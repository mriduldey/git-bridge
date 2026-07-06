# @gitbridge/shared

Shared implementation utilities for GitBridge packages.

## Responsibilities

- Provide small assertion, async, constant, guard, object, path, string, and type helpers.
- Avoid provider-specific behavior.
- Keep common implementation utilities out of public runtime package internals.

## Install

```sh
pnpm add @gitbridge/shared
```

Applications usually do not need this package directly. Prefer the public APIs exposed by
`@gitbridge/core`, provider packages, and `@gitbridge/contracts`.

## Usage

```ts
import { deepFreeze } from "@gitbridge/shared";

const value = deepFreeze({ stable: true });
```
