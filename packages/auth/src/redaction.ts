import type { AuthenticationContext, Credentials } from "@gitbridge/contracts/authentication";
import type { JsonValue } from "@gitbridge/contracts/types";
import { deepFreeze } from "@gitbridge/shared/objects";

import type { TokenDisplayHint } from "./auth-config.js";
import { summarizeCredentials, type SafeCredentialSummary } from "./credentials.js";

export const REDACTED_SECRET = "[REDACTED]" as const;

export type RedactedCredential = SafeCredentialSummary &
  Readonly<{
    token?: typeof REDACTED_SECRET;
  }>;

export type SerializedAuthContext = Readonly<{
  type: AuthenticationContext["type"];
  provider?: NonNullable<AuthenticationContext["provider"]>;
  credentials: RedactedCredential;
  scopes?: NonNullable<AuthenticationContext["scopes"]>;
  expiresAt?: NonNullable<AuthenticationContext["expiresAt"]>;
  metadata?: NonNullable<AuthenticationContext["metadata"]>;
}>;

const sensitiveKeyPattern = /token|secret|password|credential|authorization|api[-_]?key/i;

export function redactToken(value: string, hint: TokenDisplayHint = {}): string {
  if (value.length === 0) {
    return REDACTED_SECRET;
  }

  const prefixLength = hint.prefixLength ?? 0;
  const suffixLength = hint.suffixLength ?? 0;
  const visibleLength = Math.max(0, prefixLength) + Math.max(0, suffixLength);

  if (visibleLength <= 0 || visibleLength >= value.length) {
    return REDACTED_SECRET;
  }

  const prefix = value.slice(0, Math.max(0, prefixLength));
  const suffix = suffixLength > 0 ? value.slice(-suffixLength) : "";
  return `${prefix}${REDACTED_SECRET}${suffix}`;
}

export function redactCredentials(credentials: Credentials): RedactedCredential {
  const summary = summarizeCredentials(credentials);
  const redacted: {
    kind: RedactedCredential["kind"];
    provider?: NonNullable<RedactedCredential["provider"]>;
    hasToken: boolean;
    metadata?: NonNullable<RedactedCredential["metadata"]>;
    token?: typeof REDACTED_SECRET;
  } = {
    hasToken: summary.hasToken,
    kind: summary.kind
  };

  if (summary.provider !== undefined) {
    redacted.provider = summary.provider;
  }

  if (summary.metadata !== undefined) {
    redacted.metadata = redactCredentialMetadata(summary.metadata);
  }

  if (summary.hasToken) {
    redacted.token = REDACTED_SECRET;
  }

  return deepFreeze(redacted) as RedactedCredential;
}

export function serializeAuthContext(context: AuthenticationContext): SerializedAuthContext {
  const serialized: {
    type: AuthenticationContext["type"];
    provider?: NonNullable<AuthenticationContext["provider"]>;
    credentials: RedactedCredential;
    scopes?: NonNullable<AuthenticationContext["scopes"]>;
    expiresAt?: NonNullable<AuthenticationContext["expiresAt"]>;
    metadata?: NonNullable<AuthenticationContext["metadata"]>;
  } = {
    credentials: redactCredentials(context.credentials),
    type: context.type
  };

  if (context.provider !== undefined) {
    serialized.provider = context.provider;
  }

  if (context.scopes !== undefined) {
    serialized.scopes = context.scopes;
  }

  if (context.expiresAt !== undefined) {
    serialized.expiresAt = context.expiresAt;
  }

  if (context.metadata !== undefined) {
    serialized.metadata = redactCredentialMetadata(context.metadata);
  }

  return deepFreeze(serialized) as SerializedAuthContext;
}

export function sanitizeDiagnosticValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return deepFreeze(value.map((item) => sanitizeDiagnosticValue(item)));
  }

  if (value !== null && typeof value === "object") {
    const sanitized: Record<string, JsonValue> = {};

    for (const [key, child] of Object.entries(value)) {
      sanitized[key] = sensitiveKeyPattern.test(key)
        ? REDACTED_SECRET
        : sanitizeDiagnosticValue(child);
    }

    return deepFreeze(sanitized);
  }

  return value;
}

function redactCredentialMetadata<
  T extends { readonly extra?: Readonly<Record<string, JsonValue>> }
>(metadata: T): T {
  if (metadata.extra === undefined) {
    return metadata;
  }

  return deepFreeze({
    ...metadata,
    extra: sanitizeDiagnosticValue(metadata.extra) as Readonly<Record<string, JsonValue>>
  }) as T;
}
