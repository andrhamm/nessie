import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DateTime, RecordId, type Surreal } from "surrealdb";
import { close, connect } from "./db";
import { configureEmbedCache, embed } from "./embed";
import { serializeMd } from "./frontmatter";
import { deleteOne, indexAll, indexOne } from "./indexer";
import type {
  Doc,
  EntityKind,
  EventRange,
  ListFilter,
  PersonPersonEdge,
  RuntimeConfig,
  SearchHit,
  SearchOptions,
} from "./types";
import { type MdWatcher, startWatcher } from "./watcher";

export interface MdStoreOptions {
  /** Root directory for all derived state (`<dataDir>/md` is canonical). */
  dataDir: string;
  /** Override the embedded surrealkv path. Defaults to `<dataDir>/.index/nessie.db`. */
  dbPath?: string;
  /** Override the transformers.js cache dir. Defaults to `<dataDir>/.index/models`. */
  modelCacheDir?: string;
}

/**
 * High-level wrapper over the embedded SurrealDB index. Owns a single
 * long-lived Surreal handle + an fs watcher on the markdown tree.
 */
export class MdStore {
  readonly mdDir: string;
  private readonly dbPath: string;
  private watcher: MdWatcher | null = null;

  constructor(
    private readonly db: Surreal,
    options: { mdDir: string; dbPath: string },
  ) {
    this.mdDir = options.mdDir;
    this.dbPath = options.dbPath;
  }

  static async create(options: MdStoreOptions): Promise<MdStore> {
    const dataDir = resolve(options.dataDir);
    const mdDir = join(dataDir, "md");
    const dbPath = options.dbPath ?? join(dataDir, ".index", "nessie.db");
    const modelDir = options.modelCacheDir ?? join(dataDir, ".index", "models");
    await mkdir(mdDir, { recursive: true });
    await mkdir(dirname(dbPath), { recursive: true });
    configureEmbedCache(modelDir);
    const db = await connect({ path: dbPath });
    const store = new MdStore(db, { mdDir, dbPath });
    // Seed the server's detected timezone so parents never have to tell Ness.
    // Only runs when runtime_config has no timezone yet (idempotent).
    await store.ensureDefaultTimezone();
    return store;
  }

