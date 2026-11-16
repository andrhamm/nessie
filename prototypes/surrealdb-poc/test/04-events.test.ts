import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

async function addEvent(
  id: string,
  date: string,
  title: string,
  status: "past" | "scheduled" | "cancelled",
  participants: { speakers: string[]; persons: string[] },
  body: string,
): Promise<void> {
  const path = `event/${date}-${id}.md`;
  await writeMdFile(f.mdDir, path, { id, date, title, status, participants, tags: [] }, body);
  await indexOne(f.db, f.mdDir, path);
}

beforeAll(async () => {
  f = await setupFixture("04-events");
  await addEvent(
    "easter",
    "2026-03-29",
    "Easter at Grandma Dana's",
    "past",
    { speakers: ["SPEAKER_0"], persons: ["grandma-dana"] },
    "Egg hunt in the garden.",
  );
  await addEvent(
    "school-play",
    "2026-04-05",
    "School play: The Dinosaurs",
    "past",
    { speakers: ["SPEAKER_0"], persons: ["zoe-from-dance"] },
    "Alex played a baby T-Rex.",
  );
  await addEvent(
    "soccer",
    "2026-05-10",
    "Soccer practice",
    "scheduled",
    { speakers: ["SPEAKER_0"], persons: [] },
    "First soccer practice of the season.",
  );
  await addEvent(
    "dentist",
    "2026-06-01",
    "Dentist checkup",
    "scheduled",
    { speakers: ["SPEAKER_0"], persons: [] },
    "Routine checkup.",
  );
  await addEvent(
    "skip-this",
    "2026-05-20",
    "Skipped appointment",
    "cancelled",
    { speakers: ["SPEAKER_0"], persons: [] },
    "Rescheduled.",
  );
});

afterAll(async () => {
  await f.cleanup();
});

describe("04-events — calendar entries", () => {
  it("range query from..to returns the correct slice", async () => {
    const [rows] = await f.db.query<[Array<{ id: unknown; date: string }>]>(
      `SELECT meta::id(id) AS id, frontmatter.date AS date FROM event
       WHERE frontmatter.date >= $from AND frontmatter.date <= $to
       ORDER BY date`,
      { from: "2026-04-01", to: "2026-05-31" },
    );
    expect(rows).toHaveLength(3);
    const ids = rows?.map((r) => r.id);
    expect(ids).toEqual(["2026-04-05-school-play", "2026-05-10-soccer", "2026-05-20-skip-this"]);
  });

  it("filter by status=scheduled excludes past and cancelled", async () => {
    const [rows] = await f.db.query<[Array<{ id: unknown; date: string }>]>(
      `SELECT meta::id(id) AS id, frontmatter.date AS date FROM event
       WHERE frontmatter.status = 'scheduled' ORDER BY date`,
    );
    expect(rows).toHaveLength(2);
    expect(rows?.map((r) => r.id)).toEqual(["2026-05-10-soccer", "2026-06-01-dentist"]);
  });

  it("participants.persons is queryable", async () => {
    const [rows] = await f.db.query<[Array<{ id: unknown }>]>(
      "SELECT meta::id(id) AS id FROM event WHERE frontmatter.participants.persons CONTAINS $p",
      { p: "grandma-dana" },
    );
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.id).toBe("2026-03-29-easter");
  });

  it("delete_event removes the row", async () => {
    await f.db.query("DELETE type::record($tb, $id)", {
      tb: "event",
      id: "2026-06-01-dentist",
    });
    const [rows] = await f.db.query<[unknown[]]>(
      "SELECT * FROM event WHERE meta::id(id) = '2026-06-01-dentist'",
    );
    expect(rows).toHaveLength(0);
  });
});
