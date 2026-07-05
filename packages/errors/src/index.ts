/**
 * Retry guidance exposed by every public GitBridge error.
 */
export type ErrorRetryability = "Never" | "Maybe" | "Always";

/**
 * Stable public error codes. These codes are part of the compatibility contract.
 */
export const ErrorCodes = {
  Authentication: "GITBRIDGE_AUTHENTICATION",
  Authorization: "GITBRIDGE_PERMISSION_DENIED",
  Cancellation: "GITBRIDGE_CANCELLED",
  CapabilityNotSupported: "GITBRIDGE_CAPABILITY_NOT_SUPPORTED",
  Configuration: "GITBRIDGE_CONFIGURATION",
  Conflict: "GITBRIDGE_CONFLICT",
  NotFound: "GITBRIDGE_NOT_FOUND",
  Provider: "GITBRIDGE_PROVIDER",
  RateLimit: "GITBRIDGE_RATE_LIMITED",
  Repository: "GITBRIDGE_REPOSITORY",
  Timeout: "GITBRIDGE_TIMEOUT",
  Transport: "GITBRIDGE_TRANSPORT",
  Unexpected: "GITBRIDGE_UNEXPECTED",
  Validation: "GITBRIDGE_VALIDATION"
} as const;

/**
 * Stable public error code.
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Public classification for GitBridge errors.
 */
export type ErrorCategory =
  | "authentication"
  | "configuration"
  | "provider"
  | "repository"
  | "transport"
  | "unexpected"
  | "validation";

/**
 * Diagnostic severity for a GitBridge error.
 */
export type ErrorSeverity = "debug" | "info" | "warning" | "error" | "critical";

/**
 * JSON-safe primitive value accepted in diagnostics.
 */
export type DiagnosticPrimitive = string | number | boolean | null;

/**
 * JSON-safe diagnostic value accepted in public errors.
 */
export type DiagnosticValue =
  DiagnosticPrimitive | readonly DiagnosticValue[] | { readonly [key: string]: DiagnosticValue };

/**
 * Operation-level diagnostic context.
 */
export type OperationDiagnostics = Readonly<{
  operation?: string;
  capability?: string;
  retryCount?: number;
  elapsedMs?: number;
  correlationId?: string;
}>;

/**
 * Repository-level diagnostic context.
 */
export type RepositoryDiagnostics = Readonly<{
  provider?: string;
  repository?: string;
  reference?: string;
  path?: string;
}>;

/**
 * Provider-neutral diagnostic context.
 */
export type ProviderDiagnostics = Readonly<{
  provider?: string;
  requestId?: string;
  activityId?: string;
  status?: number;
  providerCode?: string;
}>;

/**
 * Transport-neutral diagnostic context.
 */
export type TransportDiagnostics = Readonly<{
  transport?: string;
  timeoutMs?: number;
  cancelled?: boolean;
  requestMethod?: string;
  requestUrl?: string;
}>;

/**
 * Safe structured diagnostic context exposed by GitBridge errors.
 */
export type ErrorDiagnostics = Readonly<{
  operation?: OperationDiagnostics;
  repository?: RepositoryDiagnostics;
  provider?: ProviderDiagnostics;
  transport?: TransportDiagnostics;
  extra?: Readonly<Record<string, DiagnosticValue>>;
}>;

/**
 * Immutable metadata exposed by every public GitBridge error.
 */
export type ErrorMetadata = Readonly<{
  code: ErrorCode;
  retryability: ErrorRetryability;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
}>;

/**
 * Constructor options shared by every public GitBridge error.
 */
export type GitBridgeErrorOptions = Readonly<{
  cause?: unknown;
  diagnostics?: ErrorDiagnostics;
  retryability?: ErrorRetryability;
  severity?: ErrorSeverity;
  timestamp?: Date | string;
}>;

/**
 * Safe serialized representation of a cause.
 */
export type SerializedCause = Readonly<{
  name: string;
  code?: ErrorCode;
}>;

