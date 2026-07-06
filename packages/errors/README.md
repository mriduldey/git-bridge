# @gitbridge/errors

Stable public error hierarchy for GitBridge.

## Responsibilities

- Provide `GitBridgeError` as the base public error type.
- Expose stable error codes, retryability, categories, severity, timestamps, diagnostics, and
  serialization.
- Provide typed subclasses for authentication, authorization, configuration, provider, repository,
  transport, timeout, cancellation, validation, conflict, not-found, rate-limit, unsupported
  capability, and unexpected failures.

## Install

```sh
pnpm add @gitbridge/errors
```

## Usage

```ts
import { GitBridgeError } from "@gitbridge/errors";

try {
  await operation();
} catch (error) {
  if (error instanceof GitBridgeError) {
    console.error(error.code, error.retryability, error.diagnostics);
  } else {
    throw error;
  }
}
```

Use `serialize()` or `toJSON()` for safe diagnostics and telemetry payloads.
