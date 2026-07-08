import type {
  AnonymousCredentials,
  CredentialMetadata,
  Credentials,
  TokenCredentials
} from "@repoferry/contracts/authentication";

export type SafeCredentialSummary = Readonly<{
  kind: Credentials["kind"];
  provider?: NonNullable<Credentials["provider"]>;
  hasToken: boolean;
  metadata?: NonNullable<Credentials["metadata"]>;
}>;

export type AuthCredentials = AnonymousCredentials | TokenCredentials;

export function hasCredentialMetadata(
  credentials: Credentials
): credentials is Credentials & { readonly metadata: CredentialMetadata } {
  return credentials.metadata !== undefined;
}

export function summarizeCredentials(credentials: Credentials): SafeCredentialSummary {
  const summary: {
    kind: Credentials["kind"];
    provider?: NonNullable<Credentials["provider"]>;
    hasToken: boolean;
    metadata?: NonNullable<Credentials["metadata"]>;
  } = {
    hasToken: "token" in credentials,
    kind: credentials.kind
  };

  if (credentials.provider !== undefined) {
    summary.provider = credentials.provider;
  }

  if (credentials.metadata !== undefined) {
    summary.metadata = credentials.metadata;
  }

  return Object.freeze(summary);
}
