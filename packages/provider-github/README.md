# @gitbridge/provider-github

GitHub provider implementation for GitBridge.

## Responsibilities

- Match GitHub repository URLs.
- Create GitHub-backed provider sessions.
- Map GitHub repository, branch, commit, file, search, issue, pull request, release, and tag models
  to provider-neutral contracts.
- Convert GitHub and transport failures into public GitBridge errors.

## Install

```sh
pnpm add @gitbridge/core @gitbridge/provider-github @gitbridge/auth
```

## Usage

```ts
import { createAuthContext, tokenAuth } from "@gitbridge/auth";
import { createGitBridgeClient, type AuthenticationStrategy } from "@gitbridge/core";
import { createGitHubProviderConfig, GitHubProviderId } from "@gitbridge/provider-github";

const token = process.env.GITHUB_TOKEN;
const authentication: AuthenticationStrategy | undefined =
  token === undefined
    ? undefined
    : {
        async authenticate() {
          return createAuthContext(tokenAuth({ provider: GitHubProviderId, token }));
        }
      };

const client = createGitBridgeClient({
  ...createGitHubProviderConfig(),
  authentication
});
```

## Capabilities

GitHub currently supports files, tree, history, search, branches, tags, releases, issues, and pull
requests.

## Configuration

`createGitHubProviderConfig` returns a client config fragment with a GitHub provider instance.
`createGitHubProvider` creates the provider directly for advanced registration flows. Use
`GITBRIDGE_GITHUB_TOKEN` or an equivalent secret source in examples and applications; never hardcode
credentials.
