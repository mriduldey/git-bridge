# Contributing

GitBridge implementation follows the accepted architecture documents exactly.

Before contributing:

1. Read `docs/architecture/adr/ADR-001.md` through `docs/architecture/adr/ADR-015.md`.
2. Read `docs/planning/IMPLEMENTATION_PLAN.md`.
3. Add a Changeset with `pnpm changeset` for user-facing package changes.
4. Run `pnpm run check` before opening a pull request.

Implementation changes must preserve package boundaries, public APIs, and dependency direction.
Architectural changes require an accepted ADR or amendment before implementation.

Release preparation uses `pnpm run release:check`, which runs all quality gates and dry-runs package
packing without publishing.

For a GitHub-only alpha release, CI/checks, examples, architecture validation, and the release-check
workflow or local equivalent must pass. npm publishing additionally requires npm registry name/scope
ownership confirmation. A v0.1 alpha release does not imply a stable release.
