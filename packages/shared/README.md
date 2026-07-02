# @gitbridge/shared

Shared, provider-neutral implementation utilities for GitBridge packages.

This package is intentionally small. It contains only deterministic helpers that are independent of
providers, domain models, frameworks, transports, configuration, logging, and network behavior.

## Modules

- `types` - reusable TypeScript utility types.
- `assertions` - invariant helpers for package internals.
- `guards` - primitive runtime type guards.
- `objects` - small object helpers.
- `strings` - deterministic string normalization helpers.
- `paths` - platform-independent slash-delimited path helpers.
- `async` - basic Promise and cancellation helpers.
- `constants` - immutable empty sentinels.

All exports are available from the package root and through module subpaths.
