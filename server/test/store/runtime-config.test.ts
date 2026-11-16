import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MdStore } from "../../src/store/store";

let store: MdStore;
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nessie-runtime-config-test-"));
  store = await MdStore.create({ dataDir });
});

afterAll(async () => {
  await store.close();
  await rm(dataDir, { recursive: true, force: true });
});

describe("MdStore runtime config", () => {
  it("seeds only the server timezone on fresh init — no other fields", async () => {
    const cfg = await store.getRuntimeConfig();
    expect(typeof cfg.timezone).toBe("string");
    expect(cfg.timezone?.length).toBeGreaterThan(0);
    expect(cfg.location).toBeUndefined();
    expect(cfg.default_voice).toBeUndefined();
    expect(cfg.default_provider).toBeUndefined();
  });

  it("persists location + timezone to config/runtime.md", async () => {
    const cfg = await store.updateRuntimeConfig({
      location: { label: "Springfield, Oregon" },
      timezone: "America/New_York",
    });
    expect(cfg.location?.label).toBe("Springfield, Oregon");
    expect(cfg.timezone).toBe("America/New_York");

    const fileText = await readFile(join(dataDir, "md", "config", "runtime.md"), "utf8");
    expect(fileText).toContain("Springfield, Oregon");
    expect(fileText).toContain("America/New_York");

    // Round-trip via a fresh read.
    const reloaded = await store.getRuntimeConfig();
    expect(reloaded.location?.label).toBe("Springfield, Oregon");
    expect(reloaded.timezone).toBe("America/New_York");
  });

  it("merges patches — unspecified fields are preserved", async () => {
    await store.updateRuntimeConfig({ default_voice: "Emily.wav" });
    const cfg = await store.getRuntimeConfig();
    expect(cfg.location?.label).toBe("Springfield, Oregon");
    expect(cfg.default_voice).toBe("Emily.wav");
  });

  it("null in a patch deletes the field", async () => {
    await store.updateRuntimeConfig({
      default_voice: null as unknown as undefined,
    });
    const cfg = await store.getRuntimeConfig();
    expect(cfg.default_voice).toBeUndefined();
    expect(cfg.location?.label).toBe("Springfield, Oregon");
  });
});
