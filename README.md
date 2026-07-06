# GitBridge

GitBridge is a provider-neutral TypeScript SDK for opening Git repositories and working with common
repository capabilities through stable public contracts. Applications create a GitBridge client,
register one or more providers, authenticate explicitly, open a repository, and use capability
services such as files, branches, history, search, issues, and pull requests.

ADR-001 through ADR-015 are accepted and authoritative. The architecture is frozen; runtime changes
must preserve those decisions.

## Architecture Summary

GitBridge is organized around explicit package boundaries:

- `@gitbridge/contracts` defines provider-neutral domain, capability, transport, cache, diagnostics,
  authentication, pagination, and metadata contracts.
- `@gitbridge/core` owns client lifecycle, provider registration, provider resolution, repository
  factories, repository references, and capability dispatch.
- Provider packages, currently `@gitbridge/provider-github`, adapt provider APIs to the contracts.
- Foundation packages provide authentication, transport, cache, errors, observability, testing, and
  shared utilities without taking provider dependencies.

See [docs/architecture/INDEX.md](docs/architecture/INDEX.md) for ADRs, diagrams, and terminology.

## Package Overview

| Package                      | Purpose                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `@gitbridge/core`            | Creates clients, registers providers, opens repositories, and exposes repository refs. |
| `@gitbridge/provider-github` | GitHub provider implementation backed by Octokit.                                      |
| `@gitbridge/contracts`       | Stable public TypeScript contracts shared by all packages.                             |
| `@gitbridge/auth`            | Authentication config, credential creation, redaction, and guards.                     |
| `@gitbridge/transport`       | Transport primitives, middleware, retry, timeout, cancellation, and headers.           |
| `@gitbridge/cache`           | Cache keys, policies, memory adapter, named caches, and registry.                      |
| `@gitbridge/errors`          | Stable error hierarchy, codes, diagnostics, and serialization.                         |
| `@gitbridge/observability`   | Diagnostics service, logging, metrics, tracing, and metadata sanitization.             |
| `@gitbridge/testing`         | Provider certification helpers and deterministic test doubles.                         |
| `@gitbridge/shared`          | Internal shared assertions, async, guards, objects, paths, strings, and constants.     |

## Installation

Install the core package and at least one provider:

```sh
pnpm add @gitbridge/core @gitbridge/provider-github @gitbridge/auth
```

This repository uses Node.js `>=20.19.0` and pnpm `>=10.0.0`.

## Supported Providers

GitHub is the currently implemented provider. The GitHub provider supports repository metadata,
files, tree, history, search, branches, tags, releases, issues, and pull requests.

## Quick Start

```ts
import { createAuthContext, tokenAuth } from "@gitbridge/auth";
import { createGitBridgeClient, type AuthenticationStrategy } from "@gitbridge/core";
import { createGitHubProviderConfig, GitHubProviderId } from "@gitbridge/provider-github";

const token = process.env.GITHUB_TOKEN;

const authentication: AuthenticationStrategy | undefined =
  token === undefined
    ? undefined
    : {
        async authenticate() {
          return createAuthContext(tokenAuth({ provider: GitHubProviderId, token }));
        }
      };

const client = createGitBridgeClient({
  ...createGitHubProviderConfig(),
  authentication
});

try {
  const repository = await client.open("https://github.com/octokit/rest.js");
  const ref = repository.ref(repository.info.defaultBranch ?? "main");
  const readme = await ref.files.readText("README.md");

  console.log(repository.info.fullName);
  console.log(readme.slice(0, 200));

  await repository.dispose();
} finally {
  await client.dispose();
}
```

## Authentication

Authentication is explicit and provider-scoped. Use `@gitbridge/auth` helpers to build safe
credential contexts and pass an `AuthenticationStrategy` to the client. Examples use
`GITBRIDGE_GITHUB_TOKEN`; credentials should always come from environment variables, secret stores,
or caller-owned token providers.

## Creating a Client

Use `createGitBridgeClient` with provider config fragments:

```ts
const client = createGitBridgeClient({
  ...createGitHubProviderConfig()
});
```

The client owns default cache resources it creates. Always call `client.dispose()` when work is
complete.

## Opening Repositories

Open repositories by URL:

```ts
const repository = await client.open("https://github.com/octokit/rest.js");
const ref = repository.ref(repository.info.defaultBranch ?? "main");
```

`Repository` exposes immutable repository metadata and lifecycle state. `RepositoryRef` exposes the
capability services bound to a branch, tag, commit, or other reference.

## Common Operations

```ts
await ref.files.readText("README.md");
await ref.branches.list({ limit: 10 });
await ref.history.list({ limit: 5 });
await ref.search.text("createGitBridgeClient", { limit: 5 });
await ref.issues.list({ limit: 10 });
await ref.pullRequests.list({ limit: 10 });
```

Each operation uses provider-neutral result shapes from `@gitbridge/contracts`.

## Error Handling

All public GitBridge errors extend `GitBridgeError` and expose stable `code`, `retryability`,
`category`, `severity`, `diagnostics`, and `serialize()` fields.

```ts
import { GitBridgeError } from "@gitbridge/errors";

try {
  await ref.files.readText("missing.txt");
} catch (error) {
  if (error instanceof GitBridgeError) {
    console.error(error.code, error.retryability, error.diagnostics);
  } else {
    throw error;
  }
}
```

## Caching

`@gitbridge/cache` provides cache keys, policies, in-memory adapters, named caches, and a registry.
Core creates a default registry when none is supplied. Provider-specific cache integration is
configuration-driven and must stay within the accepted architecture.

## Observability

`@gitbridge/observability` provides diagnostics, logging, metrics, tracing, and metadata
sanitization. Diagnostics are observational: subscriber failures must not change SDK behavior.

## Testing Package

`@gitbridge/testing` contains provider certification helpers, fake transport, fake provider,
diagnostic capture, and assertions. Provider implementations should use the certification suite to
prove public contract behavior.

## Provider Development

Provider packages implement the contracts from `@gitbridge/contracts`, expose a provider factory,
declare supported capabilities, and return provider sessions that bind runtime capability services.
Do not import package internals from examples or downstream applications.

## Examples

Runnable examples live in [examples](examples):

- `basic-node`
- `github-repository-info`
- `repository-file-reader`
- `branch-listing`
- `commit-history`
- `search`
- `issue-listing`
- `pull-request-listing`

Build all examples with:

```sh
pnpm build
```

Run an example with:

```sh
pnpm --filter @gitbridge/example-basic-node start
```

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), follow the accepted ADRs, and run validation before opening
changes:

```sh
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm run validate:architecture
```

## Roadmap

The planning roadmap lives in [docs/planning/ROADMAP.md](docs/planning/ROADMAP.md). Future work is
tracked by milestone and must preserve the frozen architecture unless a new accepted ADR changes it.
