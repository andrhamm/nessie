# eSpeak-NG Voice Demo + Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local TTS demo harness that renders the existing ElevenLabs `SAMPLE_SCRIPT` through eSpeak-NG across 6 feminine voices × 4 reverb-free FX presets with N=3 runs per combination, writing `bench.json` (speed/latency metrics) and `index.html` (listening UI) to `server/local-voice-samples/espeak-ng/`.

**Architecture:** Five single-purpose modules under `server/src/tts/local/` (emotion-map, espeak, fx, bench, html-index) plus one CLI (`server/src/cli/local-voice-sampler.ts`) and a shared helper (`server/src/utils/has-binary.ts`). Each module has its own test file. Integration tests that shell out to `espeak-ng` or `sox` are skipped if the binary is missing.

**Tech Stack:** Bun, TypeScript (strict), Biome, `Bun.spawn` for process control, `espeak-ng` + `sox` as system binaries.

**Spec reference:** `docs/superpowers/specs/2026-04-18-espeak-demo-design.md`.

**Implementation note re: pitch-range.** The spec's `EspeakParams.pitchRange` is not exposed by the `espeak-ng` CLI directly (it requires SSML wrapping). To keep the demo simple, `pitchRange` is dropped from `EspeakParams` and the tag table. All other tag intents are preserved via `speed`, `pitch`, `amplitude`, `voiceVariant`. Follow-up work can add SSML rendering if pitch-range becomes load-bearing.

---

## File structure

**New files**

| File | Responsibility |
| --- | --- |
| `server/src/utils/has-binary.ts` | `hasBinary(name)` — sync `Bun.which` wrapper for `test.skipIf`. |
| `server/src/tts/local/wav-utils.ts` | `getDurationSec(path)` — shared `sox --i -D` wrapper. |
| `server/src/tts/local/emotion-map.ts` | Parse bracket-tag script → `EspeakSegment[]`. |
| `server/src/tts/local/espeak.ts` | `synth(opts)` — per-segment `espeak-ng` + `sox` concat, timed. |
| `server/src/tts/local/fx.ts` | `applyFx(inPath, outPath, preset)` — sox FX chain, timed. |
| `server/src/tts/local/bench.ts` | `runCombination`, `aggregate`, `writeReport`, types. |
| `server/src/tts/local/html-index.ts` | `renderIndex(outDir)` — HTML page over WAV dir + bench.json. |
| `server/src/cli/local-voice-sampler.ts` | CLI orchestrator. |
| `server/test/utils/has-binary.test.ts` | Unit. |
| `server/test/tts/local/wav-utils.test.ts` | Integration (skipIf sox). |
| `server/test/tts/local/emotion-map.test.ts` | Unit. |
| `server/test/tts/local/espeak.test.ts` | Integration (skipIf espeak-ng+sox). |
| `server/test/tts/local/fx.test.ts` | Integration (skipIf sox). |
| `server/test/tts/local/bench.test.ts` | Unit. |
| `server/test/tts/local/html-index.test.ts` | Unit (filesystem + Bun.file). |

**Modified files**

| File | Change |
| --- | --- |
| `server/package.json` | Add `"tts:demo:local"` script. |
| `server/.gitignore` | Add `local-voice-samples/`. |

---

## Task 1: Binary-check helper

**Files:**
- Create: `server/src/utils/has-binary.ts`
- Test: `server/test/utils/has-binary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/utils/has-binary.test.ts`:

```ts
import { expect, test } from "bun:test";
import { hasBinary } from "../../src/utils/has-binary";

test("hasBinary returns true for sh", () => {
  expect(hasBinary("sh")).toBe(true);
});

test("hasBinary returns false for missing binary", () => {
  expect(hasBinary("this-binary-does-not-exist-zzz-xyz")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/utils/has-binary.test.ts`
Expected: FAIL — `Cannot find module '../../src/utils/has-binary'`.

- [ ] **Step 3: Write the implementation**

Create `server/src/utils/has-binary.ts`:

```ts
export function hasBinary(name: string): boolean {
  return Bun.which(name) !== null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/utils/has-binary.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add server/src/utils/has-binary.ts server/test/utils/has-binary.test.ts
git commit -m "$(cat <<'EOF'
feat(utils): add hasBinary helper for skipIf guards

Wraps Bun.which so integration tests can skip cleanly when system
binaries (espeak-ng, sox) are missing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: WAV duration helper

**Files:**
- Create: `server/src/tts/local/wav-utils.ts`
- Test: `server/test/tts/local/wav-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tts/local/wav-utils.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasBinary } from "../../../src/utils/has-binary";
import { getDurationSec } from "../../../src/tts/local/wav-utils";

