import { describe, expect, it } from "bun:test";
import {
  SpeechRequestSchema,
  type SpeechState,
  SpeechStatusSchema,
  toApiResponse,
} from "../../src/speech/types";

describe("SpeechStatusSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["received", "transcribed", "responding", "complete", "error"]) {
      const result = SpeechStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = SpeechStatusSchema.safeParse("pending");
    expect(result.success).toBe(false);
  });
});

describe("SpeechRequestSchema", () => {
  it("parses valid request with all fields", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
      transcript: "let's play pirates",
      speaker_name: "Alex",
      speaker_age: 6,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.device_id).toBe("web-001");
      expect(result.data.transcript).toBe("let's play pirates");
      expect(result.data.speaker_name).toBe("Alex");
      expect(result.data.speaker_age).toBe(6);
    }
  });

  it("applies defaults for speaker_name and speaker_age", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
      transcript: "hello nessie",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.speaker_name).toBe("Friend");
      expect(result.data.speaker_age).toBe(0);
    }
  });

  it("rejects missing device_id", () => {
    const result = SpeechRequestSchema.safeParse({
      transcript: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing transcript", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty device_id", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "",
      transcript: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty transcript", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
      transcript: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("toApiResponse", () => {
  const baseState: SpeechState = {
    id: "sp_test123",
    status: "received",
    device_id: "web-001",
    created_at: 1713264000000,
    input: null,
    response: null,
    response_audio: null,
    error: null,
  };

  it("returns minimal response for received status", () => {
    const res = toApiResponse(baseState);
    expect(res).toEqual({
      id: "sp_test123",
      status: "received",
    });
    expect(res.input).toBeUndefined();
    expect(res.response).toBeUndefined();
    expect(res.error).toBeUndefined();
  });

  it("includes input when available", () => {
    const state: SpeechState = {
      ...baseState,
      status: "transcribed",
      input: { transcript: "let's play pirates", speaker: "SPEAKER_0" },
    };
    const res = toApiResponse(state);
    expect(res.status).toBe("transcribed");
    expect(res.input).toEqual({
      transcript: "let's play pirates",
      speaker: "SPEAKER_0",
    });
    expect(res.response).toBeUndefined();
  });

  it("includes response when complete", () => {
    const state: SpeechState = {
      ...baseState,
      status: "complete",
      input: { transcript: "let's play pirates", speaker: "SPEAKER_0" },
      response: {
        speech_tagged: "[excited] Arr, Captain!",
        speech_plain: "Arr, Captain!",
        audio_url: "/v1/speech/sp_test123/response_audio",
        led_color: "#FFD700",
        led_mode: "pulse",
        memory_saved: "Likes pirates",
      },
      response_audio: new Uint8Array([1, 2, 3]),
    };
    const res = toApiResponse(state);
    expect(res.status).toBe("complete");
    expect(res.input).toBeDefined();
    expect(res.response).toBeDefined();
    expect(res.response?.speech_tagged).toBe("[excited] Arr, Captain!");
    expect(res.response?.audio_url).toBe("/v1/speech/sp_test123/response_audio");
  });

  it("does not include response_audio binary in API response", () => {
    const state: SpeechState = {
      ...baseState,
      status: "complete",
      input: { transcript: "hello", speaker: "SPEAKER_0" },
      response: {
        speech_tagged: "Hi!",
        speech_plain: "Hi!",
        audio_url: "/v1/speech/sp_test123/response_audio",
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      },
      response_audio: new Uint8Array([1, 2, 3]),
    };
    const res = toApiResponse(state);
    expect("response_audio" in res).toBe(false);
  });

  it("includes error when present", () => {
    const state: SpeechState = {
      ...baseState,
      status: "error",
      error: "Agent failed: rate limit exceeded",
    };
    const res = toApiResponse(state);
    expect(res.status).toBe("error");
    expect(res.error).toBe("Agent failed: rate limit exceeded");
    expect(res.input).toBeUndefined();
    expect(res.response).toBeUndefined();
  });
});
