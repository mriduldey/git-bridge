# @gitbridge/auth

Provider-neutral authentication primitives for GitBridge.

This package implements the foundational authentication helpers described by ADR-006. It owns
immutable auth configuration helpers, credential creation, safe credential summaries, redaction, and
runtime guards.

It does not own provider-specific authentication flows, token storage, provider SDK integration,
repository lifecycle, transport, cache, or diagnostics implementations.

`customAuth()` is a provider-neutral configuration marker for future custom strategies. It does not
implement provider-specific custom authentication behavior.
