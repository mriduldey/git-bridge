# Repository File Reader

Reads a text file from the default branch of a GitHub repository.

## Run

```sh
pnpm --filter @gitbridge/example-repository-file-reader build
pnpm --filter @gitbridge/example-repository-file-reader start
```

Optional environment variables:

- `GITBRIDGE_GITHUB_TOKEN`
- `GITBRIDGE_REPOSITORY_URL`
- `GITBRIDGE_FILE_PATH`, defaulting to `README.md`
