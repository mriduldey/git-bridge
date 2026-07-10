import { ValidationError, type UnexpectedError } from "@sourceaxis/errors";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import {
  ObservabilitySchemaVersion,
  createDiagnosticContext,
  createDiagnosticEvent,
  createDiagnosticsService,
  createLogRecord,
  createLogger,
  createLoggerFactory,
  createMetricCollector,
  createNoopDiagnosticsService,
  createNoopLogger,
  createNoopMetricCollector,
  createNoopTracer,
  createTracer,
  sanitizeMetadata,
  serializeLogRecord,
  type Counter,
  type DiagnosticEvent,
  type DiagnosticsService,
  type Gauge,
  type Histogram,
  type LogRecord,
  type Logger,
  type MetricCollector,
  type Span,
  type SpanContext,
  type Tracer
} from "../src/index.js";

describe("diagnostic events and contexts", () => {
  it("creates schema-versioned immutable provider-neutral events", () => {
    const context = createDiagnosticContext({
      metadata: { extra: { token: "secret", visible: "safe" } },
      operation: {
        capability: "contents",
        correlationId: "corr-1",
        operation: "repository.read"
      },
      provider: {
        provider: "github",
        requestId: "req-1",
        status: 200
      },
      repository: {
        path: "README.md",
        reference: "main",
        repository: "owner/repo"
      }
    });
    const event = createDiagnosticEvent({
      context,
      data: { Authorization: "Bearer secret", safe: true },
      id: "event-1",
      kind: "repository",
      name: "RepositoryRead",
      timestamp: "2026-07-02T00:00:00.000Z"
    });

    expect(event).toEqual({
      context: {
        capability: "contents",
        correlationId: "corr-1",
        metadata: { extra: { token: "[REDACTED]", visible: "safe" } },
        operation: "repository.read",
        path: "README.md",
        provider: "github",
        reference: "main",
        repository: "owner/repo"
      },
      data: {
        Authorization: "[REDACTED]",
        safe: true
      },
      id: "event-1",
      kind: "repository",
      name: "RepositoryRead",
      schemaVersion: ObservabilitySchemaVersion,
      timestamp: "2026-07-02T00:00:00.000Z"
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.context)).toBe(true);
    expect(Object.isFrozen(event.data)).toBe(true);
  });

  it("rejects invalid event identifiers and timestamps through approved errors", () => {
    expect(() => createDiagnosticEvent({ id: " ", kind: "cache", name: "CacheHit" })).toThrow(
      ValidationError
    );
    expect(() =>
      createDiagnosticEvent({ id: "event-1", kind: "cache", name: "CacheHit", timestamp: "no" })
    ).toThrow(ValidationError);
  });
});

describe("diagnostics service", () => {
  it("publishes events asynchronously in subscription order", async () => {
    const service = createDiagnosticsService();
    const event = createDiagnosticEvent({ id: "event-1", kind: "transport", name: "Started" });
    const calls: string[] = [];

    await service.subscribe(async () => {
      calls.push("first");
    });
    await service.subscribe(() => {
      calls.push("second");
    });

    await service.publish(event);

    expect(calls).toEqual(["first", "second"]);
  });

  it("isolates subscriber failures and continues publishing", async () => {
    const failures: UnexpectedError[] = [];
    const service = createDiagnosticsService({
      onSubscriberError(error) {
        failures.push(error);
      }
    });
    const received = vi.fn();

    await service.subscribe(() => {
      throw new Error("subscriber failed");
    });
    await service.subscribe(received);

    const event = createDiagnosticEvent({ id: "event-1", kind: "error", name: "ErrorOccurred" });
    await service.publish(event);

    expect(received).toHaveBeenCalledWith(event);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({
      name: "UnexpectedError",
      diagnostics: {
        extra: { eventId: "event-1", eventName: "ErrorOccurred" },
        operation: { operation: "diagnostics.publish" }
      }
    });
  });

  it("supports unsubscribe and no-op diagnostics", async () => {
    const service = createDiagnosticsService();
    const subscriber = vi.fn();
    const unsubscribe = await service.subscribe(subscriber);

    await unsubscribe();
    await service.publish(createDiagnosticEvent({ id: "event-1", kind: "provider", name: "Done" }));

    expect(subscriber).not.toHaveBeenCalled();
    await expect(
      createNoopDiagnosticsService().publish({} as DiagnosticEvent)
    ).resolves.toBeUndefined();
    await expect(createNoopDiagnosticsService().subscribe(subscriber)).resolves.toEqual(
      expect.any(Function)
    );
  });
});

