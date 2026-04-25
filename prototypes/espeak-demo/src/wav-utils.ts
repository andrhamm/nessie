export async function getDurationSec(path: string): Promise<number> {
  const proc = Bun.spawn(["sox", "--i", "-D", path], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`sox --i exited ${code}: ${err}`);
  }
  return Number.parseFloat(out.trim());
}
