# SourceAxis

SourceAxis is a provider-neutral TypeScript SDK for opening source-code repositories and working
with files, branches, commits, issues, pull requests, releases, and tags through stable public
contracts.

One API across source providers.

## Installation

For GitHub-only alpha releases before npm publishing, install commands are shown as the intended npm
usage. Until packages are published, use the repository source/tag directly.

For GitHub-first applications:

```sh
pnpm add @sourceaxis/provider-github
```

For provider-neutral applications that register providers explicitly:

```sh
pnpm add sourceaxis @sourceaxis/provider-github
```

SourceAxis requires Node.js `>=20.19.0` and pnpm `>=10.0.0` in this repository.

## 30-Second Quick Start

```ts
import { createGitHubClient } from "@sourceaxis/provider-github";

const client = createGitHubClient();

try {
  const repository = await client.open("https://github.com/microsoft/TypeScript");
  const readme = await repository.readText("README.md");

  console.log(repository.info.fullName);
  console.log(readme.slice(0, 200));

  await repository.dispose();
} finally {
  await client.dispose();
}
```

## GitHub Example

Use `SOURCEAXIS_GITHUB_TOKEN` for private repositories or higher API limits:

```ts
import { createGitHubClient } from "@sourceaxis/provider-github";

const token = process.env.SOURCEAXIS_GITHUB_TOKEN;
const client = createGitHubClient(token === undefined ? {} : { token });

const repository = await client.open("https://github.com/microsoft/TypeScript");
const ref = repository.defaultRef();

console.log(await ref.files.exists("package.json"));
console.log(await ref.files.readJson("package.json"));
console.log((await ref.commits.list({ limit: 5 })).items);
```

## Common Tasks

```ts
const repository = await client.open("https://github.com/microsoft/TypeScript");
const ref = repository.defaultRef();

await repository.readText("README.md");
await repository.readJson("package.json");
await repository.exists(".github/workflows");

await ref.files.getMetadata("README.md");
await ref.branches.list({ limit: 10 });
await ref.commits.list({ limit: 5 });
await ref.search.text("createGitHubClient", { limit: 5 });
await ref.issues?.list({ limit: 10 });
await ref.pullRequests?.list({ limit: 10 });
```

## Error Handling

All public SourceAxis errors extend `SourceAxisError` and expose stable `code`, `retryability`,
`category`, `severity`, `diagnostics`, and `serialize()` fields.

```ts
import { SourceAxisError } from "sourceaxis";

try {
  await repository.readText("missing.txt");
} catch (error) {
  if (error instanceof SourceAxisError) {
    console.error(error.code, error.retryability, error.diagnostics);
  } else {
    throw error;
  }
}
```

## Advanced Configuration

Use `sourceaxis` when your app should stay provider-neutral and register providers explicitly:

```ts
import { createSourceAxisClient } from "sourceaxis";
import { createGitHubProviderConfig, githubTokenAuth } from "@sourceaxis/provider-github";

const token = process.env.SOURCEAXIS_GITHUB_TOKEN;

const client = createSourceAxisClient({
  ...createGitHubProviderConfig(),
  authentication: token === undefined ? undefined : githubTokenAuth(token)
});
```

The same client accepts provider-neutral cache, transport, diagnostics, metrics, tracing, metadata,
and authentication dependencies.

## SDK Map

| Use case                                          | Import from                   |
| ------------------------------------------------- | ----------------------------- |
| GitHub-first application setup                    | `@sourceaxis/provider-github` |
| Provider-neutral client, errors, and auth helpers | `sourceaxis`                  |
| Direct core orchestration APIs                    | `@sourceaxis/core`            |
| Provider-neutral contracts and domain types       | `@sourceaxis/contracts`       |
| Provider certification and test doubles           | `@sourceaxis/testing`         |

Most applications should start with `@sourceaxis/provider-github`. Use `sourceaxis` when you want
the provider-neutral entry point. Use `@sourceaxis/testing` when building or certifying providers.

## Examples

Runnable examples live in [examples](examples) and follow a learning path:

1. `basic-node` opens a repository.
2. `github-repository-info` reads repository metadata.
3. `repository-file-reader` reads a file.
4. `branch-listing` lists branches.
5. `commit-history` lists commits.
6. `issue-listing` lists issues.
7. `pull-request-listing` lists pull requests.
8. `search` runs repository search.

Build all examples with:

```sh
pnpm build
```

Run an example with:

```sh
pnpm --filter @sourceaxis/example-basic-node start
```

## Architecture

ADR-001 through ADR-015 are accepted and authoritative. The architecture is frozen; runtime changes
must preserve those decisions.

SourceAxis is organized around explicit package boundaries:

- `sourceaxis` is the provider-neutral public entry point.
- `@sourceaxis/contracts` defines public provider-neutral contracts and domain types.
- `@sourceaxis/core` owns client lifecycle, provider registration, provider resolution, repository
  factories, repository references, and capability dispatch.
- `@sourceaxis/provider-github` adapts GitHub behavior to the provider contracts and includes
  GitHub-first DX helpers.
- `@sourceaxis/testing` supports provider certification and deterministic tests.

See [docs/architecture/INDEX.md](docs/architecture/INDEX.md) for ADRs, diagrams, and terminology.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), follow the accepted ADRs, and run validation before opening
changes:

```sh
pnpm lint
pnpm build
pnpm typecheck
pnpm test
pnpm run validate:architecture
```
