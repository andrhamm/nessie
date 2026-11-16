import { createNodeEngines } from "@surrealdb/node";
import { Surreal } from "surrealdb";
import { SCHEMA_STATEMENTS } from "./schemas.ts";

export interface DbOptions {
  /** Path for surrealkv file (relative or absolute). */
  path: string;
  /** Namespace inside SurrealDB. */
  namespace?: string;
  /** Database inside the namespace. */
  database?: string;
}

/**
 * Open a local embedded SurrealDB using surrealkv persistence, switch to the
 * requested ns/db, and apply the shared schema. Returns the connected handle.
 *
 * Callers own the returned handle and must `db.close()` when done.
 */
export async function connect(options: DbOptions): Promise<Surreal> {
  const db = new Surreal({ engines: { ...createNodeEngines() } });
  await db.connect(`surrealkv://${options.path}`);
  await db.use({
    namespace: options.namespace ?? "nessie_poc",
    database: options.database ?? "main",
  });

  for (const stmt of SCHEMA_STATEMENTS) {
    await db.query(stmt);
  }
  return db;
}

export async function close(db: Surreal): Promise<void> {
  await db.close();
}
