import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { deleteOne, indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

let f: TestFixture;

beforeAll(async () => {
  f = await setupFixture("09-update-delete");
});

afterAll(async () => {
  await f.cleanup();
});

describe("09-update-delete — index freshness against real files", () => {
  it("FTS hit changes when the body is edited on disk", async () => {
    const rel = "memory/mem-bike.md";
    await writeMdFile(
      f.mdDir,
      rel,
      { id: "mem-bike", subject: "speakers/SPEAKER_0" },
      "Alex learned to ride her bicycle last summer.",
    );
    await indexOne(f.db, f.mdDir, rel);

    let [hits] = await f.db.query<[Array<{ id: unknown }>]>(
      `SELECT meta::id(id) AS id FROM memory WHERE body @1@ 'bicycle'`,
    );
    expect(hits).toHaveLength(1);

    // Parent edits the file directly — outside any agent tool
    const abs = join(f.mdDir, rel);
    const original = await readFile(abs, "utf8");
    await writeFile(abs, original.replace("bicycle", "scooter"), "utf8");
    await indexOne(f.db, f.mdDir, rel); // simulate the watcher firing

    [hits] = await f.db.query<[Array<{ id: unknown }>]>(
      `SELECT meta::id(id) AS id FROM memory WHERE body @1@ 'bicycle'`,
    );
    expect(hits).toHaveLength(0);

    [hits] = await f.db.query<[Array<{ id: unknown }>]>(
      `SELECT meta::id(id) AS id FROM memory WHERE body @1@ 'scooter'`,
    );
    expect(hits).toHaveLength(1);
  });

  it("deleting the file removes the index row", async () => {
    const rel = "memory/mem-dog.md";
    await writeMdFile(f.mdDir, rel, { id: "mem-dog" }, "Alex wants a golden retriever.");
    await indexOne(f.db, f.mdDir, rel);

    let [hits] = await f.db.query<[Array<{ id: unknown }>]>(
      `SELECT meta::id(id) AS id FROM memory WHERE body @1@ 'retriever'`,
    );
    expect(hits).toHaveLength(1);

    await unlink(join(f.mdDir, rel));
    await deleteOne(f.db, rel); // simulate the watcher firing on unlink

    [hits] = await f.db.query<[Array<{ id: unknown }>]>(
      `SELECT meta::id(id) AS id FROM memory WHERE body @1@ 'retriever'`,
    );
    expect(hits).toHaveLength(0);
  });

  it("updating routine.md reflects new content immediately", async () => {
    await writeMdFile(f.mdDir, "routine.md", { updated: "v1" }, "Morning routine v1.");
    await indexOne(f.db, f.mdDir, "routine.md");
    let [r] = await f.db.query<[Array<{ body: string }>]>(
      "SELECT body FROM routine WHERE meta::id(id) = 'routine'",
    );
    expect(r?.[0]?.body).toContain("v1");

    await writeMdFile(f.mdDir, "routine.md", { updated: "v2" }, "Morning routine v2.");
    await indexOne(f.db, f.mdDir, "routine.md");
    [r] = await f.db.query<[Array<{ body: string }>]>(
      "SELECT body FROM routine WHERE meta::id(id) = 'routine'",
    );
    expect(r?.[0]?.body).toContain("v2");
    expect(r?.[0]?.body).not.toContain("v1");
  });
});
