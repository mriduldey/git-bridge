import type { AuthenticationType, CredentialKind } from "@sourceaxis/contracts/authentication";

export type AuthKind =
  "anonymous" | "token" | "bearer-token" | "oauth-token" | "application-token" | "custom";

export function authKindToAuthenticationType(kind: AuthKind): AuthenticationType {
  switch (kind) {
    case "anonymous":
      return "anonymous";
    case "token":
    case "bearer-token":
      return "token";
    case "oauth-token":
      return "oauth";
    case "application-token":
      return "application";
    case "custom":
      return "custom";
  }
}

export function authKindToCredentialKind(kind: AuthKind): CredentialKind {
  switch (kind) {
    case "anonymous":
      return "anonymous";
    case "token":
    case "bearer-token":
      return "access-token";
    case "oauth-token":
      return "oauth-token";
    case "application-token":
      return "application-token";
    case "custom":
      return "anonymous";
  }
}
