import type { ProviderId } from "@repoferry/contracts/metadata";
import type { DeepReadonly, JsonValue } from "@repoferry/contracts/types";

import type { AuthKind } from "./auth-kind.js";

export type TokenDisplayHint = DeepReadonly<{
  prefixLength?: number;
  suffixLength?: number;
}>;

export type AuthMetadata = DeepReadonly<{
  scopes?: readonly string[];
  expiresAt?: string;
  issuedAt?: string;
  extra?: Readonly<Record<string, JsonValue>>;
}>;

export type AnonymousAuthConfig = DeepReadonly<{
  kind: "anonymous";
  provider?: ProviderId;
  metadata?: AuthMetadata;
}>;

export type StaticTokenAuthConfig = DeepReadonly<{
  kind: "token";
  token: string;
  provider?: ProviderId;
  metadata?: AuthMetadata;
  redaction?: TokenDisplayHint;
}>;

export type BearerTokenAuthConfig = DeepReadonly<{
  kind: "bearer-token";
  token: string;
  provider?: ProviderId;
  metadata?: AuthMetadata;
  redaction?: TokenDisplayHint;
}>;

export type OAuthTokenAuthConfig = DeepReadonly<{
  kind: "oauth-token";
  accessToken: string;
  refreshToken?: string;
  provider?: ProviderId;
  metadata?: AuthMetadata;
  redaction?: TokenDisplayHint;
}>;

export type ApplicationTokenAuthConfig = DeepReadonly<{
  kind: "application-token";
  token: string;
  provider?: ProviderId;
  metadata?: AuthMetadata;
  redaction?: TokenDisplayHint;
}>;

export type CustomAuthConfig = DeepReadonly<{
  kind: "custom";
  provider?: ProviderId;
  metadata?: AuthMetadata;
}>;

export type AuthConfig =
  | AnonymousAuthConfig
  | StaticTokenAuthConfig
  | BearerTokenAuthConfig
  | OAuthTokenAuthConfig
  | ApplicationTokenAuthConfig
  | CustomAuthConfig;

export type TokenBackedAuthConfig = Extract<
  AuthConfig,
  { readonly kind: "token" | "bearer-token" | "oauth-token" | "application-token" }
>;

export function isTokenBackedAuthKind(kind: AuthKind): boolean {
  return (
    kind === "token" ||
    kind === "bearer-token" ||
    kind === "oauth-token" ||
    kind === "application-token"
  );
}
