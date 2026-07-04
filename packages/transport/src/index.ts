import type {
  Metadata,
  Transport,
  TransportContext,
  TransportRequest,
  TransportResponse
} from "@gitbridge/contracts";
import {
  CancellationError,
  GitBridgeError,
  NetworkError,
  TimeoutError,
  TransportError
} from "@gitbridge/errors";
import { deepFreeze, sleep } from "@gitbridge/shared";

export type {
  Transport,
  TransportBody,
  TransportContext,
  TransportMethod,
  TransportRequest,
  TransportResponse
} from "@gitbridge/contracts/transport";

export type TransportExecutor = <TBody = unknown>(
  request: TransportRequest,
  context?: TransportContext
) => Promise<TransportResponse<TBody>>;

export type TransportMiddleware = (
  request: TransportRequest,
  context: TransportContext | undefined,
  next: TransportExecutor
) => Promise<TransportResponse>;

export interface TransportPipeline extends Transport {
  dispatch<TBody = unknown>(
    request: TransportRequest,
    context?: TransportContext
  ): Promise<TransportResponse<TBody>>;
}

export type TransportPipelineOptions = Readonly<{
  middleware?: readonly TransportMiddleware[];
  transport: Transport;
}>;

export type RetryDecision = boolean | Readonly<{ retry: boolean; delayMs?: number }>;

export type RetryDelayStrategy = (
  attempt: number,
  error: GitBridgeError,
  request: TransportRequest
) => number;

export type RetryPredicate = (
  error: GitBridgeError,
  request: TransportRequest,
  attempt: number
) => RetryDecision;

export type RetryJitter = boolean | ((delayMs: number, attempt: number) => number);

export type RetryPolicy = Readonly<{
  maxAttempts: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  jitter?: RetryJitter;
  retryUnsafe?: boolean;
  delayStrategy?: RetryDelayStrategy;
  shouldRetry?: RetryPredicate;
}>;

export type TimeoutOptions = Readonly<{
  timeoutMs: number;
}>;

export type CancellationSource = Readonly<{
  signal: AbortSignal;
  abort(reason?: unknown): void;
  dispose(): void;
}>;

export type CompressionAlgorithm = "br" | "deflate" | "gzip";

export type CompressionNegotiation = Readonly<{
  acceptEncoding: string;
  algorithms: readonly CompressionAlgorithm[];
}>;

const defaultRetryPolicy: RetryPolicy = deepFreeze({
  backoffMultiplier: 2,
  baseDelayMs: 0,
  maxAttempts: 3
});

export function createTransportRequest(request: TransportRequest): TransportRequest {
  return freezeRequest(request);
}

export function createTransportResponse<TBody = unknown>(
  response: TransportResponse<TBody>
): TransportResponse<TBody> {
  return deepFreeze(response) as TransportResponse<TBody>;
}

export function withTransportHeaders(
  request: TransportRequest,
  headers: Readonly<Record<string, string>>
): TransportRequest {
  return freezeRequest({
    ...request,
    headers: deepFreeze({
      ...request.headers,
      ...headers
    })
  });
}

export function withTransportMetadata(
  request: TransportRequest,
  metadata: Metadata
): TransportRequest {
  return freezeRequest({
    ...request,
    metadata: deepFreeze({
      ...request.metadata,
      ...metadata,
      extra: {
        ...request.metadata?.extra,
        ...metadata.extra
      }
    })
  });
}

export function createTransportPipeline(options: TransportPipelineOptions): TransportPipeline {
  const execute = composeTransportMiddleware(
    options.middleware ?? [],
    async <TBody = unknown>(request: TransportRequest, context?: TransportContext) =>
      options.transport.execute<TBody>(request, context)
  );

  return deepFreeze({
    dispatch<TBody = unknown>(request: TransportRequest, context?: TransportContext) {
      return execute<TBody>(freezeRequest(request), freezeContext(context));
    },
    execute<TBody = unknown>(request: TransportRequest, context?: TransportContext) {
      return execute<TBody>(freezeRequest(request), freezeContext(context));
    }
  });
}

export function composeTransportMiddleware(
  middleware: readonly TransportMiddleware[],
  terminal: TransportExecutor
): TransportExecutor {
  return middleware.reduceRight<TransportExecutor>(
    (next, current) =>
      async <TBody = unknown>(request: TransportRequest, context?: TransportContext) =>
        (await current(request, context, next)) as TransportResponse<TBody>,
    terminal
  );
}

