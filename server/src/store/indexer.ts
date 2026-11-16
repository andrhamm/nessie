import { readFile, stat } from "node:fs/promises";
import { basename, join, relative, sep } from "node:path";
import { Glob } from "bun";
import { DateTime, type Surreal } from "surrealdb";
import { embed } from "./embed";
import { parseMd } from "./frontmatter";
import { ENTITY_KINDS, type EntityKind } from "./types";

/**
 * Infer the entity kind from a relative path. `<kind>/slug.md` → `<kind>`.
 * Special-cased top-level files: `routine.md` → routine, `constraints.md` →
 * constraint.
 */
export function inferKind(rel: string): EntityKind | null {
  const normalized = rel.split(sep).join("/");
  if (normalized === "routine.md") return "routine";
  if (normalized === "constraints.md") return "constraint";
  if (normalized === "config/runtime.md") return "runtime_config";
  const parts = rel.split(sep);
  const head = parts[0];
  if (head && (ENTITY_KINDS as readonly string[]).includes(head)) {
    return head as EntityKind;
  }
  return null;
}

/** Stable record slug derived from the filename. */
export function slugFromPath(kind: EntityKind, rel: string): string {
  if (kind === "routine") return "routine";
  if (kind === "constraint") return "constraints";
  if (kind === "runtime_config") return "runtime";
  return basename(rel, ".md");
}

export interface IndexedDoc {
  kind: EntityKind;
  slug: string;
  path: string;
}

async function upsert(db: Surreal, mdDir: string, relPath: string): Promise<IndexedDoc | null> {
  const abs = join(mdDir, relPath);
  const source = await readFile(abs, "utf8");
  const { frontmatter, body } = parseMd(source);
  const kind = inferKind(relPath);
  if (!kind) return null;
  const slug = slugFromPath(kind, relPath);
  const embedding = await embed(body);
  const s = await stat(abs);
  const record = {
    path: relPath,
    kind,
    frontmatter,
    body,
    embedding: Array.from(embedding),
    mtime: new DateTime(s.mtime),
  };
  await db.query("UPSERT type::record($tb, $id) CONTENT $data", {
    tb: kind,
    id: slug,
    data: record,
  });
  return { kind, slug, path: relPath };
}

export async function indexAll(db: Surreal, mdDir: string): Promise<IndexedDoc[]> {
  const glob = new Glob("**/*.md");
  const indexed: IndexedDoc[] = [];
  for await (const rel of glob.scan({ cwd: mdDir })) {
    const result = await upsert(db, mdDir, rel);
    if (result) indexed.push(result);
  }
  return indexed;
}

export async function indexOne(
  db: Surreal,
  mdDir: string,
  relPath: string,
): Promise<IndexedDoc | null> {
  return upsert(db, mdDir, relPath);
}

export async function deleteOne(db: Surreal, relPath: string): Promise<void> {
  const kind = inferKind(relPath);
  if (!kind) return;
  const slug = slugFromPath(kind, relPath);
  await db.query("DELETE type::record($tb, $id)", { tb: kind, id: slug });
}
