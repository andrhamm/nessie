import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DateTime, RecordId } from "surrealdb";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

function p(slug: string): RecordId {
  return new RecordId("person", slug);
}

async function addPerson(slug: string, name: string, relation: string): Promise<void> {
  const path = `person/${slug}.md`;
  await writeMdFile(
    f.mdDir,
    path,
    { slug, name, relation, known_to: ["SPEAKER_0"] },
    `${name} is a ${relation}.`,
  );
  await indexOne(f.db, f.mdDir, path);
}

async function relate(
  edge: string,
  fromSlug: string,
  toSlug: string,
  extra?: Record<string, unknown>,
) {
  // edge name is trusted (enum in schemas.ts); slugs are parameter-bound
  const extraSet = extra
    ? " SET " +
      Object.keys(extra)
        .map((k) => `${k} = $${k}`)
        .join(", ")
    : "";
  await f.db.query(`RELATE $from -> ${edge} -> $to${extraSet}`, {
    from: p(fromSlug),
    to: p(toSlug),
    ...(extra ?? {}),
  });
}

beforeAll(async () => {
  f = await setupFixture("06-graph");
  for (const [slug, name, rel] of [
    ["alex", "Alex", "self"],
    ["finn", "Finn", "sibling"],
    ["ivy", "Ivy", "sibling"],
    ["zoe", "Zoe", "classmate"],
    ["eli", "Eli", "classmate"],
    ["grandma-dana", "Dana", "grandparent"],
    ["mom", "Erin", "parent"],
  ] as const) {
    await addPerson(slug, name, rel);
  }

  await relate("sibling_of", "alex", "finn");
  await relate("sibling_of", "alex", "ivy");
  await relate("classmate_of", "alex", "zoe");
  await relate("classmate_of", "alex", "eli");
  await relate("classmate_of", "finn", "eli"); // sibling of alex has same classmate
  await relate("parent_of", "mom", "alex");
  await relate("parent_of", "mom", "finn");
  await relate("friend_of", "zoe", "ivy"); // enables 2-hop classmate→friend
  await relate("last_contacted", "alex", "grandma-dana", { date: new DateTime("2026-03-29") });
});

afterAll(async () => {
  await f.cleanup();
});

describe("06-graph — RELATE + traversals", () => {
  it("1-hop sibling_of lists Alex's siblings", async () => {
    const [rows] = await f.db.query<[Array<{ out: unknown }>]>(
      `SELECT out FROM sibling_of WHERE in = $alex`,
      { alex: p("alex") },
    );
    const targetIds = rows?.map((r) => String(r.out).split(":")[1]?.replace(/[⟨⟩]/g, "")).sort();
    expect(targetIds).toEqual(["finn", "ivy"]);
  });

  it("traversal via -> syntax lists classmates", async () => {
    const [rows] = await f.db.query<[unknown[]]>(`SELECT VALUE ->classmate_of->person FROM $alex`, {
      alex: p("alex"),
    });
    const flat = (rows?.[0] as unknown[])?.flat() ?? [];
    expect(flat).toHaveLength(2);
  });

  it("2-hop: classmates of siblings (sibling_of → classmate_of)", async () => {
    const [rows] = await f.db.query<[unknown[]]>(
      `SELECT VALUE ->sibling_of->person->classmate_of->person FROM $alex`,
      { alex: p("alex") },
    );
    const flat = ((rows?.[0] as unknown[]) ?? []).flat(2);
    // finn has classmate eli; ivy has none. Expect eli.
    expect(flat.map(String)).toContain("person:eli");
  });

  it("last_contacted edge stores the date metadata", async () => {
    const [rows] = await f.db.query<[Array<{ date: unknown }>]>(
      `SELECT date FROM last_contacted WHERE in = $alex`,
      { alex: p("alex") },
    );
    expect(rows).toHaveLength(1);
    expect(rows?.[0]?.date).toBeInstanceOf(DateTime);
  });

  it("filter traversal by specific edge type", async () => {
    const [rows] = await f.db.query<[unknown[]]>(`SELECT VALUE ->friend_of->person FROM $zoe`, {
      zoe: p("zoe"),
    });
    const flat = (rows?.[0] as unknown[])?.flat() ?? [];
    expect(flat.map(String)).toEqual(["person:ivy"]);
  });
});
