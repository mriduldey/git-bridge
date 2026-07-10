import { describe, expect, expectTypeOf, it } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  CancellationError,
  CapabilityNotSupportedError,
  ConfigurationError,
  ConflictError,
  ErrorCodes,
  SourceAxisError,
  NotFoundError,
  ProviderError,
  RateLimitError,
  RepositoryError,
  TimeoutError,
  TransportError,
  UnexpectedError,
  ValidationError,
  type ErrorCategory,
  type ErrorCode,
  type ErrorRetryability,
  type ErrorSeverity,
  type SerializedSourceAxisError
} from "../src/index.js";

type ErrorConstructor = new (
  message: string,
  options?: ConstructorParameters<typeof SourceAxisError>[1]
) => SourceAxisError;

type Case = Readonly<{
  constructor: ErrorConstructor;
  code: ErrorCode;
  retryability: ErrorRetryability;
  category: ErrorCategory;
  severity: ErrorSeverity;
  parent?: ErrorConstructor;
}>;

const cases: readonly Case[] = [
  {
    category: "unexpected",
    code: ErrorCodes.Unexpected,
    constructor: SourceAxisError,
    retryability: "Never",
    severity: "error"
  },
  {
    category: "validation",
    code: ErrorCodes.Validation,
    constructor: ValidationError,
    retryability: "Never",
    severity: "warning"
  },
  {
    category: "configuration",
    code: ErrorCodes.Configuration,
    constructor: ConfigurationError,
    retryability: "Never",
    severity: "error"
  },
  {
    category: "transport",
    code: ErrorCodes.Transport,
    constructor: TransportError,
    retryability: "Maybe",
    severity: "error"
  },
  {
    category: "transport",
    code: ErrorCodes.Timeout,
    constructor: TimeoutError,
    parent: TransportError,
    retryability: "Maybe",
    severity: "warning"
  },
  {
    category: "transport",
    code: ErrorCodes.Cancellation,
    constructor: CancellationError,
    parent: TransportError,
    retryability: "Never",
    severity: "info"
  },
  {
    category: "authentication",
    code: ErrorCodes.Authentication,
    constructor: AuthenticationError,
    retryability: "Never",
    severity: "error"
  },
  {
    category: "provider",
    code: ErrorCodes.Provider,
    constructor: ProviderError,
    retryability: "Maybe",
    severity: "error"
  },
  {
    category: "provider",
    code: ErrorCodes.RateLimit,
    constructor: RateLimitError,
    parent: ProviderError,
    retryability: "Always",
    severity: "warning"
  },
  {
    category: "provider",
    code: ErrorCodes.CapabilityNotSupported,
    constructor: CapabilityNotSupportedError,
    parent: ProviderError,
    retryability: "Never",
    severity: "warning"
  },
  {
    category: "provider",
    code: ErrorCodes.Authorization,
    constructor: AuthorizationError,
    parent: ProviderError,
    retryability: "Never",
    severity: "error"
  },
  {
    category: "provider",
    code: ErrorCodes.Conflict,
    constructor: ConflictError,
    parent: ProviderError,
    retryability: "Maybe",
    severity: "warning"
  },
  {
    category: "provider",
    code: ErrorCodes.NotFound,
    constructor: NotFoundError,
    parent: ProviderError,
    retryability: "Never",
    severity: "warning"
  },
  {
    category: "repository",
    code: ErrorCodes.Repository,
    constructor: RepositoryError,
    retryability: "Maybe",
    severity: "error"
  },
  {
    category: "unexpected",
    code: ErrorCodes.Unexpected,
    constructor: UnexpectedError,
    retryability: "Never",
    severity: "critical"
  }
];

