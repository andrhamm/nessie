import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RecordId } from "surrealdb";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-relations-test-"));
  store = await MdStore.create({ dataDir });
  for (const [slug, name, relation] of [
    ["alex", "Alex", "self"],
    ["mom-erin", "Erin", "parent"],
    ["dad-owen", "Owen", "parent"],
    ["grandma-dana", "Dana", "grandparent"],
    ["grandpa-hank", "Hank", "grandparent"],
    ["grandma-maeve", "Maeve", "grandparent"],
  ] as const) {
    await store.write(`person/${slug}.md`, { slug, name, relation }, `${name}.`);
  }
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

function p(slug: string): RecordId {
  return new RecordId("person", slug);
}

describe("MdStore graph — person↔person relations", () => {
  it("relatePersons records directed edges", async () => {
    // maternal grandparents of alex
    await store.relatePersons(p("grandma-dana"), "parent_of", p("mom-erin"));
    await store.relatePersons(p("grandpa-hank"), "parent_of", p("mom-erin"));
    // paternal grandparent
    await store.relatePersons(p("grandma-maeve"), "parent_of", p("dad-owen"));
    await store.relatePersons(p("mom-erin"), "spouse_of", p("dad-owen"));

    const dana = await store.getPersonRelations("grandma-dana");
    expect(dana.outgoing.map((r) => ({ edge: r.edge, to: r.to }))).toEqual([
      { edge: "parent_of", to: "mom-erin" },
    ]);
    expect(dana.outgoing[0]?.name).toBe("Erin");
  });

  it("getPersonRelations surfaces both directions and includes display names", async () => {
    const erin = await store.getPersonRelations("mom-erin");
    const incomingSlugs = erin.incoming.map((r) => r.from).sort();
    expect(incomingSlugs).toEqual(["grandma-dana", "grandpa-hank"]);
    expect(erin.incoming[0]?.name).not.toBeNull();
    const outgoingSlugs = erin.outgoing.map((r) => r.to);
    expect(outgoingSlugs).toContain("dad-owen");
  });

  it("relatePersons is idempotent — duplicate calls do not double-count", async () => {
    await store.relatePersons(p("grandma-dana"), "parent_of", p("mom-erin"));
    const dana = await store.getPersonRelations("grandma-dana");
    expect(
      dana.outgoing.filter((r) => r.edge === "parent_of" && r.to === "mom-erin"),
    ).toHaveLength(1);
  });

  it("unrelatePersons removes only the matching edge", async () => {
    await store.unrelatePersons(p("grandma-dana"), "parent_of", p("mom-erin"));
    const dana = await store.getPersonRelations("grandma-dana");
    expect(dana.outgoing.filter((r) => r.to === "mom-erin")).toHaveLength(0);
    // Grandpa Hank's edge to Erin still present
    const hank = await store.getPersonRelations("grandpa-hank");
    expect(hank.outgoing.some((r) => r.to === "mom-erin")).toBe(true);
  });
});
