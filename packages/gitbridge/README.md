# gitbridge

Primary public entry point for GitBridge.

## Install

```sh
pnpm add gitbridge @gitbridge/provider-github
```

Install at least one provider package before opening repositories.

## Usage

```ts
import { createGitBridgeClient } from "gitbridge";
import { createGitHubProviderConfig, githubTokenAuth } from "@gitbridge/provider-github";

const token = process.env.GITBRIDGE_GITHUB_TOKEN;

const client = createGitBridgeClient({
  ...createGitHubProviderConfig(),
  authentication: token === undefined ? undefined : githubTokenAuth(token)
});
```

For GitHub-first applications, prefer `createGitHubClient` from `@gitbridge/provider-github`.

## Public API

This package re-exports stable public APIs from `@gitbridge/core`, `@gitbridge/errors`, and
`@gitbridge/auth`. Use `@gitbridge/contracts` directly when you need the full provider-neutral
contract catalog. This package does not bundle or expose provider internals.
