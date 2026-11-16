# Nessie server

Bun + TypeScript orchestrator: the speech API, the Nessie and parent agents, memory, moderation, TTS providers, and the browser test client. For setup and an overview, see the [root README](../README.md).

```bash
bun install
bun run serve      # HTTP server on :3000 (mic client + Parent tab)
bun run chat       # terminal chat
bun run lint       # Biome
bun run test       # unit tests (bun test)
bun run test:e2e   # Playwright, Firefox
```

| Path | What |
|---|---|
| `src/server.ts` | HTTP routes: `/v1/speech`, `/v1/parent_*`, `/health`, static files |
| `src/speech/` | Turn pipeline: transcribe → screen → agent → check → TTS |
| `src/agent/` | Nessie and parent agents, prompts, tools |
| `src/store/` | Markdown memory store indexed in embedded SurrealDB, plus the audit log |
| `src/tts/` | `TtsProvider` interface, ElevenLabs and Chatterbox providers |
| `src/moderation/` | Input screening, output checks, fallbacks |
| `src/cli/` | Chat REPL and TTS utilities |
| `public/` | Browser client |

Secrets are managed with [dotenvx](https://dotenvx.com). `.env` and `.env.keys` are git-ignored.
