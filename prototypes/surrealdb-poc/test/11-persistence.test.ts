import { afterAll, describe, expect, it } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { connect } from "../src/db.ts";

const POC_ROOT = resolve(import.meta.dir, "..");
const TEST_DIR = join(POC_ROOT, "data", "test-11-persistence");

afterAll(async () => {
  await rm(TEST_DIR, { recursive: true, force: true });
});

describe("11-persistence — cross-process durability", () => {
  it("process A writes, process B reads back exactly what A wrote", async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
    await mkdir(TEST_DIR, { recursive: true });
    const dbPath = join(TEST_DIR, "poc.db");
    const writer = join(POC_ROOT, "scripts", "subprocess-writer.ts");

    const child = Bun.spawn(["bun", "run", writer, dbPath, "10"], {
      cwd: POC_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await child.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(child.stderr).text();
      throw new Error(`subprocess writer failed: exit ${exitCode}: ${stderr}`);
    }

    const db = await connect({ path: dbPath });
    const [rows] = await db.query<[Array<{ slug: string; body: string }>]>(
      `SELECT meta::id(id) AS slug, body FROM person ORDER BY slug`,
    );
    await db.close();

    expect(rows).toHaveLength(10);
    // Record numbering is 1-indexed; spot check a few
    const first = rows?.find((r) => r.slug === "sub-person-1");
    expect(first?.body).toContain("Record number 1");
    const last = rows?.find((r) => r.slug === "sub-person-10");
    expect(last?.body).toContain("Record number 10");
  }, 60000);
});
