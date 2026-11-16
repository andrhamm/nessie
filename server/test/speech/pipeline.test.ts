import { beforeEach, describe, expect, it } from "bun:test";
import type { NessieAgent } from "../../src/agent/nessie-agent";
import type { AgentInput, AgentOutput } from "../../src/agent/schemas";
import type { PipelineDeps } from "../../src/speech/pipeline";
import { runPipeline } from "../../src/speech/pipeline";
import { SpeechStore } from "../../src/speech/store";
import { MockTranscriberClient } from "../../src/speech/transcriber-client";
import type { TtsProvider } from "../../src/tts/provider";

const MOCK_AGENT_OUTPUT: AgentOutput = {
  speech: "[excited] Arr, Captain Alex! Let's find treasure!",
  led_color: "#FFD700",
  led_mode: "pulse",
  save_memory: "Alex likes pirates",
  memory_speaker: "SPEAKER_0",
};

function createMockAgent(output?: AgentOutput): NessieAgent {
  const respondOutput = output ?? MOCK_AGENT_OUTPUT;
  return {
    respond: async (_input: AgentInput): Promise<AgentOutput> => respondOutput,
    endSession: () => undefined,
  } as unknown as NessieAgent;
}

function createFailingAgent(error: Error): NessieAgent {
  return {
    respond: async () => {
      throw error;
    },
    endSession: () => undefined,
  } as unknown as NessieAgent;
}

function createMockTtsProvider(name: "elevenlabs" | "chatterbox", audio?: Uint8Array): TtsProvider {
  const audioData = audio ?? new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
  return {
    name,
    synthesize: async () => audioData,
  };
}

function createFailingTtsProvider(error: Error): TtsProvider {
  return {
    name: "elevenlabs",
    synthesize: async () => {
      throw error;
    },
  };
}

