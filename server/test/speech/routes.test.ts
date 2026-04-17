import { beforeEach, describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import type { NessieAgent } from "../../src/agent/nessie-agent";
import type { AgentInput, AgentOutput } from "../../src/agent/schemas";
import {
  handleSpeechCreate,
  handleSpeechGet,
  handleSpeechInputAudio,
  handleSpeechResponseAudio,
  type RouteDeps,
} from "../../src/speech/routes";
import { SpeechStore } from "../../src/speech/store";
import type { TtsClient, TtsConfig } from "../../src/tts/elevenlabs";

const MOCK_AGENT_OUTPUT: AgentOutput = {
  speech: "[excited] Hello!",
  led_color: "#FFD700",
  led_mode: "pulse",
  save_memory: "",
  memory_speaker: "",
};

function createMockAgent(): NessieAgent {
  return {
    respond: async (_input: AgentInput): Promise<AgentOutput> => MOCK_AGENT_OUTPUT,
    endSession: () => undefined,
  } as unknown as NessieAgent;
}

function createMockTtsClient(): TtsClient {
  return {
    textToSpeech: {
      convert: async () => Readable.from([new Uint8Array([0xff, 0xfb, 0x90])]),
    },
  };
}

const TTS_CONFIG: TtsConfig = { voiceId: "test-voice" };

describe("handleSpeechCreate", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns 201 with speech ID", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello nessie" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^sp_[0-9a-f]{12}$/);
  });

  it("creates entry in store", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });

    const res = await handleSpeechCreate(req, deps);
    const body = (await res.json()) as { id: string };
    const state = deps.store.get(body.id);
    expect(state).toBeDefined();
    expect(state?.input?.transcript).toBe("hello");
  });

  it("returns 405 for non-POST", async () => {
    const req = new Request("http://localhost/v1/speech", { method: "GET" });
    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(405);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid JSON body");
  });

  it("returns 400 for missing device_id", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "hello" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown[] };
    expect(body.error).toBe("validation failed");
  });

  it("returns 400 for missing transcript", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty transcript", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
  });

  it("accepts optional speaker_name and speaker_age", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: "web-001",
        transcript: "hello",
        speaker_name: "Alex",
        speaker_age: 6,
      }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(201);
  });
});

describe("handleSpeechGet", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns speech state", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechGet(state.id, deps);
    expect(res.status).toBe(200);
  });

  it("returns correct data shape", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechGet(state.id, deps);
    const body = (await res.json()) as {
      id: string;
      status: string;
      input: { transcript: string };
    };
    expect(body.id).toBe(state.id);
    expect(body.status).toBe("transcribed");
    expect(body.input.transcript).toBe("hello");
  });

  it("returns 404 for unknown ID", () => {
    const res = handleSpeechGet("sp_doesnotexist", deps);
    expect(res.status).toBe(404);
  });

  it("includes response when complete", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    deps.store.setResponse(
      state.id,
      {
        speech_tagged: "[happy] Hi!",
        speech_plain: "Hi!",
        audio_url: `/v1/speech/${state.id}/response_audio`,
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      },
      new Uint8Array([1, 2, 3]),
    );

    const res = handleSpeechGet(state.id, deps);
    const body = (await res.json()) as {
      status: string;
      response: { speech_plain: string };
    };
    expect(body.status).toBe("complete");
    expect(body.response.speech_plain).toBe("Hi!");
  });

  it("includes error when failed", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    deps.store.setError(state.id, "Something broke");

    const res = handleSpeechGet(state.id, deps);
    const body = (await res.json()) as { status: string; error: string };
    expect(body.status).toBe("error");
    expect(body.error).toBe("Something broke");
  });
});

describe("handleSpeechInputAudio", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns 404 for any ID (browser STT has no server-side input audio)", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechInputAudio(state.id, deps);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown ID", () => {
    const res = handleSpeechInputAudio("sp_doesnotexist", deps);
    expect(res.status).toBe(404);
  });

  it("returns descriptive error message", async () => {
    const res = handleSpeechInputAudio("sp_anything", deps);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("input audio not available");
  });
});

describe("handleSpeechResponseAudio", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns audio with correct content type", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const audioData = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00]);
    deps.store.setResponse(
      state.id,
      {
        speech_tagged: "Hi!",
        speech_plain: "Hi!",
        audio_url: `/v1/speech/${state.id}/response_audio`,
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      },
      audioData,
    );

    const res = handleSpeechResponseAudio(state.id, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/L16;rate=16000");
    expect(res.headers.get("Content-Length")).toBe("5");

    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(audioData);
  });

  it("returns 404 for unknown ID", () => {
    const res = handleSpeechResponseAudio("sp_doesnotexist", deps);
    expect(res.status).toBe(404);
  });

  it("returns 404 when audio not ready", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechResponseAudio(state.id, deps);
    expect(res.status).toBe(404);
  });

  it("returns 404 for empty audio buffer", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    deps.store.setResponse(
      state.id,
      {
        speech_tagged: "",
        speech_plain: "",
        audio_url: "",
        led_color: "",
        led_mode: "",
        memory_saved: "",
      },
      new Uint8Array(0),
    );

    const res = handleSpeechResponseAudio(state.id, deps);
    expect(res.status).toBe(404);
  });
});
