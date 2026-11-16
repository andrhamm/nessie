import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuditLog } from "../../src/store/audit";

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "nessie-audit-test-"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("AuditLog", () => {
  it("appends one JSON line per record under <day>.jsonl", async () => {
    const day = "2026-04-18";
    const log = new AuditLog({ dir, now: () => new Date(`${day}T12:00:00Z`) });

    await log.append({ agent: "nessie", kind: "turn", session_id: "s1" });
    await log.append({
      agent: "nessie",
      kind: "tool_call",
      tool: "who_is",
      input: { name: "Dana" },
    });
    await log.flush();

    const records = await log.read({ fromDay: day, toDay: day });
    expect(records).toHaveLength(2);
    expect(records[0]?.ts).toBe(new Date(`${day}T12:00:00Z`).toISOString());
    expect(records[1]?.tool).toBe("who_is");
  });

  it("concurrent appends do not interleave", async () => {
    const day = "2026-04-19";
    const log = new AuditLog({ dir, now: () => new Date(`${day}T01:00:00Z`) });

    const N = 50;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        log.append({
          agent: "ness",
          kind: "turn",
          session_id: "parent",
          extra: { i },
        }),
      ),
    );
    await log.flush();

    const records = await log.read({ fromDay: day, toDay: day });
    expect(records).toHaveLength(N);
  });

  it("filters by agent and kind", async () => {
    const day = "2026-04-20";
    const log = new AuditLog({ dir, now: () => new Date(`${day}T09:00:00Z`) });
    await log.append({ agent: "nessie", kind: "turn", session_id: "s1" });
    await log.append({ agent: "ness", kind: "turn", session_id: "parent" });
    await log.append({ agent: "nessie", kind: "tool_call", tool: "x" });
    await log.flush();

    const nessieTurns = await log.read({
      fromDay: day,
      toDay: day,
      filter: { agent: "nessie", kind: "turn" },
    });
    expect(nessieTurns).toHaveLength(1);
    expect(nessieTurns[0]?.session_id).toBe("s1");
  });

  it("reads across a multi-day range in order", async () => {
    const a = new AuditLog({ dir, now: () => new Date("2026-04-21T00:00:00Z") });
    await a.append({ agent: "nessie", kind: "turn", session_id: "sA" });
    await a.flush();
    const b = new AuditLog({ dir, now: () => new Date("2026-04-22T00:00:00Z") });
    await b.append({ agent: "nessie", kind: "turn", session_id: "sB" });
    await b.flush();

    const records = await a.read({ fromDay: "2026-04-21", toDay: "2026-04-22" });
    const sessions = records.map((r) => r.session_id);
    expect(sessions).toEqual(["sA", "sB"]);
  });
});
