# Repository File Reader

Reads a text file from the default branch of a GitHub repository.

## Run

```sh
pnpm --filter @sourceaxis/example-repository-file-reader build
pnpm --filter @sourceaxis/example-repository-file-reader start
```

Optional environment variables:

- `SOURCEAXIS_GITHUB_TOKEN`
- `SOURCEAXIS_REPOSITORY_URL`
- `SOURCEAXIS_FILE_PATH`, defaulting to `README.md`