describe("SourceAxis error hierarchy", () => {
  it.each(cases)("constructs $constructor.name with stable metadata", (entry) => {
    const error = new entry.constructor("failed", {
      diagnostics: {
        operation: {
          correlationId: "corr-1",
          elapsedMs: 12,
          operation: "repo.read",
          retryCount: 1
        },
        provider: {
          provider: "github",
          providerCode: "safe-code",
          requestId: "req-1",
          status: 503
        },
        repository: {
          path: "README.md",
          provider: "github",
          reference: "main",
          repository: "owner/repo"
        },
        transport: {
          requestMethod: "GET",
          timeoutMs: 1000,
          transport: "fetch"
        }
      },
      timestamp: "2026-07-02T00:00:00.000Z"
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SourceAxisError);
    expect(error).toBeInstanceOf(entry.constructor);
    expect(error.name).toBe(entry.constructor.name);
    expect(error.message).toBe("failed");
    expect(error.code).toBe(entry.code);
    expect(error.retryability).toBe(entry.retryability);
    expect(error.category).toBe(entry.category);
    expect(error.severity).toBe(entry.severity);
    expect(error.timestamp).toBe("2026-07-02T00:00:00.000Z");
    expect(error.metadata).toEqual({
      category: entry.category,
      code: entry.code,
      retryability: entry.retryability,
      severity: entry.severity,
      timestamp: "2026-07-02T00:00:00.000Z"
    });
    expect(error.diagnostics.provider?.requestId).toBe("req-1");
    expect(error.stack).toContain(entry.constructor.name);

    if (entry.parent !== undefined) {
      expect(error).toBeInstanceOf(entry.parent);
    }
  });

  it("exposes the approved nested hierarchy", () => {
    expect(new TimeoutError("timeout")).toBeInstanceOf(TransportError);
    expect(new CancellationError("cancelled")).toBeInstanceOf(TransportError);
    expect(new RateLimitError("rate limit")).toBeInstanceOf(ProviderError);
    expect(new CapabilityNotSupportedError("capability")).toBeInstanceOf(ProviderError);
    expect(new AuthorizationError("permission")).toBeInstanceOf(ProviderError);
    expect(new ConflictError("conflict")).toBeInstanceOf(ProviderError);
    expect(new NotFoundError("missing")).toBeInstanceOf(ProviderError);
  });
});

describe("SourceAxis error behavior", () => {
  it("preserves cause without leaking non-SourceAxis cause details in serialization", () => {
    const sdkCause = new Error("provider token leaked from SDK");
    const error = new ProviderError("provider failed", { cause: sdkCause });

    expect(error.cause).toBe(sdkCause);
    expect(error.toJSON().cause).toEqual({ name: "Error" });
  });

  it("serializes SourceAxis causes recursively", () => {
    const cause = new TimeoutError("timed out", {
      timestamp: "2026-07-02T00:00:00.000Z"
    });
    const error = new ProviderError("provider failed", {
      cause,
      timestamp: "2026-07-02T00:00:01.000Z"
    });

    expect(error.toJSON().cause).toEqual(cause.toJSON());
  });

  it("serializes deterministically with safe diagnostics", () => {
    const first = new RepositoryError("repository failed", {
      diagnostics: {
        extra: {
          branch: "main",
          flags: [true, false],
          nested: {
            count: 2
          }
        }
      },
      timestamp: new Date("2026-07-02T00:00:00.000Z")
    });
    const second = new RepositoryError("repository failed", {
      diagnostics: {
        extra: {
          branch: "main",
          flags: [true, false],
          nested: {
            count: 2
          }
        }
      },
      timestamp: "2026-07-02T00:00:00.000Z"
    });

    expect(first.serialize()).toEqual(second.serialize());
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expectTypeOf(first.serialize()).toEqualTypeOf<SerializedSourceAxisError>();
  });

  it("freezes errors and nested public metadata where practical", () => {
    const error = new ValidationError("invalid", {
      diagnostics: {
        extra: {
          nested: {
            safe: true
          }
        }
      }
    });

    expect(Object.isFrozen(error)).toBe(true);
    expect(Object.isFrozen(error.metadata)).toBe(true);
    expect(Object.isFrozen(error.diagnostics)).toBe(true);
    expect(Object.isFrozen(error.diagnostics.extra)).toBe(true);
    expect(Object.isFrozen(error.diagnostics.extra?.nested)).toBe(true);
    expect(() => {
      Object.defineProperty(error, "code", { value: ErrorCodes.Unexpected });
    }).toThrow();
  });

  it("allows retryability and severity overrides without changing stable code or category", () => {
    const error = new TransportError("network failed", {
      retryability: "Always",
      severity: "critical"
    });

    expect(error.code).toBe(ErrorCodes.Transport);
    expect(error.category).toBe("transport");
    expect(error.retryability).toBe("Always");
    expect(error.severity).toBe("critical");
  });

  it("captures creation timestamps by default", () => {
    const before = Date.now();
    const error = new UnexpectedError("boom");
    const after = Date.now();
    const timestamp = Date.parse(error.timestamp);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});
