import type { AuthenticationContext, Credentials } from "@sourceaxis/contracts/authentication";
import { isPlainObject, isString } from "@sourceaxis/shared/guards";

import type { AuthConfig, TokenBackedAuthConfig } from "./auth-config.js";

export function isAuthConfig(value: unknown): value is AuthConfig {
  if (!isPlainObject(value) || !isString(value.kind)) {
    return false;
  }

  switch (value.kind) {
    case "anonymous":
    case "custom":
      return true;
    case "token":
    case "bearer-token":
    case "application-token":
      return isString(value.token);
    case "oauth-token":
      return isString(value.accessToken);
    default:
      return false;
  }
}

export function isTokenBackedAuthConfig(value: unknown): value is TokenBackedAuthConfig {
  return (
    isAuthConfig(value) &&
    (value.kind === "token" ||
      value.kind === "bearer-token" ||
      value.kind === "oauth-token" ||
      value.kind === "application-token")
  );
}

export function isAnonymousCredentials(credentials: Credentials): boolean {
  return credentials.kind === "anonymous";
}

export function isTokenCredentials(credentials: Credentials): credentials is Credentials & {
  readonly token: string;
} {
  return "token" in credentials && isString(credentials.token);
}

export function isAuthenticationContext(value: unknown): value is AuthenticationContext {
  return (
    isPlainObject(value) &&
    isString(value.type) &&
    isPlainObject(value.credentials) &&
    isString(value.credentials.kind)
  );
}
