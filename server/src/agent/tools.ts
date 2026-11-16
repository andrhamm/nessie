import { tool } from "ai";
import { DateTime, RecordId } from "surrealdb";
import { z } from "zod";
import type { WeatherLocation, WeatherService } from "../services/weather";
import type { AuditLog } from "../store/audit";
import type { MdStore } from "../store/store";
import type { EntityKind } from "../store/types";

export interface BuildToolsOptions {
  store: MdStore;
  weather?: WeatherService;
  weatherLocation?: WeatherLocation;
  audit?: AuditLog;
  /** Propagated onto audit records. */
  deviceId?: string;
  speakerId?: string;
  /** Starting performance.now() from the agent turn; used for elapsed_ms. */
  turnStart: number;
}

function auditWrap<Args, Output>(
  name: string,
  opts: BuildToolsOptions,
  fn: (args: Args) => Promise<Output>,
): (args: Args) => Promise<Output> {
  return async (args: Args) => {
    const t0 = performance.now();
    try {
      const result = await fn(args);
      opts.audit?.append({
        agent: "nessie",
        kind: "tool_call",
        tool: name,
        device_id: opts.deviceId,
        speaker: opts.speakerId,
        input: args as unknown,
        output: result as unknown,
        latency_ms: Math.round(performance.now() - t0),
      });
      return result;
    } catch (err) {
      opts.audit?.append({
        agent: "nessie",
        kind: "error",
        tool: name,
        device_id: opts.deviceId,
        speaker: opts.speakerId,
        input: args as unknown,
        output: { error: (err as Error).message },
        latency_ms: Math.round(performance.now() - t0),
      });
      throw err;
    }
  };
}

/**
 * Tool map passed to `streamText({ tools })`. Each tool is audited and
 * reads/writes the markdown store. Returns only the tools — the calling
 * agent is responsible for merging these with its own (e.g. `recall_memory`).
 */
