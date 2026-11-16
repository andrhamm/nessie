import { createNodeEngines } from "@surrealdb/node";
import { Surreal } from "surrealdb";
import { SCHEMA_STATEMENTS } from "./schemas";

export interface DbOptions {
  path: string;
  namespace?: string;
  database?: string;
}

/**
 * Open an embedded SurrealDB using surrealkv persistence, switch to the
 * requested ns/db, and apply the shared schema. One long-lived handle per
 * process — `close()` does not reliably release the file lock on Bun +
 * macOS arm64 (issue surrealdb.js#592), so reopening in the same process
 * is NOT supported. Shut down the process instead.
 */
export async function connect(options: DbOptions): Promise<Surreal> {
  const db = new Surreal({ engines: { ...createNodeEngines() } });
  await db.connect(`surrealkv://${options.path}`);
  await db.use({
    namespace: options.namespace ?? "nessie",
    database: options.database ?? "main",
  });
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.query(stmt);
  }
  return db;
}

/**
 * Best-effort close. Wraps the SDK's `close()` in a short timeout so a stuck
 * shutdown does not block process exit — pair with `process.exit(0)` when
 * the Bun process is terminating for good.
 */
export async function close(db: Surreal, timeoutMs = 3000): Promise<void> {
  const timer = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  await Promise.race([db.close(), timer]);
}
