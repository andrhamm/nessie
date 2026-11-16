import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { Glob } from "bun";
import { DateTime, type Surreal } from "surrealdb";
import { embed } from "./embed.ts";
import { parseMd } from "./frontmatter.ts";
import { ENTITY_KINDS, type EntityKind } from "./schemas.ts";

export interface IndexerOptions {
  db: Surreal;
  /** Directory containing <kind>/*.md subdirs. */
  mdDir: string;
}

function inferKind(rel: string): EntityKind | null {
  const parts = rel.split(sep);
  if (parts.length === 1) {
    const name = parts[0] ?? "";
    if (name === "routine.md") return "routine";
    if (name === "constraints.md") return "constraint";
    return null;
  }
  const head = parts[0];
  if (head && (ENTITY_KINDS as readonly string[]).includes(head)) {
    return head as EntityKind;
  }
  return null;
}

function slugFromPath(kind: EntityKind, rel: string): string {
  if (kind === "routine") return "routine";
  if (kind === "constraint") return "constraints";
  const base = basename(rel, ".md");
  return base;
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export interface IndexedDoc {
  id: { tb: string; id: string };
  path: string;
  kind: EntityKind;
  frontmatter: Record<string, unknown>;
  body: string;
  mtime: string;
  hash: string;
}

/**
 * Walks the md dir, parses every .md file, embeds the body and UPSERTS each
 * record into SurrealDB. Returns a summary of what was indexed.
 */
export async function indexAll(options: IndexerOptions): Promise<IndexedDoc[]> {
  const mdRoot = resolve(options.mdDir);
  const glob = new Glob("**/*.md");
  const indexed: IndexedDoc[] = [];

  for await (const rel of glob.scan({ cwd: mdRoot })) {
    const abs = join(mdRoot, rel);
    const source = await readFile(abs, "utf8");
    const { frontmatter, body } = parseMd(source);
    const kind = inferKind(relative(mdRoot, abs));
    if (!kind) continue;
    const slug = slugFromPath(kind, relative(mdRoot, abs));
    const embedding = await embed(body);
    const s = await stat(abs);
    const mtimeIso = s.mtime.toISOString();
    const record = {
      path: rel,
      kind,
      frontmatter,
      body,
      embedding: Array.from(embedding),
      mtime: new DateTime(s.mtime),
    };
    await options.db.query(`UPSERT type::record($tb, $id) CONTENT $data`, {
      tb: kind,
      id: slug,
      data: record,
    });
    indexed.push({
      id: { tb: kind, id: slug },
      path: rel,
      kind,
      frontmatter,
      body,
      mtime: mtimeIso,
      hash: sha256(body),
    });
  }

  return indexed;
}

/**
 * Upsert a single .md file (used by tests that want deterministic control).
 */
export async function indexOne(
  db: Surreal,
  mdDir: string,
  relPath: string,
): Promise<IndexedDoc | null> {
  const abs = join(mdDir, relPath);
  const source = await readFile(abs, "utf8");
  const { frontmatter, body } = parseMd(source);
  const kind = inferKind(relPath);
  if (!kind) return null;
  const slug = slugFromPath(kind, relPath);
  const embedding = await embed(body);
  const s = await stat(abs);
  const mtimeIso = s.mtime.toISOString();
  const record = {
    path: relPath,
    kind,
    frontmatter,
    body,
    embedding: Array.from(embedding),
    mtime: new DateTime(s.mtime),
  };
  await db.query(`UPSERT type::record($tb, $id) CONTENT $data`, {
    tb: kind,
    id: slug,
    data: record,
  });
  return {
    id: { tb: kind, id: slug },
    path: relPath,
    kind,
    frontmatter,
    body,
    mtime: mtimeIso,
    hash: sha256(body),
  };
}

/**
 * Delete a record that no longer has a backing .md file.
 */
export async function deleteOne(db: Surreal, relPath: string): Promise<void> {
  const kind = inferKind(relPath);
  if (!kind) return;
  const slug = slugFromPath(kind, relPath);
  await db.query(`DELETE type::record($tb, $id)`, { tb: kind, id: slug });
}
