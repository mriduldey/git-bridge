# @gitbridge/contracts

Stable provider-neutral TypeScript contracts for GitBridge.

## Responsibilities

- Define repository domain models.
- Define capability interfaces for files, tree, history, search, branches, tags, releases, issues,
  and pull requests.
- Define provider, session, authentication, transport, cache, diagnostics, pagination, metadata, and
  JSON-safe value contracts.

## Install

```sh
pnpm add @gitbridge/contracts
```

Most applications consume these types transitively through `@gitbridge/core` and provider packages.
Provider authors import this package directly.

## Usage

```ts
import type { RepositoryInfo } from "@gitbridge/contracts";

function printRepository(info: RepositoryInfo): string {
  return `${info.fullName} (${info.visibility})`;
}
```

Contracts are the compatibility boundary. Runtime packages may implement them, but applications
should not rely on package internals.
