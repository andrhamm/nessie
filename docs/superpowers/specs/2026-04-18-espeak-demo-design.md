# eSpeak-NG Low-Fidelity Voice Demo + Benchmark

**Date:** 2026-04-18
**Status:** Proposed
**Scope:** First cut of a local, low-fidelity TTS evaluation harness for the offline/LAN-first Nessie variant. Produces listenable demo clips **and** a quality/speed/latency benchmark report.

## Purpose

Evaluate whether eSpeak-NG — a classical formant TTS engine — can carry a feminine / fairy-like Nessie persona well enough to justify pursuing an offline (A-route) or LAN-only (B-route) product path. Two deliverables serve this:

1. **Listenable samples** audible side-by-side with the existing ElevenLabs voice samples.
2. **A benchmark report** capturing synth wall-time, real-time factor (RTF), output duration, and output size across every voice/FX combination, in a shape aligned with the existing `server/src/cli/tts-benchmark.ts` ElevenLabs report.

This spec covers only the demo + benchmark harness. Integration into the live agent pipeline is a later spec.

## Scope

In scope:

- eSpeak-NG engine only.
- Six feminine voice variants.
- Four FX presets skewed feminine / fairy / sprite.
- Emotion-tag parity with `SAMPLE_SCRIPT` from `voice-sampler.ts` so clips are directly comparable to ElevenLabs output.
- Machine-measured benchmark (synth time, RTF, duration, file size, FX apply time, end-to-end time), N=3 runs per combination.
- A browsable HTML listening index that embeds bench figures alongside the audio.

Out of scope (explicit non-goals):

- Piper, Flite, MBROLA, RHVoice, SAM, DECtalk / Klatt voices.
- Masculine or "gruff" voice treatments.
- Reverb-based FX.
- Synthesis of non-verbal tokens (`[gasps]`, `[giggles]`) — stripped with a note.
- Streaming / real-time use — batch render only.
- Integration into `TtsProvider` for the live agent.
- Voice cloning.
- Automated quality scoring (MOS/perceptual). Quality remains human-evaluated.

## Architecture

```
server/src/tts/local/
  espeak.ts          # adapter: segments[] → concatenated WAV
  emotion-map.ts     # parse [tag] script → EspeakSegment[]
  fx.ts              # sox FX preset chain
  bench.ts           # timing harness + stats + serialization
  html-index.ts      # render listening index with embedded bench table
server/src/cli/
  local-voice-sampler.ts   # orchestrate voices × FX, benchmark, write output
server/local-voice-samples/espeak-ng/
  <voice>_<preset>.wav     # 24 WAVs
  bench.json               # full benchmark report
  index.html               # listening UI + bench figures per cell
test/tts/local/
  espeak.test.ts
  emotion-map.test.ts
  fx.test.ts
  bench.test.ts
  html-index.test.ts
```

Every module has one job and a small interface. The CLI walks the cross-product of voices × FX presets, renders and times each combination, and emits the WAVs, `bench.json`, and `index.html`.

## Components

### `emotion-map.ts`

Parses the bracket-tag script into a sequence of segments, each carrying raw text plus eSpeak-NG parameter overrides.

```ts
interface EspeakParams {
  voiceVariant?: string;  // e.g. "+whisper"; overrides base variant
  pitch?: number;         // 0–99, default 50
  pitchRange?: number;    // 0–99, default 50
  speed?: number;         // words/min, default 175
  amplitude?: number;     // 0–200, default 100
  wordGap?: number;       // 10ms units, default 0
}

interface EspeakSegment {
  text: string;
  params: EspeakParams;
  source?: string;        // original tag, for debug logging
}

function parseScript(script: string): EspeakSegment[];
```

Rules:

- Bracket tags are parsed left-to-right. Each tag resets to defaults, then applies its override.
- Unknown tags are stripped and logged, not fatal.
- `[gasps]` and `[giggles]` are dropped; a warning is logged per occurrence.
- `[normal]` resets to defaults.
- Whitespace and punctuation between tags are preserved.

#### Tag mapping

| Tag | eSpeak-NG overrides |
| --- | --- |
| `[excited]` | speed +30%, pitch +15, pitch-range +20, amplitude +10 |
| `[whispering]` | `voiceVariant: "+whisper"`, amplitude 40 |
| `[pirate voice]` | speed +10, pitch-range +15, amplitude +5 (playful impression, no variant swap) |
| `[gentle]` | speed -15, pitch -5, amplitude -15 |
| `[curious]` | pitch-range +15, speed +5 |
| `[happy]` | pitch +10, pitch-range +10, speed +10 |
| `[normal]` | reset to defaults |
| `[gasps]`, `[giggles]` | dropped — non-verbal tokens, out of scope |

