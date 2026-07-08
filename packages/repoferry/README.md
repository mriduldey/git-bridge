# repoferry

Primary public entry point for RepoFerry.

## Install

For GitHub-only alpha releases before npm publishing, install commands are shown as the intended npm
usage. Until packages are published, use the repository source/tag directly.

```sh
pnpm add repoferry @repoferry/provider-github
```

Install at least one provider package before opening repositories.

## Usage

```ts
import { createRepoFerryClient } from "repoferry";
import { createGitHubProviderConfig, githubTokenAuth } from "@repoferry/provider-github";

const token = process.env.REPOFERRY_GITHUB_TOKEN;

const client = createRepoFerryClient({
  ...createGitHubProviderConfig(),
  authentication: token === undefined ? undefined : githubTokenAuth(token)
});
```

For GitHub-first applications, prefer `createGitHubClient` from `@repoferry/provider-github`.

## Public API

This package re-exports stable public APIs from `@repoferry/core`, `@repoferry/errors`, and
`@repoferry/auth`. Use `@repoferry/contracts` directly when you need the full provider-neutral
contract catalog. This package does not bundle or expose provider internals.
