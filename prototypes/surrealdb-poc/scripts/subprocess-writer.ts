#!/usr/bin/env bun
/**
 * Subprocess helper for 11-persistence.test.ts and 12-crash-safety.test.ts.
 *
 * Usage:
 *   bun run scripts/subprocess-writer.ts <dbPath> <count> [--slow]
 *
 * Writes <count> person records, then cleanly closes. With --slow, inserts a
 * 150 ms pause per record so the parent has a window to SIGKILL mid-write.
 */

import { DateTime } from "surrealdb";
import { connect } from "../src/db.ts";

const args = process.argv.slice(2);
const dbPath = args[0];
const count = args[1] ? Number(args[1]) : 10;
const slow = args.includes("--slow");

if (!dbPath) {
  console.error("usage: subprocess-writer.ts <dbPath> <count> [--slow]");
  process.exit(1);
}

console.log(`[writer] starting, path=${dbPath}`);
const db = await connect({ path: dbPath });
console.log(`[writer] connected`);

for (let i = 1; i <= count; i++) {
  const slug = `sub-person-${i}`;
  await db.query("UPSERT type::record('person', $id) CONTENT $data", {
    id: slug,
    data: {
      path: `person/${slug}.md`,
      kind: "person",
      frontmatter: { slug, name: `Sub ${i}` },
      body: `Record number ${i} written by subprocess.`,
      embedding: Array(384).fill(0),
      mtime: new DateTime(new Date()),
    },
  });
  console.log(`wrote ${slug}`);
  if (slow) await new Promise((r) => setTimeout(r, 150));
}

// Prefer explicit close + exit so buffered writes flush and the parent's
// `child.exited` promise resolves. SurrealKV on Bun macOS arm64 has an open
// issue where .close() can hang; wall-clock the close and force-exit if it
// doesn't return promptly.
const closeTimeout = new Promise<void>((resolve) => setTimeout(resolve, 3000));
await Promise.race([db.close(), closeTimeout]);
process.exit(0);
