# @repoferry/shared

Shared implementation utilities for RepoFerry packages.

## Responsibilities

- Provide small assertion, async, constant, guard, object, path, string, and type helpers.
- Avoid provider-specific behavior.
- Keep common implementation utilities out of public runtime package internals.

## Install

```sh
pnpm add @repoferry/shared
```

Applications usually do not need this package directly. Prefer the public APIs exposed by
`@repoferry/core`, provider packages, and `@repoferry/contracts`.

## Usage

```ts
import { deepFreeze } from "@repoferry/shared";

const value = deepFreeze({ stable: true });
```
