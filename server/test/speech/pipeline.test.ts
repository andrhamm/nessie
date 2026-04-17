import { beforeEach, describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import type { NessieAgent } from "../../src/agent/nessie-agent";
import type { AgentInput, AgentOutput } from "../../src/agent/schemas";
import type { PipelineDeps } from "../../src/speech/pipeline";
import { runPipeline } from "../../src/speech/pipeline";
import { SpeechStore } from "../../src/speech/store";
import { MockTranscriberClient } from "../../src/speech/transcriber-client";
import type { TtsClient, TtsConfig } from "../../src/tts/elevenlabs";

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

function createMockTtsClient(audio?: Uint8Array): TtsClient {
  const audioData = audio ?? new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
  return {
    textToSpeech: {
      convert: async () => Readable.from([audioData]),
    },
  };
}

function createFailingTtsClient(error: Error): TtsClient {
  return {
    textToSpeech: {
      convert: async () => {
        throw error;
      },
    },
  };
}

const TTS_CONFIG: TtsConfig = {
  voiceId: "test-voice-id",
};

describe("runPipeline", () => {
  let store: SpeechStore;
  let deps: PipelineDeps;

  beforeEach(() => {
    store = new SpeechStore();
    deps = {
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
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
    deps.ttsClient = createMockTtsClient(audioData);

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

    expect(statusLog).toContain("responding");
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
    deps.ttsClient = createFailingTtsClient(new Error("TTS rate limit"));
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
    deps.ttsClient = {
      textToSpeech: {
        convert: async () => {
          ttsCalled = true;
          return Readable.from([new Uint8Array([0])]);
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
