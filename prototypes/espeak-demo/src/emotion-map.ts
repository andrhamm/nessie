export interface EspeakParams {
  voiceVariant?: string;
  pitch?: number;
  speed?: number;
  amplitude?: number;
  wordGap?: number;
}

export interface EspeakSegment {
  text: string;
  params: EspeakParams;
  source?: string;
}

const DEFAULTS: Required<Omit<EspeakParams, "voiceVariant">> = {
  pitch: 50,
  speed: 175,
  amplitude: 100,
  wordGap: 0,
};

const TAG_MAP: Record<string, EspeakParams> = {
  excited: { speed: 228, pitch: 65, amplitude: 110 },
  whispering: { voiceVariant: "+whisper", amplitude: 40 },
  "pirate voice": { speed: 185, amplitude: 105 },
  gentle: { speed: 160, pitch: 45, amplitude: 85 },
  curious: { speed: 180 },
  happy: { pitch: 60, speed: 185 },
  normal: {},
};

const DROPPED = new Set(["gasps", "giggles"]);

export function parseScript(script: string): EspeakSegment[] {
  const re = /\[([^\]]+)\]/g;
  const matches = [...script.matchAll(re)];
  const segments: EspeakSegment[] = [];

  if (matches.length === 0) {
    const t = script.trim();
    if (t) segments.push({ text: t, params: { ...DEFAULTS } });
    return segments;
  }

  const firstIndex = matches[0]?.index ?? 0;
  const preface = script.slice(0, firstIndex).trim();
  if (preface) segments.push({ text: preface, params: { ...DEFAULTS } });

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    if (!m) continue;
    const tag = m[1]?.toLowerCase().trim() ?? "";
    const tagEnd = (m.index ?? 0) + m[0].length;
    const next = matches[i + 1];
    const nextStart = next !== undefined ? (next.index ?? script.length) : script.length;
    const text = script.slice(tagEnd, nextStart).trim();
    if (!text) continue;

    let params: EspeakParams;
    if (DROPPED.has(tag)) {
      console.info(`[emotion-map] dropped non-verbal tag: ${tag}`);
      params = { ...DEFAULTS };
    } else if (tag in TAG_MAP) {
      params = { ...DEFAULTS, ...TAG_MAP[tag] };
    } else {
      console.warn(`[emotion-map] unknown tag stripped: ${tag}`);
      params = { ...DEFAULTS };
    }

    segments.push({ text, params, source: tag });
  }

  return segments;
}
