# bun-service-template

GitHub template for scaffolding Bun + TypeScript projects with batteries-included tooling.

## Use this template

**GitHub UI:** Click **"Use this template"** → **"Create a new repository"** at the top of this page.

**CLI:**

```bash
gh repo create my-project --template OWNER/bun-service-template --private --clone
cd my-project
bun install
bun run start
```

## First steps after cloning

1. **Change the port** in `src/config.ts` — pick a random/distinct value (e.g. 7123) to avoid collisions with other projects on the same machine. This is the most important thing to do first.
2. **Rename the binary** — update the `bin` field in `package.json` from `myapp` to your project name.
3. **Update `package.json`** — change `name` to your project name.
4. **Choose your mode** — see below.

## Modes

### Service mode

For long-lived processes: backend APIs, full-stack web apps, bots, workers.

The app runs via `bun run src/index.ts serve`. Deploy with Docker:

```bash
docker compose up
```

The `production` stage in the Dockerfile runs bun directly. The `docker-compose.yml` maps the port and sets env vars.

Keep: `Dockerfile`, `docker-compose.yml`, the `production` stage.
Remove if not needed: the `build` stage in the Dockerfile.

### Package mode

For distributable JavaScript packages built with `bun build --minify`.

```bash
bun run build   # outputs minified bundle to dist/
```

The build produces a single minified JS file targeting Node.js. Mark peer/external dependencies with `--external`:

```json
"build": "bun build src/index.ts --outdir dist --target=node --minify --external some-peer-dep"
```

Configure `files` in `package.json` to control what gets published:

```json
"files": ["dist/"],
"main": "dist/index.js"
```

Keep: the `build` stage in the Dockerfile.
Remove if not needed: `docker-compose.yml`, the `production` stage.

## Conventions

| Tool | Convention | Why |
|---|---|---|
| **Bun** | Runtime, bundler, test runner, package manager | Fast, all-in-one TypeScript runtime |
| **TypeScript** | Strict mode, ESNext, bundler module resolution | Maximum type safety with modern JS |
| **Biome** | Formatter + linter: 2-space indent, 100-char lines, double quotes, trailing commas, semicolons always | Single tool for formatting and linting, fast |
| **Zod** | Schema validation for config, env parsing, API inputs | Runtime type safety with TypeScript inference |
| **dotenvx** | Encrypted `.env` files for secrets | Secrets encrypted at rest, committed safely |
| **@clack/prompts** | Interactive CLI prompts | Beautiful terminal UIs |
| **Playwright** | E2E tests with Firefox only | Browser testing without Chrome dependency |
| **Docker** | Multi-stage builds, docker-compose for local dev | Consistent environments |
| **GitHub Actions** | CI with three-layer caching | Fast, reliable CI |

## Config pattern

Configuration is parsed from `process.env` using a Zod schema in `src/config.ts`:

```typescript
import { z } from "zod";

export const ConfigSchema = z.object({
  port: z.coerce.number().int().positive().default(3000),
}).readonly();

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    port: process.env.PORT,
  });
}
```

`z.coerce.number()` handles the string-to-number conversion from env vars. Add new config fields to the schema — they get type inference, validation, and defaults automatically.

## Secrets with dotenvx

For projects that need encrypted secrets (API keys, tokens, credentials). See the [dotenvx docs](https://dotenvx.com/docs) for full usage.

```bash
bun add @dotenvx/dotenvx
```

```bash
# Set a secret in a specific environment file
bunx dotenvx set -f .env.production SECRET_KEY "my-secret-value"
bunx dotenvx set -f .env.staging SECRET_KEY "my-staging-value"
```

All `.env` files (`.env`, `.env.production`, `.env.staging`, etc.) are encrypted by dotenvx and safe to commit. The `.gitignore` only excludes `.env.keys` which contains the decryption keys — never commit that file.

Load secrets in code:

```typescript
import dotenvx from "@dotenvx/dotenvx";
dotenvx.config();
// process.env.SECRET_KEY is now available
```

## Testing

### Unit tests

```bash
bun test               # run all unit tests
bun test --coverage    # with coverage report
```

Tests live in `test/` and use Bun's built-in test runner. Coverage threshold is **95% line coverage**, enforced by CI.

### E2E tests

```bash
bun run test:e2e       # headless Firefox
bun run test:e2e:ui    # interactive UI mode (visible browser, step-through)
bun run test:e2e:debug # debug mode with inspector
```

E2E tests live in `tests/e2e/` and use Playwright with **Firefox only**.

For local development, run tests natively for fast iteration and interactive debugging. Before pushing, verify against the CI-identical environment:

```bash
docker compose run --rm e2e
```

### Disabling Playwright

If your project doesn't need e2e tests:

1. Delete `playwright.config.ts` and `tests/e2e/`
2. Remove `@playwright/test` from `devDependencies`
3. Remove the `test:e2e*` scripts from `package.json`

The CI e2e job auto-skips when `playwright.config.ts` is absent.

## CI

The GitHub Actions pipeline has three jobs:

```
test → e2e → build
```

**test** — Runs inside Docker (`docker build --target test`):
- Biome lint check
- TypeScript typecheck (`tsc --noEmit`)
- Unit tests with coverage (JUnit + lcov reports posted to PR)
- 95% coverage minimum enforced

**e2e** — Runs natively on the GHA runner (for browser caching):
- Skipped if `playwright.config.ts` doesn't exist
- Playwright Firefox tests with report summary posted to PR
- Test artifacts (reports, screenshots, videos) uploaded

**build** — Docker production image build (verifies the image builds successfully)

### Caching

Three cache layers for fast CI:

1. **Docker layers** — `cache-from: type=gha` / `cache-to: type=gha,mode=max` on all Docker builds
2. **Bun dependencies** — `actions/cache@v4` keyed on `bun.lock` hash
3. **Playwright browsers** — `actions/cache/restore` + `save` keyed on Playwright version. Downloads browsers only on cache miss.

## Docker

The Dockerfile has three stages:

| Stage | Base | Purpose |
|---|---|---|
| `test` | `oven/bun:1` | Lint + typecheck + unit tests with coverage |
| `build` | `oven/bun:1` | `bun build --minify` for package mode |
| `production` | `oven/bun:1` | Runtime for service mode |

A separate `Dockerfile.e2e` based on `mcr.microsoft.com/playwright` is used by `docker compose run e2e` for environment-consistent e2e testing.

## Browser policy

All projects use **Firefox only** for e2e testing. Chrome is explicitly not used.

## Git hooks

The pre-commit hook runs `biome check` on staged `.ts` and `.json` files. It's configured via:

```json
"prepare": "git config core.hooksPath .githooks"
```

Run `bun install` after cloning to activate the hooks (the `prepare` script runs automatically).