  /** If `runtime_config.timezone` is unset, write the server's local TZ. */
  private async ensureDefaultTimezone(): Promise<void> {
    try {
      const cfg = await this.getRuntimeConfig();
      if (!cfg.timezone) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) await this.updateRuntimeConfig({ timezone: tz });
      }
    } catch {
      // Non-fatal — the store still works without a seeded TZ.
    }
  }

  /** Walk the md tree once and index everything. Idempotent. */
  async indexAll(): Promise<void> {
    await indexAll(this.db, this.mdDir);
  }

  /** Start the filesystem watcher. Call once after `indexAll()`. */
  startWatcher(): void {
    if (this.watcher) return;
    this.watcher = startWatcher({ db: this.db, mdDir: this.mdDir });
  }

  async close(): Promise<void> {
    this.watcher?.close();
    this.watcher = null;
    await close(this.db);
  }

  /** Raw DB handle. Prefer the typed helpers below; escape hatch for now. */
  get raw(): Surreal {
    return this.db;
  }

  // ---------- CRUD over .md files ----------

  /**
   * Write a canonical .md file to disk + index it immediately.
   */
  async write(relPath: string, frontmatter: Record<string, unknown>, body: string): Promise<void> {
    const abs = join(this.mdDir, relPath);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, serializeMd({ frontmatter, body }), "utf8");
    await indexOne(this.db, this.mdDir, relPath);
  }

  /**
   * Remove the .md file + drop the derived row.
   */
  async delete(relPath: string): Promise<void> {
    const abs = join(this.mdDir, relPath);
    await rm(abs, { force: true });
    await deleteOne(this.db, relPath);
  }

  async read(kind: EntityKind, slug: string): Promise<Doc | null> {
    const [rows] = await this.db.query<[Array<Record<string, unknown>>]>(
      "SELECT path, frontmatter, body, mtime FROM type::record($tb, $id)",
      { tb: kind, id: slug },
    );
    const row = rows?.[0];
    if (!row) return null;
    return {
      kind,
      slug,
      path: String(row.path),
      frontmatter: (row.frontmatter as Record<string, unknown>) ?? {},
      body: String(row.body ?? ""),
      mtime: row.mtime instanceof DateTime ? row.mtime.toString() : String(row.mtime ?? ""),
    };
  }

  async list(kind: EntityKind, filter?: ListFilter): Promise<Doc[]> {
    const conditions: string[] = [];
    const bindings: Record<string, unknown> = {};
    if (filter?.frontmatter) {
      let idx = 0;
      for (const [key, value] of Object.entries(filter.frontmatter)) {
        const param = `fm_${idx++}`;
        conditions.push(`frontmatter.${key} = $${param}`);
        bindings[param] = value;
      }
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter?.limit ? ` LIMIT ${filter.limit}` : "";
    const [rows] = await this.db.query<
      [
        Array<{
          slug: string;
          path: string;
          frontmatter: Record<string, unknown>;
          body: string;
          mtime: unknown;
        }>,
      ]
    >(
      `SELECT meta::id(id) AS slug, path, frontmatter, body, mtime FROM ${kind}${where}${limit}`,
      bindings,
    );
    return (rows ?? []).map((r) => ({
      kind,
      slug: r.slug,
      path: r.path,
      frontmatter: r.frontmatter ?? {},
      body: r.body ?? "",
      mtime: r.mtime instanceof DateTime ? r.mtime.toString() : String(r.mtime ?? ""),
    }));
  }

  // ---------- Search ----------

  /**
   * Hybrid vector + BM25 search across one or more entity kinds. Defaults to
   * persons + memories + events + journal. Results are merged via
   * `search::rrf` per table and then interleaved by score.
   */
  async search(query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
    const kinds: EntityKind[] = opts.kinds ?? ["person", "memory", "event", "journal"];
    const limit = opts.limit ?? 10;
    const qvec = opts.lexicalOnly ? null : Array.from(await embed(query));

    const merged: SearchHit[] = [];
    for (const kind of kinds) {
      if (opts.lexicalOnly || !qvec) {
        const [rows] = await this.db.query<
          [Array<{ slug: string; path: string; body: string; score: number }>]
        >(
          `SELECT meta::id(id) AS slug, path, body, search::score(1) AS score
           FROM ${kind} WHERE body @1@ $q ORDER BY score DESC LIMIT $lim`,
          { q: query, lim: limit },
        );
        for (const r of rows ?? []) merged.push({ kind, ...r });
        continue;
      }
      // SurrealQL doesn't accept parameters inside `<|K,EF|>` — K must be a
      // literal. `limit` is always a number we control, so string-interpolate.
      const k = Math.max(1, Math.floor(limit));
      const results = await this.db.query<unknown[]>(
        `
        LET $vs = (SELECT id FROM ${kind} WHERE embedding <|${k},100|> $qvec);
        LET $ft = (SELECT id, search::score(1) AS score FROM ${kind}
                   WHERE body @1@ $q ORDER BY score DESC LIMIT ${k});
        RETURN search::rrf([$vs, $ft], ${k}, 60);
        `,
        { qvec, q: query },
      );
      const fused = (results[results.length - 1] ?? []) as Array<{
        id: { id: string } | string;
        rrf_score?: number;
      }>;
      for (const hit of fused) {
        const slug =
          typeof hit.id === "object" && hit.id !== null && "id" in hit.id
            ? String(hit.id.id)
            : (String(hit.id).split(":")[1]?.replace(/[⟨⟩`]/g, "") ?? "");
        if (!slug) continue;
        const [full] = await this.db.query<[Array<{ path: string; body: string }>]>(
          "SELECT path, body FROM type::record($tb, $id)",
          { tb: kind, id: slug },
        );
        const row = full?.[0];
        if (!row) continue;
        merged.push({
          kind,
          slug,
          path: row.path,
          body: row.body,
          score: hit.rrf_score,
        });
      }
    }
    merged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return merged.slice(0, limit);
  }

  // ---------- Persons / who_is ----------

  /**
   * Resolve a name or alias to person slugs. Returns an array so the caller
   * can handle ambiguity. Empty array means no match.
   */
  async whoIs(nameOrAlias: string): Promise<string[]> {
    const [rows] = await this.db.query<[Array<{ slug: string }>]>(
      `SELECT meta::id(id) AS slug FROM person
       WHERE frontmatter.name = $q
          OR frontmatter.aliases CONTAINS $q`,
      { q: nameOrAlias },
    );
    return (rows ?? []).map((r) => r.slug);
  }

  // ---------- Events / journal ----------

  async listEvents(range: EventRange = {}): Promise<Doc[]> {
    const clauses: string[] = [];
    const bindings: Record<string, unknown> = {};
    if (range.from) {
      clauses.push("frontmatter.date >= $from");
      bindings.from = range.from;
    }
    if (range.to) {
      clauses.push("frontmatter.date <= $to");
      bindings.to = range.to;
    }
    if (range.status) {
      clauses.push("frontmatter.status = $status");
      bindings.status = range.status;
    }
    const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await this.db.query<
      [
        Array<{
          slug: string;
          path: string;
          frontmatter: Record<string, unknown>;
          body: string;
          mtime: unknown;
          date: string;
        }>,
      ]
    >(
      `SELECT meta::id(id) AS slug, path, frontmatter, body, mtime, frontmatter.date AS date
       FROM event${where} ORDER BY date`,
      bindings,
    );
    return (rows ?? []).map((r) => ({
      kind: "event" as const,
      slug: r.slug,
      path: r.path,
      frontmatter: r.frontmatter ?? {},
      body: r.body ?? "",
      mtime: r.mtime instanceof DateTime ? r.mtime.toString() : String(r.mtime ?? ""),
    }));
  }

  // ---------- Runtime config ----------

  /**
   * Read the family's runtime config (location, timezone, default voice,
   * default provider). Empty object if no config file yet.
   */
  async getRuntimeConfig(): Promise<RuntimeConfig> {
    const doc = await this.read("runtime_config", "runtime");
    if (!doc) return {};
    const { updated: _updated, ...rest } = doc.frontmatter as Record<string, unknown>;
    return rest as RuntimeConfig;
  }

  /**
   * Merge `patch` into `config/runtime.md`'s frontmatter and bump `updated`.
   * Fields set to `null` are deleted.
   */
  async updateRuntimeConfig(patch: Partial<RuntimeConfig>): Promise<RuntimeConfig> {
    const current = await this.getRuntimeConfig();
    const merged: Record<string, unknown> = { ...current };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete merged[k];
      else merged[k] = v;
    }
    const frontmatter = { ...merged, updated: new Date().toISOString() };
    await this.write(
      "config/runtime.md",
      frontmatter,
      "Family runtime configuration (location, timezone, defaults). Managed by Ness.",
    );
    const { updated: _updated, ...rest } = frontmatter;
    return rest as RuntimeConfig;
  }

  // ---------- Lookup + mentions ----------

  /**
   * Resolve a batch of names to the full computed profile per match —
   * frontmatter, graph relations, and the top few memories whose subject
   * points at the person. Designed as a one-call replacement for the
   * "who_is + read + search_memories" chain agents would otherwise do.
   */
  async lookupPersons(
    names: string[],
    opts: { memoryLimit?: number } = {},
  ): Promise<
    Array<{
      query: string;
      matches: Array<{
        slug: string;
        name: string | null;
        relation: string | null;
        aliases: string[];
        notes: string;
        relations: Awaited<ReturnType<MdStore["getPersonRelations"]>>;
        memories: Array<{ id: string; body: string }>;
      }>;
    }>
  > {
    const memoryLimit = opts.memoryLimit ?? 3;
    const results = [] as Awaited<ReturnType<MdStore["lookupPersons"]>>;
    for (const name of names) {
      const slugs = await this.whoIs(name);
      const matches = [] as (typeof results)[number]["matches"];
      for (const slug of slugs) {
        const doc = await this.read("person", slug);
        if (!doc) continue;
        const relations = await this.getPersonRelations(slug);
        const [memoryRows] = await this.db.query<[Array<{ id: string; body: string }>]>(
          `SELECT meta::id(id) AS id, body, mtime FROM memory
           WHERE frontmatter.subject = $subject ORDER BY mtime DESC LIMIT ${Math.max(1, Math.floor(memoryLimit))}`,
          { subject: `persons/${slug}` },
        );
        matches.push({
          slug,
          name: typeof doc.frontmatter.name === "string" ? doc.frontmatter.name : null,
          relation: typeof doc.frontmatter.relation === "string" ? doc.frontmatter.relation : null,
          aliases: Array.isArray(doc.frontmatter.aliases)
            ? (doc.frontmatter.aliases as string[])
            : [],
          notes: doc.body,
          relations,
          memories: memoryRows ?? [],
        });
      }
      results.push({ query: name, matches });
    }
    return results;
  }

  /**
   * Record that `mentionedBy` referenced the given `names` in some context.
   * Disambiguation policy:
   *  - exactly one match → create a `mentions` edge with the supplied context.
   *  - zero matches → stub a person record with the context as its initial
   *    notes ("Tentative — mentioned by Quinn in play_session on …"),
   *    then create the edge. The stub's slug is a sanitized version of
   *    the name plus, when provided, a hint drawn from the mentioner and
   *    session so duplicate real-world people don't collide.
   *  - multiple matches → do nothing; the returned `ambiguous` list lets
   *    the agent pick a candidate or invent a new slug.
   */
  async recordMentions(
    mentionedBy: RecordId,
    names: string[],
    context: {
      date?: Date;
      session?: string;
      snippet?: string;
      mentioned_by_label?: string;
    } = {},
  ): Promise<{
    resolved: Array<{ query: string; slug: string; created: boolean }>;
    ambiguous: Array<{ query: string; candidates: string[] }>;
  }> {
    const resolved: Array<{ query: string; slug: string; created: boolean }> = [];
    const ambiguous: Array<{ query: string; candidates: string[] }> = [];
    for (const rawName of names) {
      const name = rawName.trim();
      if (!name) continue;
      const candidates = await this.whoIs(name);
      if (candidates.length > 1) {
        ambiguous.push({ query: name, candidates });
        continue;
      }
      let slug: string;
      let created = false;
      if (candidates.length === 1) {
        slug = candidates[0] as string;
      } else {
        slug = await this.stubPerson(name, mentionedBy, context);
        created = true;
      }
      // NB: $session is a protected SurrealQL variable name; use $session_ctx.
      await this.db.query(
        `RELATE $from -> mentions -> $to
           SET date = $date,
               session = $session_ctx,
               snippet = $snippet,
               mentioned_by_label = $by`,
        {
          from: mentionedBy,
          to: new RecordId("person", slug),
          date: new DateTime(context.date ?? new Date()),
          session_ctx: context.session ?? null,
          snippet: context.snippet ?? null,
          by: context.mentioned_by_label ?? null,
        },
      );
      resolved.push({ query: name, slug, created });
    }
    return { resolved, ambiguous };
  }

  private async stubPerson(
    displayName: string,
    mentionedBy: RecordId,
    context: { date?: Date; session?: string; snippet?: string; mentioned_by_label?: string },
  ): Promise<string> {
    const base =
      displayName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "unknown";
    // Avoid collisions with real-world same-name people: append a short
    // disambiguator drawn from mentioner + session when present.
    const hintSource = [context.mentioned_by_label, context.session]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    let slug = base;
    if (await this.read("person", slug)) {
      slug = hintSource ? `${base}-${hintSource}` : `${base}-${Date.now().toString(36).slice(-4)}`;
    }
    const dateIso = (context.date ?? new Date()).toISOString().slice(0, 10);
    const notesParts = [
      `Tentative profile — first recorded ${dateIso}.`,
      context.mentioned_by_label ? `Mentioned by ${context.mentioned_by_label}.` : "",
      context.session ? `Context: ${context.session}.` : "",
      context.snippet ? `Heard: "${context.snippet}".` : "",
    ].filter(Boolean);
    await this.write(
      `person/${slug}.md`,
      { slug, name: displayName, tentative: true, first_seen: dateIso },
      notesParts.join(" "),
    );
    // Attach a mentioned_by edge for provenance.
    await this.db.query(`RELATE $from -> mentions -> $to SET role = 'stub_origin'`, {
      from: mentionedBy,
      to: new RecordId("person", slug),
    });
    return slug;
  }

  // ---------- Graph ----------

  /**
   * Create a person↔person edge (sibling_of, parent_of, spouse_of, etc.).
   * Duplicate edges with the same direction are avoided via a prior DELETE.
   */
  async relatePersons(from: RecordId, edge: PersonPersonEdge, to: RecordId): Promise<void> {
    await this.db.query(
      `DELETE ${edge} WHERE in = $from AND out = $to;
       RELATE $from -> ${edge} -> $to`,
      { from, to },
    );
  }

  async unrelatePersons(from: RecordId, edge: PersonPersonEdge, to: RecordId): Promise<void> {
    await this.db.query(`DELETE ${edge} WHERE in = $from AND out = $to`, { from, to });
  }

  /**
   * All person↔person relationships touching `slug`, grouped by edge type
   * and direction. Used by the parent UI's person detail view.
   */
  async getPersonRelations(slug: string): Promise<{
    outgoing: Array<{ edge: PersonPersonEdge; to: string; name: string | null }>;
    incoming: Array<{ edge: PersonPersonEdge; from: string; name: string | null }>;
  }> {
    const subject = new RecordId("person", slug);
    const edges: PersonPersonEdge[] = [
      "sibling_of",
      "parent_of",
      "spouse_of",
      "friend_of",
      "classmate_of",
    ];
    const outgoing: Array<{ edge: PersonPersonEdge; to: string; name: string | null }> = [];
    const incoming: Array<{ edge: PersonPersonEdge; from: string; name: string | null }> = [];

    for (const edge of edges) {
      const [outRows] = await this.db.query<[Array<{ slug: string; name: unknown }>]>(
        `SELECT meta::id(out) AS slug, out.frontmatter.name AS name
         FROM ${edge} WHERE in = $subject`,
        { subject },
      );
      for (const row of outRows ?? []) {
        outgoing.push({
          edge,
          to: row.slug,
          name: typeof row.name === "string" ? row.name : null,
        });
      }
      const [inRows] = await this.db.query<[Array<{ slug: string; name: unknown }>]>(
        `SELECT meta::id(in) AS slug, in.frontmatter.name AS name
         FROM ${edge} WHERE out = $subject`,
        { subject },
      );
      for (const row of inRows ?? []) {
        incoming.push({
          edge,
          from: row.slug,
          name: typeof row.name === "string" ? row.name : null,
        });
      }
    }
    return { outgoing, incoming };
  }

  /**
   * Record a `last_contacted` edge from a speaker to a person at a given
   * date. Upsert semantics: any existing edge with the same endpoints is
   * replaced.
   */
  async noteContactEvent(
    from: RecordId,
    to: RecordId,
    date: Date,
    extra: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.query(
      `DELETE last_contacted WHERE in = $from AND out = $to;
       RELATE $from -> last_contacted -> $to SET date = $date, meta = $extra`,
      { from, to, date: new DateTime(date), extra },
    );
  }

  /**
   * Persons connected to `from` where the last contact date is older than
   * `olderThanDays`. Used to surface "it's been a while" candidates.
   */
  async recentContacts(
    from: RecordId,
    olderThanDays: number,
  ): Promise<Array<{ slug: string; lastContact: string }>> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - olderThanDays);
    const [rows] = await this.db.query<[Array<{ slug: string; date: unknown }>]>(
      `SELECT meta::id(out) AS slug, date FROM last_contacted
       WHERE in = $from AND date < $thr`,
      { from, thr: new DateTime(threshold) },
    );
    return (rows ?? []).map((r) => ({
      slug: r.slug,
      lastContact: r.date instanceof DateTime ? r.date.toString() : String(r.date ?? ""),
    }));
  }
}
