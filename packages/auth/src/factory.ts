import type {
  AnonymousCredentials,
  CredentialMetadata,
  Credentials,
  TokenCredentials
} from "@sourceaxis/contracts/authentication";
import { ConfigurationError } from "@sourceaxis/errors";
import { deepFreeze } from "@sourceaxis/shared/objects";

import { authKindToCredentialKind } from "./auth-kind.js";
import type {
  AnonymousAuthConfig,
  ApplicationTokenAuthConfig,
  AuthConfig,
  AuthMetadata,
  BearerTokenAuthConfig,
  CustomAuthConfig,
  OAuthTokenAuthConfig,
  StaticTokenAuthConfig
} from "./auth-config.js";

export function anonymousAuth(config: Omit<AnonymousAuthConfig, "kind"> = {}): AnonymousAuthConfig {
  return deepFreeze({
    ...config,
    kind: "anonymous"
  });
}

export function tokenAuth(config: Omit<StaticTokenAuthConfig, "kind">): StaticTokenAuthConfig {
  validateToken(config.token, "token");
  return deepFreeze({
    ...config,
    kind: "token"
  });
}

export function bearerTokenAuth(
  config: Omit<BearerTokenAuthConfig, "kind">
): BearerTokenAuthConfig {
  validateToken(config.token, "bearer token");
  return deepFreeze({
    ...config,
    kind: "bearer-token"
  });
}

export function oauthTokenAuth(config: Omit<OAuthTokenAuthConfig, "kind">): OAuthTokenAuthConfig {
  validateToken(config.accessToken, "OAuth access token");
  return deepFreeze({
    ...config,
    kind: "oauth-token"
  });
}

export function applicationTokenAuth(
  config: Omit<ApplicationTokenAuthConfig, "kind">
): ApplicationTokenAuthConfig {
  validateToken(config.token, "application token");
  return deepFreeze({
    ...config,
    kind: "application-token"
  });
}

export function customAuth(config: Omit<CustomAuthConfig, "kind"> = {}): CustomAuthConfig {
  return deepFreeze({
    ...config,
    kind: "custom"
  });
}

export function createCredentials(config: AuthConfig): Credentials {
  switch (config.kind) {
    case "anonymous":
    case "custom":
      return createAnonymousCredentials(config);
    case "token":
    case "bearer-token":
    case "application-token":
      return createTokenCredentials(config, config.token);
    case "oauth-token":
      return createTokenCredentials(config, config.accessToken);
  }
}

function createAnonymousCredentials(
  config: AnonymousAuthConfig | CustomAuthConfig
): AnonymousCredentials {
  const credentials: {
    kind: "anonymous";
    provider?: NonNullable<AnonymousCredentials["provider"]>;
    metadata?: NonNullable<AnonymousCredentials["metadata"]>;
  } = {
    kind: "anonymous"
  };

  if (config.provider !== undefined) {
    credentials.provider = config.provider;
  }

  if (config.metadata !== undefined) {
    credentials.metadata = normalizeMetadata(config.metadata);
  }

  return deepFreeze(credentials) as AnonymousCredentials;
}

function createTokenCredentials(
  config:
    | StaticTokenAuthConfig
    | BearerTokenAuthConfig
    | OAuthTokenAuthConfig
    | ApplicationTokenAuthConfig,
  token: string
): TokenCredentials {
  validateToken(token, `${config.kind} credential`);

  const credentials: {
    kind: TokenCredentials["kind"];
    token: string;
    provider?: NonNullable<TokenCredentials["provider"]>;
    metadata?: NonNullable<TokenCredentials["metadata"]>;
  } = {
    kind: authKindToCredentialKind(config.kind) as TokenCredentials["kind"],
    token
  };

  if (config.provider !== undefined) {
    credentials.provider = config.provider;
  }

  credentials.metadata = normalizeMetadata(config.metadata, getSchemeMetadata(config));

  return deepFreeze(credentials) as TokenCredentials;
}

function normalizeMetadata(
  metadata: AuthMetadata | undefined,
  extra: Readonly<Record<string, string>> = {}
): CredentialMetadata {
  return deepFreeze({
    ...metadata,
    extra: {
      ...metadata?.extra,
      ...extra
    }
  });
}

function getSchemeMetadata(
  config:
    | StaticTokenAuthConfig
    | BearerTokenAuthConfig
    | OAuthTokenAuthConfig
    | ApplicationTokenAuthConfig
): Readonly<Record<string, string>> {
  switch (config.kind) {
    case "bearer-token":
      return { authScheme: "bearer" };
    case "oauth-token":
      return config.refreshToken === undefined
        ? { authScheme: "oauth" }
        : { authScheme: "oauth", refreshToken: "[configured]" };
    case "application-token":
      return { authScheme: "application" };
    case "token":
      return { authScheme: "token" };
  }
}

function validateToken(token: string, label: string): void {
  if (token.trim().length === 0) {
    throw new ConfigurationError(`Invalid ${label}: token must be a non-empty string`);
  }
}
