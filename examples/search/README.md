# Search

Searches code in a GitHub repository. GitHub code search usually requires authenticated access, so
set `GITBRIDGE_GITHUB_TOKEN`.

## Run

```sh
pnpm --filter @gitbridge/example-search build
pnpm --filter @gitbridge/example-search start
```

Optional environment variables:

- `GITBRIDGE_GITHUB_TOKEN`
- `GITBRIDGE_REPOSITORY_URL`
- `GITBRIDGE_SEARCH_QUERY`, defaulting to `Octokit`