Percentage modifiers are resolved against the engine default, not compounded.

### `espeak.ts`

Adapter for the `espeak-ng` CLI.

```ts
interface SynthOptions {
  voice: string;          // e.g. "en+f3", "en-us+f5"
  segments: EspeakSegment[];
  outPath: string;        // final WAV path
  sampleRate?: number;    // default 22050
}

interface SynthResult {
  outPath: string;
  segmentTimingsMs: number[];  // per-segment espeak-ng wall time
  concatMs: number;            // sox concat wall time
  totalMs: number;             // sum of the above
  durationSec: number;         // output audio duration
  bytes: number;               // output file size
}

async function synth(opts: SynthOptions): Promise<SynthResult>;
```

Implementation: for each segment, spawn `espeak-ng` via `Bun.spawn` with `-v <voice[+variant]>`, `-s`, `-p`, `-a`, `-g`, `--stdout`, writing to a temp WAV. Collect segment WAVs. Concatenate in order via `sox <in1> <in2> … <out>`. Clean up temp files. Capture wall time for each `espeak-ng` call and the concat. Derive `durationSec` from `sox --i -D <out>`.

Per-segment `params.voiceVariant` overrides the base voice variant (so `en+f3` becomes `en+whisper` inside a `[whispering]` segment).

### `fx.ts`

Applies a named FX preset to a WAV via sox.

```ts
type FxPreset = "dry" | "fairy" | "magical" | "sprite";

interface FxResult {
  outPath: string;
  elapsedMs: number;
  durationSec: number;
  bytes: number;
}

async function applyFx(
  inPath: string,
  outPath: string,
  preset: FxPreset,
): Promise<FxResult>;
```

Preset chains:

| Preset | sox chain |
| --- | --- |
| `dry` | copy (no processing) |
| `fairy` | `pitch +300`, `chorus 0.7 0.9 40 0.4 0.25 2 -t`, `equalizer 6000 1q +3` |
| `magical` | `chorus 0.6 0.9 50 0.4 0.25 2 -t 60 0.32 0.4 1.3 -s`, `tremolo 4 20` |
| `sprite` | `pitch +500`, `tremolo 8 25`, `equalizer 7000 1.2q +4` |

All presets avoid reverb by design. Exact numeric values are a starting point and may be tuned during implementation; tests assert only that each preset produces a valid, non-empty WAV of plausible duration.

### `bench.ts`

Timing harness and aggregation.

```ts
interface RunMetrics {
  synthMs: number;      // espeak-ng segments + sox concat
  fxMs: number;         // sox FX chain (0 for dry)
  totalMs: number;      // synthMs + fxMs
  durationSec: number;  // output audio duration
  bytes: number;        // output file size
  rtf: number;          // totalMs / 1000 / durationSec (lower = faster)
}

interface CombinationStats {
  voice: string;
  preset: FxPreset;
  runs: RunMetrics[];
  mean: RunMetrics;
  min: RunMetrics;
  max: RunMetrics;
}

interface BenchReport {
  generatedAt: string;           // ISO timestamp
  runsPerCombination: number;    // 3
  script: { length: number; segmentCount: number };
  engine: "espeak-ng";
  host: { platform: string; arch: string };
  combinations: CombinationStats[];
}

async function runCombination(opts: {
  voice: string;
  preset: FxPreset;
  segments: EspeakSegment[];
  outPath: string;
  runs: number;
}): Promise<CombinationStats>;

async function writeReport(outDir: string, report: BenchReport): Promise<void>;
```

Behavior:

- Each combination is run N=3 times. Output WAV from the **final** run is the one that stays on disk (`<voice>_<preset>.wav`); intermediate runs write to a temp file and are deleted.
- Reports `mean`, `min`, `max` per metric.

### `html-index.ts`

Walks the output directory and writes `index.html`:

- Header: script text, voice list, FX preset list, non-verbal-token limitation.
- One table, one row per voice, one column per FX preset. Each cell contains an `<audio controls src="…wav">` plus mean-totalMs and mean-RTF pulled from `bench.json`.

```ts
async function renderIndex(outDir: string): Promise<void>;
```

### `local-voice-sampler.ts`

CLI orchestrator. Steps:

