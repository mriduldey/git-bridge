import type {
  DiagnosticContext,
  DiagnosticEvent,
  DiagnosticEventKind,
  DiagnosticSubscriber,
  DiagnosticsService
} from "@repoferry/contracts/diagnostics";
import type { Metadata } from "@repoferry/contracts/metadata";
import type { DeepReadonly, JsonValue } from "@repoferry/contracts/types";
import { UnexpectedError, ValidationError, type ErrorDiagnostics } from "@repoferry/errors";
import { deepFreeze } from "@repoferry/shared";

export type {
  DiagnosticContext,
  DiagnosticEvent,
  DiagnosticEventKind,
  DiagnosticSubscriber,
  DiagnosticsService
} from "@repoferry/contracts/diagnostics";
export type { ErrorDiagnostics } from "@repoferry/errors";

export const ObservabilitySchemaVersion = "1.0";

export type StructuredMetadata = Readonly<Record<string, JsonValue>>;

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export type LogRecord = DeepReadonly<{
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  requestId?: string;
  fields?: StructuredMetadata;
}>;

export type LogSink = (record: LogRecord) => Promise<void> | void;

export type LoggerOptions = Readonly<{
  minimumLevel?: LogLevel;
  sink?: LogSink;
}>;

export interface Logger {
  readonly minimumLevel: LogLevel;
  debug(message: string, fields?: StructuredMetadata): Promise<void>;
  error(message: string, fields?: StructuredMetadata): Promise<void>;
  fatal(message: string, fields?: StructuredMetadata): Promise<void>;
  info(message: string, fields?: StructuredMetadata): Promise<void>;
  isEnabled(level: LogLevel): boolean;
  log(record: LogRecord): Promise<void>;
  trace(message: string, fields?: StructuredMetadata): Promise<void>;
  warn(message: string, fields?: StructuredMetadata): Promise<void>;
}

export interface LoggerFactory {
  createLogger(name: string, context?: StructuredMetadata): Logger;
}

export type MetricLabels = Readonly<Record<string, string | number | boolean>>;

export type MetricCategory = "operational" | "diagnostic";

export type MetricDefinition = Readonly<{
  name: string;
  category: MetricCategory;
  description?: string;
  unit?: string;
}>;

export interface Counter {
  add(value: number, labels?: MetricLabels): void;
  increment(labels?: MetricLabels): void;
}

export interface Gauge {
  decrement(value?: number, labels?: MetricLabels): void;
  increment(value?: number, labels?: MetricLabels): void;
  set(value: number, labels?: MetricLabels): void;
}

export interface Histogram {
  record(value: number, labels?: MetricLabels): void;
}

export interface MetricCollector {
  counter(definition: MetricDefinition): Counter;
  gauge(definition: MetricDefinition): Gauge;
  histogram(definition: MetricDefinition): Histogram;
}

export type SpanStatus = "unset" | "ok" | "error";

export type SpanAttributes = StructuredMetadata;

export type SpanContext = DeepReadonly<{
  traceId: string;
  spanId: string;
  correlationId?: string;
  parentSpanId?: string;
  operationName: string;
  startTime: string;
  endTime?: string;
}>;

export type SpanEvent = DeepReadonly<{
  name: string;
  timestamp: string;
  attributes?: SpanAttributes;
}>;

export interface Span {
  readonly context: SpanContext;
  readonly status: SpanStatus;
  addEvent(name: string, attributes?: SpanAttributes): void;
  end(endTime?: Date | string): SpanContext;
  isRecording(): boolean;
  setAttribute(name: string, value: JsonValue): void;
  setStatus(status: SpanStatus): void;
}

export type StartSpanOptions = Readonly<{
  attributes?: SpanAttributes;
  correlationId?: string;
  parent?: Span | SpanContext;
  startTime?: Date | string;
}>;

export interface Tracer {
  startSpan(operationName: string, options?: StartSpanOptions): Span;
}

export type DiagnosticEventInput = Readonly<{
  id: string;
  kind: DiagnosticEventKind;
  name: string;
  context?: DiagnosticContext;
  data?: StructuredMetadata;
  schemaVersion?: string;
  timestamp?: Date | string;
}>;

export type DiagnosticsServiceOptions = Readonly<{
  onSubscriberError?: (error: UnexpectedError, event: DiagnosticEvent) => Promise<void> | void;
}>;

