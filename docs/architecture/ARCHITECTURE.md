# GitBridge Architecture

This document is derived from ADR-001 through ADR-015. The ADRs remain the
source of truth when this overview and an ADR differ.

## System Shape

GitBridge is a provider-neutral TypeScript SDK for working with hosted Git
repositories. Applications use the public `gitbridge` entry point and stable
contracts. Provider SDKs and provider response models remain implementation
details.

The runtime flow is:

```text
Application -> GitBridge Client -> Provider -> Transport -> Repository host
```

Core selects a provider, creates a provider session, constructs repository
service objects, and manages lifecycle. Providers adapt host-specific behavior
to GitBridge contracts. Transport owns protocol execution and middleware.

## Package Boundaries

- `gitbridge` is the public convenience entry point.
- `@gitbridge/contracts` owns public provider-neutral contracts and domain
  value models.
- `@gitbridge/core` owns client lifecycle, provider resolution, repository
  factories, and repository references.
- `@gitbridge/provider-github` adapts GitHub behavior through the provider
  contract.
- `@gitbridge/auth`, `@gitbridge/transport`, `@gitbridge/cache`,
  `@gitbridge/errors`, `@gitbridge/observability`, `@gitbridge/testing`, and
  `@gitbridge/shared` provide foundation capabilities.

Foundational packages must not depend on provider packages. Core must not import
providers. Providers depend on contracts and foundation packages, not the other
way around.

## Public API Model

The public API is service-oriented:

- `GitBridgeClient` owns configuration, providers, cache, transport, and
  diagnostics.
- `Repository` represents provider-neutral repository identity and metadata.
- `RepositoryRef` binds operations to an explicit branch, tag, commit, or other
  reference.
- Capability services such as `files`, `tree`, `history`, `search`, `branches`,
  `tags`, `releases`, `issues`, and `pullRequests` expose cohesive operations.

Returned domain models are immutable value objects. Provider SDK models never
become public contracts.

## Provider Architecture

Providers are ports-and-adapters implementations. A provider owns URL matching,
session creation, capability implementation, provider model mapping, and
provider error translation.

Providers must:

- implement the public `Provider` and `ProviderSession` contracts,
- expose provider-neutral capability services,
- map provider responses to GitBridge domain models,
- translate provider failures into GitBridge errors,
- use Transport for outbound communication.

Providers must not:

- construct `RepositoryRef`,
- expose provider SDK clients or SDK models,
- bypass Transport for protocol execution,
- own global cache state.

## Transport

Transport executes infrastructure requests. Providers describe what operation is
needed; Transport executes how it is performed. Middleware owns cross-cutting
concerns such as retry, timeout, request IDs, headers, compression negotiation,
and cancellation.

Protocol-specific details do not escape Transport boundaries. Provider code
communicates through `TransportRequest`, `TransportResponse`, and
`TransportContext`.

## Authentication

Authentication is explicit and provider scoped. Strategies create immutable
authentication contexts. Credentials are redacted for diagnostics and must not
leak through errors, logs, or metadata.

## Errors

All public failures are represented by `GitBridgeError` subclasses with stable
codes, retryability, category, severity, diagnostics, and serialization.
Provider and transport failures are translated at their respective boundaries.

## Cache

Caching is an optional Core responsibility built on provider-neutral cache
contracts. The implemented cache package provides cache keys, immutable entries,
policies, named caches, memory storage, and a registry. Providers may receive
cache references through context, but they must not own global cache state or
store provider SDK models.

Current provider operations preserve the cache boundary and do not introduce
hidden provider-owned caches. Cache behavior remains explicit through the cache
contracts and registry.

## Observability

Diagnostics, logging, metrics, and tracing are observational. Subscriber
failures must not change SDK behavior. Observability metadata is structured,
sanitized, and provider-neutral.

## Testing and Governance

Architecture tests enforce package direction, provider isolation, public export
rules, release metadata, and provider certification coverage. Provider contract
tests verify reusable provider compatibility. ADR-015 governs future
architectural changes through new ADRs or approved amendments.
