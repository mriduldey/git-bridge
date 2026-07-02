# PROJECT_STRUCTURE.md

> Canonical Repository Blueprint for GitBridge
>
> **Status:** Accepted
>
> **Architecture:** ADR-001 → ADR-015
>
> **Implementation:** IMPLEMENTATION_PLAN.md

---

# 1. Repository Philosophy

## Purpose

This document defines the physical organization of the GitBridge repository.

It specifies:

- repository layout,
- package organization,
- folder ownership,
- documentation organization,
- testing structure,
- contributor expectations.

It intentionally does **not** redefine architecture.

---

## Design Principles

The repository follows these principles.

### Single Responsibility

Every package owns one primary responsibility.

Examples:

- Core runtime
- Authentication
- Transport
- GitHub Provider

Responsibilities do not overlap.

---

### Explicit Ownership

Every directory has an owner.

Ownership is defined at the package boundary.

Examples:

```text
packages/core
```

owns the Core runtime.

```text
packages/provider-github
```

owns GitHub integration.

---

### Shallow Structure

Avoid unnecessary folder nesting.

Navigation should remain intuitive.

---

### Architecture Mirrors Repository

Repository organization follows the accepted architecture.

There should never be multiple competing structures.

---

### Independent Packages

Each package should:

- build independently,
- test independently,
- document independently.

---

### Contributor Friendly

A contributor should quickly determine:

- where code belongs,
- where tests belong,
- where documentation belongs,
- where examples belong.

---

# 2. High-Level Repository Layout

```text
gitbridge/

├── .changeset/
├── .github/
├── .husky/
├── docs/
├── examples/
├── packages/
├── test/
├── scripts/
├── tooling/
├── .editorconfig
├── .gitignore
├── .npmrc
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── README.md
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── IMPLEMENTATION_PLAN.md
├── PROJECT_STRUCTURE.md
└── ARCHITECTURE.md
```

---

## Top-Level Directory Responsibilities

### `.github/`

Repository automation.

Contains:

- workflows,
- issue templates,
- pull request templates,
- discussion templates.

---

### `.changeset/`

Version management.

Owns:

- release planning,
- changelog generation,
- version bumps.

---

### `.husky/`

Git hooks.

Examples:

- pre-commit,
- commit-msg.

---

### `docs/`

All project documentation.

Owns:

- architecture,
- API documentation,
- guides,
- tutorials,
- migration guides.

---

### `examples/`

Executable example applications.

Every example must compile.

---

### `packages/`

All production packages.

No documentation or tooling belongs here.

---

### `test/`

Repository-wide testing assets.

Examples:

- Golden Repositories,
- integration fixtures,
- benchmark datasets.

Package-specific tests remain inside each package.

---

### `scripts/`

Engineering automation.

Examples:

- release scripts,
- validation scripts,
- documentation generation.

---

### `tooling/`

Reusable tooling configuration.

Examples:

- shared ESLint config,
- shared tsconfig,
- reusable build utilities.

---

# 3. Package Structure

```text
packages/

├── gitbridge/
├── shared/
├── contracts/
├── errors/
├── diagnostics/
├── auth/
├── transport/
├── cache/
├── core/
├── provider-github/
├── provider-gitlab/
├── provider-bitbucket/
├── provider-azure/
├── provider-gitea/
└── testing/
```

Each package owns exactly one architectural responsibility.

---

## gitbridge

### Purpose

Public SDK.

Minimal implementation.

Acts as the canonical entry point.

---

### Public Exports

- GitBridgeClient
- public contracts
- public errors

---

### Dependencies

Depends only on stable public packages.

---

### Future

Should remain intentionally small.

---

## shared

### Purpose

Shared utilities.

Examples:

- collection helpers,
- string utilities,
- invariant helpers,
- reusable internal utilities.

---

### Public API

Minimal.

Only utilities intended for cross-package reuse.

---

### Dependencies

None.

This package sits at the bottom of the dependency graph.

---

## contracts

### Purpose

Public contracts defined by ADR-011.

Contains:

- interfaces,
- value models,
- request/response contracts,
- public enums/string unions.

---

### Public API

Entire package.

---

### Dependencies

Only `shared`.

---

### Future

Expands as public APIs evolve.

---

## errors

### Purpose

Public error hierarchy.

Implements ADR-008.

---

### Public API

- RepoKitError equivalent hierarchy
- stable error codes
- diagnostic metadata

---

### Dependencies

- shared
- contracts

---

## diagnostics

### Purpose

Diagnostics infrastructure.

Examples:

- events,
- metrics,
- tracing contracts.

---

### Dependencies

- contracts
- shared

---

## auth

### Purpose

Authentication abstractions.

Implements ADR-006.

---

### Public API

Authentication strategies.

Credential contracts.

---

### Dependencies

- contracts
- diagnostics
- errors

---

## transport

### Purpose

Transport abstraction.

Implements ADR-007.

---

### Public API

Transport interfaces.

Middleware contracts.

---

### Dependencies

- auth
- diagnostics
- errors

---

## cache

### Purpose

Caching infrastructure.

Implements ADR-009.

---

### Dependencies

- shared
- diagnostics

---

## core

### Purpose

Runtime implementation.

Contains:

- Client,
- Repository,
- RepositoryRef,
- Provider Registry,
- Repository Factory.

---

### Public API

Minimal.

Consumers interact through `gitbridge`.

---

### Dependencies

