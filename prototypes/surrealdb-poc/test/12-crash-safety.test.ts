import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { connect } from "../src/db.ts";

const POC_ROOT = resolve(import.meta.dir, "..");
const TEST_DIR = join(POC_ROOT, "data", "test-12-crash");

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("12-crash-safety — SIGKILL mid-write", () => {
  it("store reopens cleanly after a SIGKILLed writer", async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
    const dbPath = join(TEST_DIR, "poc.db");
    const writer = join(POC_ROOT, "scripts", "subprocess-writer.ts");

    // Slow writer: 150 ms per record, 50 records = ~7.5 s total.
    // We kill it after ~1 s so it gets maybe 5-10 records in.
    const child = Bun.spawn(["bun", "run", writer, dbPath, "50", "--slow"], {
      cwd: POC_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });

    await new Promise((r) => setTimeout(r, 1000));
    child.kill("SIGKILL");
    await child.exited;

    // Parent opens the same db. If #592 is present, we may hang here;
    // time-box the connect so we fail cleanly instead of locking up.
    const timer = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("parent reopen hung >15s")), 15000),
    );
    let db: Awaited<ReturnType<typeof connect>>;
    try {
      db = await Promise.race([connect({ path: dbPath }), timer]);
    } catch (err) {
      // Record the observation but do not mark this as a hard fail — in the
      // README we capture whether the store is recoverable at all after crash.
      throw err;
    }

    const [rows] = await db.query<[Array<Record<string, unknown>>]>(
      `SELECT meta::id(id) AS slug, body FROM person`,
    );
    await db.close();

    // DOCUMENTARY: we report however many records survived the crash.
    // SurrealKV is WAL-backed so the store should at minimum open cleanly;
    // exact durability mid-write is what this test measures for the README.
    const committed = rows?.length ?? 0;
    console.log(`[12-crash-safety] records survived SIGKILL mid-write: ${committed}`);
    expect(typeof committed).toBe("number"); // i.e., we got SOME answer without crashing
  }, 60000);
});
