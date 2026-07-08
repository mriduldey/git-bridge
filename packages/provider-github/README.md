# @gitbridge/provider-github

GitHub provider and GitHub-first convenience helpers for GitBridge.

## Install

For GitHub-only alpha releases before npm publishing, install commands are shown as the intended npm
usage. Until packages are published, use the repository source/tag directly.

```sh
pnpm add @gitbridge/provider-github
```

## Quick Start

```ts
import { createGitHubClient } from "@gitbridge/provider-github";

const client = createGitHubClient();
const repository = await client.open("https://github.com/microsoft/TypeScript");

console.log(await repository.readText("README.md"));
```

## Authenticated Access

```ts
import { createGitHubClient } from "@gitbridge/provider-github";

const token = process.env.GITBRIDGE_GITHUB_TOKEN;
const client = createGitHubClient(token === undefined ? {} : { token });
```

## Public Helpers

- `createGitHubClient(config?)` creates a GitBridge client with the GitHub provider registered.
- `githubProvider(config?)` creates the GitHub provider for explicit registration.
- `githubTokenAuth(token, options?)` creates a GitHub-scoped token authentication strategy.
- `createGitHubProvider(config?)` is the explicit provider factory.
- `createGitHubProviderConfig(config?)` returns a provider config fragment for `gitbridge` or
  `@gitbridge/core`.

## Provider-Neutral Setup

Use this form when your application wants to register providers explicitly:

```ts
import { createGitBridgeClient } from "gitbridge";
import { createGitHubProviderConfig, githubTokenAuth } from "@gitbridge/provider-github";

const token = process.env.GITBRIDGE_GITHUB_TOKEN;

const client = createGitBridgeClient({
  ...createGitHubProviderConfig(),
  authentication: token === undefined ? undefined : githubTokenAuth(token)
});
```

## Capabilities

GitHub currently supports files, tree, history/commits, search, branches, tags, releases, issues,
and pull requests.

## Package Choice

- Use `@gitbridge/provider-github` for GitHub-first application setup.
- Use `gitbridge` for provider-neutral apps that register providers explicitly.
- Use `@gitbridge/testing` when certifying providers or writing provider contract tests.