describe("runPipeline", () => {
  let store: SpeechStore;
  let deps: PipelineDeps;

  beforeEach(() => {
    store = new SpeechStore();
    deps = {
      agent: createMockAgent(),
      ttsProviders: { elevenlabs: createMockTtsProvider("elevenlabs") },
      defaultTtsProvider: "elevenlabs",
      store,
      transcriber: new MockTranscriberClient("let's play pirates"),
    };
  });

  it("processes a speech request to completion", async () => {
    const state = store.create("web-001", "let's play pirates", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("complete");
    expect(result?.response?.speech_tagged).toBe(
      "[excited] Arr, Captain Alex! Let's find treasure!",
    );
    expect(result?.response?.speech_plain).toBe("Arr, Captain Alex! Let's find treasure!");
    expect(result?.response?.led_color).toBe("#FFD700");
    expect(result?.response?.led_mode).toBe("pulse");
    expect(result?.response?.memory_saved).toBe("Alex likes pirates");
    expect(result?.response?.audio_url).toBe(`/v1/speech/${state.id}/response_audio`);
  });

  it("stores TTS audio buffer", async () => {
    const audioData = new Uint8Array([1, 2, 3, 4, 5]);
    deps.ttsProviders = { elevenlabs: createMockTtsProvider("elevenlabs", audioData) };

    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.response_audio).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("transitions through responding status", async () => {
    const statusLog: string[] = [];

    // Wrap agent to capture status at call time
    const originalRespond = deps.agent.respond.bind(deps.agent);
    const state = store.create("web-001", "hello", "SPEAKER_0");

    deps.agent.respond = async (input: AgentInput) => {
      const current = store.get(state.id);
      statusLog.push(current?.status ?? "unknown");
      return originalRespond(input);
    };

    await runPipeline(deps, state.id, "Alex", 6);

    expect(statusLog).toContain("thinking");
    expect(store.get(state.id)?.status).toBe("complete");
  });

  it("handles agent error", async () => {
    deps.agent = createFailingAgent(new Error("Model overloaded"));
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("Model overloaded");
  });

  it("handles TTS error", async () => {
    deps.ttsProviders = { elevenlabs: createFailingTtsProvider(new Error("TTS rate limit")) };
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("TTS rate limit");
  });

  it("does nothing for unknown speech ID", async () => {
    await runPipeline(deps, "sp_doesnotexist", "Alex", 6);
    expect(store.size()).toBe(0);
  });

  it("sets error when input data is missing", async () => {
    const state = store.create("web-001", "hello", "SPEAKER_0");
    // Manually clear input to simulate edge case
    const entry = store.get(state.id);
    if (entry) {
      entry.input = null;
    }

    await runPipeline(deps, state.id, "Alex", 6);
    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("No input data available");
  });

  it("skips TTS for empty speech", async () => {
    const silentOutput: AgentOutput = {
      speech: "",
      led_color: "#333333",
      led_mode: "solid",
      save_memory: "",
      memory_speaker: "",
    };
    deps.agent = createMockAgent(silentOutput);

    let ttsCalled = false;
    deps.ttsProviders = {
      elevenlabs: {
        name: "elevenlabs",
        synthesize: async () => {
          ttsCalled = true;
          return new Uint8Array([0]);
        },
      },
    };

    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    expect(ttsCalled).toBe(false);
    expect(store.get(state.id)?.status).toBe("complete");
    expect(store.get(state.id)?.response_audio?.length).toBe(0);
  });

  it("passes speaker info to agent input", async () => {
    const captured: { input: AgentInput | null } = { input: null };
    deps.agent = {
      respond: async (input: AgentInput) => {
        captured.input = input;
        return MOCK_AGENT_OUTPUT;
      },
      endSession: () => undefined,
    } as unknown as NessieAgent;

    const state = store.create("web-001", "hello nessie", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    expect(captured.input).not.toBeNull();
    expect(captured.input?.device_id).toBe("web-001");
    expect(captured.input?.speaker.name).toBe("Alex");
    expect(captured.input?.speaker.age).toBe(6);
    expect(captured.input?.speaker.id).toBe("SPEAKER_0");
    expect(captured.input?.text).toBe("hello nessie");
  });

  it("transcribes PCM audio when status is received", async () => {
    deps.transcriber = new MockTranscriberClient("hello from audio");
    const pcmBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const state = store.createFromAudio("web-001", pcmBytes);

    expect(state.status).toBe("received");

    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("complete");
    expect(result?.inputTranscript).toBe("hello from audio");
    expect(result?.input?.transcript).toBe("hello from audio");
  });

  it("sets error when audio body is missing", async () => {
    const state = store.createFromAudio("web-001", new Uint8Array(0));
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("No audio data available");
  });

  it("records tts_provider_used and tts_latency_ms from the default provider", async () => {
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.response?.tts_provider_used).toBe("elevenlabs");
    expect(typeof result?.response?.tts_latency_ms).toBe("number");
    expect(result?.response?.tts_latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("uses requested provider when both are registered", async () => {
    deps.ttsProviders = {
      elevenlabs: createMockTtsProvider("elevenlabs", new Uint8Array([1])),
      chatterbox: createMockTtsProvider("chatterbox", new Uint8Array([2, 2])),
    };
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6, "chatterbox");

    const result = store.get(state.id);
    expect(result?.response?.tts_provider_used).toBe("chatterbox");
    expect(result?.response_audio).toEqual(new Uint8Array([2, 2]));
  });

  it("falls back to defaultTtsProvider when no provider requested", async () => {
    deps.ttsProviders = {
      elevenlabs: createMockTtsProvider("elevenlabs", new Uint8Array([1])),
      chatterbox: createMockTtsProvider("chatterbox", new Uint8Array([2, 2])),
    };
    deps.defaultTtsProvider = "chatterbox";
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.response?.tts_provider_used).toBe("chatterbox");
  });

  it("errors when requested provider is not configured", async () => {
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6, "chatterbox");

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toMatch(/chatterbox/);
  });

  it("sets error when transcriber fails", async () => {
    const failingTranscriber = {
      transcribe: async (_bytes: Uint8Array): Promise<string> => {
        throw new Error("Whisper unavailable");
      },
    };
    deps.transcriber = failingTranscriber;

    const pcmBytes = new Uint8Array([0x00, 0x01]);
    const state = store.createFromAudio("web-001", pcmBytes);
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("Whisper unavailable");
  });
});
