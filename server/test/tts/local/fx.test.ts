import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFx, type FxPreset } from "../../../src/tts/local/fx";
import { hasBinary } from "../../../src/utils/has-binary";

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
