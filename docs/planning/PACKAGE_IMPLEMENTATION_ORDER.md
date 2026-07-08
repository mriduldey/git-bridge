# PACKAGE_IMPLEMENTATION_ORDER.md

> Canonical Package Execution Order for GitBridge
>
> **Status:** Accepted
>
> **Architecture:** ADR-001 → ADR-015
>
> **Implementation:** IMPLEMENTATION_PLAN.md
>
> **Repository Layout:** PROJECT_STRUCTURE.md

---

# 1. Implementation Philosophy

## Purpose

This document defines the **exact implementation sequence** for every package in the GitBridge monorepo.

It translates the architectural dependency graph into a practical engineering roadmap.

It does **not** redefine package responsibilities or architecture.

---

## Why Package Order Matters

A well-defined implementation order:

- minimizes implementation risk,
- prevents circular dependencies,
- enables incremental validation,
- keeps CI stable,
- allows independent contributor work,
- produces usable software as early as possible.

Poor sequencing results in:

- unnecessary refactoring,
- unstable APIs,
- duplicated work,
- broken dependency chains.

---

## Guiding Principles

### Infrastructure Before Features

Foundational infrastructure must exist before feature packages.

Example:

```text
Transport

↓

Provider
```

Never the reverse.

---

### Dependencies Define Order

Implementation follows dependency direction.

A package is implemented only after all of its required dependencies are stable.

---

### Working Repository After Every Wave

Every implementation wave leaves the repository in a buildable, testable state.

The `main` branch must remain releasable.

---

### Incremental Validation

Each completed wave introduces:

- tests,
- CI validation,
- documentation updates.

Quality grows continuously rather than being deferred.

---

### Single Responsibility

Every wave introduces one major architectural responsibility.

Avoid combining unrelated concerns into a single implementation phase.

---

### Small Reviewable Changes

Engineering progress is measured through small, independently reviewable pull requests.

---

# 2. Complete Dependency Graph

The package graph is derived directly from the accepted architecture.

```text
shared
    │
    ▼
contracts
    │
    ▼
errors
    │
    ▼
observability
    │
    ▼
auth
    │
    ▼
transport
    │
    ▼
cache
    │
    ▼
core
    │
    ▼
provider-github
    │
    ▼
gitbridge
    │
    ▼
testing
```

Examples and documentation consume only public packages and therefore are implemented after the runtime packages stabilize.

---

## Package Classification

### Leaf Package

| Package | Responsibility |
|----------|----------------|
| `@gitbridge/shared` | Common reusable utilities |

---

### Foundational Packages

| Package | Responsibility |
|----------|----------------|
| `@gitbridge/contracts` | Public contracts |
| `@gitbridge/errors` | Error model |
| `@gitbridge/observability` | Observability infrastructure, including diagnostics |

---

### Runtime Infrastructure

| Package | Responsibility |
|----------|----------------|
| `@gitbridge/auth` | Authentication abstractions |
| `@gitbridge/transport` | Transport pipeline |
| `@gitbridge/cache` | Cache infrastructure |

---

### Runtime Core

| Package | Responsibility |
|----------|----------------|
| `@gitbridge/core` | Repository runtime |

---

### Provider Layer

| Package | Responsibility |
|----------|----------------|
| `@gitbridge/provider-github` | GitHub provider |
| `@gitbridge/provider-gitlab` | Future |
| `@gitbridge/provider-bitbucket` | Future |
| `@gitbridge/provider-azure` | Future |
| `@gitbridge/provider-gitea` | Future |

---

### Public SDK

| Package | Responsibility |
|----------|----------------|
| `gitbridge` | Public entry point |

---

### Testing

| Package | Responsibility |
|----------|----------------|
| `@gitbridge/testing` | Contract Test Kit & testing utilities |

---

# 3. Implementation Waves

Implementation is divided into small engineering waves.

Each wave introduces exactly one major architectural responsibility.

