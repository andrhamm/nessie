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
    "pitch",
    "+300",
    "chorus",
    "0.7",
    "0.9",
    "40",
    "0.4",
    "0.25",
    "2",
    "-t",
    "equalizer",
    "6000",
    "1q",
    "+3",
  ],
  magical: [
    "chorus",
    "0.6",
    "0.9",
    "50",
    "0.4",
    "0.25",
    "2",
    "-t",
    "60",
    "0.32",
    "0.4",
    "1.3",
    "-s",
    "tremolo",
    "4",
    "20",
  ],
  sprite: ["pitch", "+500", "tremolo", "8", "25", "equalizer", "7000", "1.2q", "+4"],
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
    const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
    if (code !== 0) {
      throw new Error(`sox ${preset} exited ${code}: ${stderr}`);
    }
  }
  const elapsedMs = performance.now() - t0;
  const durationSec = await getDurationSec(outPath);
  const { size: bytes } = await stat(outPath);
  return { outPath, elapsedMs, durationSec, bytes };
}
