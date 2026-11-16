#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { createServer } from "./server.ts";
import { ChatterboxProvider } from "./tts/chatterbox-provider";
import type { ElevenLabsTtsClient } from "./tts/elevenlabs-provider";
import { ElevenLabsProvider } from "./tts/elevenlabs-provider";
import type { TtsProviderRegistry } from "./tts/provider";

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
  const { streamText } = await import("ai");
  const { ElevenLabsClient } = await import("elevenlabs");
  const { InMemoryStore } = await import("./agent/memory-inmemory");
  const { NessieAgent } = await import("./agent/nessie-agent");
  const { ParentAgent } = await import("./agent/parent-agent");
  const { SpeechStore } = await import("./speech/store");
  const { SubprocessTranscriberClient } = await import("./speech/transcriber-client");
  const { MdStore } = await import("./store/store");
  const { AuditLog } = await import("./store/audit");
  const { config } = await import("./config");

  const model = anthropic("claude-haiku-4-5");
  const memoryStore = new InMemoryStore();

  // Markdown-backed store for persons/memories/events/journal + runtime config.
  const mdStore = await MdStore.create({ dataDir: config.DATA_DIR });
  await mdStore.indexAll();
  mdStore.startWatcher();

  const auditLog = new AuditLog({ dir: `${config.DATA_DIR}/audit` });

  const agent = new NessieAgent(
    {
      model,
      memoryStore,
      enableInputScreening: true,
      enableOutputCheck: true,
      mdStore,
      auditLog,
    },
    { streamText },
  );

  const parentAgent = new ParentAgent(
    { model: anthropic(config.PARENT_AGENT_MODEL), store: mdStore, auditLog },
    { streamText },
  );

  const chatterboxProvider = new ChatterboxProvider({
    url: config.CHATTERBOX_URL,
    voice: config.CHATTERBOX_VOICE,
  });
  const ttsProviders: TtsProviderRegistry = { chatterbox: chatterboxProvider };
  if (config.ELEVENLABS_API_KEY) {
    const elevenLabsClient = new ElevenLabsClient({
      apiKey: config.ELEVENLABS_API_KEY,
    }) as unknown as ElevenLabsTtsClient;
    ttsProviders.elevenlabs = new ElevenLabsProvider(elevenLabsClient, {
      voiceId: config.NESSIE_VOICE_ID,
    });
  }

  const speechStore = new SpeechStore();

  // Project root is one level up from the server directory (where uv.lock lives)
  const projectRoot = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
  const transcriber = new SubprocessTranscriberClient(projectRoot);

  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  const server = createServer({
    port,
    speechDeps: {
      store: speechStore,
      agent,
      ttsProviders,
      defaultTtsProvider: config.DEFAULT_TTS_PROVIDER,
      transcriber,
    },
    parentDeps: config.PARENT_UI_ENABLED ? { agent: parentAgent, store: mdStore } : undefined,
  });

  p.log.success(`Server listening on http://localhost:${server.port}`);
  p.log.info("Speech API enabled at /v1/speech");
  if (config.PARENT_UI_ENABLED)
    p.log.info("Parent API enabled at /v1/parent_chat, /v1/parent_state");
  p.log.info(`Voice ID (ElevenLabs): ${config.NESSIE_VOICE_ID}`);
  p.log.info(`Chatterbox: ${config.CHATTERBOX_URL} voice=${config.CHATTERBOX_VOICE}`);
  p.log.info(`Default TTS provider: ${config.DEFAULT_TTS_PROVIDER}`);
  p.log.info(`Data dir: ${config.DATA_DIR}`);

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