1. Check `espeak-ng`, `sox` on `PATH`. Fail fast with install hints.
2. Parse `SAMPLE_SCRIPT` via `emotion-map.parseScript`.
3. For each voice × FX preset combination, call `bench.runCombination(runs=3)`.
4. Aggregate into `BenchReport`, attach host info.
5. Call `bench.writeReport(outDir, report)` → `bench.json`.
6. Call `html-index.renderIndex(outDir)`.
7. Print summary: number of WAVs written, mean RTF, fastest and slowest combinations, `open …/index.html` hint.

## Configuration

Hard-coded in the CLI for this demo, not wired through `config.ts`:

- Voices: `["en+f2", "en+f3", "en+f4", "en+f5", "en-us+f3", "en-us+f5"]`
- FX presets: `["dry", "fairy", "magical", "sprite"]`
- Runs per combination: `3`
- Output directory: `server/local-voice-samples/espeak-ng`
- Sample rate: 22050 Hz (eSpeak-NG default).

## Output

```
server/local-voice-samples/espeak-ng/
  en+f2_dry.wav
  en+f2_fairy.wav
  en+f2_magical.wav
  en+f2_sprite.wav
  en+f3_dry.wav
  … (24 WAVs total)
  bench.json
  index.html
```

## Data flow

```
SAMPLE_SCRIPT
  ↓ emotion-map.parseScript
EspeakSegment[]
  ↓ loop over voices × presets × runs
bench.runCombination
  ↳ espeak.synth  → dry WAV + timing
  ↳ fx.applyFx    → <voice>_<preset>.wav + timing
  ↳ collect RunMetrics × N
  ↳ aggregate CombinationStats
  ↓ bench.writeReport
bench.json
  ↓ html-index.renderIndex
index.html
```

## Error handling

- Missing `espeak-ng` or `sox`: fail fast at CLI startup with install hint (`brew install espeak-ng sox`).
- Any `espeak-ng` or `sox` failure during a run: log stderr and fail the CLI with a non-zero exit. Demo runs are cheap; failing loud beats limping with partial output.

## Testing

Per repo standard, every module has tests. All tests run under `bun test` with no external network calls.

- `emotion-map.test.ts` — `SAMPLE_SCRIPT` parses to the expected number of segments; each tag maps to its documented param overrides; unknown tags are stripped; `[gasps]` / `[giggles]` are dropped with a log entry; `[normal]` resets.
- `espeak.test.ts` — given a one-segment input and `en+f3`, produces a non-empty WAV and returns `SynthResult` with plausible timings and duration. `test.skipIf(!hasBinary("espeak-ng") || !hasBinary("sox"))`.
- `fx.test.ts` — each preset applied to a short fixture WAV produces a valid non-empty WAV and returns `FxResult` with a positive `elapsedMs`. `test.skipIf(!hasBinary("sox"))`.
- `bench.test.ts` — given synthetic `RunMetrics` arrays, aggregation produces correct mean/min/max; `writeReport` produces parseable JSON matching the documented shape.
- `html-index.test.ts` — given a temp dir with known WAVs and a fixture `bench.json`, the rendered HTML contains one `<audio>` per file, the voice × preset table, and mean-totalMs + RTF cells.

## Dependencies

- System binaries: `espeak-ng`, `sox` (`brew install espeak-ng sox`).
- NPM: none. All process control uses `Bun.spawn`.
- `package.json`: add `"tts:demo:local": "bun run src/cli/local-voice-sampler.ts"`.

## Invocation

```bash
bun run tts:demo:local
```

## Success criteria

- End-to-end run on a Mac with `espeak-ng` + `sox` produces 24 WAVs, `bench.json`, and `index.html` in the documented output directory.
- `index.html` renders in a browser with playable audio and visible bench figures per cell.
- `bench.json` validates against the documented shape (checked in test via Zod schema).
- `bun test` green (or appropriately skipped).
- `bun run lint` clean.

## Open questions

None blocking. Exact sox preset parameter values may be tuned during implementation — tests assert validity, not specific acoustic properties.

## Follow-up work (not this spec)

- Scope B cut: add Piper, Flite, MBROLA, SAM adapters behind the same `SynthOptions` shape; extend `bench.ts` to tag `engine` per combination.
- Teach `tts-benchmark.ts` to emit a compatible JSON so ElevenLabs and local engines share one report shape.
- If eSpeak-NG is promoted to a `TtsProvider`, port it to ESP32-P4 for the A-route offline path.
