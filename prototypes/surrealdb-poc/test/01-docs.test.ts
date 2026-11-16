import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deleteOne, indexAll, indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

beforeAll(async () => {
  f = await setupFixture("01-docs");
});

afterAll(async () => {
  await f.cleanup();
});

describe("01-docs — .md-on-disk round-trip", () => {
  it("writes a person .md to disk, indexer upserts it, SurrealDB round-trips the data", async () => {
    const relPath = "person/grandma-dana.md";
    await writeMdFile(
      f.mdDir,
      relPath,
      {
        slug: "grandma-dana",
        name: "Dana",
        aliases: ["Gran Dana", "Nana"],
        relation: "grandparent",
        known_to: ["SPEAKER_0"],
        lives: "Seattle",
      },
      "Grandma Dana makes raviolis at Christmas and saves a plate for Alex.",
    );

    const indexed = await indexOne(f.db, f.mdDir, relPath);
    expect(indexed).not.toBeNull();
    expect(indexed?.kind).toBe("person");

    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT * FROM person WHERE path = $p",
      { p: relPath },
    );
    expect(rows).toHaveLength(1);
    const row = rows?.[0];
    expect(row?.kind).toBe("person");
    expect(row?.body).toContain("Grandma Dana");
    const fm = row?.frontmatter as Record<string, unknown>;
    expect(fm?.name).toBe("Dana");
    expect(fm?.aliases).toEqual(["Gran Dana", "Nana"]);
  });

  it("editing the file and re-indexing updates the record", async () => {
    const relPath = "person/grandma-dana.md";
    const abs = join(f.mdDir, relPath);
    const original = await readFile(abs, "utf8");
    await writeFile(abs, original.replace("raviolis", "gnocchi"), "utf8");

    await indexOne(f.db, f.mdDir, relPath);

    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT body FROM person WHERE path = $p",
      { p: relPath },
    );
    expect(rows?.[0]?.body).toContain("gnocchi");
    expect(rows?.[0]?.body).not.toContain("raviolis");
  });

  it("deleting the file removes the record", async () => {
    const relPath = "person/grandma-dana.md";
    await unlink(join(f.mdDir, relPath));
    await deleteOne(f.db, relPath);

    const [rows] = await f.db.query<[Array<Record<string, unknown>>]>(
      "SELECT * FROM person WHERE path = $p",
      { p: relPath },
    );
    expect(rows).toHaveLength(0);
  });

  it("indexAll walks the full md/ tree and picks up each entity kind", async () => {
    await writeMdFile(
      f.mdDir,
      "routine.md",
      { updated: "2026-04-18T09:00Z" },
      "Morning routine, after-school routine.",
    );
    await writeMdFile(
      f.mdDir,
      "constraints.md",
      { updated: "2026-04-18T09:00Z" },
      "- No scary stories tonight",
    );
    await writeMdFile(
      f.mdDir,
      "memory/mem-100.md",
      { id: "mem-100", subject: "person/zoe-from-dance", tags: ["friend"] },
      "Zoe is Alex's classmate in dance.",
    );

    const indexed = await indexAll({ db: f.db, mdDir: f.mdDir });
    const kinds = new Set(indexed.map((d) => d.kind));
    expect(kinds.has("routine")).toBe(true);
    expect(kinds.has("constraint")).toBe(true);
    expect(kinds.has("memory")).toBe(true);
  });
});
