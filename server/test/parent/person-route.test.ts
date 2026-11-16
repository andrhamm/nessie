import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordId } from "surrealdb";
import type { ParentAgent } from "../../src/agent/parent-agent";
import { handleParentPerson } from "../../src/parent/routes";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

const fakeAgent = {
  respond: async function* () {},
  endSession: () => undefined,
} as unknown as ParentAgent;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-person-route-test-"));
  store = await MdStore.create({ dataDir });
  await store.write(
    "person/grandma-dana.md",
    {
      slug: "grandma-dana",
      name: "Dana",
      relation: "grandparent",
      aliases: ["Nana"],
    },
    "Lives in Seattle.",
  );
  await store.write(
    "person/mom-erin.md",
    { slug: "mom-erin", name: "Erin", relation: "parent" },
    "",
  );
  await store.relatePersons(
    new RecordId("person", "grandma-dana"),
    "parent_of",
    new RecordId("person", "mom-erin"),
  );
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("GET /v1/parent_person", () => {
  it("returns the profile and relations for a known slug", async () => {
    const req = new Request("http://localhost/v1/parent_person?slug=grandma-dana");
    const res = await handleParentPerson(req, { agent: fakeAgent, store });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as {
      name: string;
      aliases: string[];
      notes: string;
      relations: { outgoing: Array<{ to: string; name: string }>; incoming: unknown[] };
    };
    expect(body.name).toBe("Dana");
    expect(body.aliases).toContain("Nana");
    expect(body.notes).toContain("Seattle");
    expect(body.relations.outgoing).toHaveLength(1);
    expect(body.relations.outgoing[0]?.to).toBe("mom-erin");
    expect(body.relations.outgoing[0]?.name).toBe("Erin");
  });

  it("returns 400 when slug is missing", async () => {
    const req = new Request("http://localhost/v1/parent_person");
    const res = await handleParentPerson(req, { agent: fakeAgent, store });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown slug", async () => {
    const req = new Request("http://localhost/v1/parent_person?slug=nobody");
    const res = await handleParentPerson(req, { agent: fakeAgent, store });
    expect(res.status).toBe(404);
  });
});
