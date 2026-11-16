import { tool } from "ai";
import { RecordId } from "surrealdb";
import { z } from "zod";
import type { AuditLog } from "../store/audit";
import type { MdStore } from "../store/store";
import { PERSON_PERSON_EDGES } from "../store/types";

export interface ParentToolOptions {
  store: MdStore;
  audit?: AuditLog;
  sessionId?: string;
}

function wrap<Args, Output>(
  name: string,
  opts: ParentToolOptions,
  fn: (args: Args) => Promise<Output>,
): (args: Args) => Promise<Output> {
  return async (args: Args) => {
    const t0 = performance.now();
    try {
      const out = await fn(args);
      opts.audit?.append({
        agent: "ness",
        kind: "tool_call",
        tool: name,
        session_id: opts.sessionId,
        input: args as unknown,
        output: out as unknown,
        latency_ms: Math.round(performance.now() - t0),
      });
      return out;
    } catch (err) {
      opts.audit?.append({
        agent: "ness",
        kind: "error",
        tool: name,
        session_id: opts.sessionId,
        input: args as unknown,
        output: { error: (err as Error).message },
        latency_ms: Math.round(performance.now() - t0),
      });
      throw err;
    }
  };
}

/**
 * Tool surface for Ness. Reads/writes every entity kind via MdStore and
 * the audit log. Parents drive this via chat in the parent tab.
 */
