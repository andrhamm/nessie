import { anthropic } from "@ai-sdk/anthropic";
import * as p from "@clack/prompts";
import { generateText } from "ai";
import { InMemoryStore } from "../agent/memory-inmemory";
import { NessieAgent } from "../agent/nessie-agent";
import type { AgentInput } from "../agent/schemas";
import { stripTags } from "../utils/speech";

export async function runChat(): Promise<void> {
  // Fail gracefully if ANTHROPIC_API_KEY is not set
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is not set.");
    console.error("Set it before running: ANTHROPIC_API_KEY=sk-ant-... bun run src/index.ts chat");
    process.exit(1);
  }

  p.intro("Nessie CLI Chat");

  const speakerName = await p.text({
    message: "What is your name?",
    placeholder: "Alex",
    initialValue: "Developer",
    validate(value) {
      if (!value || value.length === 0) return "Name is required!";
    },
  });

  if (p.isCancel(speakerName)) {
    p.cancel("Goodbye!");
    process.exit(0);
  }

  const speakerAgeStr = await p.text({
    message: "How old are you?",
    placeholder: "6",
    initialValue: "0",
    validate(value) {
      const num = Number(value ?? "");
      if (Number.isNaN(num) || num < 0) return "Please enter a valid age!";
    },
  });

  if (p.isCancel(speakerAgeStr)) {
    p.cancel("Goodbye!");
    process.exit(0);
  }

  const speakerAge = Number(speakerAgeStr);
  const model = anthropic("claude-haiku-4-5");

  const store = new InMemoryStore();
  const agent = new NessieAgent(
    {
      model,
      memoryStore: store,
      enableInputScreening: true,
      enableOutputCheck: true,
    },
    { generateText },
  );

  const deviceId = "cli-dev";
  const speaker = {
    id: "SPEAKER_0",
    name: speakerName,
    age: speakerAge,
    preferences: [],
  };

  p.log.info(`Chatting as ${speakerName} (age ${speakerAge}). Type "exit" to quit.\n`);

  let running = true;
  while (running) {
    const input = await p.text({
      message: `${speakerName}:`,
      placeholder: "Say something to Nessie...",
    });

    if (p.isCancel(input) || input === "exit" || input === "quit") {
      running = false;
      break;
    }

    const agentInput: AgentInput = {
      device_id: deviceId,
      speaker,
      text: input,
      ambient: [],
      timestamp: Date.now(),
    };

    const s = p.spinner();
    s.start("Nessie is thinking...");

    try {
      const result = await agent.respond(agentInput);
      s.stop("Nessie responded!");

      const plainSpeech = stripTags(result.speech);
      if (plainSpeech) {
        p.log.message(`Nessie: ${plainSpeech}`);
      } else {
        p.log.message("Nessie: [no verbal response]");
      }

      p.log.info(`  Tags: ${result.speech}`);
      p.log.info(`  LED: ${result.led_color} (${result.led_mode})`);

      if (result.save_memory) {
        p.log.info(`  Memory: "${result.save_memory}" about ${result.memory_speaker || "general"}`);
      }
    } catch (error) {
      s.stop("Error!");
      const message = error instanceof Error ? error.message : String(error);
      p.log.error(`Error: ${message}`);
    }
  }

  agent.endSession(deviceId);
  p.outro("Bye! Nessie will miss you!");
}
