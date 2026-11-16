import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordId } from "surrealdb";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-lookup-test-"));
  store = await MdStore.create({ dataDir });

  await store.write(
    "person/quinn.md",
    { slug: "quinn", name: "Quinn", relation: "self" },
    "Alex-like speaker for this fixture.",
  );
  await store.write(
    "person/grandma-dana.md",
    {
      slug: "grandma-dana",
      name: "Dana",
      relation: "grandparent",
      aliases: ["Nana"],
    },
    "Bakes raviolis at Christmas.",
  );
  await store.write(
    "memory/mem-ravioli.md",
    {
      id: "mem-ravioli",
      subject: "persons/grandma-dana",
      tags: ["food"],
      created: "2026-04-10",
    },
    "Grandma Dana makes homemade raviolis every Christmas.",
  );
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("MdStore.lookupPersons", () => {
  it("returns full profiles + relations + recent memories for a batch of names", async () => {
    const results = await store.lookupPersons(["Dana", "Unknown"]);
    expect(results).toHaveLength(2);

    const dana = results.find((r) => r.query === "Dana");
    expect(dana?.matches).toHaveLength(1);
    expect(dana?.matches[0]?.slug).toBe("grandma-dana");
    expect(dana?.matches[0]?.notes).toContain("raviolis");
    expect(dana?.matches[0]?.memories[0]?.body).toContain("raviolis");

    const unknown = results.find((r) => r.query === "Unknown");
    expect(unknown?.matches).toEqual([]);
  });
});

describe("MdStore.recordMentions", () => {
  it("creates a tentative stub with context when the name is new", async () => {
    const out = await store.recordMentions(new RecordId("person", "quinn"), ["Tessa"], {
      session: "play_session",
      snippet: "Tessa said the slime was gross",
      mentioned_by_label: "Quinn",
    });
    expect(out.resolved).toHaveLength(1);
    expect(out.resolved[0]?.created).toBe(true);
    const slug = out.resolved[0]?.slug as string;
    expect(slug).toMatch(/^tessa/);

    const stub = await store.read("person", slug);
    expect(stub?.frontmatter.tentative).toBe(true);
    expect(stub?.body).toContain("Quinn");
    expect(stub?.body).toContain("play_session");
  });

  it("reuses the existing stub on a second mention of the same name", async () => {
    const first = await store.recordMentions(new RecordId("person", "quinn"), ["Tessa"], {
      session: "play_session",
    });
    const out = await store.recordMentions(new RecordId("person", "quinn"), ["Tessa"], {
      session: "play_session",
      snippet: "Tessa also likes dinosaurs",
    });
    expect(out.resolved[0]?.slug).toBe(first.resolved[0]?.slug);
    expect(out.resolved[0]?.created).toBe(false);
  });

  it("reports ambiguity without writing when multiple matches exist", async () => {
    await store.write(
      "person/tessa-cousin.md",
      { slug: "tessa-cousin", name: "Tessa", aliases: [] },
      "Cousin Tessa.",
    );
    const before = await store.whoIs("Tessa");
    const out = await store.recordMentions(new RecordId("person", "quinn"), ["Tessa"], {
      session: "play_session",
    });
    const after = await store.whoIs("Tessa");
    expect(after.sort()).toEqual(before.sort());
    expect(out.resolved).toHaveLength(0);
    expect(out.ambiguous).toHaveLength(1);
    expect(out.ambiguous[0]?.candidates.length).toBeGreaterThanOrEqual(2);
  });
});

describe("MdStore auto-seeds timezone", () => {
  it("runtime_config.timezone is populated on fresh store creation", async () => {
    const freshDir = await mkdtemp(join(tmpdir(), "nessie-tz-seed-"));
    const s = await MdStore.create({ dataDir: freshDir });
    const cfg = await s.getRuntimeConfig();
    expect(cfg.timezone).toBeDefined();
    expect(typeof cfg.timezone).toBe("string");
    await s.close();
    await rm(freshDir, { recursive: true, force: true });
  });
});