const canRun = hasBinary("sox");

test.skipIf(!canRun)("getDurationSec reads duration of synthesized tone", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wav-utils-"));
  const fix = join(dir, "fix.wav");
  const proc = Bun.spawn(
    ["sox", "-n", "-r", "22050", "-c", "1", fix, "synth", "0.5", "sine", "440"],
    { stdout: "pipe", stderr: "pipe" },
  );
  await proc.exited;
  const d = await getDurationSec(fix);
  expect(d).toBeGreaterThan(0.4);
  expect(d).toBeLessThan(0.6);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/tts/local/wav-utils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `server/src/tts/local/wav-utils.ts`:

```ts
export async function getDurationSec(path: string): Promise<number> {
  const proc = Bun.spawn(["sox", "--i", "-D", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`sox --i exited ${code}: ${err}`);
  }
  return Number.parseFloat(out.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/tts/local/wav-utils.test.ts`
Expected: PASS (or SKIP if sox missing).

- [ ] **Step 5: Commit**

```bash
git add server/src/tts/local/wav-utils.ts server/test/tts/local/wav-utils.test.ts
git commit -m "$(cat <<'EOF'
feat(tts/local): add getDurationSec via sox --i -D

Shared WAV duration probe used by both the espeak synth adapter
and the FX chain.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Emotion-map parser

**Files:**
- Create: `server/src/tts/local/emotion-map.ts`
- Test: `server/test/tts/local/emotion-map.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tts/local/emotion-map.test.ts`:

```ts
import { expect, test } from "bun:test";
import { parseScript } from "../../../src/tts/local/emotion-map";

const SCRIPT = `[excited] Oh wow, a dragon! [gasps] Quick, hide behind the castle!
[whispering] Shh, I think it's coming closer.
[pirate voice] Arr, but Captain Alex isn't scared of any dragon!
[giggles] [normal] Just kidding.
[gentle] Hey, it's okay to be a little scared sometimes. I get scared too.
[curious] What do you think we should do?
[happy] That's such a good idea! Let's try it!`;

test("parseScript produces one segment per non-empty tag region", () => {
  const segs = parseScript(SCRIPT);
  expect(segs.map((s) => s.source)).toEqual([
    "excited",
    "gasps",
    "whispering",
    "pirate voice",
    "normal",
    "gentle",
    "curious",
    "happy",
  ]);
});

test("parseScript applies [excited] speed/pitch/amplitude overrides", () => {
  const segs = parseScript(SCRIPT);
  const excited = segs.find((s) => s.source === "excited");
  expect(excited).toBeDefined();
  expect(excited?.params.speed).toBe(228);
  expect(excited?.params.pitch).toBe(65);
  expect(excited?.params.amplitude).toBe(110);
});

test("parseScript maps [whispering] to voiceVariant and low amp", () => {
  const segs = parseScript(SCRIPT);
  const w = segs.find((s) => s.source === "whispering");
  expect(w?.params.voiceVariant).toBe("+whisper");
  expect(w?.params.amplitude).toBe(40);
});

test("parseScript treats [gasps] as default params (non-verbal dropped)", () => {
  const segs = parseScript(SCRIPT);
  const gasps = segs.find((s) => s.source === "gasps");
  expect(gasps?.params.speed).toBe(175);
  expect(gasps?.params.pitch).toBe(50);
  expect(gasps?.params.amplitude).toBe(100);
});

test("parseScript strips unknown tags and defaults their text", () => {
  const segs = parseScript("[mystery] hello [normal] world");
  expect(segs.map((s) => s.text)).toEqual(["hello", "world"]);
  expect(segs[0].params.pitch).toBe(50);
});

test("parseScript drops [giggles][normal] empty-text region for giggles", () => {
  const segs = parseScript("[giggles] [normal] Just kidding.");
  expect(segs.map((s) => s.source)).toEqual(["normal"]);
  expect(segs[0].text).toBe("Just kidding.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/tts/local/emotion-map.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `server/src/tts/local/emotion-map.ts`:

```ts
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

  const preface = script.slice(0, matches[0].index).trim();
  if (preface) segments.push({ text: preface, params: { ...DEFAULTS } });

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const tag = m[1].toLowerCase().trim();
    const tagEnd = (m.index ?? 0) + m[0].length;
    const nextStart = i + 1 < matches.length ? matches[i + 1].index ?? script.length : script.length;
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
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/tts/local/emotion-map.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add server/src/tts/local/emotion-map.ts server/test/tts/local/emotion-map.test.ts
git commit -m "$(cat <<'EOF'
feat(tts/local): add emotion-map parser for bracket-tag scripts

Parses [excited]/[whispering]/[pirate voice]/[gentle]/[curious]/[happy]
into EspeakSegment[] with per-segment param overrides. [gasps] and
[giggles] are dropped with a log; unknown tags are stripped. Preserves
emotion-tag parity with the ElevenLabs SAMPLE_SCRIPT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: eSpeak-NG adapter

**Files:**
- Create: `server/src/tts/local/espeak.ts`
- Test: `server/test/tts/local/espeak.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tts/local/espeak.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasBinary } from "../../../src/utils/has-binary";
import { synth } from "../../../src/tts/local/espeak";

const canRun = hasBinary("espeak-ng") && hasBinary("sox");

test.skipIf(!canRun)("synth renders non-empty WAV for single segment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "espeak-"));
  const out = join(dir, "out.wav");
  const result = await synth({
    voice: "en+f3",
    segments: [{ text: "hello there", params: {}, source: "test" }],
    outPath: out,
  });
  expect(result.outPath).toBe(out);
  expect(result.bytes).toBeGreaterThan(0);
  expect(result.durationSec).toBeGreaterThan(0);
  expect(result.segmentTimingsMs).toHaveLength(1);
  expect(result.segmentTimingsMs[0]).toBeGreaterThan(0);
  expect(result.concatMs).toBeGreaterThanOrEqual(0);
  expect(result.totalMs).toBeGreaterThan(0);
});

test.skipIf(!canRun)("synth concatenates multiple segments in order", async () => {
  const dir = await mkdtemp(join(tmpdir(), "espeak-"));
  const out = join(dir, "out.wav");
  const result = await synth({
    voice: "en+f3",
    segments: [
      { text: "one", params: {}, source: "a" },
      { text: "two", params: {}, source: "b" },
      { text: "three", params: {}, source: "c" },
    ],
    outPath: out,
  });
  expect(result.segmentTimingsMs).toHaveLength(3);
  expect(result.durationSec).toBeGreaterThan(0.3);
});

test.skipIf(!canRun)("synth swaps variant when voiceVariant is set", async () => {
  const dir = await mkdtemp(join(tmpdir(), "espeak-"));
  const out = join(dir, "out.wav");
  const result = await synth({
    voice: "en+f3",
    segments: [{ text: "whisper test", params: { voiceVariant: "+whisper" } }],
    outPath: out,
  });
  expect(result.bytes).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/tts/local/espeak.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `server/src/tts/local/espeak.ts`:

```ts
import { mkdtemp, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EspeakSegment } from "./emotion-map";
import { getDurationSec } from "./wav-utils";

export interface SynthOptions {
  voice: string;
  segments: EspeakSegment[];
  outPath: string;
  sampleRate?: number;
}

export interface SynthResult {
  outPath: string;
  segmentTimingsMs: number[];
  concatMs: number;
  totalMs: number;
  durationSec: number;
  bytes: number;
}

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stderr, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${cmd[0]} exited ${code}: ${stderr}`);
  }
}

function resolveVoice(base: string, variant: string | undefined): string {
  if (!variant) return base;
  const root = base.replace(/\+.*$/, "");
  return root + variant;
}

export async function synth(opts: SynthOptions): Promise<SynthResult> {
  const sampleRate = opts.sampleRate ?? 22050;
  const tmp = await mkdtemp(join(tmpdir(), "nessie-espeak-"));
  const segTmp: string[] = [];
  const segmentTimingsMs: number[] = [];

  try {
    for (let i = 0; i < opts.segments.length; i++) {
      const seg = opts.segments[i];
      const tmpPath = join(tmp, `seg-${String(i).padStart(3, "0")}.wav`);
      segTmp.push(tmpPath);

      const voice = resolveVoice(opts.voice, seg.params.voiceVariant);
      const args = ["espeak-ng", "-v", voice];
      if (seg.params.speed != null) args.push("-s", String(seg.params.speed));
      if (seg.params.pitch != null) args.push("-p", String(seg.params.pitch));
      if (seg.params.amplitude != null) args.push("-a", String(seg.params.amplitude));
      if (seg.params.wordGap != null) args.push("-g", String(seg.params.wordGap));
      args.push("-w", tmpPath, seg.text);

      const t0 = performance.now();
      await run(args);
      segmentTimingsMs.push(performance.now() - t0);
    }

    const t1 = performance.now();
    await run(["sox", ...segTmp, opts.outPath, "rate", String(sampleRate)]);
    const concatMs = performance.now() - t1;

    const durationSec = await getDurationSec(opts.outPath);
    const { size: bytes } = await stat(opts.outPath);
    const totalMs = segmentTimingsMs.reduce((a, b) => a + b, 0) + concatMs;

    return { outPath: opts.outPath, segmentTimingsMs, concatMs, totalMs, durationSec, bytes };
  } finally {
    await Promise.all(segTmp.map((p) => unlink(p).catch(() => {})));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/tts/local/espeak.test.ts`
Expected: PASS, 3/3 (or SKIP on environments without the binaries).

- [ ] **Step 5: Commit**

```bash
git add server/src/tts/local/espeak.ts server/test/tts/local/espeak.test.ts
git commit -m "$(cat <<'EOF'
feat(tts/local): add eSpeak-NG adapter with per-segment param overrides

synth() renders each EspeakSegment via espeak-ng -w, concatenates with
sox, and returns timing + duration + byte size metrics. Per-segment
voiceVariant overrides the base voice suffix (e.g. en+f3 → en+whisper
inside a [whispering] segment).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FX chain

**Files:**
- Create: `server/src/tts/local/fx.ts`
- Test: `server/test/tts/local/fx.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tts/local/fx.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasBinary } from "../../../src/utils/has-binary";
import { applyFx, type FxPreset } from "../../../src/tts/local/fx";

const canRun = hasBinary("sox");

async function makeFixture(dir: string): Promise<string> {
  const path = join(dir, "fix.wav");
  const proc = Bun.spawn(
    ["sox", "-n", "-r", "22050", "-c", "1", path, "synth", "0.5", "sine", "440"],
    { stdout: "pipe", stderr: "pipe" },
  );
  await proc.exited;
  return path;
}

const PRESETS: FxPreset[] = ["dry", "fairy", "magical", "sprite"];

for (const preset of PRESETS) {
  test.skipIf(!canRun)(`applyFx(${preset}) produces valid non-empty WAV`, async () => {
    const dir = await mkdtemp(join(tmpdir(), "fx-"));
    const fix = await makeFixture(dir);
    const out = join(dir, `out-${preset}.wav`);
    const r = await applyFx(fix, out, preset);
    expect(r.outPath).toBe(out);
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.durationSec).toBeGreaterThan(0);
    expect(r.elapsedMs).toBeGreaterThan(0);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/tts/local/fx.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `server/src/tts/local/fx.ts`:

```ts
import { copyFile, stat } from "node:fs/promises";
import { getDurationSec } from "./wav-utils";

export type FxPreset = "dry" | "fairy" | "magical" | "sprite";

export interface FxResult {
  outPath: string;
  elapsedMs: number;
  durationSec: number;
  bytes: number;
}

const CHAIN: Record<FxPreset, string[]> = {
  dry: [],
  fairy: [
    "pitch", "+300",
    "chorus", "0.7", "0.9", "40", "0.4", "0.25", "2", "-t",
    "equalizer", "6000", "1q", "+3",
  ],
  magical: [
    "chorus", "0.6", "0.9", "50", "0.4", "0.25", "2", "-t",
              "60", "0.32", "0.4", "1.3", "-s",
    "tremolo", "4", "20",
  ],
  sprite: [
    "pitch", "+500",
    "tremolo", "8", "25",
    "equalizer", "7000", "1.2q", "+4",
  ],
};

export async function applyFx(
  inPath: string,
  outPath: string,
  preset: FxPreset,
): Promise<FxResult> {
  const t0 = performance.now();
  if (preset === "dry") {
    await copyFile(inPath, outPath);
  } else {
    const proc = Bun.spawn(["sox", inPath, outPath, ...CHAIN[preset]], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stderr, code] = await Promise.all([
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      throw new Error(`sox ${preset} exited ${code}: ${stderr}`);
    }
  }
  const elapsedMs = performance.now() - t0;
  const durationSec = await getDurationSec(outPath);
  const { size: bytes } = await stat(outPath);
  return { outPath, elapsedMs, durationSec, bytes };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/tts/local/fx.test.ts`
Expected: PASS, 4/4 (or SKIP).

- [ ] **Step 5: Commit**

```bash
git add server/src/tts/local/fx.ts server/test/tts/local/fx.test.ts
git commit -m "$(cat <<'EOF'
feat(tts/local): add reverb-free FX chain (dry/fairy/magical/sprite)

Each preset runs a fixed sox chain and returns elapsed ms + duration +
size. dry copies the file unchanged. All presets skew feminine/sparkle
and deliberately avoid reverb.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Benchmark harness

**Files:**
- Create: `server/src/tts/local/bench.ts`
- Test: `server/test/tts/local/bench.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tts/local/bench.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aggregate,
  writeReport,
  type BenchReport,
  type RunMetrics,
} from "../../../src/tts/local/bench";

test("aggregate computes mean/min/max across runs", () => {
  const runs: RunMetrics[] = [
    { synthMs: 100, fxMs: 50, totalMs: 150, durationSec: 2, bytes: 10_000, rtf: 0.075 },
    { synthMs: 200, fxMs: 60, totalMs: 260, durationSec: 2, bytes: 10_000, rtf: 0.13 },
    { synthMs: 300, fxMs: 70, totalMs: 370, durationSec: 2, bytes: 10_000, rtf: 0.185 },
  ];
  const { mean, min, max } = aggregate(runs);
  expect(mean.totalMs).toBe(260);
  expect(min.totalMs).toBe(150);
  expect(max.totalMs).toBe(370);
  expect(mean.synthMs).toBe(200);
  expect(mean.rtf).toBeCloseTo(0.13, 3);
});

test("writeReport writes parseable JSON with documented shape", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bench-"));
  const report: BenchReport = {
    generatedAt: "2026-04-19T00:00:00.000Z",
    runsPerCombination: 3,
    script: { length: 100, segmentCount: 8 },
    engine: "espeak-ng",
    host: { platform: "darwin", arch: "arm64" },
    combinations: [],
  };
  await writeReport(dir, report);
  const parsed = JSON.parse(await Bun.file(join(dir, "bench.json")).text());
  expect(parsed.engine).toBe("espeak-ng");
  expect(parsed.runsPerCombination).toBe(3);
  expect(parsed.host.platform).toBe("darwin");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/tts/local/bench.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `server/src/tts/local/bench.ts`:

```ts
import { mkdtemp, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EspeakSegment } from "./emotion-map";
import { synth } from "./espeak";
import { applyFx, type FxPreset } from "./fx";

export interface RunMetrics {
  synthMs: number;
  fxMs: number;
  totalMs: number;
  durationSec: number;
  bytes: number;
  rtf: number;
}

export interface CombinationStats {
  voice: string;
  preset: FxPreset;
  runs: RunMetrics[];
  mean: RunMetrics;
  min: RunMetrics;
  max: RunMetrics;
}

export interface BenchReport {
  generatedAt: string;
  runsPerCombination: number;
  script: { length: number; segmentCount: number };
  engine: "espeak-ng";
  host: { platform: string; arch: string };
  combinations: CombinationStats[];
}

const KEYS: (keyof RunMetrics)[] = [
  "synthMs",
  "fxMs",
  "totalMs",
  "durationSec",
  "bytes",
  "rtf",
];

export function aggregate(runs: RunMetrics[]): {
  mean: RunMetrics;
  min: RunMetrics;
  max: RunMetrics;
} {
  const reduce = (op: (vals: number[]) => number): RunMetrics => {
    const out = {} as RunMetrics;
    for (const k of KEYS) out[k] = op(runs.map((r) => r[k]));
    return out;
  };
  return {
    mean: reduce((v) => v.reduce((a, b) => a + b, 0) / v.length),
    min: reduce((v) => Math.min(...v)),
    max: reduce((v) => Math.max(...v)),
  };
}

export async function runCombination(opts: {
  voice: string;
  preset: FxPreset;
  segments: EspeakSegment[];
  outPath: string;
  runs: number;
}): Promise<CombinationStats> {
  const tmp = await mkdtemp(join(tmpdir(), "nessie-bench-"));
  const runs: RunMetrics[] = [];

  for (let i = 0; i < opts.runs; i++) {
    const isFinal = i === opts.runs - 1;
    const drySrc = join(tmp, `dry-${i}.wav`);
    const fxOut = isFinal ? opts.outPath : join(tmp, `fx-${i}.wav`);

    const s = await synth({ voice: opts.voice, segments: opts.segments, outPath: drySrc });
    const fx = await applyFx(drySrc, fxOut, opts.preset);

    const totalMs = s.totalMs + fx.elapsedMs;
    runs.push({
      synthMs: s.totalMs,
      fxMs: fx.elapsedMs,
      totalMs,
      durationSec: fx.durationSec,
      bytes: fx.bytes,
      rtf: totalMs / 1000 / fx.durationSec,
    });

    await unlink(drySrc).catch(() => {});
    if (!isFinal) await unlink(fxOut).catch(() => {});
  }

  const { mean, min, max } = aggregate(runs);
  return { voice: opts.voice, preset: opts.preset, runs, mean, min, max };
}

export async function writeReport(outDir: string, report: BenchReport): Promise<void> {
  await writeFile(join(outDir, "bench.json"), JSON.stringify(report, null, 2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/tts/local/bench.test.ts`
Expected: PASS, 2/2.

- [ ] **Step 5: Commit**

```bash
git add server/src/tts/local/bench.ts server/test/tts/local/bench.test.ts
git commit -m "$(cat <<'EOF'
feat(tts/local): add benchmark harness (N-run aggregation + writeReport)

runCombination wraps synth + applyFx, times each run, and aggregates
mean/min/max across N runs. writeReport serializes to bench.json.
Metrics: synthMs, fxMs, totalMs, durationSec, bytes, rtf.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: HTML index renderer

**Files:**
- Create: `server/src/tts/local/html-index.ts`
- Test: `server/test/tts/local/html-index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/test/tts/local/html-index.test.ts`:

```ts
import { expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BenchReport, RunMetrics } from "../../../src/tts/local/bench";
import { renderIndex } from "../../../src/tts/local/html-index";

const RM: RunMetrics = {
  synthMs: 100,
  fxMs: 50,
  totalMs: 150,
  durationSec: 2,
  bytes: 10_000,
  rtf: 0.075,
};

test("renderIndex writes HTML with one <audio> per combination", async () => {
  const dir = await mkdtemp(join(tmpdir(), "idx-"));
  const report: BenchReport = {
    generatedAt: "2026-04-19T00:00:00.000Z",
    runsPerCombination: 3,
    script: { length: 100, segmentCount: 8 },
    engine: "espeak-ng",
    host: { platform: "darwin", arch: "arm64" },
    combinations: [
      { voice: "en+f3", preset: "dry", runs: [RM], mean: RM, min: RM, max: RM },
      { voice: "en+f3", preset: "fairy", runs: [RM], mean: RM, min: RM, max: RM },
    ],
  };
  await writeFile(join(dir, "bench.json"), JSON.stringify(report));
  await renderIndex(dir);

  const html = await Bun.file(join(dir, "index.html")).text();
  expect(html).toContain("en%2Bf3_dry.wav");
  expect(html).toContain("en%2Bf3_fairy.wav");
  expect(html).toContain("<audio");
  expect(html).toContain("rtf");
  expect(html).toContain("total");
  expect(html).toContain("espeak-ng");
  expect(html).toContain("darwin");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `server/`: `bun test test/tts/local/html-index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `server/src/tts/local/html-index.ts`:

```ts
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BenchReport, CombinationStats } from "./bench";
import type { FxPreset } from "./fx";

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function encodeSrc(voice: string, preset: FxPreset): string {
  return `${encodeURIComponent(voice)}_${preset}.wav`;
}

export async function renderIndex(outDir: string): Promise<void> {
  const raw = await Bun.file(join(outDir, "bench.json")).text();
  const report: BenchReport = JSON.parse(raw);

  const voices = uniq(report.combinations.map((c) => c.voice));
  const presets = uniq(report.combinations.map((c) => c.preset));

  const byKey = new Map<string, CombinationStats>();
  for (const c of report.combinations) byKey.set(`${c.voice}|${c.preset}`, c);

  const head = `<tr><th>voice</th>${presets.map((p) => `<th>${p}</th>`).join("")}</tr>`;
  const rows = voices
    .map((v) => {
      const cells = presets
        .map((p) => {
          const c = byKey.get(`${v}|${p}`);
          if (!c) return "<td><em>missing</em></td>";
          const src = encodeSrc(v, p);
          return `<td>
  <audio controls preload="metadata" src="${src}"></audio><br/>
  <small>total ${c.mean.totalMs.toFixed(0)}ms · rtf ${c.mean.rtf.toFixed(3)}</small>
</td>`;
        })
        .join("");
      return `<tr><th>${v}</th>${cells}</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>eSpeak-NG Demo</title>
<style>
  body{font-family:system-ui;margin:2rem;color:#222}
  table{border-collapse:collapse}
  th,td{border:1px solid #ccc;padding:0.5rem;vertical-align:top}
  th{background:#f4f4f4}
  small{color:#666}
  audio{width:240px}
</style></head>
<body>
<h1>eSpeak-NG Low-Fidelity Voice Demo</h1>
<p><strong>Engine:</strong> ${report.engine} · <strong>Host:</strong> ${report.host.platform}/${report.host.arch} · <strong>Generated:</strong> ${report.generatedAt}</p>
<p><strong>Runs per combination:</strong> ${report.runsPerCombination} · <strong>Script:</strong> ${report.script.length} chars, ${report.script.segmentCount} segments</p>
<p><em>Note: [gasps] and [giggles] non-verbal tokens are dropped; text around them renders with default params.</em></p>
<table>
<thead>${head}</thead>
<tbody>
${rows}
</tbody>
</table>
</body></html>`;

  await writeFile(join(outDir, "index.html"), html);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `server/`: `bun test test/tts/local/html-index.test.ts`
Expected: PASS, 1/1.

- [ ] **Step 5: Commit**

```bash
git add server/src/tts/local/html-index.ts server/test/tts/local/html-index.test.ts
git commit -m "$(cat <<'EOF'
feat(tts/local): render voice × preset index.html with embedded bench figures

Reads bench.json, renders a voice × preset table with one <audio>
element per cell and mean-totalMs / mean-rtf figures pulled from the
benchmark report.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: CLI orchestrator

**Files:**
- Create: `server/src/cli/local-voice-sampler.ts`
- Modify: `server/package.json` (add `tts:demo:local` script)
- Modify: `server/.gitignore` (ignore `local-voice-samples/`)

- [ ] **Step 1: Read existing package.json scripts block**

Run: `cat server/package.json | head -40`

Note the existing `"scripts"` block so the addition slots in with matching indentation/comma placement.

- [ ] **Step 2: Create the CLI file**

Create `server/src/cli/local-voice-sampler.ts`:

```ts
#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { runCombination, writeReport, type BenchReport, type CombinationStats } from "../tts/local/bench";
import { parseScript } from "../tts/local/emotion-map";
import type { FxPreset } from "../tts/local/fx";
import { renderIndex } from "../tts/local/html-index";
import { hasBinary } from "../utils/has-binary";

const SAMPLE_SCRIPT = `[excited] Oh wow, a dragon! [gasps] Quick, hide behind the castle!
[whispering] Shh, I think it's coming closer.
[pirate voice] Arr, but Captain Alex isn't scared of any dragon!
[giggles] [normal] Just kidding.
[gentle] Hey, it's okay to be a little scared sometimes. I get scared too.
[curious] What do you think we should do?
[happy] That's such a good idea! Let's try it!`;

const VOICES = ["en+f2", "en+f3", "en+f4", "en+f5", "en-us+f3", "en-us+f5"];
const PRESETS: FxPreset[] = ["dry", "fairy", "magical", "sprite"];
const RUNS = 3;
const OUT_DIR = join(import.meta.dir, "../../local-voice-samples/espeak-ng");

if (!hasBinary("espeak-ng") || !hasBinary("sox")) {
  console.error("Missing espeak-ng or sox. Install: brew install espeak-ng sox");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const segments = parseScript(SAMPLE_SCRIPT);
console.log(`Parsed ${segments.length} segments from script (${SAMPLE_SCRIPT.length} chars)`);

const combinations: CombinationStats[] = [];
for (const voice of VOICES) {
  for (const preset of PRESETS) {
    const outPath = join(OUT_DIR, `${voice}_${preset}.wav`);
    process.stdout.write(`${voice} × ${preset} ... `);
    const stats = await runCombination({ voice, preset, segments, outPath, runs: RUNS });
    combinations.push(stats);
    console.log(`mean ${stats.mean.totalMs.toFixed(0)}ms · rtf ${stats.mean.rtf.toFixed(3)}`);
  }
}

const report: BenchReport = {
  generatedAt: new Date().toISOString(),
  runsPerCombination: RUNS,
  script: { length: SAMPLE_SCRIPT.length, segmentCount: segments.length },
  engine: "espeak-ng",
  host: { platform: process.platform, arch: process.arch },
  combinations,
};

await writeReport(OUT_DIR, report);
await renderIndex(OUT_DIR);

const sorted = [...combinations].sort((a, b) => a.mean.totalMs - b.mean.totalMs);
const fastest = sorted[0];
const slowest = sorted[sorted.length - 1];
console.log(`\nDone. ${combinations.length} WAVs written to ${OUT_DIR}`);
console.log(`Fastest: ${fastest.voice} × ${fastest.preset} (${fastest.mean.totalMs.toFixed(0)}ms)`);
console.log(`Slowest: ${slowest.voice} × ${slowest.preset} (${slowest.mean.totalMs.toFixed(0)}ms)`);
console.log(`Preview: open ${join(OUT_DIR, "index.html")}`);
```

- [ ] **Step 3: Add the npm script**

Edit `server/package.json`. Inside the `"scripts"` object, add:

```json
"tts:demo:local": "bun run src/cli/local-voice-sampler.ts"
```

Keep alphabetical ordering if the existing block uses it; otherwise slot near other `tts:` scripts.

- [ ] **Step 4: Add `.gitignore` entry**

Append to `server/.gitignore` (create if missing):

```
local-voice-samples/
```

- [ ] **Step 5: Typecheck**

Run from `server/`: `bunx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 6: Lint**

Run from `server/`: `bun run lint`
Expected: exit 0, no errors.

- [ ] **Step 7: Run the full test suite**

Run from `server/`: `bun test`
Expected: all tests pass (or skip where binaries missing). No regressions.

- [ ] **Step 8: Commit**

```bash
git add server/src/cli/local-voice-sampler.ts server/package.json server/.gitignore
git commit -m "$(cat <<'EOF'
feat(cli): add local-voice-sampler for eSpeak-NG demo + benchmark

Orchestrates 6 voices × 4 FX presets × 3 runs against SAMPLE_SCRIPT,
writes 24 WAVs + bench.json + index.html to server/local-voice-samples/
espeak-ng/. Adds `tts:demo:local` npm script and gitignores the output
directory.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: End-to-end verification

**Files:** none modified — verification only.

- [ ] **Step 1: Verify system binaries**

Run: `which espeak-ng && which sox`
Expected: both paths print. If missing: `brew install espeak-ng sox`.

- [ ] **Step 2: Run the demo CLI**

Run from `server/`: `bun run tts:demo:local`
Expected: parses 8 segments, prints one line per voice×preset combination, prints fastest/slowest summary, prints the `open …/index.html` hint. Exit code 0.

- [ ] **Step 3: Verify output files**

Run: `ls server/local-voice-samples/espeak-ng/ | sort`
Expected: 24 `.wav` files (`en+f2_dry.wav` … `en-us+f5_sprite.wav`), plus `bench.json` and `index.html`.

- [ ] **Step 4: Sanity-check bench.json**

Run: `jq '.engine, .runsPerCombination, (.combinations | length)' server/local-voice-samples/espeak-ng/bench.json`
Expected: `"espeak-ng"`, `3`, `24`.

- [ ] **Step 5: Open the index in a browser**

Run: `open server/local-voice-samples/espeak-ng/index.html`
Expected: table renders with 6 rows × 4 columns, each cell plays audio, each cell shows mean total and rtf.

- [ ] **Step 6: Final commit if any follow-up tweaks**

If nothing needed, skip. If sox preset tuning was required, commit with:

```bash
git add -p server/src/tts/local/fx.ts
git commit -m "$(cat <<'EOF'
tune(tts/local): adjust sox FX parameters after listening pass

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

- Spec coverage: all spec sections (Purpose, Scope, Architecture, Components emotion-map / espeak / fx / bench / html-index / CLI, Configuration, Output, Data flow, Error handling, Testing, Dependencies, Invocation, Success criteria) have corresponding tasks.
- Spec deviation: `pitchRange` dropped from `EspeakParams` and TAG_MAP (eSpeak-NG CLI does not expose pitch-range without SSML). Documented at top of plan and in TAG_MAP mapping. Follow-up work can re-add via SSML.
- Placeholder scan: no TBDs, all code blocks are complete, all commands and expected outputs are concrete.
- Type consistency: `EspeakSegment`, `EspeakParams`, `SynthOptions`, `SynthResult`, `FxPreset`, `FxResult`, `RunMetrics`, `CombinationStats`, `BenchReport` are defined once in their respective modules and imported elsewhere by those exact names.
- Error handling: CLI fails fast on missing binaries (Task 8 step). `synth` and `applyFx` throw on non-zero exit; the CLI does not catch, so the run exits non-zero per spec.
