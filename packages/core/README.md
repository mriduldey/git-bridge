# @repoferry/core

Provider-neutral RepoFerry runtime foundation.

## Responsibilities

- Create isolated RepoFerry clients with explicit configuration.
- Register and resolve providers.
- Open repositories from provider-supported locators.
- Create repository and repository reference service objects.
- Bind provider session capabilities to public repository APIs.
- Own client and repository lifecycle disposal.

## Install

```sh
pnpm add @repoferry/core
```

Install at least one provider package, such as `@repoferry/provider-github`, before opening
repositories.

## Usage

```ts
import { createRepoFerryClient } from "@repoferry/core";
import { createGitHubProviderConfig } from "@repoferry/provider-github";

const client = createRepoFerryClient({
  ...createGitHubProviderConfig()
});

try {
  const repository = await client.open("https://github.com/octokit/rest.js");
  const ref = repository.ref(repository.info.defaultBranch ?? "main");
  const readme = await ref.files.readText("README.md");

  console.log(repository.info.fullName, readme.length);

  await repository.dispose();
} finally {
  await client.dispose();
}
```

## Public API

- `createRepoFerryClient`
- `resolveRepoFerryConfig`
- `resolveConfiguration`
- `createRepository`
- `createRepositoryRef`
- `RepoFerryClient`
- `Repository`
- `RepositoryRef`
- `RepositoryFactory`

All provider behavior is reached through public provider contracts and registered providers. Do not
import provider or core internals from applications.
