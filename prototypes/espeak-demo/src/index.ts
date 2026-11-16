#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { type BenchReport, type CombinationStats, runCombination, writeReport } from "./bench";
import { parseScript } from "./emotion-map";
import type { FxPreset } from "./fx";
import { hasBinary } from "./has-binary";
import { renderIndex } from "./html-index";

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
const OUT_DIR = join(import.meta.dir, "../local-voice-samples/espeak-ng");

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
if (!fastest || !slowest) {
  console.log(`\nDone. ${combinations.length} WAVs written to ${OUT_DIR}`);
} else {
  console.log(`\nDone. ${combinations.length} WAVs written to ${OUT_DIR}`);
  console.log(
    `Fastest: ${fastest.voice} × ${fastest.preset} (${fastest.mean.totalMs.toFixed(0)}ms)`,
  );
  console.log(
    `Slowest: ${slowest.voice} × ${slowest.preset} (${slowest.mean.totalMs.toFixed(0)}ms)`,
  );
}
console.log(`Preview: open ${join(OUT_DIR, "index.html")}`);
