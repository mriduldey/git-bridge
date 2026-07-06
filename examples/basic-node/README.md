# Basic Node Example

Opens a GitHub repository with the public GitBridge client and prints repository metadata.

## Run

```sh
pnpm --filter @gitbridge/example-basic-node build
pnpm --filter @gitbridge/example-basic-node start
```

Optional environment variables:

- `GITBRIDGE_GITHUB_TOKEN`: GitHub token for higher rate limits or private repositories.
- `GITBRIDGE_REPOSITORY_URL`: repository URL. Defaults to `https://github.com/octokit/rest.js`.
