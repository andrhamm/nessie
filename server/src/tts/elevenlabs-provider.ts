import type { Readable } from "node:stream";
import type { TtsProvider } from "./provider";

/**
 * Minimal interface matching what we use from ElevenLabsClient.textToSpeech.
 * Allows dependency injection for testing.
 */
export interface ElevenLabsTtsClient {
  textToSpeech: {
    convert(
      voiceId: string,
      request: { text: string; model_id: string; output_format: string },
    ): Promise<Readable>;
  };
}

export interface ElevenLabsProviderConfig {
  voiceId: string;
  modelId?: string;
  outputFormat?: string;
}

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
 * ElevenLabs TTS provider. Produces raw PCM 16 kHz mono bytes.
 * Accepts ElevenLabs v3 audio tags (e.g. [excited], [whispers]) in the input.
 */
export class ElevenLabsProvider implements TtsProvider {
  readonly name = "elevenlabs" as const;

  constructor(
    private readonly client: ElevenLabsTtsClient,
    private readonly config: ElevenLabsProviderConfig,
  ) {}

  async synthesize(text: string): Promise<Uint8Array> {
    if (!text.trim()) {
      return new Uint8Array(0);
    }

    const stream = await this.client.textToSpeech.convert(this.config.voiceId, {
      text,
      model_id: this.config.modelId ?? "eleven_v3",
      output_format: this.config.outputFormat ?? "pcm_16000",
    });

    return streamToBuffer(stream);
  }
}
