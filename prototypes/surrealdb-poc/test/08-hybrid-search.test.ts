import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { embed } from "../src/embed.ts";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

beforeAll(async () => {
  f = await setupFixture("08-hybrid");

  // 4 collections, distinct content. Grandma Dana mentioned in several.
  await writeMdFile(
    f.mdDir,
    "person/grandma-dana.md",
    { slug: "grandma-dana", name: "Dana", relation: "grandparent" },
    "Grandma Dana lives in Seattle and loves to bake.",
  );
  await indexOne(f.db, f.mdDir, "person/grandma-dana.md");

  await writeMdFile(
    f.mdDir,
    "memory/mem-ravioli.md",
    { id: "mem-ravioli", subject: "person/grandma-dana", tags: ["food"] },
    "Grandma Dana makes homemade raviolis every Christmas.",
  );
  await indexOne(f.db, f.mdDir, "memory/mem-ravioli.md");

  await writeMdFile(
    f.mdDir,
    "event/2026-03-29-easter.md",
    {
      id: "evt-easter",
      date: "2026-03-29",
      title: "Easter brunch",
      participants: { speakers: ["SPEAKER_0"], persons: ["grandma-dana"] },
    },
    "Easter brunch at Grandma Dana's house. Egg hunt in the garden.",
  );
  await indexOne(f.db, f.mdDir, "event/2026-03-29-easter.md");

  await writeMdFile(
    f.mdDir,
    "journal/2026-04-05-baking.md",
    { date: "2026-04-05", speakers: ["SPEAKER_0"], persons_mentioned: ["grandma-dana"] },
    "Baked cookies with Grandma Dana over video chat this afternoon.",
  );
  await indexOne(f.db, f.mdDir, "journal/2026-04-05-baking.md");

  // Noise docs to make sure filtering works
  await writeMdFile(
    f.mdDir,
    "memory/mem-soccer.md",
    { id: "mem-soccer", subject: "speakers/SPEAKER_0", tags: ["sports"] },
    "Alex started playing soccer last fall.",
  );
  await indexOne(f.db, f.mdDir, "memory/mem-soccer.md");
});

afterAll(async () => {
  await f.cleanup();
});

describe("08-hybrid-search — cross-collection", () => {
  it("FTS finds literal 'raviolis' in memory collection", async () => {
    const [rows] = await f.db.query<[Array<{ id: unknown }>]>(
      `SELECT meta::id(id) AS id FROM memory WHERE body @1@ 'raviolis'`,
    );
    expect(rows?.[0]?.id).toBe("mem-ravioli");
  });

  it("vector finds semantically-related docs across collections", async () => {
    const qvec = Array.from(await embed("christmas pasta cooking tradition"));
    const [rows] = await f.db.query<[Array<{ id: unknown; kind: string; body: string }>]>(
      `SELECT meta::id(id) AS id, kind, body FROM person, memory, event, journal
       WHERE embedding <|5,100|> $qvec`,
      { qvec },
    );
    const hits = rows ?? [];
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.body).toMatch(/ravioli|Christmas|bake/i);
  });

  it("hybrid search::rrf fuses vector + FTS on one collection", async () => {
    const qvec = Array.from(await embed("cookies baked with grandmother"));
    const results = await f.db.query<unknown[]>(
      `
      LET $vs = (SELECT id FROM journal WHERE embedding <|5,100|> $qvec);
      LET $ft = (SELECT id, search::score(1) AS score FROM journal
                 WHERE body @1@ 'baked cookies Grandma' ORDER BY score DESC LIMIT 5);
      RETURN search::rrf([$vs, $ft], 5, 60);
      `,
      { qvec },
    );
    // LET, LET, RETURN — three statements; last one holds the RRF result
    const fused = results[results.length - 1] as Array<Record<string, unknown>>;
    expect(fused.length).toBeGreaterThan(0);
    // The baking journal should rise to the top across both signals
    expect(String(fused[0]?.id)).toMatch(/baking/);
  });

  it("scope to memory collection only returns memory hits", async () => {
    const qvec = Array.from(await embed("grandmother cooking"));
    const [rows] = await f.db.query<[Array<{ kind: string }>]>(
      `SELECT meta::id(id) AS id, kind FROM memory WHERE embedding <|5,100|> $qvec`,
      { qvec },
    );
    const kinds = new Set(rows?.map((r) => r.kind));
    expect([...kinds]).toEqual(["memory"]);
  });
});
