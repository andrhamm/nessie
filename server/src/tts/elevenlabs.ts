import type { Readable } from "node:stream";

/**
 * Minimal interface matching what we use from ElevenLabsClient.textToSpeech.
 * Allows dependency injection for testing.
 */
export interface TtsClient {
  textToSpeech: {
    convert(
      voiceId: string,
      request: { text: string; model_id: string; output_format: string },
    ): Promise<Readable>;
  };
}

/**
 * Configuration for the TTS wrapper.
 */
export interface TtsConfig {
  voiceId: string;
  modelId?: string;
  outputFormat?: string;
}

/**
 * Collect a Node.js Readable stream into a single Uint8Array.
 */
async function streamToBuffer(readable: Readable): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of readable) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer));
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Convert speech text to audio using ElevenLabs TTS.
 *
 * The text should include ElevenLabs v3 audio tags (e.g. [excited])
 * which the model uses for expressive speech synthesis.
 *
 * @param client - ElevenLabs client (or mock implementing TtsClient)
 * @param config - Voice ID and optional model/format overrides
 * @param text - Speech text with optional audio tags
 * @returns PCM audio as Uint8Array
 */
export async function synthesize(
  client: TtsClient,
  config: TtsConfig,
  text: string,
): Promise<Uint8Array> {
  if (!text.trim()) {
    return new Uint8Array(0);
  }

  const stream = await client.textToSpeech.convert(config.voiceId, {
    text,
    model_id: config.modelId ?? "eleven_v3",
    output_format: config.outputFormat ?? "pcm_16000",
  });

  return streamToBuffer(stream);
}
