# Contributing

GitBridge implementation follows the accepted architecture documents exactly.

Before contributing:

1. Read `docs/architecture/adr/ADR-001.md` through `docs/architecture/adr/ADR-015.md`.
2. Read `docs/planning/IMPLEMENTATION_PLAN.md`.
3. Run `pnpm run check` before opening a pull request.

Implementation changes must preserve package boundaries, public APIs, and dependency direction.
Architectural changes require an accepted ADR or amendment before implementation.
