import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildEntityTools } from "../../src/agent/tools";
import { AuditLog } from "../../src/store/audit";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let audit: AuditLog;
let dataDir: string;

// biome-ignore lint/suspicious/noExplicitAny: ai-sdk tool handle is narrow, cast for exec
type ToolHandle = { execute: (args: any) => Promise<any> };

function toolsFor(): Record<string, ToolHandle> {
  return buildEntityTools({
    store,
    audit,
    deviceId: "test-device",
    speakerId: "SPEAKER_0",
    turnStart: performance.now(),
  }) as Record<string, ToolHandle>;
}

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-tools-test-"));
  store = await MdStore.create({ dataDir });
  audit = new AuditLog({ dir: join(dataDir, "audit") });

  // Seed one person so who_is has something to resolve.
  await store.write(
    "person/grandma-dana.md",
    { slug: "grandma-dana", name: "Dana", aliases: ["Nana"], relation: "grandparent" },
    "Grandma Dana bakes raviolis at Christmas.",
  );
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("buildEntityTools", () => {
  it("who_is resolves by alias", async () => {
    const result = await toolsFor().who_is?.execute({ name_or_alias: "Nana" });
    expect(result.slugs).toEqual(["grandma-dana"]);
  });

  it("upsert_person creates a stub from conversation", async () => {
    const out = await toolsFor().upsert_person?.execute({
      slug: "zoe-from-dance",
      name: "Zoe",
      relation: "classmate",
      note: "Alex's dance class friend",
    });
    expect(out.slug).toBe("zoe-from-dance");
    expect(out.created).toBe(true);
    const read = await store.read("person", "zoe-from-dance");
    expect(read?.frontmatter.name).toBe("Zoe");
  });

  it("add_memory writes a new memory doc", async () => {
    const out = await toolsFor().add_memory?.execute({
      subject: "speakers/SPEAKER_0",
      content: "Alex loves T-Rex.",
      tags: ["dinosaurs"],
    });
    expect(out.id).toMatch(/^mem-/);
    const memories = await store.list("memory");
    expect(memories.some((m) => m.slug === out.id)).toBe(true);
  });

  it("note_contact_event + recent_contacts surface the reconnect candidate", async () => {
    await toolsFor().upsert_person?.execute({ slug: "uncle-bob", name: "Bob" });
    await toolsFor().upsert_person?.execute({ slug: "SPEAKER_0", name: "Alex", relation: "self" });

    // 90 days ago
    const date = new Date();
    date.setDate(date.getDate() - 90);
    await toolsFor().note_contact_event?.execute({
      speaker: "SPEAKER_0",
      person_slug: "uncle-bob",
      type: "mentioned_only",
      date: date.toISOString(),
    });

    const result = await toolsFor().recent_contacts?.execute({
      speaker: "SPEAKER_0",
      older_than_days: 30,
    });
    const slugs = result.persons.map((p: { slug: string }) => p.slug);
    expect(slugs).toContain("uncle-bob");
  });

  it("search_knowledge returns hits across collections", async () => {
    await toolsFor().add_memory?.execute({
      subject: "speakers/SPEAKER_0",
      content: "Alex bakes cookies with Grandma Dana every Christmas.",
    });
    const out = await toolsFor().search_knowledge?.execute({
      query: "christmas baking with grandmother",
      collections: ["memory"],
      limit: 3,
    });
    expect(out.hits.length).toBeGreaterThan(0);
    expect(out.hits[0].kind).toBe("memory");
  });

  it("get_upcoming_events filters to the scheduled window", async () => {
    const soon = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    await store.write(
      `event/${soon}-soccer.md`,
      { id: "soccer", date: soon, title: "Soccer practice", status: "scheduled" },
      "First practice of spring.",
    );
    const out = await toolsFor().get_upcoming_events?.execute({ days_ahead: 7 });
    expect(out.events.length).toBeGreaterThan(0);
    expect(out.events[0].title).toBe("Soccer practice");
  });

  it("audits each tool call", async () => {
    await audit.flush();
    const today = new Date().toISOString().slice(0, 10);
    const records = await audit.read({ fromDay: today, toDay: today });
    const tools = new Set(records.filter((r) => r.kind === "tool_call").map((r) => r.tool));
    expect(tools.has("who_is")).toBe(true);
    expect(tools.has("upsert_person")).toBe(true);
  });

  it("get_weather_detail reports unavailable when no location configured", async () => {
    const result = await toolsFor().get_weather_detail?.execute({});
    expect(result.available).toBe(false);
  });
});
