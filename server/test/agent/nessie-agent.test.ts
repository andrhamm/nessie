import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryStore } from "../../src/agent/memory-inmemory";
import { NessieAgent, type NessieAgentDeps } from "../../src/agent/nessie-agent";
import type { AgentInput, AgentOutput } from "../../src/agent/schemas";

function makeInput(overrides: Partial<AgentInput> = {}): AgentInput {
  return {
    device_id: "device-001",
    speaker: {
      id: "SPEAKER_0",
      name: "Alex",
      age: 6,
      preferences: ["dinosaurs"],
    },
    text: "Tell me about dinosaurs!",
    ambient: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

function makeAgentOutput(overrides: Partial<AgentOutput> = {}): AgentOutput {
  return {
    speech: "[excited] Oh wow, dinosaurs! [giggles] I love them too!",
    led_color: "#FFD700",
    led_mode: "pulse",
    save_memory: "",
    memory_speaker: "",
    ...overrides,
  };
}

/**
 * Create a mock streamText result that resolves to the given text.
 */
function mockStreamResult(responseText: string) {
  async function* textStreamGen() {
    yield responseText;
  }
  return {
    text: Promise.resolve(responseText),
    textStream: textStreamGen(),
    response: Promise.resolve({
      id: "test",
      timestamp: new Date(),
      modelId: "test",
      headers: {},
      messages: [{ role: "assistant" as const, content: responseText }],
    }),
  };
}

/**
 * Create mock deps.
 *
 * The mock distinguishes between the input-screening call (which has `prompt` but no `tools`)
 * and the agent call (which has `tools`).
 */
function createMockDeps(agentOutput: AgentOutput, inputScreenResponse?: string): NessieAgentDeps {
  const mockStreamText = (options: Record<string, unknown>) => {
    const isScreeningCall = !("tools" in options);

    if (isScreeningCall) {
      const text =
        inputScreenResponse ??
        JSON.stringify({
          risk_level: 0,
          category: "none",
          reasoning: "Safe input",
        });
      return mockStreamResult(text);
    }

    return mockStreamResult(JSON.stringify(agentOutput));
  };

  return {
    streamText: mockStreamText as unknown as NessieAgentDeps["streamText"],
  };
}

describe("NessieAgent", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe("respond", () => {
    it("returns valid AgentOutput for safe input", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      const result = await agent.respond(makeInput());
      expect(result.speech).toBe(output.speech);
      expect(result.led_color).toBe(output.led_color);
      expect(result.led_mode).toBe(output.led_mode);
    });

    it("saves memory when save_memory is non-empty", async () => {
      const output = makeAgentOutput({
        save_memory: "Alex loves dinosaurs",
        memory_speaker: "SPEAKER_0",
      });
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      await agent.respond(makeInput());
      const memories = store.getAll();
      expect(memories).toHaveLength(1);
      expect(memories[0]?.content).toBe("Alex loves dinosaurs");
      expect(memories[0]?.speaker).toBe("SPEAKER_0");
    });

    it("does not save memory when save_memory is empty", async () => {
      const output = makeAgentOutput({ save_memory: "", memory_speaker: "" });
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      await agent.respond(makeInput());
      expect(store.getAll()).toHaveLength(0);
    });

    it("uses speaker.id as fallback when memory_speaker is empty", async () => {
      const output = makeAgentOutput({
        save_memory: "Likes to play",
        memory_speaker: "",
      });
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      await agent.respond(makeInput());
      const memories = store.getAll();
      expect(memories[0]?.speaker).toBe("SPEAKER_0");
    });

    it("maintains conversation history per device", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      await agent.respond(makeInput({ device_id: "device-001" }));
      await agent.respond(makeInput({ device_id: "device-001" }));

      const session = agent.endSession("device-001");
      // Each respond adds 2 messages (user + assistant)
      expect(session).toHaveLength(4);
    });

    it("keeps separate sessions for different devices", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      await agent.respond(makeInput({ device_id: "device-001" }));
      await agent.respond(makeInput({ device_id: "device-002" }));

      const session1 = agent.endSession("device-001");
      const session2 = agent.endSession("device-002");
      expect(session1).toHaveLength(2);
      expect(session2).toHaveLength(2);
    });
  });

  describe("input screening", () => {
    it("blocks unsafe input with risk level 3", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(
        output,
        JSON.stringify({
          risk_level: 3,
          category: "Self-Harm",
          reasoning: "Unsafe content",
        }),
      );
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      const result = await agent.respond(makeInput({ text: "unsafe content" }));
      // Should return a safe fallback, not the agent output
      expect(result.speech).not.toBe(output.speech);
      expect(result.led_mode).toBeDefined();
    });

    it("passes through safe input with risk level 0", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(
        output,
        JSON.stringify({
          risk_level: 0,
          category: "none",
          reasoning: "Safe",
        }),
      );
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      const result = await agent.respond(makeInput());
      expect(result.speech).toBe(output.speech);
    });

    it("can be disabled", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        {
          model: "anthropic/claude-haiku-4-5",
          memoryStore: store,
          enableInputScreening: false,
        },
        deps,
      );

      const result = await agent.respond(makeInput());
      expect(result.speech).toBe(output.speech);
    });
  });

  describe("output validation", () => {
    it("blocks output containing PII", async () => {
      const output = makeAgentOutput({
        speech: "You can email me at nessie@example.com!",
      });
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      const result = await agent.respond(makeInput());
      // Should return a safe fallback
      expect(result.speech).not.toContain("@example.com");
    });

    it("blocks output containing URLs", async () => {
      const output = makeAgentOutput({
        speech: "Check out https://example.com for fun!",
      });
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      const result = await agent.respond(makeInput());
      expect(result.speech).not.toContain("https://");
    });

    it("can be disabled", async () => {
      const output = makeAgentOutput({
        speech: "Contact nessie@example.com!",
      });
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        {
          model: "anthropic/claude-haiku-4-5",
          memoryStore: store,
          enableOutputCheck: false,
        },
        deps,
      );

      const result = await agent.respond(makeInput());
      expect(result.speech).toContain("@example.com");
    });
  });

  describe("endSession", () => {
    it("returns session messages and clears them", async () => {
      const output = makeAgentOutput();
      const deps = createMockDeps(output);
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      await agent.respond(makeInput({ device_id: "device-001" }));
      const messages = agent.endSession("device-001");
      expect(messages).toHaveLength(2);

      // Should be gone now
      const messagesAgain = agent.endSession("device-001");
      expect(messagesAgain).toBeUndefined();
    });

    it("returns undefined for unknown device", () => {
      const deps = createMockDeps(makeAgentOutput());
      const agent = new NessieAgent(
        { model: "anthropic/claude-haiku-4-5", memoryStore: store },
        deps,
      );

      const messages = agent.endSession("nonexistent");
      expect(messages).toBeUndefined();
    });
  });
});
