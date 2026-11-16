import { describe, expect, it } from "bun:test";
import { ChatterboxProvider } from "../../src/tts/chatterbox-provider";

/**
 * Build a minimal valid PCM16 mono WAV buffer from Int16 samples.
 * Canonical 44-byte header.
 */
function makeWavBuffer(samples: Int16Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new Uint8Array(44 + dataBytes);
  const dv = new DataView(buf.buffer);
  const setStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) buf[offset + i] = s.charCodeAt(i);
  };
  setStr(0, "RIFF");
  dv.setUint32(4, 36 + dataBytes, true);
  setStr(8, "WAVE");
  setStr(12, "fmt ");
  dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  setStr(36, "data");
  dv.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    dv.setInt16(44 + i * 2, samples[i] as number, true);
  }
  return buf;
}

function mockFetch(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch;
}

describe("ChatterboxProvider", () => {
  const baseConfig = { url: "http://localhost:8004", voice: "Emily.wav" };

  it("has name 'chatterbox'", () => {
    const provider = new ChatterboxProvider({ ...baseConfig, fetchFn: mockFetch(new Response()) });
    expect(provider.name).toBe("chatterbox");
  });

  it("returns empty for empty text without calling fetch", async () => {
    let called = false;
    const fetchFn = (async () => {
      called = true;
      return new Response();
    }) as unknown as typeof fetch;
    const provider = new ChatterboxProvider({ ...baseConfig, fetchFn });
    const out = await provider.synthesize("   ");
    expect(out.length).toBe(0);
    expect(called).toBe(false);
  });

  it("POSTs the correct JSON body to /v1/audio/speech", async () => {
    let capturedUrl = "";
    let capturedBody: unknown = null;
    const wav = makeWavBuffer(new Int16Array([0, 100, -100]), 16000);
    const fetchFn = (async (url: string, init: RequestInit) => {
      capturedUrl = url;
      capturedBody = JSON.parse(init.body as string);
      return new Response(wav, { status: 200 });
    }) as unknown as typeof fetch;

    const provider = new ChatterboxProvider({ ...baseConfig, fetchFn });
    await provider.synthesize("[laugh] Hi!");

    expect(capturedUrl).toBe("http://localhost:8004/v1/audio/speech");
    expect(capturedBody).toEqual({
      model: "chatterbox",
      input: "[laugh] Hi!",
      voice: "Emily.wav",
      response_format: "wav",
    });
  });

  it("strips trailing slash on url", async () => {
    let capturedUrl = "";
    const wav = makeWavBuffer(new Int16Array([0]), 16000);
    const fetchFn = (async (url: string) => {
      capturedUrl = url;
      return new Response(wav, { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new ChatterboxProvider({
      ...baseConfig,
      url: "http://localhost:8004/",
      fetchFn,
    });
    await provider.synthesize("hi");
    expect(capturedUrl).toBe("http://localhost:8004/v1/audio/speech");
  });

  it("decodes WAV response to raw PCM 16 LE bytes", async () => {
    const samples = new Int16Array([0, 1000, -1000, 32000, -32000]);
    const wav = makeWavBuffer(samples, 16000);
    const provider = new ChatterboxProvider({
      ...baseConfig,
      fetchFn: mockFetch(new Response(wav, { status: 200 })),
    });

    const pcm = await provider.synthesize("hello");
    expect(pcm.length).toBe(samples.length * 2);

    // Verify the bytes are Int16 LE matching our input samples (within ±1 due
    // to float round-trip through the decoder).
    const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    for (let i = 0; i < samples.length; i++) {
      const expected = samples[i] as number;
      const actual = view.getInt16(i * 2, true);
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("throws on non-OK HTTP response and includes the error body", async () => {
    const fetchFn = (async () =>
      new Response('{"detail":"boom"}', {
        status: 500,
        statusText: "Internal Server Error",
      })) as unknown as typeof fetch;
    const provider = new ChatterboxProvider({ ...baseConfig, fetchFn });
    const err = await provider.synthesize("hi").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/HTTP 500/);
    expect((err as Error).message).toMatch(/boom/);
  });

  it("throws when returned WAV sample rate differs from expected", async () => {
    const wav = makeWavBuffer(new Int16Array([0, 1, 2]), 24000);
    const provider = new ChatterboxProvider({
      ...baseConfig,
      fetchFn: mockFetch(new Response(wav, { status: 200 })),
    });
    await expect(provider.synthesize("hi")).rejects.toThrow(/24000 Hz, expected 16000 Hz/);
  });

  it("honors expectedSampleRate override", async () => {
    const wav = makeWavBuffer(new Int16Array([0, 1, 2]), 24000);
    const provider = new ChatterboxProvider({
      ...baseConfig,
      expectedSampleRate: 24000,
      fetchFn: mockFetch(new Response(wav, { status: 200 })),
    });
    const pcm = await provider.synthesize("hi");
    expect(pcm.length).toBe(6);
  });
});
