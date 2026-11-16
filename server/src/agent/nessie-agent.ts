import { type LanguageModel, type ModelMessage, stepCountIs, type streamText, tool } from "ai";
import { z } from "zod";
import { log, logAgentEvent, logError, logRaw, logStreamComplete } from "../logger";
import { getSafeFallback, SANITIZED_INPUT_MESSAGE } from "../moderation/fallbacks";
import { type InputScreenDeps, screenInput } from "../moderation/input-screen";
import { checkOutput } from "../moderation/output-check";
import type { WeatherLocation, WeatherService } from "../services/weather";
import type { AuditLog } from "../store/audit";
import type { MdStore } from "../store/store";
import { stripTags } from "../utils/speech";
import type { MemoryStore } from "./memory";
import { buildSystemPrompt, formatUserMessage } from "./prompts";
import { renderRuntimeContext } from "./runtime-context";
import { type AgentInput, type AgentOutput, AgentOutputSchema } from "./schemas";
import { buildEntityTools } from "./tools";

export interface NessieAgentConfig {
  model: LanguageModel;
  memoryStore: MemoryStore;
  moderationModel?: LanguageModel;
  enableInputScreening?: boolean;
  enableOutputCheck?: boolean;
  /** Optional audit log — when set, every turn/tool call is persisted. */
  auditLog?: AuditLog;
  /** Markdown store for the per-turn runtime context. */
  mdStore?: MdStore;
  /** Weather service for the runtime-context snapshot. */
  weather?: WeatherService;
  /** Location used by the weather service, if configured. */
  weatherLocation?: WeatherLocation;
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
  private readonly auditLog: AuditLog | undefined;
  private readonly mdStore: MdStore | undefined;
  private readonly weather: WeatherService | undefined;
  private readonly weatherLocation: WeatherLocation | undefined;
  private readonly deps: NessieAgentDeps;

  constructor(config: NessieAgentConfig, deps: NessieAgentDeps) {
    this.memoryStore = config.memoryStore;
    this.model = config.model;
    this.moderationModel = config.moderationModel ?? config.model;
    this.enableInputScreening = config.enableInputScreening ?? true;
    this.enableOutputCheck = config.enableOutputCheck ?? true;
    this.auditLog = config.auditLog;
    this.mdStore = config.mdStore;
    this.weather = config.weather;
    this.weatherLocation = config.weatherLocation;
    this.deps = deps;
  }

