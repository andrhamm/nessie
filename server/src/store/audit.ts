import { appendFile, mkdir, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type AuditKind = "turn" | "tool_call" | "tool_result" | "screen" | "output_check" | "error";

export interface AuditRecord {
  ts?: string;
  agent: "nessie" | "ness";
  session_id?: string;
  device_id?: string;
  speaker?: string;
  kind: AuditKind;
  tool?: string;
  input?: unknown;
  output?: unknown;
  latency_ms?: number;
  usage?: Record<string, unknown>;
  /** Free-form extras — anything the caller wants to pin to this record. */
  extra?: Record<string, unknown>;
}

export interface AuditOptions {
  /** Directory to write `<YYYY-MM-DD>.jsonl` files into. */
  dir: string;
  /** Override clock for tests. */
  now?: () => Date;
}

function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Append-only JSONL audit log. One file per UTC day so readers can grep or
 * tail without bloating a single handle. Writes serialize through a promise
 * chain so overlapping calls never interleave bytes.
 */
export class AuditLog {
  private readonly dir: string;
  private readonly now: () => Date;
  private queue: Promise<void> = Promise.resolve();
  private ensuredDir = false;

  constructor(options: AuditOptions) {
    this.dir = resolve(options.dir);
    this.now = options.now ?? (() => new Date());
  }

  append(record: AuditRecord): Promise<void> {
    const now = this.now();
    const enriched: AuditRecord = { ts: now.toISOString(), ...record };
    const target = join(this.dir, `${ymd(now)}.jsonl`);
    const line = `${JSON.stringify(enriched)}\n`;
    // Chain writes so concurrent calls never interleave.
    this.queue = this.queue.then(async () => {
      if (!this.ensuredDir) {
        await mkdir(this.dir, { recursive: true });
        this.ensuredDir = true;
      }
      await appendFile(target, line, "utf8");
    });
    return this.queue;
  }

  /** Wait for all pending writes to flush. */
  async flush(): Promise<void> {
    await this.queue;
  }

  /**
   * Read records across one or more UTC days. `fromDay` and `toDay` are
   * inclusive `YYYY-MM-DD` strings. Optionally filter by kind or agent.
   */
  async read(opts: {
    fromDay: string;
    toDay: string;
    filter?: Partial<Pick<AuditRecord, "agent" | "kind" | "session_id" | "device_id">>;
  }): Promise<AuditRecord[]> {
    const entries: AuditRecord[] = [];
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch {
      return [];
    }
    const dayFiles = files
      .filter((n) => n.endsWith(".jsonl"))
      .map((n) => n.slice(0, -".jsonl".length))
      .filter((day) => day >= opts.fromDay && day <= opts.toDay)
      .sort();
    for (const day of dayFiles) {
      const content = await readFile(join(this.dir, `${day}.jsonl`), "utf8").catch(() => "");
      for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        let record: AuditRecord;
        try {
          record = JSON.parse(line) as AuditRecord;
        } catch {
          continue;
        }
        if (opts.filter) {
          const { agent, kind, session_id, device_id } = opts.filter;
          if (agent && record.agent !== agent) continue;
          if (kind && record.kind !== kind) continue;
          if (session_id && record.session_id !== session_id) continue;
          if (device_id && record.device_id !== device_id) continue;
        }
        entries.push(record);
      }
    }
    return entries;
  }
}