---

## Wave 0 — Repository Bootstrap

Purpose:

Establish the engineering foundation.

Deliverables:

- Workspace
- Tooling
- CI
- Build pipeline

---

## Wave 1 — Shared Foundation

Package:

```text
@gitbridge/shared
```

Purpose:

Reusable utilities.

Produces the lowest layer of the dependency graph.

---

## Wave 2 — Public Contracts

Package:

```text
@gitbridge/contracts
```

Purpose:

Public interfaces and value models.

All higher packages depend on these contracts.

---

## Wave 3 — Error Infrastructure

Package:

```text
@gitbridge/errors
```

Purpose:

Stable public error model.

---

## Wave 4 — Observability Infrastructure

Package:

```text
@gitbridge/observability
```

Purpose:

Events, metrics, tracing contracts.

---

## Wave 5 — Authentication

Package:

```text
@gitbridge/auth
```

Purpose:

Authentication abstractions.

---

## Wave 6 — Transport

Package:

```text
@gitbridge/transport
```

Purpose:

Transport abstraction and middleware pipeline.

---

## Wave 7 — Cache Infrastructure

Package:

```text
@gitbridge/cache
```

Purpose:

Caching infrastructure.

---

## Wave 8 — Core Runtime

Package:

```text
@gitbridge/core
```

Purpose:

Client, Repository, RepositoryRef, Provider Registry, Repository Factory.

---

## Wave 9 — GitHub Provider

Package:

```text
@gitbridge/provider-github
```

Purpose:

First production provider.

Validates the provider architecture.

---

## Wave 10 — Public SDK

Package:

```text
gitbridge
```

Purpose:

Stable public entry point.

---

## Wave 11 — Testing Infrastructure

Package:

```text
@gitbridge/testing
```

Purpose:

Provider Contract Test Kit, shared testing utilities, fake providers.

---

## Wave 12 — Examples

Purpose:

Executable documentation.

---

## Wave 13 — Documentation Hardening

Purpose:

Finalize documentation, API reference, guides, and release assets.

---

## Wave 14 — v0.1 Release

Purpose:

First public preview release.

Validated by:

- CI
- Contract Tests
- Documentation
- Example applications

---

# 6. Validation Strategy

Every implementation wave must be validated before the next wave begins.

Validation grows progressively as the repository matures.

---

## Wave 0 — Repository Bootstrap

Validation:

- Workspace installs successfully.
- Repository builds.
- Lint passes.
- Formatting passes.
- CI executes successfully.

Architecture Verification:

- Repository structure matches `PROJECT_STRUCTURE.md`.

---

## Wave 1 — Shared Foundation

Validation:

- Unit tests.
- Static analysis.
- Type checking.

Architecture Verification:

- No upward dependencies.

---

## Wave 2 — Public Contracts

Validation:

- Type tests.
- Serialization tests.
- API compatibility tests.

Architecture Verification:

- Public contracts exported only through package entry points.

---

## Wave 3 — Error Infrastructure

Validation:

- Unit tests.
- Error serialization.
- Stable error code verification.

Architecture Verification:

- Error hierarchy follows ADR-008.

---

## Wave 4 — Diagnostics

Validation:

- Event pipeline tests.
- Context propagation tests.

Architecture Verification:

- Diagnostics remain optional.
- No runtime behavior changes.

---

## Wave 5 — Authentication

Validation:

- Authentication strategy tests.
- Credential isolation tests.

Architecture Verification:

- Authentication remains provider-neutral.

---

## Wave 6 — Transport

Validation:

- Middleware tests.
- Retry tests.
- Timeout tests.
- Cancellation tests.

Architecture Verification:

- Transport remains provider-agnostic.

---

## Wave 7 — Cache

Validation:

- Cache hit/miss tests.
- TTL tests.
- Single-flight tests.

Architecture Verification:

- Cache never mutates domain objects.

