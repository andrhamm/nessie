import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DateTime, RecordId } from "surrealdb";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

function p(slug: string): RecordId {
  return new RecordId("person", slug);
}

async function addPerson(slug: string, name: string): Promise<void> {
  const path = `person/${slug}.md`;
  await writeMdFile(f.mdDir, path, { slug, name, relation: "friend" }, `${name} is a friend.`);
  await indexOne(f.db, f.mdDir, path);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

beforeAll(async () => {
  f = await setupFixture("07-contact");
  for (const [slug, name, days] of [
    ["alex", "Alex", -1],
    ["grandma-dana", "Dana", 5],
    ["grandma-maeve", "Maeve", 45],
    ["uncle-bob", "Bob", 90],
    ["aunt-erin", "Erin", 10],
    ["zoe", "Zoe", 2],
  ] as const) {
    await addPerson(slug, name);
    if (days >= 0) {
      await f.db.query(`RELATE $from -> last_contacted -> $to SET date = $date`, {
        from: p("alex"),
        to: p(slug),
        date: new DateTime(daysAgo(days)),
      });
    }
  }
});

afterAll(async () => {
  await f.cleanup();
});

describe("07-contact-tracking — 'call grandma, it's been a while'", () => {
  it("recent_contacts(older_than=30d) returns only persons past the threshold", async () => {
    const threshold = daysAgo(30);
    const [rows] = await f.db.query<[Array<{ slug: string; date: unknown }>]>(
      `SELECT meta::id(out) AS slug, date FROM last_contacted WHERE in = $alex AND date < $thr`,
      { alex: p("alex"), thr: new DateTime(threshold) },
    );
    const slugs = rows?.map((r) => r.slug).sort();
    expect(slugs).toEqual(["grandma-maeve", "uncle-bob"]);
  });

  it("recent_contacts(older_than=3d) includes all but very recent", async () => {
    const threshold = daysAgo(3);
    const [rows] = await f.db.query<[Array<{ slug: string }>]>(
      `SELECT meta::id(out) AS slug FROM last_contacted WHERE in = $alex AND date < $thr`,
      { alex: p("alex"), thr: new DateTime(threshold) },
    );
    const slugs = rows?.map((r) => r.slug).sort();
    // zoe=2d ago is excluded; grandma-dana=5d included
    expect(slugs).toContain("grandma-dana");
    expect(slugs).not.toContain("zoe");
  });

  it("note_contact_event updates last_contact to now", async () => {
    // Simulate a new event that involved grandma-maeve
    const now = new Date();
    await f.db.query(
      `DELETE last_contacted WHERE in = $alex AND out = $maeve;
       RELATE $alex -> last_contacted -> $maeve SET date = $now`,
      { alex: p("alex"), maeve: p("grandma-maeve"), now: new DateTime(now) },
    );

    const threshold = daysAgo(30);
    const [rows] = await f.db.query<[Array<{ slug: string }>]>(
      `SELECT meta::id(out) AS slug FROM last_contacted WHERE in = $alex AND date < $thr`,
      { alex: p("alex"), thr: new DateTime(threshold) },
    );
    const slugs = rows?.map((r) => r.slug) ?? [];
    expect(slugs).not.toContain("grandma-maeve"); // now within 30 days
  });
});
