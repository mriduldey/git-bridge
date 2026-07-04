import type { ProviderId } from "../metadata/index.js";
import type { DeepReadonly, JsonValue, OperationOptions } from "../types/index.js";

export type AuthenticationType = "anonymous" | "token" | "oauth" | "application" | "custom";
export type CredentialKind = "anonymous" | "access-token" | "oauth-token" | "application-token";

export type CredentialScope = string;

export type CredentialMetadata = DeepReadonly<{
  scopes?: readonly CredentialScope[];
  expiresAt?: string;
  issuedAt?: string;
  extra?: Readonly<Record<string, JsonValue>>;
}>;

export type Credentials = DeepReadonly<{
  kind: CredentialKind;
  provider?: ProviderId;
  metadata?: CredentialMetadata;
}>;

export type TokenCredentials = Credentials &
  DeepReadonly<{
    kind: "access-token" | "oauth-token" | "application-token";
    token: string;
  }>;

export type AnonymousCredentials = Credentials &
  DeepReadonly<{
    kind: "anonymous";
  }>;

export type AuthenticationContext = DeepReadonly<{
  type: AuthenticationType;
  provider?: ProviderId;
  credentials: Credentials;
  scopes?: readonly CredentialScope[];
  expiresAt?: string;
  metadata?: CredentialMetadata;
}>;

export type AuthenticationRequest = OperationOptions &
  DeepReadonly<{
    provider?: ProviderId;
    requiredScopes?: readonly CredentialScope[];
  }>;

export interface AuthenticationStrategy {
  readonly type: AuthenticationType;
  authenticate(request?: AuthenticationRequest): Promise<AuthenticationContext>;
  refresh?(
    context: AuthenticationContext,
    request?: AuthenticationRequest
  ): Promise<AuthenticationContext>;
}

export interface CredentialResolver {
  resolve(request?: AuthenticationRequest): Promise<Credentials>;
}

export interface TokenProvider {
  getToken(request?: AuthenticationRequest): Promise<TokenCredentials>;
  refreshToken?(
    credentials: TokenCredentials,
    request?: AuthenticationRequest
  ): Promise<TokenCredentials>;
}
