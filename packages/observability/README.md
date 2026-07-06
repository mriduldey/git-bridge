# @gitbridge/observability

Diagnostics, logging, metrics, tracing, and metadata sanitization for GitBridge.

## Responsibilities

- Create diagnostics services and diagnostic events.
- Sanitize structured metadata before logging or telemetry.
- Provide logger, logger factory, metric collector, and tracer abstractions.
- Provide no-op defaults for SDK-safe configuration.

## Install

```sh
pnpm add @gitbridge/observability
```

## Usage

```ts
import { createDiagnosticsService } from "@gitbridge/observability";

const diagnostics = createDiagnosticsService();
await diagnostics.subscribe((event) => {
  console.log(event.kind, event.name);
});
```

Diagnostics are observational. Subscriber failures are isolated and must not change repository
operation behavior.
