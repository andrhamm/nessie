import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Surreal } from "surrealdb";
import { connect } from "../src/db.ts";
import { configureEmbedCache } from "../src/embed.ts";

const POC_ROOT = resolve(import.meta.dir, "..");
const MODELS_DIR = join(POC_ROOT, "models");

/** Configure the shared model cache once — singleton effect. */
configureEmbedCache(MODELS_DIR);

export interface TestFixture {
  db: Surreal;
  mdDir: string;
  dbPath: string;
  cleanup: () => Promise<void>;
}

/**
 * Set up an isolated test fixture: a fresh `data/test-<slug>/` directory,
 * a fresh surrealkv at `.../poc.db`, and an empty `md/` subdir ready for
 * the test to write into.
 */
export async function setupFixture(slug: string): Promise<TestFixture> {
  const testDir = join(POC_ROOT, "data", `test-${slug}`);
  await rm(testDir, { recursive: true, force: true });
  const mdDir = join(testDir, "md");
  const dbPath = join(testDir, "poc.db");
  await mkdir(mdDir, { recursive: true });

  const db = await connect({ path: dbPath });

  const cleanup = async () => {
    await db.close();
    await rm(testDir, { recursive: true, force: true });
  };

  return { db, mdDir, dbPath, cleanup };
}
