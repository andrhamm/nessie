export type TtsProviderName = "elevenlabs" | "chatterbox";

/**
 * Abstract TTS provider. Accepts text (may include provider-specific audio
 * tags) and returns raw PCM 16-bit little-endian mono @ 16 kHz bytes — the
 * format the rest of the pipeline and the ESP32 client expect.
 */
export interface TtsProvider {
  readonly name: TtsProviderName;
  synthesize(text: string): Promise<Uint8Array>;
}

export type TtsProviderRegistry = Partial<Record<TtsProviderName, TtsProvider>>;

export function selectProvider(
  registry: TtsProviderRegistry,
  requested: TtsProviderName | undefined,
  fallback: TtsProviderName,
): TtsProvider {
  const name = requested ?? fallback;
  const provider = registry[name];
  if (!provider) {
    throw new Error(`TTS provider not configured: ${name}`);
  }
  return provider;
}
