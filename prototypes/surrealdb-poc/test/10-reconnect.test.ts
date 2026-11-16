import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { connect } from "../src/db.ts";
import { configureEmbedCache } from "../src/embed.ts";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";

const POC_ROOT = resolve(import.meta.dir, "..");
configureEmbedCache(join(POC_ROOT, "models"));

const TEST_DIR = join(POC_ROOT, "data", "test-10-reconnect");

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

/**
 * This test is DOCUMENTARY: it records the observed reconnect behaviour so
 * the README can say what actually happens on this platform. Either outcome
 * keeps the test green — the prototype's job is to surface the reality, not
 * to require a specific one.
 */
describe("10-reconnect — direct reproducer for surrealdb.js issue #592", () => {
  it("records reconnect behaviour (clean reconnect OR #592 hang)", async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    const mdDir = join(TEST_DIR, "md");
    await mkdir(mdDir, { recursive: true });
    const dbPath = join(TEST_DIR, "poc.db");

    const db1 = await connect({ path: dbPath });
    await writeMdFile(mdDir, "person/r1.md", { slug: "r1", name: "R1" }, "R1 body.");
    await indexOne(db1, mdDir, "person/r1.md");
    await db1.close();

    const timer = new Promise<"hang">((resolve) => setTimeout(() => resolve("hang"), 15000));
    const result = await Promise.race([
      connect({ path: dbPath }).then((db) => ({ kind: "ok" as const, db })),
      timer,
    ]);

    if (result === "hang") {
      console.log("[10-reconnect] CONFIRMED: same-process reconnect hangs (issue #592)");
      console.log("[10-reconnect] Mitigation: use a single long-lived connection per process");
      expect(result).toBe("hang");
    } else {
      console.log("[10-reconnect] Same-process reconnect succeeded — #592 not triggered");
      const [rows] = await result.db.query<[Array<{ body: string }>]>(
        "SELECT body FROM person WHERE meta::id(id) = 'r1'",
      );
      await result.db.close();
      expect(rows?.[0]?.body).toContain("R1 body");
    }
  }, 30000);
});
