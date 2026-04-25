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

const KEYS: (keyof RunMetrics)[] = ["synthMs", "fxMs", "totalMs", "durationSec", "bytes", "rtf"];

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