export function buildParentTools(opts: ParentToolOptions): Record<string, unknown> {
  const store = opts.store;

  return {
    // --- Instructions ---
    get_routine: tool({
      description: "Read the current routine.md body.",
      inputSchema: z.object({}),
      execute: wrap("get_routine", opts, async () => {
        const doc = await store.read("routine", "routine");
        return { body: doc?.body ?? "" };
      }),
    }),
    set_routine: tool({
      description: "Replace the routine.md body wholesale.",
      inputSchema: z.object({ body: z.string() }),
      execute: wrap("set_routine", opts, async ({ body }) => {
        await store.write("routine.md", { updated: new Date().toISOString() }, body);
        return { ok: true };
      }),
    }),

    get_constraints: tool({
      description: "Read the current constraints.md body (bulleted parent notes).",
      inputSchema: z.object({}),
      execute: wrap("get_constraints", opts, async () => {
        const doc = await store.read("constraint", "constraints");
        return { body: doc?.body ?? "" };
      }),
    }),
    add_constraint: tool({
      description: "Append a single bullet to constraints.md.",
      inputSchema: z.object({ line: z.string() }),
      execute: wrap("add_constraint", opts, async ({ line }) => {
        const doc = await store.read("constraint", "constraints");
        const existing = doc?.body.trimEnd() ?? "";
        const bullet = line.startsWith("-") ? line : `- ${line}`;
        const body = existing ? `${existing}\n${bullet}` : bullet;
        await store.write("constraints.md", { updated: new Date().toISOString() }, body);
        return { ok: true };
      }),
    }),
    remove_constraint: tool({
      description:
        "Remove the first bullet in constraints.md whose text contains the given substring.",
      inputSchema: z.object({ match: z.string() }),
      execute: wrap("remove_constraint", opts, async ({ match }) => {
        const doc = await store.read("constraint", "constraints");
        if (!doc) return { removed: false };
        const lines = doc.body.split("\n");
        const idx = lines.findIndex(
          (l) => l.trim().startsWith("-") && l.toLowerCase().includes(match.toLowerCase()),
        );
        if (idx < 0) return { removed: false };
        lines.splice(idx, 1);
        await store.write(
          "constraints.md",
          { updated: new Date().toISOString() },
          lines.join("\n"),
        );
        return { removed: true, line: lines[idx] ?? "" };
      }),
    }),
    set_constraints: tool({
      description: "Replace the constraints.md body wholesale.",
      inputSchema: z.object({ body: z.string() }),
      execute: wrap("set_constraints", opts, async ({ body }) => {
        await store.write("constraints.md", { updated: new Date().toISOString() }, body);
        return { ok: true };
      }),
    }),

    // --- Profiles ---
    list_profiles: tool({
      description: "List all child profiles.",
      inputSchema: z.object({}),
      execute: wrap("list_profiles", opts, async () => {
        const rows = await store.list("profile");
        return {
          profiles: rows.map((r) => ({
            speaker: r.slug,
            name: r.frontmatter.name,
            age: r.frontmatter.age,
            pronouns: r.frontmatter.pronouns,
            notes: r.body,
          })),
        };
      }),
    }),
    upsert_profile: tool({
      description: "Create or update a child profile.",
      inputSchema: z.object({
        speaker: z.string().describe("e.g. SPEAKER_0"),
        name: z.string(),
        age: z.number().int().nonnegative(),
        pronouns: z.string().optional(),
        notes: z.string().optional(),
      }),
      execute: wrap("upsert_profile", opts, async ({ speaker, name, age, pronouns, notes }) => {
        await store.write(
          `profile/${speaker}.md`,
          { speaker, name, age, ...(pronouns ? { pronouns } : {}) },
          notes ?? "",
        );
        return { ok: true };
      }),
    }),

    // --- Persons ---
    list_persons: tool({
      description: "List persons, optionally filtered by relation.",
      inputSchema: z.object({
        relation: z.string().optional(),
      }),
      execute: wrap("list_persons", opts, async ({ relation }) => {
        const filter = relation ? { frontmatter: { relation } } : undefined;
        const rows = await store.list("person", filter);
        return {
          persons: rows.map((r) => ({
            slug: r.slug,
            name: r.frontmatter.name,
            relation: r.frontmatter.relation,
            aliases: r.frontmatter.aliases,
          })),
        };
      }),
    }),
    upsert_person: tool({
      description: "Create or update a person record.",
      inputSchema: z.object({
        slug: z.string(),
        name: z.string(),
        relation: z.string().optional(),
        aliases: z.array(z.string()).optional(),
        notes: z.string().optional(),
      }),
      execute: wrap("upsert_person", opts, async ({ slug, name, relation, aliases, notes }) => {
        const existing = await store.read("person", slug);
        await store.write(
          `person/${slug}.md`,
          {
            ...(existing?.frontmatter ?? {}),
            slug,
            name,
            ...(relation ? { relation } : {}),
            ...(aliases ? { aliases } : {}),
          },
          notes ?? existing?.body ?? "",
        );
        return { ok: true, created: !existing };
      }),
    }),
    delete_person: tool({
      description: "Remove a person record.",
      inputSchema: z.object({ slug: z.string() }),
      execute: wrap("delete_person", opts, async ({ slug }) => {
        await store.delete(`person/${slug}.md`);
        return { ok: true };
      }),
    }),
    who_is: tool({
      description: "Resolve a name or alias to zero or more person slugs.",
      inputSchema: z.object({ name_or_alias: z.string() }),
      execute: wrap("who_is", opts, async ({ name_or_alias }) => ({
        slugs: await store.whoIs(name_or_alias),
      })),
    }),

    relate_persons: tool({
      description:
        "Record a directional relationship between two persons (sibling_of, parent_of, spouse_of, friend_of, classmate_of). Example: grandma-dana parent_of mom-erin means Dana is Erin's parent.",
      inputSchema: z.object({
        from: z.string().describe("slug of the subject"),
        edge: z.enum(PERSON_PERSON_EDGES),
        to: z.string().describe("slug of the object"),
      }),
      execute: wrap("relate_persons", opts, async ({ from, edge, to }) => {
        await store.relatePersons(new RecordId("person", from), edge, new RecordId("person", to));
        return { ok: true };
      }),
    }),

    unrelate_persons: tool({
      description: "Remove a previously-recorded relationship between two persons.",
      inputSchema: z.object({
        from: z.string(),
        edge: z.enum(PERSON_PERSON_EDGES),
        to: z.string(),
      }),
      execute: wrap("unrelate_persons", opts, async ({ from, edge, to }) => {
        await store.unrelatePersons(new RecordId("person", from), edge, new RecordId("person", to));
        return { ok: true };
      }),
    }),

    get_person: tool({
      description: "Read a single person's profile plus every recorded relationship touching them.",
      inputSchema: z.object({ slug: z.string() }),
      execute: wrap("get_person", opts, async ({ slug }) => {
        const doc = await store.read("person", slug);
        if (!doc) return { found: false as const };
        const relations = await store.getPersonRelations(slug);
        return {
          found: true as const,
          slug,
          name: doc.frontmatter.name,
          relation: doc.frontmatter.relation,
          aliases: doc.frontmatter.aliases ?? [],
          notes: doc.body,
          relations,
        };
      }),
    }),

    // --- Events ---
    list_events: tool({
      description: "List events in a date range, optionally filtered by status.",
      inputSchema: z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        status: z.enum(["past", "scheduled", "cancelled"]).optional(),
      }),
      execute: wrap("list_events", opts, async ({ from, to, status }) => {
        const rows = await store.listEvents({ from, to, status });
        return {
          events: rows.map((r) => ({
            slug: r.slug,
            date: r.frontmatter.date,
            title: r.frontmatter.title,
            status: r.frontmatter.status,
            body: r.body,
          })),
        };
      }),
    }),
    upsert_event: tool({
      description: "Create or update a calendar event.",
      inputSchema: z.object({
        id: z.string(),
        date: z.string().describe("YYYY-MM-DD"),
        title: z.string(),
        status: z.enum(["past", "scheduled", "cancelled"]).default("scheduled"),
        body: z.string().optional(),
      }),
      execute: wrap("upsert_event", opts, async ({ id, date, title, status, body }) => {
        await store.write(`event/${date}-${id}.md`, { id, date, title, status }, body ?? "");
        return { ok: true };
      }),
    }),

    // --- Memories ---
    add_memory: tool({
      description: "Record a short fact about a person or speaker.",
      inputSchema: z.object({
        subject: z.string().describe("persons/<slug> or speakers/<id>"),
        content: z.string(),
        tags: z.array(z.string()).optional(),
      }),
      execute: wrap("add_memory", opts, async ({ subject, content, tags }) => {
        const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await store.write(
          `memory/${id}.md`,
          {
            id,
            subject,
            tags: tags ?? [],
            created: new Date().toISOString().slice(0, 10),
            source: "ness",
          },
          content,
        );
        return { id };
      }),
    }),

    // --- Contacts ---
    recent_contacts: tool({
      description: "List persons whose last contact with a speaker is older than N days.",
      inputSchema: z.object({
        speaker: z.string(),
        older_than_days: z.number().int().positive().default(30),
      }),
      execute: wrap("recent_contacts", opts, async ({ speaker, older_than_days }) => {
        const persons = await store.recentContacts(
          new RecordId("person", speaker),
          older_than_days,
        );
        return { persons };
      }),
    }),

    // --- Runtime config ---
    get_runtime_config: tool({
      description:
        "Read the family's runtime config: location (label + lat/lon), timezone, default TTS voice and provider.",
      inputSchema: z.object({}),
      execute: wrap("get_runtime_config", opts, async () => ({
        config: await store.getRuntimeConfig(),
      })),
    }),
    update_runtime_config: tool({
      description:
        "Update the family's runtime config. Pass only the fields you want to change. Set a field to null to remove it. The location field accepts {label, lat?, lon?} — always capture at least the label (e.g. 'Springfield, Oregon') when the parent shares where the household is.",
      inputSchema: z.object({
        location: z
          .object({
            label: z.string().min(1),
            lat: z.number().optional(),
            lon: z.number().optional(),
          })
          .nullable()
          .optional(),
        timezone: z.string().nullable().optional(),
        default_voice: z.string().nullable().optional(),
        default_provider: z.enum(["elevenlabs", "chatterbox"]).nullable().optional(),
      }),
      execute: wrap("update_runtime_config", opts, async (patch) => ({
        // Runtime field values may be null to signal removal; cast is safe
        // because MdStore.updateRuntimeConfig handles null by deleting the key.
        config: await store.updateRuntimeConfig(
          patch as unknown as Parameters<typeof store.updateRuntimeConfig>[0],
        ),
      })),
    }),

    // --- Audit ---
    query_audit: tool({
      description: "Read audit log entries in a date range. Returns up to 200 records.",
      inputSchema: z.object({
        from: z.string().describe("YYYY-MM-DD"),
        to: z.string().describe("YYYY-MM-DD"),
        device_id: z.string().optional(),
        agent: z.enum(["nessie", "ness"]).optional(),
      }),
      execute: wrap("query_audit", opts, async ({ from, to, device_id, agent }) => {
        if (!opts.audit) return { records: [] };
        const filter: Parameters<typeof opts.audit.read>[0]["filter"] = {};
        if (device_id) filter.device_id = device_id;
        if (agent) filter.agent = agent;
        const records = await opts.audit.read({ fromDay: from, toDay: to, filter });
        return { records: records.slice(-200) };
      }),
    }),
  };
}
