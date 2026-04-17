import { type generateText, type LanguageModel, tool } from "ai";
import { z } from "zod";
import { getSafeFallback, SANITIZED_INPUT_MESSAGE } from "../moderation/fallbacks";
import { type InputScreenDeps, screenInput } from "../moderation/input-screen";
import { checkOutput } from "../moderation/output-check";
import type { MemoryStore } from "./memory";
import { buildSystemPrompt, formatUserMessage } from "./prompts";
import { type AgentInput, type AgentOutput, AgentOutputSchema } from "./schemas";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface NessieAgentConfig {
  model: LanguageModel;
  memoryStore: MemoryStore;
  moderationModel?: LanguageModel;
  enableInputScreening?: boolean;
  enableOutputCheck?: boolean;
}

export interface NessieAgentDeps {
  generateText: typeof generateText;
}

export class NessieAgent {
  private readonly sessions: Map<string, ConversationMessage[]> = new Map();
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
    let effectiveInput = input;

    // Layer 1: Input screening
    if (this.enableInputScreening) {
      const screenDeps: InputScreenDeps = {
        generateText: this.deps.generateText,
        model: this.moderationModel,
      };
      const screenResult = await screenInput(effectiveInput.text, screenDeps);

      if (screenResult.risk_level >= 3) {
        return getSafeFallback();
      }

      if (screenResult.risk_level >= 2) {
        // Replace input text with sanitized version
        effectiveInput = { ...effectiveInput, text: SANITIZED_INPUT_MESSAGE };
      }
    }

    // Get or create session history
    const messages = this.getSession(effectiveInput.device_id);

    // Build system prompt with speaker context
    const speakerContext = await this.memoryStore.getSpeakerContext(effectiveInput.device_id);
    const systemPrompt = buildSystemPrompt(speakerContext);

    // Format user message
    const userMessage = formatUserMessage(
      effectiveInput.speaker.name,
      effectiveInput.text,
      effectiveInput.ambient,
    );

    // Layer 2: Call the agent
    const result = await this.deps.generateText({
      model: this.model,
      system: systemPrompt,
      messages: [...messages, { role: "user" as const, content: userMessage }],
      tools: {
        recall_memory: tool({
          description: "Search memories for relevant context about a speaker or topic",
          inputSchema: z.object({
            query: z.string().describe("What to search for"),
            speaker: z.string().describe("Speaker ID to filter by, empty for all"),
          }),
          execute: async ({ query, speaker }) => {
            const results = await this.memoryStore.recall(query, speaker || undefined);
            return { memories: results };
          },
        }),
      },
      onStepFinish: ({ text, toolCalls, finishReason, usage }) => {
        console.log("[NessieAgent] step:", {
          finishReason,
          toolCalls: toolCalls?.length ?? 0,
          textLength: text?.length ?? 0,
          tokens: usage,
        });
      },
    });

    // Parse the text response as JSON and validate with Zod
    const rawText = result.text.trim();
    if (!rawText) {
      console.error("[NessieAgent] Empty text response from model");
      return getSafeFallback();
    }

    // Extract JSON from the response — model may wrap it in markdown code fences
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[NessieAgent] Failed to parse JSON:", rawText.slice(0, 200));
      return getSafeFallback();
    }

    const validated = AgentOutputSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[NessieAgent] Zod validation failed:", validated.error.issues);
      return getSafeFallback();
    }

    const output = validated.data;

    // Layer 3: Output validation
    if (this.enableOutputCheck) {
      const checkResult = checkOutput(output);
      if (!checkResult.safe) {
        return getSafeFallback();
      }
    }

    // Update session history
    messages.push(
      { role: "user", content: userMessage },
      { role: "assistant", content: JSON.stringify(output) },
    );

    // Handle memory save
    if (output.save_memory) {
      await this.memoryStore.save(output.memory_speaker || input.speaker.id, output.save_memory);
    }

    return output;
  }

  private getSession(deviceId: string): ConversationMessage[] {
    const existing = this.sessions.get(deviceId);
    if (existing) {
      return existing;
    }
    const newSession: ConversationMessage[] = [];
    this.sessions.set(deviceId, newSession);
    return newSession;
  }

  endSession(deviceId: string): ConversationMessage[] | undefined {
    const messages = this.sessions.get(deviceId);
    this.sessions.delete(deviceId);
    return messages;
  }
}
