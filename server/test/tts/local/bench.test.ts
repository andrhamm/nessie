import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  aggregate,
  type BenchReport,
  type RunMetrics,
  writeReport,
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
