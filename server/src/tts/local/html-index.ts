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