export type StructuredDiagnosticContext = DeepReadonly<{
  operation?: ErrorDiagnostics["operation"];
  provider?: ErrorDiagnostics["provider"];
  repository?: ErrorDiagnostics["repository"];
  transport?: ErrorDiagnostics["transport"];
  metadata?: Metadata;
}>;

const logLevelPriority: Readonly<Record<LogLevel, number>> = deepFreeze({
  debug: 1,
  error: 4,
  fatal: 5,
  info: 2,
  trace: 0,
  warn: 3
});

const sensitiveKeyPattern = /(?:authorization|credential|password|secret|token|api[-_]?key)/iu;
const redactedValue = "[REDACTED]";

export function createDiagnosticContext(input: StructuredDiagnosticContext): DiagnosticContext {
  const context: {
    operation?: string;
    capability?: string;
    provider?: string;
    repository?: string;
    reference?: string;
    path?: string;
    correlationId?: string;
    metadata?: Metadata;
  } = {};

  if (input.operation?.operation !== undefined) {
    context.operation = input.operation.operation;
  }

  if (input.operation?.capability !== undefined) {
    context.capability = input.operation.capability;
  }

  if (input.operation?.correlationId !== undefined) {
    context.correlationId = input.operation.correlationId;
  }

  if (input.repository?.provider !== undefined) {
    context.provider = input.repository.provider;
  } else if (input.provider?.provider !== undefined) {
    context.provider = input.provider.provider;
  }

  if (input.repository?.repository !== undefined) {
    context.repository = input.repository.repository;
  }

  if (input.repository?.reference !== undefined) {
    context.reference = input.repository.reference;
  }

  if (input.repository?.path !== undefined) {
    context.path = input.repository.path;
  }

  if (input.metadata !== undefined) {
    context.metadata = sanitizeMetadata(input.metadata);
  }

  return deepFreeze(context) as DiagnosticContext;
}

export function createDiagnosticEvent(input: DiagnosticEventInput): DiagnosticEvent {
  assertNonEmpty(input.id, "Diagnostic event id must be a non-empty string");
  assertNonEmpty(input.name, "Diagnostic event name must be a non-empty string");

  const event: {
    id: string;
    kind: DiagnosticEventKind;
    name: string;
    schemaVersion: string;
    timestamp: string;
    context?: DiagnosticContext;
    data?: StructuredMetadata;
  } = {
    id: input.id,
    kind: input.kind,
    name: input.name,
    schemaVersion: input.schemaVersion ?? ObservabilitySchemaVersion,
    timestamp: normalizeTimestamp(input.timestamp)
  };

  if (input.context !== undefined) {
    event.context = deepFreeze(input.context) as DiagnosticContext;
  }

  if (input.data !== undefined) {
    event.data = sanitizeMetadata(input.data);
  }

  return deepFreeze(event) as DiagnosticEvent;
}

export function createDiagnosticsService(
  options: DiagnosticsServiceOptions = {}
): DiagnosticsService {
  const subscribers = new Set<DiagnosticSubscriber>();

  const service: DiagnosticsService = {
    async publish(event: DiagnosticEvent) {
      const safeEvent = deepFreeze(event) as DiagnosticEvent;

      for (const subscriber of subscribers) {
        try {
          await subscriber(safeEvent);
        } catch (error: unknown) {
          await options.onSubscriberError?.(
            new UnexpectedError("Diagnostic subscriber failed", {
              cause: error,
              diagnostics: {
                operation: { operation: "diagnostics.publish" },
                extra: { eventId: safeEvent.id, eventName: safeEvent.name }
              }
            }),
            safeEvent
          );
        }
      }
    },
    async subscribe(subscriber: DiagnosticSubscriber) {
      subscribers.add(subscriber);

      return async () => {
        subscribers.delete(subscriber);
      };
    }
  };

  return deepFreeze(service) as DiagnosticsService;
}

