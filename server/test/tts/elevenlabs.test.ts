import { describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import { synthesize, type TtsClient, type TtsConfig } from "../../src/tts/elevenlabs";

function createMockClient(responseChunks: Uint8Array[]): TtsClient {
  return {
    textToSpeech: {
      convert: async (
        _voiceId: string,
        _request: { text: string; model_id: string; output_format: string },
      ) => {
        return Readable.from(responseChunks);
      },
    },
  };
}

function createFailingClient(error: Error): TtsClient {
  return {
    textToSpeech: {
      convert: async () => {
        throw error;
      },
    },
  };
}

describe("synthesize", () => {
  const config: TtsConfig = {
    voiceId: "test-voice-id",
  };

  it("returns audio buffer from stream", async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);
    const client = createMockClient([chunk1, chunk2]);

    const result = await synthesize(client, config, "[excited] Hello!");
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("returns empty buffer for empty text", async () => {
    const client = createMockClient([new Uint8Array([1, 2, 3])]);
    const result = await synthesize(client, config, "");
    expect(result.length).toBe(0);
  });

  it("returns empty buffer for whitespace-only text", async () => {
    const client = createMockClient([new Uint8Array([1, 2, 3])]);
    const result = await synthesize(client, config, "   ");
    expect(result.length).toBe(0);
  });

  it("passes correct parameters to client", async () => {
    const calls: Array<{ voiceId: string; text: string; model_id: string; output_format: string }> =
      [];

    const client: TtsClient = {
      textToSpeech: {
        convert: async (voiceId, request) => {
          calls.push({ voiceId, ...request });
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };

    await synthesize(client, { voiceId: "my-voice" }, "[happy] Test text");
    expect(calls.length).toBe(1);
    const call = calls[0];
    if (call === undefined) throw new Error("no calls recorded");
    expect(call.voiceId).toBe("my-voice");
    expect(call.text).toBe("[happy] Test text");
    expect(call.model_id).toBe("eleven_v3");
    expect(call.output_format).toBe("pcm_16000");
  });

  it("uses custom model_id and output_format when provided", async () => {
    const calls: Array<{ model_id: string; output_format: string }> = [];

    const client: TtsClient = {
      textToSpeech: {
        convert: async (_voiceId, request) => {
          calls.push({ model_id: request.model_id, output_format: request.output_format });
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };

    const customConfig: TtsConfig = {
      voiceId: "test",
      modelId: "eleven_turbo_v2",
      outputFormat: "mp3_22050_32",
    };

    await synthesize(client, customConfig, "Hello");
    expect(calls.length).toBe(1);
    const call = calls[0];
    if (call === undefined) throw new Error("no calls recorded");
    expect(call.model_id).toBe("eleven_turbo_v2");
    expect(call.output_format).toBe("mp3_22050_32");
  });

  it("handles single-chunk streams", async () => {
    const client = createMockClient([new Uint8Array([10, 20, 30])]);
    const result = await synthesize(client, config, "Hello");
    expect(result).toEqual(new Uint8Array([10, 20, 30]));
  });

  it("handles empty stream", async () => {
    const client = createMockClient([]);
    const result = await synthesize(client, config, "Hello");
    expect(result.length).toBe(0);
  });

  it("propagates client errors", async () => {
    const client = createFailingClient(new Error("API rate limit"));
    await expect(synthesize(client, config, "Hello")).rejects.toThrow("API rate limit");
  });
});
