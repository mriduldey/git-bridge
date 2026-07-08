import { CancellationError, TimeoutError, TransportError } from "@repoferry/errors";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  composeTransportMiddleware,
  createCancellationSource,
  createCompressionMiddleware,
  createCompressionNegotiation,
  createNoopTransport,
  createRequestIdMiddleware,
  createRetryMiddleware,
  createTimeoutMiddleware,
  createTransportPipeline,
  createTransportRequest,
  createTransportResponse,
  createUserAgentMiddleware,
  mapTransportError,
  throwIfAborted,
  withTransportHeaders,
  type RetryPolicy,
  type Transport,
  type TransportContext,
  type TransportExecutor,
  type TransportMiddleware,
  type TransportPipeline,
  type TransportRequest,
  type TransportResponse
} from "../src/index.js";

const request = createTransportRequest({
  method: "read",
  target: "memory://repo/README.md"
});

describe("transport pipeline", () => {
  it("executes middleware in deterministic before and after order", async () => {
    const events: string[] = [];
    const middleware =
      (name: string): TransportMiddleware =>
      async (nextRequest, context, next) => {
        events.push(`${name}:before`);
        const response = await next(nextRequest, context);
        events.push(`${name}:after`);
        return response;
      };
    const transport: Transport = {
      async execute() {
        events.push("transport");
        return createTransportResponse({ status: 200 });
      }
    };

    await createTransportPipeline({
      middleware: [middleware("one"), middleware("two")],
      transport
    }).execute(request);

    expect(events).toEqual(["one:before", "two:before", "transport", "two:after", "one:after"]);
  });

  it("allows middleware to derive requests without mutating the original", async () => {
    let observed: TransportRequest | undefined;
    const original = createTransportRequest({
      headers: { existing: "true" },
      method: "read",
      target: "memory://repo/file"
    });
    const transport: Transport = {
      async execute(nextRequest) {
        observed = nextRequest;
        return createTransportResponse({ status: 200 });
      }
    };

    await createTransportPipeline({
      middleware: [createUserAgentMiddleware("repoferry-test")],
      transport
    }).execute(original);

    expect(original.headers).toEqual({ existing: "true" });
    expect(observed?.headers).toEqual({ existing: "true", "user-agent": "repoferry-test" });
    expect(Object.isFrozen(original)).toBe(true);
    expect(Object.isFrozen(observed)).toBe(true);
  });

  it("propagates middleware errors and skips later execution", async () => {
    const transport = { execute: vi.fn() };
    const error = new TransportError("middleware failed");

    await expect(
      createTransportPipeline({
        middleware: [
          async () => {
            throw error;
          }
        ],
        transport
      }).execute(request)
    ).rejects.toBe(error);
    expect(transport.execute).not.toHaveBeenCalled();
  });

  it("supports short-circuiting with an immutable response", async () => {
    const transport = { execute: vi.fn() };
    const response = await createTransportPipeline({
      middleware: [async () => createTransportResponse({ body: "cached", status: 200 })],
      transport
    }).execute<string>(request);

    expect(response).toEqual({ body: "cached", status: 200 });
    expect(Object.isFrozen(response)).toBe(true);
    expect(transport.execute).not.toHaveBeenCalled();
  });
});

describe("retry middleware", () => {
  it("retries retryable safe requests until success", async () => {
    const transport = {
      execute: vi
        .fn()
        .mockRejectedValueOnce(new TransportError("network", { retryability: "Maybe" }))
        .mockResolvedValueOnce(createTransportResponse({ status: 200 }))
    };

    const response = await createTransportPipeline({
      middleware: [createRetryMiddleware({ baseDelayMs: 0, maxAttempts: 2 })],
      transport
    }).execute(request);

    expect(response.status).toBe(200);
    expect(transport.execute).toHaveBeenCalledTimes(2);
  });

  it("preserves the final mapped error when retries are exhausted", async () => {
    const final = new TransportError("still down", { retryability: "Maybe" });
    const transport = {
      execute: vi.fn().mockRejectedValue(new TypeError("fetch failed"))
    };

    transport.execute
      .mockRejectedValueOnce(new TransportError("down", { retryability: "Maybe" }))
      .mockRejectedValueOnce(final);

    await expect(
      createTransportPipeline({
        middleware: [createRetryMiddleware({ baseDelayMs: 0, maxAttempts: 2 })],
        transport
      }).execute(request)
    ).rejects.toBe(final);
    expect(transport.execute).toHaveBeenCalledTimes(2);
  });

  it("does not retry unsafe requests unless marked idempotent", async () => {
    const transport = {
      execute: vi.fn().mockRejectedValue(new TransportError("network", { retryability: "Maybe" }))
    };

    await expect(
      createTransportPipeline({
        middleware: [createRetryMiddleware({ maxAttempts: 3 })],
        transport
      }).execute({ method: "write", target: "memory://repo/file" })
    ).rejects.toBeInstanceOf(TransportError);
    expect(transport.execute).toHaveBeenCalledTimes(1);

    await expect(
      createTransportPipeline({
        middleware: [createRetryMiddleware({ maxAttempts: 3 })],
        transport
      }).execute({
        metadata: { extra: { idempotent: true } },
        method: "write",
        target: "memory://repo/file"
      })
    ).rejects.toBeInstanceOf(TransportError);
    expect(transport.execute).toHaveBeenCalledTimes(4);
  });

  it("stops retrying when cancellation is observed", async () => {
    const controller = new AbortController();
    const transport = {
      execute: vi.fn().mockImplementation(() => {
        controller.abort(new Error("stop"));
        throw new TransportError("network", { retryability: "Maybe" });
      })
    };

    await expect(
      createTransportPipeline({
        middleware: [createRetryMiddleware({ maxAttempts: 3 })],
        transport
      }).execute({ ...request, signal: controller.signal })
    ).rejects.toBeInstanceOf(CancellationError);
    expect(transport.execute).toHaveBeenCalledTimes(1);
  });
});

