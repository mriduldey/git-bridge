# sourceaxis

Primary public entry point for SourceAxis.

## Install

For GitHub-only alpha releases before npm publishing, install commands are shown as the intended npm
usage. Until packages are published, use the repository source/tag directly.

```sh
pnpm add sourceaxis @sourceaxis/provider-github
```

Install at least one provider package before opening repositories.

## Usage

```ts
import { createSourceAxisClient } from "sourceaxis";
import { createGitHubProviderConfig, githubTokenAuth } from "@sourceaxis/provider-github";

const token = process.env.SOURCEAXIS_GITHUB_TOKEN;

const client = createSourceAxisClient({
  ...createGitHubProviderConfig(),
  authentication: token === undefined ? undefined : githubTokenAuth(token)
});
```

For GitHub-first applications, prefer `createGitHubClient` from `@sourceaxis/provider-github`.

## Public API

This package re-exports stable public APIs from `@sourceaxis/core`, `@sourceaxis/errors`, and
`@sourceaxis/auth`. Use `@sourceaxis/contracts` directly when you need the full provider-neutral
contract catalog. This package does not bundle or expose provider internals.
