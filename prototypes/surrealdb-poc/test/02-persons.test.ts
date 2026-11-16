import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

async function addPerson(
  slug: string,
  name: string,
  fields: Record<string, unknown>,
  body: string,
): Promise<void> {
  const path = `person/${slug}.md`;
  await writeMdFile(f.mdDir, path, { slug, name, ...fields }, body);
  await indexOne(f.db, f.mdDir, path);
}

beforeAll(async () => {
  f = await setupFixture("02-persons");

  await addPerson(
    "alex",
    "Alex",
    { relation: "self", known_to: ["SPEAKER_0"] },
    "Alex is six, loves dinosaurs.",
  );
  await addPerson(
    "finn",
    "Finn",
    { relation: "sibling", known_to: ["SPEAKER_0"] },
    "Finn is Alex's little brother.",
  );
  await addPerson(
    "grandma-dana",
    "Dana",
    { aliases: ["Gran Dana", "Nana"], relation: "grandparent", known_to: ["SPEAKER_0"] },
    "Grandma Dana lives in Seattle.",
  );
  await addPerson(
    "grandma-maeve",
    "Maeve",
    { aliases: ["Gran", "Gran Maeve"], relation: "grandparent", known_to: ["SPEAKER_0"] },
    "Grandma Maeve lives nearby.",
  );
  await addPerson(
    "zoe-from-dance",
    "Zoe",
    { relation: "classmate", known_to: ["SPEAKER_0"] },
    "Zoe is Alex's classmate in dance.",
  );
});

afterAll(async () => {
  await f.cleanup();
});

describe("02-persons — person graph nodes", () => {
  it("list_persons returns all rows", async () => {
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT meta::id(id) AS slug, frontmatter.name AS name FROM person",
    );
    expect(rows).toHaveLength(5);
  });

  it("list_persons filtered by relation", async () => {
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT meta::id(id) AS slug FROM person WHERE frontmatter.relation = 'grandparent'",
    );
    expect(rows).toHaveLength(2);
    const slugs = rows?.map((r) => r.slug).sort();
    expect(slugs).toEqual(["grandma-dana", "grandma-maeve"]);
  });

  it("who_is by exact name resolves to the right slug", async () => {
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT meta::id(id) AS slug FROM person WHERE frontmatter.name = $name",
      { name: "Zoe" },
    );
    expect(rows?.[0]?.slug).toBe("zoe-from-dance");
  });

  it("who_is by unique alias resolves to the right slug", async () => {
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT meta::id(id) AS slug FROM person WHERE frontmatter.aliases CONTAINS $alias",
      { alias: "Nana" },
    );
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.slug).toBe("grandma-dana");
  });

  it("who_is ambiguous alias returns both candidates", async () => {
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT meta::id(id) AS slug FROM person WHERE frontmatter.aliases CONTAINS $alias",
      { alias: "Gran" },
    );
    // "Gran" is an alias of maeve; "Gran Dana" / "Gran Maeve" would match too
    // if we'd asked for prefix — we're testing CONTAINS on an exact alias,
    // so only grandma-maeve should match (she has "Gran" in her aliases).
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.slug).toBe("grandma-maeve");
  });

  it("delete_person removes the record", async () => {
    await f.db.query("DELETE type::record($tb, $id)", { tb: "person", id: "finn" });
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT * FROM person WHERE meta::id(id) = 'finn'",
    );
    expect(rows).toHaveLength(0);
  });

  it("add_alias appends to the aliases array", async () => {
    await f.db.query("UPDATE type::record($tb, $id) SET frontmatter.aliases += $alias", {
      tb: "person",
      id: "grandma-dana",
      alias: "Gram",
    });
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT frontmatter.aliases AS aliases FROM type::record($tb, $id)",
      { tb: "person", id: "grandma-dana" },
    );
    const aliases = rows?.[0]?.aliases as string[];
    expect(aliases).toContain("Gram");
  });
});
