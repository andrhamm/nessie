import { z } from "zod";
import type { ParentAgent } from "../agent/parent-agent";
import type { MdStore } from "../store/store";

export interface ParentRouteDeps {
  agent: ParentAgent;
  store: MdStore;
}

const ChatBodySchema = z.object({
  message: z.string().min(1),
  session_id: z.string().default("parent"),
});

/**
 * POST /v1/parent_chat — text/event-stream. One SSE event per Ness chunk
 * (text deltas + tool events + done).
 */
export async function handleParentChat(req: Request, deps: ParentRouteDeps): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const parsed = ChatBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation failed" }, { status: 400 });
  }
  const { message, session_id } = parsed.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of deps.agent.respond(session_id, message)) {
          const payload = `data: ${JSON.stringify(chunk)}\n\n`;
          controller.enqueue(encoder.encode(payload));
          if (chunk.type === "done" || chunk.type === "error") break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

/**
 * GET /v1/parent_person?slug=<slug> — full profile + person↔person
 * relations for one person. Drives the parent UI's person detail drawer.
 */
export async function handleParentPerson(req: Request, deps: ParentRouteDeps): Promise<Response> {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  if (!slug) {
    return Response.json({ error: "slug query param required" }, { status: 400 });
  }
  const doc = await deps.store.read("person", slug);
  if (!doc) return Response.json({ error: "not found" }, { status: 404 });
  const relations = await deps.store.getPersonRelations(slug);
  return Response.json({
    slug,
    name: doc.frontmatter.name ?? slug,
    relation: doc.frontmatter.relation ?? null,
    aliases: doc.frontmatter.aliases ?? [],
    notes: doc.body,
    relations,
  });
}

/**
 * GET /v1/parent_state — JSON snapshot of everything the sidebar renders.
 */
export async function handleParentState(deps: ParentRouteDeps): Promise<Response> {
  const store = deps.store;
  const today = new Date().toISOString().slice(0, 10);
  const twoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const [routine, constraints, profiles, persons, upcoming, runtimeConfig] = await Promise.all([
    store.read("routine", "routine"),
    store.read("constraint", "constraints"),
    store.list("profile"),
    store.list("person"),
    store.listEvents({ from: today, to: twoWeeks, status: "scheduled" }),
    store.getRuntimeConfig(),
  ]);

  return Response.json({
    routine: routine?.body ?? "",
    constraints: constraints?.body ?? "",
    profiles: profiles.map((p) => ({
      speaker: p.slug,
      name: p.frontmatter.name,
      age: p.frontmatter.age,
      notes: p.body,
    })),
    persons: persons.map((p) => ({
      slug: p.slug,
      name: p.frontmatter.name,
      relation: p.frontmatter.relation,
    })),
    upcoming_events: upcoming.slice(0, 5).map((e) => ({
      slug: e.slug,
      date: e.frontmatter.date,
      title: e.frontmatter.title,
    })),
    runtime_config: runtimeConfig,
  });
}
