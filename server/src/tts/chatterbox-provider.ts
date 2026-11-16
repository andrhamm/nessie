import type { TtsProvider } from "./provider";
import decodeWav from "./vendor/decode-wav";

export interface ChatterboxProviderConfig {
  /** Base URL of the devnen Chatterbox TTS server. */
  url: string;
  /** Reference voice filename (must exist in the server's voices/ or reference_audio/ dir). */
  voice: string;
  /** Expected output sample rate. Defaults to 16000 to match Nessie pipeline. */
  expectedSampleRate?: number;
  /** Optional fetch override for testing. Defaults to global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * Minimal fetch-based client for a devnen/Chatterbox-TTS-Server. Posts to the
 * OpenAI-compatible /v1/audio/speech endpoint, receives a WAV response, and
 * decodes it to raw PCM 16-bit LE mono bytes at 16 kHz — the format the rest
 * of the Nessie pipeline and the ESP32 client expect.
 *
 * Supports paralinguistic tags ([laugh], [gasp], [sigh] etc.) inline in the
 * text; other text is synthesized in the selected voice.
 */
export class ChatterboxProvider implements TtsProvider {
  readonly name = "chatterbox" as const;

  private readonly url: string;
  private readonly voice: string;
  private readonly expectedSampleRate: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: ChatterboxProviderConfig) {
    this.url = config.url.replace(/\/$/, "");
    this.voice = config.voice;
    this.expectedSampleRate = config.expectedSampleRate ?? 16000;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async synthesize(text: string): Promise<Uint8Array> {
    if (!text.trim()) {
      return new Uint8Array(0);
    }

    const res = await this.fetchFn(`${this.url}/v1/audio/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "chatterbox",
        input: text,
        voice: this.voice,
        response_format: "wav",
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Chatterbox TTS failed: HTTP ${res.status} ${res.statusText}${
          detail ? ` — ${detail}` : ""
        }`,
      );
    }

    const wavBytes = new Uint8Array(await res.arrayBuffer());
    const decoded = await decodeWav(wavBytes);

    if (decoded.sampleRate !== this.expectedSampleRate) {
      throw new Error(
        `Chatterbox returned WAV at ${decoded.sampleRate} Hz, expected ${this.expectedSampleRate} Hz. ` +
          `Set audio_output.sample_rate in the Chatterbox server config.yaml.`,
      );
    }

    const mono = decoded.channelData[0];
    if (!mono) {
      return new Uint8Array(0);
    }

    return float32ToInt16LE(mono);
  }
}

function float32ToInt16LE(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    const v = s < 0 ? Math.round(s * 32768) : Math.round(s * 32767);
    view.setInt16(i * 2, v, true);
  }
  return out;
}
