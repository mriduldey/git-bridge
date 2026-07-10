# @sourceaxis/testing

Testing helpers and provider certification utilities for SourceAxis.

## Responsibilities

- Provide deterministic fake transport, fake provider, and fake repository fixtures.
- Capture diagnostics in tests.
- Assert SourceAxis error shapes.
- Run provider certification suites against provider implementations.

## Install

```sh
pnpm add -D @sourceaxis/testing
```

## Usage

```ts
import { createDiagnosticCapture, createFakeProvider } from "@sourceaxis/testing";

const diagnostics = createDiagnosticCapture();
const provider = createFakeProvider();

console.log(diagnostics.events.length, provider.info.id);
```

Provider packages should use certification helpers to prove contract behavior without relying on
application-specific test code.
