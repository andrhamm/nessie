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
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
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
      if (!seg) continue;
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
