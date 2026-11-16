import { type LanguageModel, type ModelMessage, stepCountIs, type streamText } from "ai";
import { logError } from "../logger";
import type { AuditLog } from "../store/audit";
import type { MdStore } from "../store/store";
import { buildNessSystemPrompt } from "./parent-prompts";
import { buildParentTools } from "./parent-tools";

export interface ParentAgentConfig {
  model: LanguageModel;
  store: MdStore;
  auditLog?: AuditLog;
}

export interface ParentAgentDeps {
  streamText: typeof streamText;
}

export type ParentChunk =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; input: unknown }
  | { type: "tool_result"; name: string; output: unknown }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Ness — parent-facing agent. Single-session dev-phase design: all parent
 * chat shares one `"parent"` session. Streams text + tool events via an
 * async iterator; no moderation layer.
 */
export class ParentAgent {
  private readonly sessions: Map<string, ModelMessage[]> = new Map();

  constructor(
    private readonly config: ParentAgentConfig,
    private readonly deps: ParentAgentDeps,
  ) {}

  private getSession(sessionId: string): ModelMessage[] {
    const existing = this.sessions.get(sessionId);
    if (existing) return existing;
    const fresh: ModelMessage[] = [];
    this.sessions.set(sessionId, fresh);
    return fresh;
  }

  async *respond(sessionId: string, userText: string): AsyncIterable<ParentChunk> {
    const messages = this.getSession(sessionId);
    messages.push({ role: "user" as const, content: userText });

    this.config.auditLog?.append({
      agent: "ness",
      kind: "turn",
      session_id: sessionId,
      input: { text: userText },
    });

    const tools = buildParentTools({
      store: this.config.store,
      audit: this.config.auditLog,
      sessionId,
    });

    const stream = this.deps.streamText({
      model: this.config.model,
      system: buildNessSystemPrompt(),
      messages,
      stopWhen: stepCountIs(5),
      tools: tools as Parameters<typeof this.deps.streamText>[0]["tools"],
    });

    let buffered = "";
    try {
      for await (const chunk of stream.textStream) {
        buffered += chunk;
        yield { type: "text", delta: chunk };
      }
      const response = await stream.response;
      messages.push(...response.messages);
      yield { type: "done" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`[ParentAgent] error: ${message}`);
      this.config.auditLog?.append({
        agent: "ness",
        kind: "error",
        session_id: sessionId,
        output: { error: message },
      });
      yield { type: "error", message };
    }
  }

  endSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
