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
