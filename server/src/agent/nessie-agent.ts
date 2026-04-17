import { type LanguageModel, type ModelMessage, stepCountIs, type streamText, tool } from "ai";
import { z } from "zod";
import { getSafeFallback, SANITIZED_INPUT_MESSAGE } from "../moderation/fallbacks";
import { type InputScreenDeps, screenInput } from "../moderation/input-screen";
import { checkOutput } from "../moderation/output-check";
import { stripTags } from "../utils/speech";
import type { MemoryStore } from "./memory";
import { buildSystemPrompt, formatUserMessage } from "./prompts";
import { type AgentInput, type AgentOutput, AgentOutputSchema } from "./schemas";

export interface NessieAgentConfig {
  model: LanguageModel;
  memoryStore: MemoryStore;
  moderationModel?: LanguageModel;
  enableInputScreening?: boolean;
  enableOutputCheck?: boolean;
}

export interface NessieAgentDeps {
  streamText: typeof streamText;
}

export class NessieAgent {
  private readonly sessions: Map<string, ModelMessage[]> = new Map();
  private readonly memoryStore: MemoryStore;
  private readonly model: LanguageModel;
  private readonly moderationModel: LanguageModel;
  private readonly enableInputScreening: boolean;
  private readonly enableOutputCheck: boolean;
  private readonly deps: NessieAgentDeps;

  constructor(config: NessieAgentConfig, deps: NessieAgentDeps) {
    this.memoryStore = config.memoryStore;
    this.model = config.model;
    this.moderationModel = config.moderationModel ?? config.model;
    this.enableInputScreening = config.enableInputScreening ?? true;
    this.enableOutputCheck = config.enableOutputCheck ?? true;
    this.deps = deps;
  }

  async respond(input: AgentInput): Promise<AgentOutput> {
    const t0 = performance.now();
    const elapsed = () => `${Math.round(performance.now() - t0)}ms`;
    let effectiveInput = input;

    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `[Agent] ${elapsed()} New request from ${input.speaker.name} (age ${input.speaker.age})`,
    );
    console.log(`[Agent] ${elapsed()} Input: "${input.text}"`);
    if (input.ambient.length > 0) {
      console.log(`[Agent] ${elapsed()} Ambient: ${input.ambient.join(", ")}`);
    }

    // Layer 1: Input screening
    if (this.enableInputScreening) {
      console.log(`[Agent] ${elapsed()} Input screening...`);
      const screenDeps: InputScreenDeps = {
        streamText: this.deps.streamText,
        model: this.moderationModel,
      };
      const screenResult = await screenInput(effectiveInput.text, screenDeps);
      console.log(
        `[Agent] ${elapsed()} Screen result: risk=${screenResult.risk_level} category=${screenResult.category}`,
      );

      if (screenResult.risk_level >= 3) {
        console.log(`[Agent] ${elapsed()} BLOCKED — returning safe fallback`);
        return getSafeFallback();
      }

      if (screenResult.risk_level >= 2) {
        console.log(`[Agent] ${elapsed()} SANITIZED — replacing input`);
        effectiveInput = { ...effectiveInput, text: SANITIZED_INPUT_MESSAGE };
      }
    }

    // Get or create session history
    const messages = this.getSession(effectiveInput.device_id);
    console.log(
      `[Agent] ${elapsed()} Session "${effectiveInput.device_id}": ${messages.length} messages in history`,
    );

    // Build system prompt with speaker context
    const speakerContext = await this.memoryStore.getSpeakerContext(effectiveInput.device_id);
    const systemPrompt = buildSystemPrompt(speakerContext);
    console.log(
      `[Agent] ${elapsed()} System prompt: ${systemPrompt.length} chars (${speakerContext ? "with" : "no"} speaker context)`,
    );

    // Format user message
    const userMessage = formatUserMessage(
      effectiveInput.speaker.name,
      effectiveInput.text,
      effectiveInput.ambient,
    );
    console.log(`[Agent] ${elapsed()} User message: "${userMessage}"`);