  async respond(input: AgentInput): Promise<AgentOutput> {
    const t0 = performance.now();
    const elapsed = () => `${Math.round(performance.now() - t0)}ms`;
    let effectiveInput = input;

    log(`\n${"=".repeat(60)}`);
    log(`[Agent] ${elapsed()} New request from ${input.speaker.name} (age ${input.speaker.age})`);
    log(`[Agent] ${elapsed()} Input: "${input.text}"`);
    if (input.ambient.length > 0) {
      log(`[Agent] ${elapsed()} Ambient: ${input.ambient.join(", ")}`);
    }

    // Layer 1: Input screening
    if (this.enableInputScreening) {
      log(`[Agent] ${elapsed()} Input screening...`);
      const screenDeps: InputScreenDeps = {
        streamText: this.deps.streamText,
        model: this.moderationModel,
      };
      const screenResult = await screenInput(effectiveInput.text, screenDeps);
      log(
        `[Agent] ${elapsed()} Screen result: risk=${screenResult.risk_level} category=${screenResult.category}`,
      );

      this.auditLog?.append({
        agent: "nessie",
        kind: "screen",
        device_id: input.device_id,
        speaker: input.speaker.id,
        input: { text: input.text },
        output: screenResult,
        latency_ms: Math.round(performance.now() - t0),
      });

      if (screenResult.risk_level >= 3) {
        log(`[Agent] ${elapsed()} BLOCKED — returning safe fallback`);
        return getSafeFallback();
      }

      if (screenResult.risk_level >= 2) {
        log(`[Agent] ${elapsed()} SANITIZED — replacing input`);
        effectiveInput = { ...effectiveInput, text: SANITIZED_INPUT_MESSAGE };
      }
    }

    // Get or create session history
    const messages = this.getSession(effectiveInput.device_id);
    log(
      `[Agent] ${elapsed()} Session "${effectiveInput.device_id}": ${messages.length} messages in history`,
    );

    // Build system prompt: static character + speech conventions + speaker
    // context + per-turn runtime context (date, weather, routine, parent
    // notes, known-child summary).
    const speakerContext = await this.memoryStore.getSpeakerContext(effectiveInput.device_id);
    const ttsProvider = effectiveInput.tts_provider ?? "elevenlabs";
    let runtimeContext = "";
    if (this.mdStore) {
      try {
        runtimeContext = await renderRuntimeContext({
          store: this.mdStore,
          weather: this.weather,
          location: this.weatherLocation,
          speakerId: effectiveInput.speaker.id,
          now: new Date(),
        });
      } catch (err) {
        logError(`[Agent] ${elapsed()} runtime context failed: ${(err as Error).message}`);
      }
    }
    const systemPrompt = buildSystemPrompt(speakerContext, ttsProvider, runtimeContext);
    log(
      `[Agent] ${elapsed()} System prompt: ${systemPrompt.length} chars (tts=${ttsProvider}, ${speakerContext ? "with" : "no"} speaker context, ${runtimeContext ? "with" : "no"} runtime context)`,
    );

    // Format user message
    const userMessage = formatUserMessage(
      effectiveInput.speaker.name,
      effectiveInput.text,
      effectiveInput.ambient,
    );
    log(`[Agent] ${elapsed()} User message: "${userMessage}"`);

    // Layer 2: Call the agent with streaming
    let stepNum = 0;
    const baseTools = {
      recall_memory: tool({
        description: "Search memories for relevant context about a speaker or topic",
        inputSchema: z.object({
          query: z.string().describe("What to search for"),
          speaker: z.string().describe("Speaker ID to filter by, empty for all"),
        }),
        execute: async ({ query, speaker }) => {
          const toolStart = performance.now();
          const results = await this.memoryStore.recall(query, speaker || undefined);
          const ms = Math.round(performance.now() - t0);
          const latency = Math.round(performance.now() - toolStart);
          logAgentEvent(
            "tool_call",
            {
              tool: "recall_memory",
              query,
              speaker,
              resultsCount: results.length,
              results,
            },
            ms,
          );
          this.auditLog?.append({
            agent: "nessie",
            kind: "tool_call",
            tool: "recall_memory",
            device_id: input.device_id,
            speaker: input.speaker.id,
            input: { query, speaker },
            output: { count: results.length, results },
            latency_ms: latency,
          });
          return { memories: results };
        },
      }),
    };
    const entityTools = this.mdStore
      ? buildEntityTools({
          store: this.mdStore,
          weather: this.weather,
          weatherLocation: this.weatherLocation,
          audit: this.auditLog,
          deviceId: input.device_id,
          speakerId: input.speaker.id,
          turnStart: t0,
        })
      : {};
    const stream = this.deps.streamText({
      model: this.model,
      system: systemPrompt,
      messages: [...messages, { role: "user" as const, content: userMessage }],
      stopWhen: stepCountIs(5),
      tools: { ...baseTools, ...entityTools },
      onStepFinish: ({ text, toolCalls, finishReason, usage }) => {
        stepNum++;
        const ms = Math.round(performance.now() - t0);
        logAgentEvent(
          "step_finish",
          {
            step: stepNum,
            finishReason,
            toolCalls: toolCalls?.length ?? 0,
            textLength: text?.length ?? 0,
            usage: {
              input: usage.inputTokens,
              output: usage.outputTokens,
              cacheRead: usage.cachedInputTokens ?? 0,
            },
          },
          ms,
        );
        this.auditLog?.append({
          agent: "nessie",
          kind: "turn",
          device_id: input.device_id,
          speaker: input.speaker.id,
          input: { text: input.text, step: stepNum },
          output: { finishReason, textLength: text?.length ?? 0 },
          latency_ms: ms,
          usage: {
            input: usage.inputTokens,
            output: usage.outputTokens,
            cacheRead: usage.cachedInputTokens ?? 0,
          },
        });
      },
    });

    // Stream text to console as it arrives, collecting the full text
    let rawText = "";
    log(`[Agent] ${elapsed()} Streaming response:`);
    logRaw("  ");
    for await (const chunk of stream.textStream) {
      logRaw(chunk);
      rawText += chunk;
    }
    logRaw("\n");

    rawText = rawText.trim();
    logStreamComplete(rawText, Math.round(performance.now() - t0));

    if (!rawText) {
      logError(`[Agent] ${elapsed()} ERROR: Empty text response from model`);
      return getSafeFallback();
    }

    // Extract JSON from the response — model may wrap it in markdown code fences
    let jsonStr = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      log(`[Agent] ${elapsed()} Extracted JSON from code fence`);
      jsonStr = jsonMatch[1].trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logError(`[Agent] ${elapsed()} ERROR: Failed to parse JSON`);
      logError(`[Agent] Raw response: ${rawText.slice(0, 500)}`);
      return getSafeFallback();
    }

    const validated = AgentOutputSchema.safeParse(parsed);
    if (!validated.success) {
      logError(`[Agent] ${elapsed()} ERROR: Zod validation failed`);
      for (const issue of validated.error.issues) {
        logError(`[Agent]   ${issue.path.join(".")}: ${issue.message}`);
      }
      return getSafeFallback();
    }

    const output = validated.data;
    logAgentEvent(
      "output",
      {
        speech_plain: stripTags(output.speech),
        speech_tagged: output.speech,
        led_color: output.led_color,
        led_mode: output.led_mode,
        save_memory: output.save_memory || null,
        memory_speaker: output.memory_speaker || null,
      },
      Math.round(performance.now() - t0),
    );

    // Layer 3: Output validation
    if (this.enableOutputCheck) {
      const checkResult = checkOutput(output);
      this.auditLog?.append({
        agent: "nessie",
        kind: "output_check",
        device_id: input.device_id,
        speaker: input.speaker.id,
        input: { speech: output.speech },
        output: checkResult,
        latency_ms: Math.round(performance.now() - t0),
      });
      if (!checkResult.safe) {
        log(`[Agent] ${elapsed()} Output check FAILED: ${checkResult.reason}`);
        return getSafeFallback();
      }
      log(`[Agent] ${elapsed()} Output check: safe`);
    }

    // Update session history using SDK's response messages
    const responseMessages = (await stream.response).messages;
    messages.push({ role: "user" as const, content: userMessage }, ...responseMessages);
    log(`[Agent] ${elapsed()} Session updated: now ${messages.length} messages`);

    // Handle memory save
    if (output.save_memory) {
      log(
        `[Agent] ${elapsed()} Saving memory: "${output.save_memory}" about ${output.memory_speaker || "general"}`,
      );
      await this.memoryStore.save(output.memory_speaker || input.speaker.id, output.save_memory);
    }

    log(`[Agent] ${elapsed()} Done`);
    log(`${"=".repeat(60)}\n`);

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