export function createNoopDiagnosticsService(): DiagnosticsService {
  const service: DiagnosticsService = {
    async publish() {
      return undefined;
    },
    async subscribe() {
      return async () => undefined;
    }
  };

  return deepFreeze(service) as DiagnosticsService;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const minimumLevel = options.minimumLevel ?? "info";
  const sink = options.sink;

  const logger: Logger = {
    minimumLevel,
    debug(message, fields) {
      return logger.log(createLogRecord("debug", message, fields));
    },
    error(message, fields) {
      return logger.log(createLogRecord("error", message, fields));
    },
    fatal(message, fields) {
      return logger.log(createLogRecord("fatal", message, fields));
    },
    info(message, fields) {
      return logger.log(createLogRecord("info", message, fields));
    },
    isEnabled(level) {
      return logLevelPriority[level] >= logLevelPriority[minimumLevel];
    },
    async log(record) {
      if (!logger.isEnabled(record.level)) {
        return;
      }

      await sink?.(serializeLogRecord(record));
    },
    trace(message, fields) {
      return logger.log(createLogRecord("trace", message, fields));
    },
    warn(message, fields) {
      return logger.log(createLogRecord("warn", message, fields));
    }
  };

  return deepFreeze(logger) as Logger;
}

export function createNoopLogger(): Logger {
  return createLogger({ minimumLevel: "fatal" });
}

export function createLoggerFactory(options: LoggerOptions = {}): LoggerFactory {
  const factory: LoggerFactory = {
    createLogger(name: string, context: StructuredMetadata = {}) {
      assertNonEmpty(name, "Logger name must be a non-empty string");
      const base = sanitizeMetadata({ ...context, logger: name });
      const logger = createLogger(options);

      return createLogger({
        minimumLevel: logger.minimumLevel,
        sink: (record) => logger.log(mergeLogFields(record, base))
      });
    }
  };

  return deepFreeze(factory) as LoggerFactory;
}

export function createLogRecord(
  level: LogLevel,
  message: string,
  fields?: StructuredMetadata,
  timestamp?: Date | string
): LogRecord {
  assertNonEmpty(message, "Log message must be a non-empty string");

  const record: {
    level: LogLevel;
    message: string;
    timestamp: string;
    correlationId?: string;
    requestId?: string;
    fields?: StructuredMetadata;
  } = {
    level,
    message,
    timestamp: normalizeTimestamp(timestamp)
  };

  const safeFields = sanitizeMetadata(fields ?? {});

  if (typeof safeFields.correlationId === "string") {
    record.correlationId = safeFields.correlationId;
  }

  if (typeof safeFields.requestId === "string") {
    record.requestId = safeFields.requestId;
  }

  if (Reflect.ownKeys(safeFields).length > 0) {
    record.fields = safeFields;
  }

  return deepFreeze(record) as LogRecord;
}

export function serializeLogRecord(record: LogRecord): LogRecord {
  return createLogRecord(record.level, record.message, record.fields, record.timestamp);
}

export function createMetricCollector(): MetricCollector {
  return createNoopMetricCollector();
}

export function createNoopMetricCollector(): MetricCollector {
  const counter: Counter = deepFreeze({
    add(value: number) {
      assertFiniteNumber(value, "Counter value must be finite");
    },
    increment() {
      return undefined;
    }
  }) as Counter;

  const gauge: Gauge = deepFreeze({
    decrement(value = 1) {
      assertFiniteNumber(value, "Gauge value must be finite");
    },
    increment(value = 1) {
      assertFiniteNumber(value, "Gauge value must be finite");
    },
    set(value: number) {
      assertFiniteNumber(value, "Gauge value must be finite");
    }
  }) as Gauge;

  const histogram: Histogram = deepFreeze({
    record(value: number) {
      assertFiniteNumber(value, "Histogram value must be finite");
    }
  }) as Histogram;

  const collector: MetricCollector = {
    counter(definition) {
      assertMetricDefinition(definition);
      return counter;
    },
    gauge(definition) {
      assertMetricDefinition(definition);
      return gauge;
    },
    histogram(definition) {
      assertMetricDefinition(definition);
      return histogram;
    }
  };

  return deepFreeze(collector) as MetricCollector;
}

export function createTracer(): Tracer {
  const tracer: Tracer = {
    startSpan(operationName: string, options: StartSpanOptions = {}) {
      assertNonEmpty(operationName, "Span operation name must be a non-empty string");

      return createSpan(operationName, options, true);
    }
  };

  return deepFreeze(tracer) as Tracer;
}