export function createRetryMiddleware(policy: Partial<RetryPolicy> = {}): TransportMiddleware {
  const resolved = resolveRetryPolicy(policy);

  return async (request, context, next) => {
    let attempt = 1;

    while (true) {
      throwIfAborted(request.signal);

      try {
        return await next(request, context);
      } catch (error: unknown) {
        const mapped = mapTransportError(error);

        if (!shouldRetryAttempt(mapped, request, attempt, resolved)) {
          throw mapped;
        }

        const delayMs = getRetryDelayMs(attempt, mapped, request, resolved);
        attempt += 1;

        if (delayMs > 0) {
          await sleep(delayMs, request.signal);
        }
      }
    }
  };
}

export function createTimeoutMiddleware(options?: Partial<TimeoutOptions>): TransportMiddleware {
  return async (request, context, next) => {
    const timeoutMs = options?.timeoutMs ?? request.timeoutMs;

    if (timeoutMs === undefined) {
      return next(request, context);
    }

    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      throw new TransportError("Transport timeout must be a non-negative finite number", {
        diagnostics: { transport: { timeoutMs } },
        retryability: "Never"
      });
    }

    const timeoutReason = new TimeoutError("Transport request timed out", {
      diagnostics: { transport: { timeoutMs } }
    });
    const timeout =
      request.signal === undefined
        ? createCancellationSource({ reason: timeoutReason, timeoutMs })
        : createCancellationSource({
            parent: request.signal as AbortSignal,
            reason: timeoutReason,
            timeoutMs
          });

    try {
      return await raceWithSignal(
        () => next(withAbortSignal(request, timeout.signal), context),
        timeout.signal
      );
    } catch (error: unknown) {
      throw timeout.signal.aborted
        ? mapAbortSignalError(timeout.signal, error, timeoutMs)
        : mapTransportError(error);
    } finally {
      timeout.dispose();
    }
  };
}

export function createRequestIdMiddleware(
  createRequestId: () => string = createDefaultRequestId
): TransportMiddleware {
  return async (request, context, next) => {
    const requestId = request.id ?? request.metadata?.requestId ?? createRequestId();
    const nextRequest = withTransportMetadata(
      {
        ...request,
        id: requestId
      },
      { requestId }
    );

    return next(nextRequest, context);
  };
}

export function createUserAgentMiddleware(userAgent: string): TransportMiddleware {
  return async (request, context, next) =>
    next(withTransportHeaders(request, { "user-agent": userAgent }), context);
}

export function createCompressionNegotiation(
  algorithms: readonly CompressionAlgorithm[]
): CompressionNegotiation {
  const unique = [...new Set(algorithms)];

  return deepFreeze({
    acceptEncoding: unique.join(", "),
    algorithms: unique
  });
}

export function createCompressionMiddleware(
  negotiation: CompressionNegotiation
): TransportMiddleware {
  return async (request, context, next) => {
    if (negotiation.algorithms.length === 0) {
      return next(request, context);
    }

    return next(
      withTransportHeaders(request, { "accept-encoding": negotiation.acceptEncoding }),
      context
    );
  };
}

export function createNoopTransport(
  response: TransportResponse = createTransportResponse({ status: 204 })
): Transport {
  return deepFreeze({
    async execute<TBody = unknown>() {
      return response as TransportResponse<TBody>;
    }
  });
}

export function createCancellationSource(
  options: {
    parent?: AbortSignal;
    reason?: unknown;
    timeoutMs?: number;
  } = {}
): CancellationSource {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const abort = (reason?: unknown): void => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  const onParentAbort = (): void => {
    abort(options.parent?.reason);
  };

  if (options.parent?.aborted === true) {
    abort(options.parent.reason);
  } else {
    options.parent?.addEventListener("abort", onParentAbort, { once: true });
  }

  if (options.timeoutMs !== undefined) {
    timeout = setTimeout(() => {
      abort(options.reason);
    }, options.timeoutMs);
  }

  const dispose = (): void => {
    if (timeout !== undefined) {
      clearTimeout(timeout);
      timeout = undefined;
    }

    options.parent?.removeEventListener("abort", onParentAbort);
  };

  return Object.freeze({
    abort,
    dispose,
    signal: controller.signal
  });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted === true) {
    throw createCancellationError(signal.reason);
  }
}

export function mapTransportError(error: unknown): GitBridgeError {
  if (error instanceof GitBridgeError) {
    return error;
  }

  if (isAbortError(error)) {
    return createCancellationError(error);
  }

  if (isNetworkLikeError(error)) {
    return new NetworkError("Transport network failure", { cause: error });
  }

  return new TransportError("Transport execution failed", { cause: error });
}

function freezeRequest(request: TransportRequest): TransportRequest {
  const frozenRequest = {
    ...request,
    headers: request.headers === undefined ? undefined : deepFreeze(request.headers),
    metadata: request.metadata === undefined ? undefined : deepFreeze(request.metadata)
  };

  return Object.freeze(frozenRequest) as TransportRequest;
}

