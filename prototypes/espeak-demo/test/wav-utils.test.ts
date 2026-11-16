import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hasBinary } from "../src/has-binary";
import { getDurationSec } from "../src/wav-utils";

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
