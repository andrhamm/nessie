import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { embed } from "../src/embed.ts";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

async function addMemory(id: string, subject: string, tags: string[], body: string): Promise<void> {
  const path = `memory/${id}.md`;
  await writeMdFile(f.mdDir, path, { id, subject, tags, created: "2026-04-10" }, body);
  await indexOne(f.db, f.mdDir, path);
}

beforeAll(async () => {
  f = await setupFixture("03-memories");

  await addMemory(
    "mem-1",
    "person/grandma-dana",
    ["food"],
    "Grandma Dana bakes homemade raviolis every Christmas.",
  );
  await addMemory(
    "mem-2",
    "person/grandma-dana",
    ["hobbies"],
    "Grandma Dana knits scarves and quilts in the winter.",
  );
  await addMemory(
    "mem-3",
    "person/grandma-dana",
    ["travel"],
    "Grandma Dana took a train across the country to visit.",
  );
  await addMemory(
    "mem-4",
    "speakers/SPEAKER_0",
    ["food"],
    "Alex's favourite meal is spaghetti with meatballs.",
  );
  await addMemory(
    "mem-5",
    "speakers/SPEAKER_0",
    ["hobbies"],
    "Alex builds elaborate dinosaur habitats out of Lego.",
  );
  await addMemory(
    "mem-6",
    "speakers/SPEAKER_0",
    ["school"],
    "Alex is in first grade and sits next to a girl named Zoe.",
  );
});

afterAll(async () => {
  await f.cleanup();
});

describe("03-memories — atomic facts + semantic recall", () => {
  it("vector search for 'something the grandparent cooks' surfaces food memory", async () => {
    const qvec = Array.from(await embed("what does the grandparent cook"));
    const [rows] = await f.db.query<[Array<{ id: unknown; body: string }>]>(
      `SELECT meta::id(id) AS id, body FROM memory WHERE embedding <|3,100|> $qvec
       AND frontmatter.subject = 'person/grandma-dana'`,
      { qvec },
    );
    expect(rows?.[0]?.body).toMatch(/raviolis/);
  });

  it("filter by subject returns only that person's memories", async () => {
    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT meta::id(id) AS id FROM memory WHERE frontmatter.subject = $s",
      { s: "person/grandma-dana" },
    );
    expect(rows).toHaveLength(3);
    const ids = rows?.map((r) => r.id).sort();
    expect(ids).toEqual(["mem-1", "mem-2", "mem-3"]);
  });

  it("vector search by subject for 'dinosaurs' finds lego memory", async () => {
    const qvec = Array.from(await embed("dinosaur play"));
    const [rows] = await f.db.query<[Array<{ id: unknown; body: string }>]>(
      `SELECT meta::id(id) AS id, body FROM memory WHERE embedding <|2,100|> $qvec
       AND frontmatter.subject = 'speakers/SPEAKER_0'`,
      { qvec },
    );
    expect(rows?.[0]?.body).toMatch(/dinosaur/);
  });
});
