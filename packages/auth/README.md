# @repoferry/auth

Authentication helpers for RepoFerry.

## Responsibilities

- Create typed authentication config objects.
- Convert auth config into public authentication contexts and credentials.
- Provide token, bearer token, OAuth token, application token, custom, and anonymous helpers.
- Summarize and redact credentials safely.

## Install

```sh
pnpm add @repoferry/auth
```

## Usage

```ts
import { createAuthContext, tokenAuth } from "@repoferry/auth";
import { GitHubProviderId } from "@repoferry/provider-github";

const context = createAuthContext(
  tokenAuth({
    provider: GitHubProviderId,
    token: process.env.GITHUB_TOKEN ?? ""
  })
);
```

Prefer environment variables, secret managers, or caller-owned token providers. Do not log raw
credentials.

## Public API

The package exports auth config types, credential types, auth kind helpers, factories, guards,
redaction helpers, and `createAuthContext`.
