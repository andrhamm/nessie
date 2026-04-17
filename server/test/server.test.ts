import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Readable } from "node:stream";
import type { AgentInput, AgentOutput } from "../src/agent/schemas";
import { createServer } from "../src/server.ts";
import type { RouteDeps } from "../src/speech/routes";
import { SpeechStore } from "../src/speech/store";
import { MockTranscriberClient } from "../src/speech/transcriber-client";
import type { TtsClient, TtsConfig } from "../src/tts/elevenlabs";

const MOCK_AGENT_OUTPUT: AgentOutput = {
  speech: "[happy] Hello friend!",
  led_color: "#87CEEB",
  led_mode: "solid",
  save_memory: "",
  memory_speaker: "",
};

function createTestDeps(): RouteDeps {
  return {
    store: new SpeechStore(),
    agent: {
      respond: async (_input: AgentInput): Promise<AgentOutput> => MOCK_AGENT_OUTPUT,
      endSession: () => undefined,
    } as unknown as RouteDeps["agent"],
    ttsClient: {
      textToSpeech: {
        convert: async () => Readable.from([new Uint8Array([0xff, 0xfb, 0x90])]),
      },
    } as TtsClient,
    ttsConfig: { voiceId: "test-voice" } as TtsConfig,
    transcriber: new MockTranscriberClient("hello"),
  };
}

describe("server", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeAll(() => {
    server = createServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  test("GET /health returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  test("GET /unknown returns 404", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not found");
  });

  test("POST /health returns 405", async () => {
    const res = await fetch(`${baseUrl}/health`, { method: "POST" });
    expect(res.status).toBe(405);
  });

  test("POST /v1/speech returns 503 when speech deps not configured", async () => {
    const res = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });
    expect(res.status).toBe(503);
  });
});

describe("server with speech deps", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let deps: RouteDeps;

  beforeAll(() => {
    deps = createTestDeps();
    server = createServer({ port: 0, speechDeps: deps });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  test("POST /v1/speech creates speech request", async () => {
    const res = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello nessie" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^sp_[0-9a-f]{12}$/);
  });

  test("GET /v1/speech/:id returns speech state", async () => {
    const createRes = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });
    const { id } = (await createRes.json()) as { id: string };

    // Wait briefly for pipeline to run
    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`${baseUrl}/v1/speech/${id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.id).toBe(id);
  });

  test("GET /v1/speech/unknown returns 404", async () => {
    const res = await fetch(`${baseUrl}/v1/speech/sp_doesnotexist`);
    expect(res.status).toBe(404);
  });

  test("GET /v1/speech/:id/response_audio returns audio after completion", async () => {
    const createRes = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });
    const { id } = (await createRes.json()) as { id: string };

    // Wait for pipeline to complete
    await new Promise((r) => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/v1/speech/${id}/response_audio`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/L16;rate=16000");
  });

  test("GET /health still works with speech deps", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
