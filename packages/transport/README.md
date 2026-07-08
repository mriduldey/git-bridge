# @repoferry/transport

Provider-neutral transport primitives and middleware for RepoFerry.

## Responsibilities

- Create immutable transport requests and responses.
- Compose transport middleware.
- Provide retry, timeout, cancellation, request ID, user agent, and compression middleware.
- Normalize unknown transport failures into public RepoFerry errors.

## Install

```sh
pnpm add @repoferry/transport
```

## Usage

```ts
import {
  createRetryMiddleware,
  createTimeoutMiddleware,
  createTransportPipeline
} from "@repoferry/transport";

const transport = createTransportPipeline({
  middleware: [createTimeoutMiddleware({ timeoutMs: 10_000 }), createRetryMiddleware()],
  transport: {
    async execute(request) {
      return { body: undefined, status: 204, headers: request.headers };
    }
  }
});
```

Providers may use transport directly or adapt provider SDK clients through provider-owned adapters.
