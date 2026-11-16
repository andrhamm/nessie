import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParentAgent, ParentChunk } from "../../src/agent/parent-agent";
import { handleParentChat, handleParentState } from "../../src/parent/routes";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-parent-route-test-"));
  store = await MdStore.create({ dataDir });
  await store.write(
    "routine.md",
    { updated: "2026-04-18" },
    "School days: up at 7, dinner at 6, bed at 8.",
  );
  await store.write(
    "profile/SPEAKER_0.md",
    { speaker: "SPEAKER_0", name: "Alex", age: 6 },
    "loves dinosaurs",
  );
  await store.write(
    "person/grandma-dana.md",
    { slug: "grandma-dana", name: "Dana", relation: "grandparent" },
    "Lives in Seattle.",
  );
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

function makeMockAgent(chunks: ParentChunk[]): ParentAgent {
  return {
    respond: async function* () {
      for (const c of chunks) yield c;
    },
    endSession: () => undefined,
  } as unknown as ParentAgent;
}

describe("GET /v1/parent_state", () => {
  it("returns routine, profiles, persons, and upcoming events", async () => {
    const agent = makeMockAgent([]);
    const res = await handleParentState({ agent, store });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      routine: string;
      profiles: Array<{ name: string }>;
      persons: Array<{ name: string }>;
      upcoming_events: unknown[];
    };
    expect(body.routine).toContain("School days");
    expect(body.profiles.map((p) => p.name)).toContain("Alex");
    expect(body.persons.map((p) => p.name)).toContain("Dana");
    expect(Array.isArray(body.upcoming_events)).toBe(true);
  });
});

describe("POST /v1/parent_chat (SSE)", () => {
  it("streams text deltas and a done event", async () => {
    const agent = makeMockAgent([
      { type: "text", delta: "Noted. " },
      { type: "text", delta: "Saved." },
      { type: "done" },
    ]);
    const req = new Request("http://localhost/v1/parent_chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "add a constraint: no screens before school" }),
    });
    const res = await handleParentChat(req, { agent, store });
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const text = await res.text();
    expect(text).toContain('data: {"type":"text","delta":"Noted. "}');
    expect(text).toContain('data: {"type":"text","delta":"Saved."}');
    expect(text).toContain('data: {"type":"done"}');
  });

  it("returns 405 for GET", async () => {
    const agent = makeMockAgent([]);
    const req = new Request("http://localhost/v1/parent_chat", { method: "GET" });
    const res = await handleParentChat(req, { agent, store });
    expect(res.status).toBe(405);
  });

  it("returns 400 for invalid body", async () => {
    const agent = makeMockAgent([]);
    const req = new Request("http://localhost/v1/parent_chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ not: "valid" }),
    });
    const res = await handleParentChat(req, { agent, store });
    expect(res.status).toBe(400);
  });
});
