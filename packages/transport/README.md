# @gitbridge/transport

Provider-neutral transport pipeline and middleware for GitBridge.

This package implements the foundational transport helpers described by ADR-007. It owns immutable
transport request/response helpers, middleware composition, retry, timeout, request id,
cancellation, compression negotiation, and noop transport utilities.

It does not own provider resolution, authentication lifecycle, repository lifecycle, domain model
mapping, cache orchestration, diagnostics implementation, or protocol-specific adapters.
