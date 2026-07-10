# @sourceaxis/shared

Shared implementation utilities for SourceAxis packages.

## Responsibilities

- Provide small assertion, async, constant, guard, object, path, string, and type helpers.
- Avoid provider-specific behavior.
- Keep common implementation utilities out of public runtime package internals.

## Install

```sh
pnpm add @sourceaxis/shared
```

Applications usually do not need this package directly. Prefer the public APIs exposed by
`@sourceaxis/core`, provider packages, and `@sourceaxis/contracts`.

## Usage

```ts
import { deepFreeze } from "@sourceaxis/shared";

const value = deepFreeze({ stable: true });
```
