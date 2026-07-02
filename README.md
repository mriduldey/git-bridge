# GitBridge

GitBridge is a provider-neutral TypeScript SDK for interacting with Git repositories through stable
public contracts.

The architecture is frozen in `docs/architecture/adr/ADR-001.md` through
`docs/architecture/adr/ADR-015.md`. Implementation follows the accepted planning documents in
`docs/planning/`.

## Current Status

Milestone 1, Repository Bootstrap, is active. Runtime packages are intentionally not implemented in
this milestone.

## Development

```sh
pnpm install
pnpm run check
```

The `check` script runs formatting, linting, type checking, tests, and architecture validation.