describe("timeout and cancellation", () => {
  it("implements timeout as AbortSignal cancellation and maps it to TimeoutError", async () => {
    const observed: AbortSignal[] = [];
    const transport: Transport = {
      async execute(nextRequest) {
        observed.push(nextRequest.signal as AbortSignal);

        return new Promise(() => undefined);
      }
    };

    await expect(
      createTransportPipeline({
        middleware: [createTimeoutMiddleware({ timeoutMs: 1 })],
        transport
      }).execute(request)
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(observed).toHaveLength(1);
    expect(observed[0]?.aborted).toBe(true);
  });

  it("propagates caller abort signals through the pipeline", async () => {
    const controller = new AbortController();
    let observed: AbortSignal | undefined;
    const transport: Transport = {
      async execute(nextRequest) {
        observed = nextRequest.signal;
        return new Promise((_, reject) => {
          nextRequest.signal?.addEventListener(
            "abort",
            () => {
              reject(nextRequest.signal?.reason);
            },
            { once: true }
          );
          controller.abort("caller");
        });
      }
    };

    await expect(
      createTransportPipeline({
        middleware: [createTimeoutMiddleware({ timeoutMs: 100 })],
        transport
      }).execute({ ...request, signal: controller.signal })
    ).rejects.toBeInstanceOf(CancellationError);
    expect(observed?.aborted).toBe(true);
  });

  it("creates disposable composed cancellation sources", () => {
    const parent = new AbortController();
    const source = createCancellationSource({ parent: parent.signal });

    parent.abort("done");

    expect(source.signal.aborted).toBe(true);
    expect(() => source.dispose()).not.toThrow();
  });
});

describe("request metadata middleware", () => {
  it("adds request ids immutably", async () => {
    let observed: TransportRequest | undefined;

    await createTransportPipeline({
      middleware: [createRequestIdMiddleware(() => "req-1")],
      transport: {
        async execute(nextRequest) {
          observed = nextRequest;
          return createTransportResponse({ status: 200 });
        }
      }
    }).execute(request);

    expect(request.id).toBeUndefined();
    expect(observed?.id).toBe("req-1");
    expect(observed?.metadata?.requestId).toBe("req-1");
  });

  it("adds user-agent and compression negotiation headers", async () => {
    let observed: TransportRequest | undefined;
    const negotiation = createCompressionNegotiation(["gzip", "br", "gzip"]);

    await createTransportPipeline({
      middleware: [createUserAgentMiddleware("ua"), createCompressionMiddleware(negotiation)],
      transport: {
        async execute(nextRequest) {
          observed = nextRequest;
          return createTransportResponse({ status: 200 });
        }
      }
    }).execute(request);

    expect(negotiation).toEqual({ acceptEncoding: "gzip, br", algorithms: ["gzip", "br"] });
    expect(observed?.headers).toEqual({
      "accept-encoding": "gzip, br",
      "user-agent": "ua"
    });
  });
});

describe("error mapping and utilities", () => {
  it("maps platform failures into approved transport errors while preserving cause", () => {
    const cause = new TypeError("fetch failed");
    const mapped = mapTransportError(cause);

    expect(mapped).toBeInstanceOf(TransportError);
    expect(mapped.cause).toBe(cause);
    expect(mapTransportError(new Error("boom"))).toBeInstanceOf(TransportError);
  });

  it("supports noop transport and direct composition helpers", async () => {
    const context: TransportContext = { metadata: { requestId: "ctx" } };
    const terminal: TransportExecutor = async <TBody = unknown>(
      nextRequest: TransportRequest,
      nextContext?: TransportContext
    ) =>
      createTransportResponse({
        body: nextContext?.metadata?.requestId ?? "",
        headers: nextRequest.headers ?? {},
        status: 200
      }) as unknown as TransportResponse<TBody>;
    const executor = composeTransportMiddleware(
      [
        async (nextRequest, nextContext, next) =>
          next(withTransportHeaders(nextRequest, { one: "1" }), nextContext)
      ],
      terminal
    );

    expect(await createNoopTransport().execute(request)).toEqual({ status: 204 });
    await expect(executor(request, context)).resolves.toEqual({
      body: "ctx",
      headers: { one: "1" },
      status: 200
    });
  });

  it("exports stable public types", () => {
    expectTypeOf<TransportPipeline>().toMatchTypeOf<Transport>();
    expectTypeOf<RetryPolicy>().toMatchTypeOf<{ maxAttempts: number }>();
    expectTypeOf<TransportResponse<string>>().toMatchTypeOf<TransportResponse>();
  });
});