function freezeContext(context: TransportContext | undefined): TransportContext | undefined {
  return context === undefined ? undefined : (deepFreeze(context) as TransportContext);
}

function withAbortSignal(request: TransportRequest, signal: AbortSignal): TransportRequest {
  return freezeRequest({
    ...request,
    signal
  });
}

function resolveRetryPolicy(policy: Partial<RetryPolicy>): RetryPolicy {
  return deepFreeze({
    ...defaultRetryPolicy,
    ...policy,
    maxAttempts: policy.maxAttempts ?? defaultRetryPolicy.maxAttempts
  });
}

function shouldRetryAttempt(
  error: GitBridgeError,
  request: TransportRequest,
  attempt: number,
  policy: RetryPolicy
): boolean {
  if (request.signal?.aborted === true) {
    throw createCancellationError(request.signal.reason);
  }

  if (error instanceof CancellationError || attempt >= policy.maxAttempts) {
    return false;
  }

  if (!policy.retryUnsafe && !isRetrySafe(request)) {
    return false;
  }

  const decision = policy.shouldRetry?.(error, request, attempt);

  if (typeof decision === "boolean") {
    return decision;
  }

  if (decision !== undefined) {
    return decision.retry;
  }

  return error.retryability === "Always" || error.retryability === "Maybe";
}

function getRetryDelayMs(
  attempt: number,
  error: GitBridgeError,
  request: TransportRequest,
  policy: RetryPolicy
): number {
  const decision = policy.shouldRetry?.(error, request, attempt);

  if (typeof decision === "object" && decision.delayMs !== undefined) {
    return Math.max(0, decision.delayMs);
  }

  const strategyDelay = policy.delayStrategy?.(attempt, error, request);

  if (strategyDelay !== undefined) {
    return Math.max(0, strategyDelay);
  }

  const baseDelayMs = policy.baseDelayMs ?? 0;
  const multiplier = policy.backoffMultiplier ?? 1;
  const exponentialDelay = baseDelayMs * multiplier ** (attempt - 1);
  const cappedDelay =
    policy.maxDelayMs === undefined
      ? exponentialDelay
      : Math.min(exponentialDelay, policy.maxDelayMs);

  return applyJitter(cappedDelay, attempt, policy.jitter);
}

function applyJitter(delayMs: number, attempt: number, jitter: RetryJitter | undefined): number {
  if (typeof jitter === "function") {
    return Math.max(0, jitter(delayMs, attempt));
  }

  if (jitter === true) {
    return Math.max(0, Math.floor(Math.random() * (delayMs + 1)));
  }

  return Math.max(0, delayMs);
}

function isRetrySafe(request: TransportRequest): boolean {
  if (request.method === "read" || request.method === "stream") {
    return true;
  }

  return request.metadata?.extra?.idempotent === true;
}

function createCancellationError(reason: unknown): CancellationError {
  return new CancellationError("Transport request was cancelled", {
    cause: reason,
    diagnostics: {
      transport: {
        cancelled: true
      }
    }
  });
}

function mapTimeoutAbort(error: unknown, timeoutMs: number): GitBridgeError {
  if (error instanceof TimeoutError) {
    return error;
  }

  if (error instanceof CancellationError) {
    return new TimeoutError("Transport request timed out", {
      cause: error,
      diagnostics: { transport: { timeoutMs } }
    });
  }

  if (isAbortError(error)) {
    return new TimeoutError("Transport request timed out", {
      cause: error,
      diagnostics: { transport: { timeoutMs } }
    });
  }

  return mapTransportError(error);
}

function mapAbortSignalError(
  signal: AbortSignal,
  error: unknown,
  timeoutMs: number
): GitBridgeError {
  if (signal.reason instanceof TimeoutError) {
    return mapTimeoutAbort(error, timeoutMs);
  }

  return createCancellationError(signal.reason ?? error);
}

function raceWithSignal<T>(
  operationFactory: () => PromiseLike<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise<T>((resolve, reject) => {
    let aborted = false;
    const onAbort = (): void => {
      aborted = true;
      reject(signal.reason);
    };

    signal.addEventListener("abort", onAbort, { once: true });

    let operationPromise: Promise<T>;

    try {
      operationPromise = Promise.resolve(operationFactory());
    } catch (error: unknown) {
      signal.removeEventListener("abort", onAbort);
      reject(error);
      return;
    }

    operationPromise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        if (!aborted) {
          resolve(value);
        }
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        if (!aborted) {
          reject(error);
        }
      }
    );
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isNetworkLikeError(error: unknown): boolean {
  return error instanceof TypeError || (error instanceof Error && "code" in error);
}

function createDefaultRequestId(): string {
  return crypto.randomUUID();
}
