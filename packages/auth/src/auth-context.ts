import type { AuthenticationContext } from "@sourceaxis/contracts/authentication";
import { deepFreeze } from "@sourceaxis/shared/objects";

import { authKindToAuthenticationType } from "./auth-kind.js";
import type { AuthConfig } from "./auth-config.js";
import { createCredentials } from "./factory.js";

export type AuthContext = AuthenticationContext;

export function createAuthContext(config: AuthConfig): AuthContext {
  const credentials = createCredentials(config);
  const context: {
    type: AuthenticationContext["type"];
    provider?: NonNullable<AuthenticationContext["provider"]>;
    credentials: AuthenticationContext["credentials"];
    scopes?: NonNullable<AuthenticationContext["scopes"]>;
    expiresAt?: NonNullable<AuthenticationContext["expiresAt"]>;
    metadata?: NonNullable<AuthenticationContext["metadata"]>;
  } = {
    credentials,
    type: authKindToAuthenticationType(config.kind)
  };

  if (config.provider !== undefined) {
    context.provider = config.provider;
  }

  if (config.metadata?.scopes !== undefined) {
    context.scopes = config.metadata.scopes;
  }

  if (config.metadata?.expiresAt !== undefined) {
    context.expiresAt = config.metadata.expiresAt;
  }

  if (config.metadata !== undefined) {
    context.metadata = config.metadata;
  }

  return deepFreeze(context) as AuthContext;
}
