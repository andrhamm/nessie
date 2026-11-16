import { describe, expect, it } from "bun:test";
import { Readable } from "node:stream";
import { ElevenLabsProvider, type ElevenLabsTtsClient } from "../../src/tts/elevenlabs-provider";

function createMockClient(responseChunks: Uint8Array[]): ElevenLabsTtsClient {
  return {
    textToSpeech: {
      convert: async () => Readable.from(responseChunks),
    },
  };
}

function createFailingClient(error: Error): ElevenLabsTtsClient {
  return {
    textToSpeech: {
      convert: async () => {
        throw error;
      },
    },
  };
}

describe("ElevenLabsProvider", () => {
  it("has name 'elevenlabs'", () => {
    const provider = new ElevenLabsProvider(createMockClient([]), { voiceId: "v" });
    expect(provider.name).toBe("elevenlabs");
  });

  it("returns audio buffer concatenated from stream", async () => {
    const client = createMockClient([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])]);
    const provider = new ElevenLabsProvider(client, { voiceId: "v" });
    const result = await provider.synthesize("[excited] Hello!");
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("returns empty buffer for empty text", async () => {
    const provider = new ElevenLabsProvider(createMockClient([new Uint8Array([1, 2, 3])]), {
      voiceId: "v",
    });
    const result = await provider.synthesize("");
    expect(result.length).toBe(0);
  });

  it("returns empty buffer for whitespace-only text", async () => {
    const provider = new ElevenLabsProvider(createMockClient([new Uint8Array([1, 2, 3])]), {
      voiceId: "v",
    });
    const result = await provider.synthesize("   ");
    expect(result.length).toBe(0);
  });

  it("passes correct defaults to client (eleven_v3, pcm_16000)", async () => {
    const calls: Array<{ voiceId: string; text: string; model_id: string; output_format: string }> =
      [];
    const client: ElevenLabsTtsClient = {
      textToSpeech: {
        convert: async (voiceId, request) => {
          calls.push({ voiceId, ...request });
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };
    const provider = new ElevenLabsProvider(client, { voiceId: "my-voice" });
    await provider.synthesize("[happy] Test text");
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
    const client: ElevenLabsTtsClient = {
      textToSpeech: {
        convert: async (_voiceId, request) => {
          calls.push({ model_id: request.model_id, output_format: request.output_format });
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };
    const provider = new ElevenLabsProvider(client, {
      voiceId: "test",
      modelId: "eleven_turbo_v2",
      outputFormat: "mp3_22050_32",
    });
    await provider.synthesize("Hello");
    const call = calls[0];
    if (call === undefined) throw new Error("no calls recorded");
    expect(call.model_id).toBe("eleven_turbo_v2");
    expect(call.output_format).toBe("mp3_22050_32");
  });

  it("handles empty stream", async () => {
    const provider = new ElevenLabsProvider(createMockClient([]), { voiceId: "v" });
    const result = await provider.synthesize("Hello");
    expect(result.length).toBe(0);
  });

  it("propagates client errors", async () => {
    const provider = new ElevenLabsProvider(createFailingClient(new Error("API rate limit")), {
      voiceId: "v",
    });
    await expect(provider.synthesize("Hello")).rejects.toThrow("API rate limit");
  });
});