/**
 * Safe serialized representation of a GitBridge error.
 */
export type SerializedGitBridgeError = Readonly<{
  name: string;
  message: string;
  code: ErrorCode;
  retryability: ErrorRetryability;
  category: ErrorCategory;
  severity: ErrorSeverity;
  timestamp: string;
  diagnostics: ErrorDiagnostics;
  cause?: SerializedGitBridgeError | SerializedCause;
}>;

type ErrorDefinition = Readonly<{
  code: ErrorCode;
  retryability: ErrorRetryability;
  category: ErrorCategory;
  severity: ErrorSeverity;
}>;

const definitions = {
  AuthenticationError: {
    category: "authentication",
    code: ErrorCodes.Authentication,
    retryability: "Never",
    severity: "error"
  },
  CancellationError: {
    category: "transport",
    code: ErrorCodes.Cancellation,
    retryability: "Never",
    severity: "info"
  },
  CapabilityNotSupportedError: {
    category: "provider",
    code: ErrorCodes.CapabilityNotSupported,
    retryability: "Never",
    severity: "warning"
  },
  ConfigurationError: {
    category: "configuration",
    code: ErrorCodes.Configuration,
    retryability: "Never",
    severity: "error"
  },
  ConflictError: {
    category: "provider",
    code: ErrorCodes.Conflict,
    retryability: "Maybe",
    severity: "warning"
  },
  GitBridgeError: {
    category: "unexpected",
    code: ErrorCodes.Unexpected,
    retryability: "Never",
    severity: "error"
  },
  NotFoundError: {
    category: "provider",
    code: ErrorCodes.NotFound,
    retryability: "Never",
    severity: "warning"
  },
  AuthorizationError: {
    category: "provider",
    code: ErrorCodes.Authorization,
    retryability: "Never",
    severity: "error"
  },
  ProviderError: {
    category: "provider",
    code: ErrorCodes.Provider,
    retryability: "Maybe",
    severity: "error"
  },
  RateLimitError: {
    category: "provider",
    code: ErrorCodes.RateLimit,
    retryability: "Always",
    severity: "warning"
  },
  RepositoryError: {
    category: "repository",
    code: ErrorCodes.Repository,
    retryability: "Maybe",
    severity: "error"
  },
  TimeoutError: {
    category: "transport",
    code: ErrorCodes.Timeout,
    retryability: "Maybe",
    severity: "warning"
  },
  TransportError: {
    category: "transport",
    code: ErrorCodes.Transport,
    retryability: "Maybe",
    severity: "error"
  },
  UnexpectedError: {
    category: "unexpected",
    code: ErrorCodes.Unexpected,
    retryability: "Never",
    severity: "critical"
  },
  ValidationError: {
    category: "validation",
    code: ErrorCodes.Validation,
    retryability: "Never",
    severity: "warning"
  }
} as const satisfies Record<string, ErrorDefinition>;

/**
 * Base class for every public GitBridge error.
 */
export class GitBridgeError extends Error {
  /**
   * Stable public error code.
   */
  public readonly code: ErrorCode;

  /**
   * Retry guidance for callers and retry middleware.
   */
  public readonly retryability: ErrorRetryability;

  /**
   * Provider-neutral error category.
   */
  public readonly category: ErrorCategory;

  /**
   * Diagnostic severity.
   */
  public readonly severity: ErrorSeverity;

  /**
   * ISO-8601 timestamp captured when the error is created.
   */
  public readonly timestamp: string;

  /**
   * Safe structured diagnostic context.
   */
  public readonly diagnostics: ErrorDiagnostics;

  /**
   * Immutable error metadata.
   */
  public readonly metadata: ErrorMetadata;

  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    const definition = getDefinition(new.target.name);
    super(message, createErrorOptions(options.cause));

