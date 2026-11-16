import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordId } from "surrealdb";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-store-test-"));
  store = await MdStore.create({ dataDir });
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("MdStore — .md-on-disk round-trip", () => {
  it("write, read back via SurrealDB", async () => {
    await store.write(
      "person/grandma-dana.md",
      { slug: "grandma-dana", name: "Dana", relation: "grandparent", aliases: ["Nana"] },
      "Grandma Dana bakes every Christmas.",
    );
    const doc = await store.read("person", "grandma-dana");
    expect(doc?.slug).toBe("grandma-dana");
    expect(doc?.body).toContain("Christmas");
    expect(doc?.frontmatter.name).toBe("Dana");
  });

  it("list filters by frontmatter field", async () => {
    await store.write("person/mom.md", { slug: "mom", name: "Erin", relation: "parent" }, "Mom.");
    await store.write("person/zoe.md", { slug: "zoe", name: "Zoe", relation: "classmate" }, "Zoe.");
    const parents = await store.list("person", { frontmatter: { relation: "parent" } });
    expect(parents).toHaveLength(1);
    expect(parents[0]?.slug).toBe("mom");
  });

  it("delete removes both file and index row", async () => {
    await store.write("person/temp.md", { slug: "temp", name: "Temp" }, "body");
    await store.delete("person/temp.md");
    const gone = await store.read("person", "temp");
    expect(gone).toBeNull();
  });
});

describe("MdStore — whoIs", () => {
  it("resolves by exact name", async () => {
    const hits = await store.whoIs("Dana");
    expect(hits).toContain("grandma-dana");
  });

  it("resolves by unique alias", async () => {
    const hits = await store.whoIs("Nana");
    expect(hits).toEqual(["grandma-dana"]);
  });

  it("returns empty for unknown name", async () => {
    const hits = await store.whoIs("Nobody");
    expect(hits).toEqual([]);
  });
});

describe("MdStore — events range", () => {
  beforeAll(async () => {
    await store.write(
      "event/2026-03-29-easter.md",
      { id: "easter", date: "2026-03-29", title: "Easter", status: "past" },
      "brunch",
    );
    await store.write(
      "event/2026-05-10-soccer.md",
      { id: "soccer", date: "2026-05-10", title: "Soccer", status: "scheduled" },
      "practice",
    );
    await store.write(
      "event/2026-06-01-dentist.md",
      { id: "dentist", date: "2026-06-01", title: "Dentist", status: "scheduled" },
      "checkup",
    );
  });

  it("listEvents filters by date range", async () => {
    const rows = await store.listEvents({ from: "2026-04-01", to: "2026-05-31" });
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toEqual(["2026-05-10-soccer"]);
  });

  it("listEvents filters by status", async () => {
    const rows = await store.listEvents({ status: "scheduled" });
    expect(rows.map((r) => r.slug).sort()).toEqual(["2026-05-10-soccer", "2026-06-01-dentist"]);
  });
});

describe("MdStore — contact tracking", () => {
  beforeAll(async () => {
    for (const slug of ["alex", "uncle-bob", "aunt-erin"]) {
      await store.write(`person/${slug}.md`, { slug, name: slug, relation: "other" }, slug);
    }
    const alex = new RecordId("person", "alex");
    await store.noteContactEvent(alex, new RecordId("person", "uncle-bob"), daysAgo(90));
    await store.noteContactEvent(alex, new RecordId("person", "aunt-erin"), daysAgo(5));
  });

  it("recentContacts returns only persons past the threshold", async () => {
    const rows = await store.recentContacts(new RecordId("person", "alex"), 30);
    const slugs = rows.map((r) => r.slug);
    expect(slugs).toContain("uncle-bob");
    expect(slugs).not.toContain("aunt-erin");
  });

  it("noteContactEvent refreshes an existing edge", async () => {
    const alex = new RecordId("person", "alex");
    await store.noteContactEvent(alex, new RecordId("person", "uncle-bob"), daysAgo(1));
    const rows = await store.recentContacts(alex, 30);
    expect(rows.map((r) => r.slug)).not.toContain("uncle-bob");
  });
});

describe("MdStore — search", () => {
  beforeAll(async () => {
    await store.write(
      "memory/mem-baking.md",
      { id: "mem-baking", subject: "person/grandma-dana" },
      "Grandma Dana baked homemade raviolis every Christmas.",
    );
    await store.write(
      "memory/mem-soccer.md",
      { id: "mem-soccer", subject: "speakers/SPEAKER_0" },
      "Alex started playing soccer last fall.",
    );
  });

  it("lexical-only search finds literal words", async () => {
    const hits = await store.search("raviolis", { kinds: ["memory"], lexicalOnly: true });
    expect(hits[0]?.slug).toBe("mem-baking");
  });

  it("hybrid search finds semantically related memory", async () => {
    const hits = await store.search("christmas pasta tradition", { kinds: ["memory"] });
    expect(hits.map((h) => h.slug)).toContain("mem-baking");
  });
});

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
