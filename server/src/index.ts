#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { createServer } from "./server.ts";
import type { TtsClient } from "./tts/elevenlabs";

const DEFAULT_PORT = 3000;

function printHelp(): void {
  console.log(`
Usage: myapp <command>

Commands:
  serve    Start the HTTP server
  chat     Start an interactive chat with Nessie
  help     Show this help message

Options:
  --help, -h    Show help
`);
}

async function cmdServe(): Promise<void> {
  const { anthropic } = await import("@ai-sdk/anthropic");
  const { generateText } = await import("ai");
  const { ElevenLabsClient } = await import("elevenlabs");
  const { InMemoryStore } = await import("./agent/memory-inmemory");
  const { NessieAgent } = await import("./agent/nessie-agent");
  const { SpeechStore } = await import("./speech/store");
  const { config } = await import("./config");

  const model = anthropic("claude-haiku-4-5");
  const memoryStore = new InMemoryStore();
  const agent = new NessieAgent(
    {
      model,
      memoryStore,
      enableInputScreening: true,
      enableOutputCheck: true,
    },
    { generateText },
  );

  const ttsClient = new ElevenLabsClient({
    apiKey: config.ELEVENLABS_API_KEY,
  }) as unknown as TtsClient;

  const speechStore = new SpeechStore();

  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  const server = createServer({
    port,
    speechDeps: {
      store: speechStore,
      agent,
      ttsClient,
      ttsConfig: {
        voiceId: config.NESSIE_VOICE_ID,
      },
    },
  });

  p.log.success(`Server listening on http://localhost:${server.port}`);
  p.log.info("Speech API enabled at /v1/speech");
  p.log.info(`Voice ID: ${config.NESSIE_VOICE_ID}`);

  // Periodic cleanup of old speech entries (every 5 minutes)
  setInterval(
    () => {
      const removed = speechStore.cleanup();
      if (removed > 0) {
        p.log.info(`Cleaned up ${removed} expired speech entries`);
      }
    },
    5 * 60 * 1000,
  );
}

async function main(args: string[]): Promise<void> {
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "serve":
      await cmdServe();
      break;
    case "chat": {
      const { runChat } = await import("./cli/chat");
      await runChat();
      break;
    }
    default:
      p.log.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main(process.argv.slice(2));