describe("structured logging", () => {
  it("emits structured log records with safe serialization and redaction", async () => {
    const records: LogRecord[] = [];
    const logger = createLogger({
      minimumLevel: "debug",
      sink(record) {
        records.push(record);
      }
    });

    await logger.info("request completed", {
      correlationId: "corr-1",
      nested: { password: "secret", safe: "yes" },
      token: "secret"
    });

    expect(records).toEqual([
      expect.objectContaining({
        correlationId: "corr-1",
        fields: {
          correlationId: "corr-1",
          nested: { password: "[REDACTED]", safe: "yes" },
          token: "[REDACTED]"
        },
        level: "info",
        message: "request completed"
      })
    ]);
    expect(Object.isFrozen(records[0])).toBe(true);
  });

  it("filters below the configured level and supports no-op logging", async () => {
    const sink = vi.fn();
    const logger = createLogger({ minimumLevel: "warn", sink });

    await logger.info("hidden");
    await logger.error("visible");
    await createNoopLogger().info("ignored");

    expect(sink).toHaveBeenCalledTimes(1);
    expect(logger.isEnabled("debug")).toBe(false);
    expect(logger.isEnabled("fatal")).toBe(true);
  });

  it("creates logger factories that enrich records without owning output", async () => {
    const records: LogRecord[] = [];
    const factory = createLoggerFactory({
      minimumLevel: "trace",
      sink(record) {
        records.push(record);
      }
    });

    await factory.createLogger("transport", { component: "fetch" }).debug("started");

    expect(records[0]?.fields).toMatchObject({
      component: "fetch",
      logger: "transport"
    });
  });

  it("serializes records deterministically", () => {
    const record = createLogRecord("warn", "message", {
      apiKey: "secret"
    });

    expect(serializeLogRecord(record)).toEqual(record);
    expect(record.fields).toMatchObject({
      apiKey: "[REDACTED]"
    });
  });
});

describe("metrics", () => {
  it("provides provider-neutral no-op counters, gauges, and histograms", () => {
    const collector = createMetricCollector();
    const counter = collector.counter({ category: "operational", name: "request.count" });
    const gauge = collector.gauge({ category: "diagnostic", name: "queue.depth" });
    const histogram = collector.histogram({ category: "operational", name: "latency" });

    expect(() => counter.increment({ provider: "github" })).not.toThrow();
    expect(() => counter.add(2)).not.toThrow();
    expect(() => gauge.set(10)).not.toThrow();
    expect(() => gauge.increment()).not.toThrow();
    expect(() => gauge.decrement(2)).not.toThrow();
    expect(() => histogram.record(12.5)).not.toThrow();
    expect(createNoopMetricCollector()).toMatchObject({
      counter: expect.any(Function),
      gauge: expect.any(Function),
      histogram: expect.any(Function)
    });
  });

  it("validates metric definitions and values", () => {
    const collector = createMetricCollector();

    expect(() => collector.counter({ category: "operational", name: " " })).toThrow(
      ValidationError
    );
    expect(() =>
      collector.histogram({ category: "operational", name: "latency" }).record(Number.NaN)
    ).toThrow(ValidationError);
  });
});

describe("tracing", () => {
  it("creates nested spans with immutable context propagation", () => {
    const tracer = createTracer();
    const parent = tracer.startSpan("repository.open", {
      correlationId: "corr-1",
      startTime: "2026-07-02T00:00:00.000Z"
    });
    const child = tracer.startSpan("transport.execute", {
      parent,
      startTime: "2026-07-02T00:00:01.000Z"
    });

    child.setAttribute("timeoutMs", 1000);
    child.addEvent("request.started", { requestId: "req-1" });
    child.setStatus("ok");

    expect(child.context.traceId).toBe(parent.context.traceId);
    expect(child.context.parentSpanId).toBe(parent.context.spanId);
    expect(child.context.correlationId).toBe("corr-1");
    expect(child.status).toBe("ok");
    expect(child.isRecording()).toBe(true);

    const ended = child.end("2026-07-02T00:00:02.000Z");

    expect(ended.endTime).toBe("2026-07-02T00:00:02.000Z");
    expect(Object.isFrozen(ended)).toBe(true);
    expect(child.isRecording()).toBe(false);
  });

  it("supports no-op spans for disabled tracing", () => {
    const span = createNoopTracer().startSpan("repository.open");

    span.setStatus("error");
    span.setAttribute("token", "secret");
    span.addEvent("ignored");

    expect(span.isRecording()).toBe(false);
    expect(span.status).toBe("unset");
    expect(span.end().endTime).toEqual(expect.any(String));
  });
});

describe("metadata helpers and public exports", () => {
  it("sanitizes unsafe and non-json metadata", () => {
    expect(
      sanitizeMetadata({
        date: new Date("2026-07-02T00:00:00.000Z"),
        fn: () => "ignored",
        infinite: Number.POSITIVE_INFINITY,
        secret: "value"
      })
    ).toEqual({
      date: "2026-07-02T00:00:00.000Z",
      fn: '() => "ignored"',
      infinite: null,
      secret: "[REDACTED]"
    });
  });

  it("exports stable public contracts", () => {
    expectTypeOf<DiagnosticsService>().toHaveProperty("publish");
    expectTypeOf<Logger>().toHaveProperty("log");
    expectTypeOf<MetricCollector>().toHaveProperty("counter");
    expectTypeOf<Counter>().toHaveProperty("increment");
    expectTypeOf<Gauge>().toHaveProperty("set");
    expectTypeOf<Histogram>().toHaveProperty("record");
    expectTypeOf<Tracer>().toHaveProperty("startSpan");
    expectTypeOf<Span>().toHaveProperty("end");
    expectTypeOf<SpanContext>().toHaveProperty("traceId");
  });
});
