import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { embed } from "../src/embed.ts";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

async function addJournal(
  date: string,
  slug: string,
  body: string,
  tags: string[] = [],
): Promise<void> {
  const path = `journal/${date}-${slug}.md`;
  await writeMdFile(f.mdDir, path, { date, speakers: ["SPEAKER_0"], tags }, body);
  await indexOne(f.db, f.mdDir, path);
}

beforeAll(async () => {
  f = await setupFixture("05-journal");
  await addJournal(
    "2026-04-02",
    "museum",
    "Family trip to the dinosaur museum. Alex was thrilled, especially at the T-Rex skeleton.",
  );
  await addJournal("2026-04-05", "baking", "Baked cookies with Grandma Dana over video chat.");
  await addJournal(
    "2026-04-10",
    "park",
    "Scooter ride at the park, Alex fell and scraped her knee.",
  );
  await addJournal("2026-04-15", "play", "Acted out a whole space adventure with stuffed animals.");
  await addJournal("2026-04-18", "dance", "Alex had dance class with Zoe. Learned a new routine.");
});

afterAll(async () => {
  await f.cleanup();
});

describe("05-journal — retrospective entries + semantic recall", () => {
  it("recall 'dinosaur museum' surfaces the museum journal", async () => {
    const qvec = Array.from(await embed("dinosaur museum visit"));
    const [rows] = await f.db.query<[Array<{ id: unknown; body: string }>]>(
      "SELECT meta::id(id) AS id, body FROM journal WHERE embedding <|3,100|> $qvec",
      { qvec },
    );
    expect(rows?.[0]?.body).toMatch(/dinosaur museum/);
  });

  it("filter by date range narrows to recent entries", async () => {
    const [rows] = await f.db.query<[Array<{ id: unknown; date: string }>]>(
      `SELECT meta::id(id) AS id, frontmatter.date AS date FROM journal
       WHERE frontmatter.date >= $from
       ORDER BY date DESC`,
      { from: "2026-04-15" },
    );
    expect(rows).toHaveLength(2);
  });

  it("combining recall + date range returns semantically+temporally relevant hits", async () => {
    const qvec = Array.from(await embed("playing pretend with toys"));
    const [rows] = await f.db.query<[Array<{ id: unknown; body: string }>]>(
      `SELECT meta::id(id) AS id, body FROM journal
       WHERE embedding <|3,100|> $qvec
       AND frontmatter.date >= $from`,
      { qvec, from: "2026-04-10" },
    );
    expect(rows?.[0]?.body).toMatch(/space adventure|stuffed animals/);
  });
});
