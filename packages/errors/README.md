# @sourceaxis/errors

Stable public error hierarchy for SourceAxis.

## Responsibilities

- Provide `SourceAxisError` as the base public error type.
- Expose stable error codes, retryability, categories, severity, timestamps, diagnostics, and
  serialization.
- Provide typed subclasses for authentication, authorization, configuration, provider, repository,
  transport, timeout, cancellation, validation, conflict, not-found, rate-limit, unsupported
  capability, and unexpected failures.

## Install

```sh
pnpm add @sourceaxis/errors
```

## Usage

```ts
import { SourceAxisError } from "@sourceaxis/errors";

try {
  await operation();
} catch (error) {
  if (error instanceof SourceAxisError) {
    console.error(error.code, error.retryability, error.diagnostics);
  } else {
    throw error;
  }
}
```

Use `serialize()` or `toJSON()` for safe diagnostics and telemetry payloads.
