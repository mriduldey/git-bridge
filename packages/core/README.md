# @gitbridge/core

Provider-neutral GitBridge core runtime.

This package implements the finalized Core SDK surface:

- `GitBridgeClient` construction and lifecycle
- configuration resolution and dependency composition
- provider and capability registration
- provider resolution and session creation
- `Repository` and `RepositoryRef` service objects
- provider-neutral capability service wiring
- cache, authentication, transport, and diagnostics dependency integration

Core intentionally remains provider-agnostic. It does not implement GitHub or any other concrete
provider package, and it does not expose provider SDK objects through its public API.