- transport
- auth
- cache
- diagnostics
- errors
- contracts

---

## provider-github

### Purpose

GitHub implementation.

Contains:

- provider adapter,
- capability implementations,
- model mappers.

---

### Dependencies

- core
- transport
- auth

Never imported by Core.

---

## provider-gitlab

Future implementation.

Same responsibility pattern as GitHub.

---

## provider-bitbucket

Future implementation.

---

## provider-azure

Future implementation.

---

## provider-gitea

Community/official provider.

---

## testing

### Purpose

Testing infrastructure.

Contains:

- Contract Test Kit,
- fake providers,
- reusable assertions,
- testing utilities.

---

### Dependencies

Depends only on public packages.

Never on package internals.

---

# 8. Scripts & Tooling

Engineering automation is isolated from production code.

```text
scripts/

├── build/
├── release/
├── validation/
├── documentation/
├── development/
└── utilities/
```

---

## scripts/build/

Repository build automation.

Examples:

- clean
- build
- package validation

---

## scripts/release/

Release automation.

Examples:

- version preparation
- changelog generation
- release verification
- publication helpers

---

## scripts/validation/

Repository validation.

Examples:

- architecture verification
- dependency validation
- export validation
- API compatibility

---

## scripts/documentation/

Documentation automation.

Examples:

- API generation
- diagram generation
- broken-link checking
- documentation synchronization

---

## scripts/development/

Developer convenience.

Examples:

- bootstrap
- local validation
- workspace maintenance

---

## scripts/utilities/

Reusable engineering utilities.

---

# Tooling

```text
tooling/

├── eslint/
├── prettier/
├── typescript/
├── vitest/
├── changesets/
├── github/
└── shared/
```

Tooling packages contain reusable configuration only.

Production packages never own shared tooling configuration.

---

# 9. Configuration Files

Root configuration belongs at the repository root.

---

## package.json

Workspace root.

Owns:

- workspace scripts
- package manager configuration
- repository metadata

---

## pnpm-workspace.yaml

Workspace definition.

Defines package discovery.

---

## turbo.json

Task graph.

Defines:

- build ordering
- caching
- incremental execution

---

## tsconfig.base.json

Shared TypeScript configuration.

Inherited by every package.

---

## eslint.config.\*

Repository lint configuration.

Shared across all packages.

---

## prettier.config.\*

Repository formatting rules.

---

## vitest.workspace.\*

Shared testing configuration.

---

## .changeset/

Release management.

---

## .github/

Automation.

Contains:

- CI
- issue templates
- release workflows

---

## .editorconfig

Editor consistency.

---

## .npmrc

Repository package manager behavior.

---

## LICENSE

Project licensing.

---

## SECURITY.md

Security reporting process.

---

## CONTRIBUTING.md

Contributor onboarding.

---

## CODE_OF_CONDUCT.md

Community expectations.

---

# 10. Dependency Rules

Dependency direction follows the architecture.

Higher layers may depend only on lower layers.

Never the reverse.

---

## Allowed Dependency Graph

```text
shared

↓

contracts

↓

errors

↓

diagnostics

↓

auth

↓

transport

↓

cache

↓

core

↓

provider-*

↓

testing

↓

gitbridge
```

---

## Package Rules

### shared

Depends on nothing.

---

### contracts

Depends only on:

- shared

---

### errors

Depends only on:

- contracts
- shared

---

### diagnostics

Depends only on:

- contracts
- shared

---

### auth

Depends on:

- contracts
- diagnostics
- errors

---

### transport

Depends on:

- auth
- diagnostics
- errors

---

### cache

Depends on:

- diagnostics
- shared

---

### core

Depends on runtime infrastructure only.

Never imports providers.

---

### providers

May depend on:

- core
- transport
- auth

Never depend on each other.

---

### testing

Depends only on public packages.

Never imports package internals.

---

### gitbridge

Public aggregation package.

Never contains business logic.

---

# Forbidden Dependencies

Examples:

Core

×

Provider

Provider

×

Provider

Contracts

×

Core

Shared

×

Any upward dependency

Internal

×

External package import

All forbidden dependencies are verified through Architecture Tests.

---

# 11. Naming Conventions

Consistency is preferred over brevity.

---

## Packages

Use:

```text
@gitbridge/<name>
```

Examples:

```text
@gitbridge/core
@gitbridge/provider-github
@gitbridge/testing
```

---

## Folders

Use:

lowercase-kebab-case

Examples:

```text
provider-github
golden-repositories
custom-provider
```

---

## Source Files

Use:

lowercase-kebab-case.ts

Examples:

```text
provider-registry.ts
repository-factory.ts
authentication-context.ts
```

---

## Classes

PascalCase.

---

## Interfaces

PascalCase.

Avoid the `I` prefix.

---

## Types

PascalCase.

Semantic aliases preferred.

Examples:

RepositoryName

CommitSha

BranchName

---

## Tests

Mirror the source layout.

Examples:

```text
provider-registry.test.ts
repository.test.ts
```

---

## Fixtures

Describe behavior.

Examples:

```text
empty-repository.json
large-tree.json
unicode-readme.md
```

---

## Scripts

Verb-oriented.

Examples:

```text
validate-api
generate-docs
verify-release
```

---

## Documentation

Uppercase canonical names.

Examples:

```text
ARCHITECTURE.md
IMPLEMENTATION_PLAN.md
PROJECT_STRUCTURE.md
```