    Object.setPrototypeOf(this, new.target.prototype);
    this.name = new.target.name;
    this.code = definition.code;
    this.retryability = options.retryability ?? definition.retryability;
    this.category = definition.category;
    this.severity = options.severity ?? definition.severity;
    this.timestamp = normalizeTimestamp(options.timestamp);
    this.diagnostics = freezeDiagnostics(options.diagnostics);
    this.metadata = deepFreeze({
      category: this.category,
      code: this.code,
      retryability: this.retryability,
      severity: this.severity,
      timestamp: this.timestamp
    });

    if (Error.captureStackTrace !== undefined) {
      Error.captureStackTrace(this, new.target);
    }

    Object.freeze(this);
  }

  /**
   * Returns a deterministic, safe representation suitable for diagnostics and telemetry.
   */
  public toJSON(): SerializedGitBridgeError {
    const serialized: {
      name: string;
      message: string;
      code: ErrorCode;
      retryability: ErrorRetryability;
      category: ErrorCategory;
      severity: ErrorSeverity;
      timestamp: string;
      diagnostics: ErrorDiagnostics;
      cause?: SerializedGitBridgeError | SerializedCause;
    } = {
      category: this.category,
      code: this.code,
      diagnostics: this.diagnostics,
      message: this.message,
      name: this.name,
      retryability: this.retryability,
      severity: this.severity,
      timestamp: this.timestamp
    };

    const cause = serializeCause(this.cause);

    if (cause !== undefined) {
      serialized.cause = cause;
    }

    return deepFreeze(serialized);
  }

  /**
   * Returns the canonical serialized representation.
   */
  public serialize(): SerializedGitBridgeError {
    return this.toJSON();
  }
}

/**
 * Validation failure detected before an operation executes.
 */
export class ValidationError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Invalid or missing GitBridge configuration.
 */
export class ConfigurationError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Transport-neutral execution failure.
 */
export class TransportError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Request execution exceeded an allowed duration.
 */
export class TimeoutError extends TransportError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Operation was intentionally interrupted.
 */
export class CancellationError extends TransportError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Authentication failure.
 */
export class AuthenticationError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Provider-neutral provider failure.
 */
export class ProviderError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Provider rate limit failure.
 */
export class RateLimitError extends ProviderError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Requested provider capability is not supported.
 */
export class CapabilityNotSupportedError extends ProviderError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Provider denied permission for the requested operation.
 */
export class AuthorizationError extends ProviderError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Provider reported a conflict for the requested operation.
 */
export class ConflictError extends ProviderError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Provider or repository resource was not found.
 */
export class NotFoundError extends ProviderError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Repository lifecycle or repository state failure.
 */
export class RepositoryError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

/**
 * Internal defect or unforeseen runtime condition.
 */
export class UnexpectedError extends GitBridgeError {
  public constructor(message: string, options: GitBridgeErrorOptions = {}) {
    super(message, options);
  }
}

function getDefinition(name: string): ErrorDefinition {
  return definitions[name as keyof typeof definitions] ?? definitions.GitBridgeError;
}

function createErrorOptions(cause: unknown): ErrorOptions | undefined {
  return cause === undefined ? undefined : { cause };
}

function normalizeTimestamp(timestamp: Date | string | undefined): string {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }

  return timestamp ?? new Date().toISOString();
}

function freezeDiagnostics(diagnostics: ErrorDiagnostics | undefined): ErrorDiagnostics {
  return deepFreeze(diagnostics ?? {});
}

function serializeCause(cause: unknown): SerializedGitBridgeError | SerializedCause | undefined {
  if (cause instanceof GitBridgeError) {
    return cause.toJSON();
  }

  if (cause instanceof Error) {
    return deepFreeze({ name: cause.name });
  }

  if (cause === undefined) {
    return undefined;
  }

  return deepFreeze({ name: typeof cause });
}

function deepFreeze<T>(value: T): T {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) {
    return value;
  }

  for (const key of Reflect.ownKeys(value)) {
    const child = (value as Record<PropertyKey, unknown>)[key];

    if (child !== null && (typeof child === "object" || typeof child === "function")) {
      deepFreeze(child);
    }
  }

  return Object.freeze(value);
}
