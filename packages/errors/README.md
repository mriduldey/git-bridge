# @repoferry/errors

Stable public error hierarchy for RepoFerry.

## Responsibilities

- Provide `RepoFerryError` as the base public error type.
- Expose stable error codes, retryability, categories, severity, timestamps, diagnostics, and
  serialization.
- Provide typed subclasses for authentication, authorization, configuration, provider, repository,
  transport, timeout, cancellation, validation, conflict, not-found, rate-limit, unsupported
  capability, and unexpected failures.

## Install

```sh
pnpm add @repoferry/errors
```

## Usage

```ts
import { RepoFerryError } from "@repoferry/errors";

try {
  await operation();
} catch (error) {
  if (error instanceof RepoFerryError) {
    console.error(error.code, error.retryability, error.diagnostics);
  } else {
    throw error;
  }
}
```

Use `serialize()` or `toJSON()` for safe diagnostics and telemetry payloads.
