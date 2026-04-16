# bun-service-template

## Stack

- **Runtime/bundler/test/package manager:** Bun
- **Language:** TypeScript (strict mode)
- **Linter/formatter:** Biome 2.x — 2-space indent, 100-char lines, double quotes, trailing commas, semicolons always
- **Validation:** Zod v4
- **CLI prompts:** @clack/prompts
- **E2E testing:** Playwright with Firefox only (no Chrome)
- **Secrets:** dotenvx (encrypted .env files committed to repo; .env.keys never committed)
- **CI:** GitHub Actions (Docker-based test → Playwright e2e → Docker production build)

## Commands

```bash
bun test                # unit tests
bun test --coverage     # unit tests with coverage (95% threshold)
bun run test:e2e        # Playwright e2e tests (Firefox)
bun run lint            # biome check
bun run lint:fix        # biome check --write
bunx tsc --noEmit       # typecheck
bun run build           # bun build --minify to dist/
bun run serve           # start HTTP server
```

## Project structure

- `src/` — application source
- `test/` — unit tests (Bun test runner)
- `tests/e2e/` — Playwright e2e tests
- `.githooks/` — git hooks (pre-commit runs biome on staged files)

## Conventions

- Config is parsed from `process.env` via Zod schema in `src/config.ts`
- Server is created via `createServer()` in `src/server.ts`
- CLI entry point is `src/index.ts` with subcommands (serve, help)
- Unit test files live in `test/` and match `*.test.ts`
- E2E test files live in `tests/e2e/` and match `*.e2e.test.ts`
- Docker has three stages: `test`, `build`, `production`

## CI monitoring

To check CI status after pushing:

```bash
# List recent workflow runs
gh run list --limit 5

# Check a specific run's status
gh api repos/OWNER/REPO/actions/runs/RUN_ID --jq '{status: .status, conclusion: .conclusion}'

# View individual job results
gh api repos/OWNER/REPO/actions/runs/RUN_ID/jobs --jq '.jobs[] | {name: .name, conclusion: .conclusion}'

# View failed job logs
gh run view RUN_ID --log-failed
```

Use `gh api` for status checks (avoids annotation permission issues with `gh run view`). Poll with `--jq '.status'` until the value is no longer `in_progress` or `queued`.
