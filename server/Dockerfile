# --- Test stage: lint + typecheck + unit tests ---
FROM oven/bun:1 AS test
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run lint
RUN bunx tsc --noEmit
RUN bun test --coverage --coverage-reporter=lcov --coverage-dir=coverage \
    --reporter=default --reporter=junit --reporter-outfile=test-results.xml

# --- Build stage: minified bundle (package mode) ---
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY src/ src/
RUN bun build src/index.ts --outdir dist --target=node --minify

# --- Production stage: runtime (service mode) ---
FROM oven/bun:1 AS production
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY src/ src/
EXPOSE 3000
CMD ["bun", "run", "src/index.ts", "serve"]
