import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildParentTools } from "../../src/agent/parent-tools";
import { AuditLog } from "../../src/store/audit";
import { MdStore } from "../../src/store/store";

// biome-ignore lint/suspicious/noExplicitAny: ai-sdk tool handle is narrow
type T = { execute: (args: any) => Promise<any> };

let store: MdStore;
let audit: AuditLog;
let dataDir: string;
let tools: Record<string, T>;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-ness-tools-test-"));
  store = await MdStore.create({ dataDir });
  audit = new AuditLog({ dir: join(dataDir, "audit") });
  tools = buildParentTools({ store, audit, sessionId: "parent" }) as Record<string, T>;
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("parent-tools — instructions", () => {
  it("get/set routine round-trip", async () => {
    await tools.set_routine?.execute({ body: "Up at 7. Dinner at 6." });
    const got = await tools.get_routine?.execute({});
    expect(got.body).toContain("Dinner at 6");
  });

  it("add_constraint appends a bullet", async () => {
    await tools.add_constraint?.execute({ line: "No scary stories" });
    await tools.add_constraint?.execute({ line: "Bath before bed" });
    const got = (await tools.get_constraints?.execute({})) ?? { body: "" };
    const { body } = got;
    expect(body).toContain("- No scary stories");
    expect(body).toContain("- Bath before bed");
  });

  it("remove_constraint drops the matching bullet", async () => {
    await tools.remove_constraint?.execute({ match: "scary" });
    const got = (await tools.get_constraints?.execute({})) ?? { body: "" };
    const { body } = got;
    expect(body).not.toContain("No scary stories");
    expect(body).toContain("Bath before bed");
  });
});

describe("parent-tools — persons + events", () => {
  it("upsert_person + list_persons + who_is", async () => {
    await tools.upsert_person?.execute({
      slug: "grandma-dana",
      name: "Dana",
      relation: "grandparent",
      aliases: ["Nana"],
      notes: "Lives in Seattle.",
    });
    const listed = await tools.list_persons?.execute({ relation: "grandparent" });
    expect(listed.persons.map((p: { slug: string }) => p.slug)).toContain("grandma-dana");
    const found = await tools.who_is?.execute({ name_or_alias: "Nana" });
    expect(found.slugs).toContain("grandma-dana");
  });

  it("upsert_event + list_events by date range", async () => {
    await tools.upsert_event?.execute({
      id: "soccer",
      date: "2026-06-15",
      title: "Soccer practice",
      status: "scheduled",
      body: "Meet at the field",
    });
    const rows = await tools.list_events?.execute({ from: "2026-06-01", to: "2026-06-30" });
    expect(rows.events).toHaveLength(1);
    expect(rows.events[0].title).toBe("Soccer practice");
  });

  it("delete_person removes the record", async () => {
    await tools.upsert_person?.execute({ slug: "temp", name: "Temp" });
    await tools.delete_person?.execute({ slug: "temp" });
    const listed = await tools.list_persons?.execute({});
    expect(listed.persons.map((p: { slug: string }) => p.slug)).not.toContain("temp");
  });
});

describe("parent-tools — audit query", () => {
  it("returns audit records for the day range", async () => {
    await audit.flush();
    const today = new Date().toISOString().slice(0, 10);
    const out = await tools.query_audit?.execute({ from: today, to: today });
    const toolsHit = new Set(
      out.records
        .filter((r: { kind: string }) => r.kind === "tool_call")
        .map((r: { tool: string }) => r.tool),
    );
    expect(toolsHit.has("upsert_person")).toBe(true);
  });
});