export function createNoopTracer(): Tracer {
  const tracer: Tracer = {
    startSpan(operationName: string, options: StartSpanOptions = {}) {
      assertNonEmpty(operationName, "Span operation name must be a non-empty string");

      return createSpan(operationName, options, false);
    }
  };

  return deepFreeze(tracer) as Tracer;
}

export function sanitizeMetadata(metadata: Readonly<Record<string, unknown>>): StructuredMetadata {
  const result: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(metadata)) {
    result[key] = sensitiveKeyPattern.test(key) ? redactedValue : toJsonValue(value);
  }

  return deepFreeze(result) as StructuredMetadata;
}

function createSpan(operationName: string, options: StartSpanOptions, recording: boolean): Span {
  const parentContext = getParentContext(options.parent);
  const traceId = parentContext?.traceId ?? createId("trace");
  const spanId = createId("span");
  const attributes = new Map<string, JsonValue>();
  const events: SpanEvent[] = [];
  let status: SpanStatus = "unset";
  let context: SpanContext = deepFreeze({
    correlationId: options.correlationId ?? parentContext?.correlationId,
    operationName,
    parentSpanId: parentContext?.spanId,
    spanId,
    startTime: normalizeTimestamp(options.startTime),
    traceId
  }) as SpanContext;
  let ended = false;

  for (const [key, value] of Object.entries(options.attributes ?? {})) {
    attributes.set(key, value);
  }

  const span: Span = {
    get context() {
      return context;
    },
    get status() {
      return status;
    },
    addEvent(name, eventAttributes) {
      if (!recording || ended) {
        return;
      }

      assertNonEmpty(name, "Span event name must be a non-empty string");
      const event: {
        name: string;
        timestamp: string;
        attributes?: SpanAttributes;
      } = {
        name,
        timestamp: normalizeTimestamp(undefined)
      };

      if (eventAttributes !== undefined) {
        event.attributes = sanitizeMetadata(eventAttributes);
      }

      events.push(deepFreeze(event) as SpanEvent);
    },
    end(endTime) {
      if (ended) {
        return context;
      }

      ended = true;
      context = deepFreeze({
        ...context,
        endTime: normalizeTimestamp(endTime)
      }) as SpanContext;

      return context;
    },
    isRecording() {
      return recording && !ended;
    },
    setAttribute(name, value) {
      if (!recording || ended) {
        return;
      }

      assertNonEmpty(name, "Span attribute name must be a non-empty string");
      attributes.set(name, toJsonValue(value));
    },
    setStatus(nextStatus) {
      if (!recording || ended) {
        return;
      }

      status = nextStatus;
    }
  };

  return Object.freeze(span) as Span;
}

function mergeLogFields(record: LogRecord, fields: StructuredMetadata): LogRecord {
  return createLogRecord(
    record.level,
    record.message,
    {
      ...fields,
      ...(record.fields ?? {})
    },
    record.timestamp
  );
}

function getParentContext(parent: Span | SpanContext | undefined): SpanContext | undefined {
  if (parent === undefined) {
    return undefined;
  }

  if ("context" in parent) {
    return parent.context;
  }

  return parent;
}

function assertMetricDefinition(definition: MetricDefinition): void {
  assertNonEmpty(definition.name, "Metric name must be a non-empty string");
}

function assertFiniteNumber(value: number, message: string): void {
  if (!Number.isFinite(value)) {
    throw new ValidationError(message, {
      diagnostics: { operation: { operation: "observability.metric.validate" } }
    });
  }
}

function assertNonEmpty(value: string, message: string): void {
  if (value.trim() === "") {
    throw new ValidationError(message, {
      diagnostics: { operation: { operation: "observability.validate" } }
    });
  }
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeTimestamp(timestamp: Date | string | undefined): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  if (timestamp !== undefined) {
    const parsed = Date.parse(timestamp);

    if (Number.isNaN(parsed)) {
      throw new ValidationError("Timestamp must be a valid ISO-8601 value", {
        diagnostics: { operation: { operation: "observability.timestamp.normalize" } }
      });
    }

    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (value instanceof Error) {
    return { name: value.name };
  }

  if (typeof value === "object") {
    const result: Record<string, JsonValue> = {};

    for (const [key, child] of Object.entries(value)) {
      result[key] = sensitiveKeyPattern.test(key) ? redactedValue : toJsonValue(child);
    }

    return result;
  }

  return String(value);
}