export function buildEntityTools(opts: BuildToolsOptions): Record<string, unknown> {
  const store = opts.store;

  return {
    who_is: tool({
      description:
        "Resolve a name or alias you heard to one or more person slugs. Returns empty array when the name is new.",
      inputSchema: z.object({
        name_or_alias: z.string(),
      }),
      execute: auditWrap("who_is", opts, async ({ name_or_alias }) => ({
        slugs: await store.whoIs(name_or_alias),
      })),
    }),

    lookup_persons: tool({
      description:
        "Resolve a batch of names (e.g. everyone the child just mentioned) to full computed profiles — frontmatter, graph relations, and recent memories — in one call. Use this BEFORE asking the child about anyone; only ask if the match list is empty or ambiguous and you genuinely need more info.",
      inputSchema: z.object({
        names: z.array(z.string()).min(1),
        memory_limit: z.number().int().positive().max(10).default(3),
      }),
      execute: auditWrap("lookup_persons", opts, async ({ names, memory_limit }) => ({
        results: await store.lookupPersons(names, { memoryLimit: memory_limit }),
      })),
    }),

    record_mentions: tool({
      description:
        "When a child brings up names in play (e.g. 'Quinn and Tessa are in my class'), log the mentions as graph edges. For each name: if one person matches, link the mentioner→that person with a `mentions` edge and the play context; if none, seed a tentative stub profile from the context; if multiple match, the ambiguous list is returned so you can resolve or skip. Use this instead of asking 'who is Tessa?' during play — the graph grows on its own, and next time the same name comes up you'll already have a thread to pull.",
      inputSchema: z.object({
        mentioned_by: z
          .string()
          .describe("Slug of the person doing the mentioning (usually the speaker's slug)."),
        names: z.array(z.string()).min(1),
        date: z.string().optional(),
        session: z.string().optional().describe("e.g. play_session, bedtime_chat, school_story"),
        snippet: z.string().optional(),
        mentioned_by_label: z.string().optional(),
      }),
      execute: auditWrap(
        "record_mentions",
        opts,
        async ({ mentioned_by, names, date, session, snippet, mentioned_by_label }) => {
          return await store.recordMentions(new RecordId("person", mentioned_by), names, {
            date: date ? new Date(date) : undefined,
            session,
            snippet,
            mentioned_by_label,
          });
        },
      ),
    }),

    upsert_person: tool({
      description:
        "Create or update a person record from conversation. Use for new names you hear, with the best-guess relation.",
      inputSchema: z.object({
        slug: z.string().describe("Stable id, e.g. grandma-dana"),
        name: z.string(),
        relation: z.string().optional(),
        aliases: z.array(z.string()).optional(),
        note: z.string().optional().describe("One-line note about this person"),
      }),
      execute: auditWrap("upsert_person", opts, async ({ slug, name, relation, aliases, note }) => {
        const existing = await store.read("person", slug);
        const fm = {
          slug,
          name,
          ...(relation ? { relation } : {}),
          ...(aliases ? { aliases } : {}),
          ...(existing?.frontmatter ?? {}),
        };
        const body = note ?? existing?.body ?? "";
        await store.write(`person/${slug}.md`, fm, body);
        return { slug, created: !existing };
      }),
    }),

    add_memory: tool({
      description:
        "Record a short fact about a speaker or person. Content should be one sentence or short paragraph.",
      inputSchema: z.object({
        subject: z.string().describe("e.g. 'persons/grandma-dana' or 'speakers/SPEAKER_0'"),
        content: z.string(),
        tags: z.array(z.string()).optional(),
      }),
      execute: auditWrap("add_memory", opts, async ({ subject, content, tags }) => {
        const id = `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
        await store.write(
          `memory/${id}.md`,
          {
            id,
            subject,
            tags: tags ?? [],
            created: new Date().toISOString().slice(0, 10),
            source: "nessie",
          },
          content,
        );
        return { id };
      }),
    }),

    recent_contacts: tool({
      description:
        "List persons connected to a speaker whose last contact is older than the threshold. Use to suggest reconnection activities.",
      inputSchema: z.object({
        speaker: z.string().describe("speaker id, e.g. SPEAKER_0"),
        older_than_days: z.number().int().positive().default(30),
      }),
      execute: auditWrap("recent_contacts", opts, async ({ speaker, older_than_days }) => {
        const from = new RecordId("person", speaker);
        const rows = await store.recentContacts(from, older_than_days);
        return { persons: rows };
      }),
    }),

    note_contact_event: tool({
      description:
        "Mark that a speaker and a person had contact on a given date. Upserts the last_contacted edge.",
      inputSchema: z.object({
        speaker: z.string(),
        person_slug: z.string(),
        type: z
          .enum(["visit", "call", "video_call", "play_date", "text", "event", "mentioned_only"])
          .default("mentioned_only"),
        date: z.string().optional().describe("ISO date; defaults to today"),
      }),
      execute: auditWrap(
        "note_contact_event",
        opts,
        async ({ speaker, person_slug, type, date }) => {
          const when = date ? new Date(date) : new Date();
          await store.noteContactEvent(
            new RecordId("person", speaker),
            new RecordId("person", person_slug),
            when,
            { type },
          );
          return { ok: true, date: when.toISOString(), type };
        },
      ),
    }),

    search_knowledge: tool({
      description:
        "Semantic+keyword search across persons, memories, events, and journal entries. Returns the top hits.",
      inputSchema: z.object({
        query: z.string(),
        collections: z.array(z.enum(["person", "memory", "event", "journal"])).optional(),
        limit: z.number().int().positive().max(20).default(5),
      }),
      execute: auditWrap("search_knowledge", opts, async ({ query, collections, limit }) => {
        const hits = await store.search(query, {
          kinds: (collections ?? undefined) as EntityKind[] | undefined,
          limit,
        });
        return {
          hits: hits.map((h) => ({ kind: h.kind, slug: h.slug, body: h.body })),
        };
      }),
    }),

    get_upcoming_events: tool({
      description: "List scheduled events in the next N days.",
      inputSchema: z.object({ days_ahead: z.number().int().positive().default(7) }),
      execute: auditWrap("get_upcoming_events", opts, async ({ days_ahead }) => {
        const from = new Date().toISOString().slice(0, 10);
        const to = new Date(Date.now() + days_ahead * 86_400_000).toISOString().slice(0, 10);
        const events = await store.listEvents({ from, to, status: "scheduled" });
        return {
          events: events.map((e) => ({
            slug: e.slug,
            date: e.frontmatter.date,
            title: e.frontmatter.title,
            body: e.body,
          })),
        };
      }),
    }),

    search_events: tool({
      description: "Find past or scheduled events by free-text query.",
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().positive().max(20).default(5),
      }),
      execute: auditWrap("search_events", opts, async ({ query, limit }) => {
        const hits = await store.search(query, { kinds: ["event"], limit });
        return { events: hits.map((h) => ({ slug: h.slug, body: h.body })) };
      }),
    }),

    recall_journal: tool({
      description: "Recall past moments recorded in the journal, semantically matched.",
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().int().positive().max(20).default(5),
      }),
      execute: auditWrap("recall_journal", opts, async ({ query, limit }) => {
        const hits = await store.search(query, { kinds: ["journal"], limit });
        return { entries: hits.map((h) => ({ slug: h.slug, body: h.body })) };
      }),
    }),

    get_weather_detail: tool({
      description:
        "Full today+tomorrow hourly forecast. Use when the child asks about rain/snow/warmth later.",
      inputSchema: z.object({}),
      execute: auditWrap("get_weather_detail", opts, async () => {
        if (!opts.weather || !opts.weatherLocation) {
          return { available: false as const };
        }
        const detail = await opts.weather.detail(opts.weatherLocation);
        if (!detail) return { available: false as const };
        return { available: true as const, ...detail };
      }),
    }),
  };
}

// Re-export DateTime in case the agent needs to write datetime fields.
export { DateTime };
