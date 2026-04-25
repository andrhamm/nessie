import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { synth } from "../../../src/tts/local/espeak";
import { hasBinary } from "../../../src/utils/has-binary";

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
  const [first] = result.segmentTimingsMs;
  expect(first).toBeGreaterThan(0);
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