---

## Wave 8 — Core

Validation:

- Repository lifecycle.
- Provider resolution.
- Repository factory.
- RepositoryRef lifecycle.

Architecture Verification:

- Core never imports providers.

---

## Wave 9 — Provider

Validation:

- Provider Contract Test Kit.
- Integration tests.
- Golden repositories.

Architecture Verification:

- Provider leakage tests.

---

## Wave 10+

Validation:

- Example compilation.
- Documentation synchronization.
- End-to-end tests.
- Release validation.

---

# 7. Incremental Deliverables

Every wave produces usable software.

---

## Wave 0

Deliverable:

Repository ready for development.

---

## Wave 1

Deliverable:

Reusable shared utilities.

---

## Wave 2

Deliverable:

Stable public contracts.

---

## Wave 3

Deliverable:

Stable public error model.

---

## Wave 4

Deliverable:

Diagnostics infrastructure operational.

---

## Wave 5

Deliverable:

Authentication abstractions usable.

---

## Wave 6

Deliverable:

Transport pipeline operational.

---

## Wave 7

Deliverable:

Caching infrastructure operational.

---

## Wave 8

Deliverable:

Core runtime functional with a mock provider.

---

## Wave 9

Deliverable:

GitHub repositories can be opened.

Basic repository operations work.

---

## Wave 10

Deliverable:

Public SDK operational.

Quick Start examples compile.

---

## Wave 11

Deliverable:

Provider certification available.

---

## Wave 12

Deliverable:

Reference applications published.

---

## Wave 13

Deliverable:

Documentation site complete.

---

## Wave 14

Deliverable:

v0.1 released.

---

# 8. Dependency Constraints

The following rules are mandatory.

---

## Infrastructure

Infrastructure packages are implemented before runtime packages.

---

## Shared

`shared`

must exist before every other package.

---

## Contracts

Public contracts must stabilize before runtime implementation.

---

## Errors

Every runtime package uses the shared error model.

No package defines its own public error hierarchy.

---

## Diagnostics

Diagnostics are available before runtime features.

---

## Authentication

Authentication precedes transport.

---

## Transport

Transport precedes providers.

---

## Cache

Cache precedes Core.

---

## Core

Core precedes all providers.

---

## Providers

Providers never depend on each other.

---

## Public SDK

The public SDK is implemented only after the runtime stabilizes.

---

## Testing

Testing infrastructure depends only on public contracts.

Never package internals.

---

## Examples

Examples consume only published public APIs.

---

## Documentation

Documentation is synchronized continuously and finalized before release.

---

# 9. Risk Analysis

---

## Wave 0

Risk

Repository tooling instability.

Mitigation

Validate bootstrap on clean environments.

Rollback

Revert tooling changes.

---

## Wave 1

Risk

Duplicate utilities.

Mitigation

Centralize reusable helpers.

---

## Wave 2

Risk

Public contract churn.

Mitigation

Complete API review before implementation.

---

## Wave 3

Risk

Incorrect error semantics.

Mitigation

Verify against ADR-008.

---

## Wave 4

Risk

Observability coupling.

Mitigation

Keep diagnostics, as provided through `@gitbridge/observability`, framework-neutral.

---

## Wave 5

Risk

Authentication abstraction leaks.

Mitigation

Contract tests.

---

## Wave 6

Risk

Transport abstraction too HTTP-centric.

Mitigation

Validate against local provider scenarios.

---

## Wave 7

Risk

Incorrect cache invalidation.

Mitigation

Golden cache tests.

---

## Wave 8

Risk

Repository lifecycle complexity.

Mitigation

Incremental implementation.

---

## Wave 9

Risk

Provider SDK leakage.

Mitigation

Contract tests.

---

## Wave 10+

Risk

Documentation drift.

Mitigation

Automated validation.

Required Reviews:

- Architecture compliance
- API review
- Test review
- Documentation review