    // Layer 2: Call the agent with streaming
    let stepNum = 0;
    const stream = this.deps.streamText({
      model: this.model,
      system: systemPrompt,
      messages: [...messages, { role: "user" as const, content: userMessage }],
      stopWhen: stepCountIs(5),
      tools: {
        recall_memory: tool({
          description: "Search memories for relevant context about a speaker or topic",
          inputSchema: z.object({
            query: z.string().describe("What to search for"),
            speaker: z.string().describe("Speaker ID to filter by, empty for all"),
          }),
          execute: async ({ query, speaker }) => {
            console.log(
              `[Agent] ${elapsed()} Tool call: recall_memory(query="${query}", speaker="${speaker}")`,
            );
            const results = await this.memoryStore.recall(query, speaker || undefined);
            console.log(`[Agent] ${elapsed()} Tool result: ${results.length} memories found`);
            if (results.length > 0) {
              for (const mem of results) {
                console.log(`[Agent] ${elapsed()}   - "${mem}"`);
              }
            }
            return { memories: results };
          },
        }),
      },
      onStepFinish: ({ text, toolCalls, finishReason, usage }) => {
        stepNum++;
        console.log(
          `[Agent] ${elapsed()} Step ${stepNum}: reason=${finishReason} tools=${toolCalls?.length ?? 0} text=${text?.length ?? 0}chars input=${usage.inputTokens}tok output=${usage.outputTokens}tok`,
        );
      },
    });

    // Stream text to console as it arrives, collecting the full text
    let rawText = "";
    console.log(`[Agent] ${elapsed()} Streaming response:`);
    process.stdout.write("  ");
    for await (const chunk of stream.textStream) {
      process.stdout.write(chunk);
      rawText += chunk;
    }
    process.stdout.write("\n");

    rawText = rawText.trim();
    if (!rawText) {
      console.error(`[Agent] ${elapsed()} ERROR: Empty text response from model`);
      return getSafeFallback();
    }

    console.log(`[Agent] ${elapsed()} Raw text: ${rawText.length} chars`);

    // Extract JSON from the response — model may wrap it in markdown code fences
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      console.log(`[Agent] ${elapsed()} Extracted JSON from code fence`);
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error(`[Agent] ${elapsed()} ERROR: Failed to parse JSON`);
      console.error(`[Agent] Raw response: ${rawText.slice(0, 500)}`);
      return getSafeFallback();
    }

    const validated = AgentOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error(`[Agent] ${elapsed()} ERROR: Zod validation failed`);
      for (const issue of validated.error.issues) {
        console.error(`[Agent]   ${issue.path.join(".")}: ${issue.message}`);
      }
      return getSafeFallback();
    }

    const output = validated.data;
    console.log(`[Agent] ${elapsed()} Output validated OK`);
    console.log(
      `[Agent] ${elapsed()} Speech: "${stripTags(output.speech).slice(0, 100)}${stripTags(output.speech).length > 100 ? "..." : ""}"`,
    );
    console.log(`[Agent] ${elapsed()} LED: ${output.led_color} ${output.led_mode}`);

    // Layer 3: Output validation
    if (this.enableOutputCheck) {
      const checkResult = checkOutput(output);
      if (!checkResult.safe) {
        console.log(`[Agent] ${elapsed()} Output check FAILED: ${checkResult.reason}`);
        return getSafeFallback();
      }
      console.log(`[Agent] ${elapsed()} Output check: safe`);
    }

    // Update session history using SDK's response messages
    const responseMessages = (await stream.response).messages;
    messages.push({ role: "user" as const, content: userMessage }, ...responseMessages);
    console.log(`[Agent] ${elapsed()} Session updated: now ${messages.length} messages`);

    // Handle memory save
    if (output.save_memory) {
      console.log(
        `[Agent] ${elapsed()} Saving memory: "${output.save_memory}" about ${output.memory_speaker || "general"}`,
      );
      await this.memoryStore.save(output.memory_speaker || input.speaker.id, output.save_memory);
    }

    console.log(`[Agent] ${elapsed()} Done`);
    console.log(`${"=".repeat(60)}\n`);

    return output;
  }

  private getSession(deviceId: string): ModelMessage[] {
    const existing = this.sessions.get(deviceId);
    if (existing) {
      return existing;
    }
    const newSession: ModelMessage[] = [];
    this.sessions.set(deviceId, newSession);
    return newSession;
  }

  endSession(deviceId: string): ModelMessage[] | undefined {
    const messages = this.sessions.get(deviceId);
    this.sessions.delete(deviceId);
    return messages;
  }
}
