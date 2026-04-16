import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryStore } from "../../src/agent/memory-inmemory";

describe("InMemoryStore", () => {
  let store: InMemoryStore;

  beforeEach(() => {
    store = new InMemoryStore();
  });

  describe("save", () => {
    it("saves a memory", async () => {
      await store.save("SPEAKER_0", "Alex loves dinosaurs");
      const all = store.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]?.speaker).toBe("SPEAKER_0");
      expect(all[0]?.content).toBe("Alex loves dinosaurs");
    });

    it("saves multiple memories", async () => {
      await store.save("SPEAKER_0", "Alex loves dinosaurs");
      await store.save("SPEAKER_1", "Liam likes trucks");
      expect(store.getAll()).toHaveLength(2);
    });

    it("saves memory with timestamp", async () => {
      await store.save("SPEAKER_0", "test");
      const all = store.getAll();
      expect(all[0]?.timestamp).toBeGreaterThan(0);
    });
  });

  describe("recall", () => {
    beforeEach(async () => {
      await store.save("SPEAKER_0", "Alex loves dinosaurs");
      await store.save("SPEAKER_0", "Alex is 6 years old");
      await store.save("SPEAKER_1", "Liam likes trucks and dinosaurs");
      await store.save("SPEAKER_1", "Liam is shy");
    });

    it("finds memories matching query", async () => {
      const results = await store.recall("dinosaurs");
      expect(results).toHaveLength(2);
      expect(results).toContain("Alex loves dinosaurs");
      expect(results).toContain("Liam likes trucks and dinosaurs");
    });

    it("filters by speaker", async () => {
      const results = await store.recall("dinosaurs", "SPEAKER_0");
      expect(results).toHaveLength(1);
      expect(results).toContain("Alex loves dinosaurs");
    });

    it("returns empty array when no matches", async () => {
      const results = await store.recall("pirates");
      expect(results).toHaveLength(0);
    });

    it("is case-insensitive", async () => {
      const results = await store.recall("DINOSAURS");
      expect(results).toHaveLength(2);
    });

    it("returns empty array for unknown speaker", async () => {
      const results = await store.recall("dinosaurs", "SPEAKER_99");
      expect(results).toHaveLength(0);
    });

    it("returns all memories without speaker filter", async () => {
      const results = await store.recall("is");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getSpeakerContext", () => {
    it("returns empty string when no memories", async () => {
      const context = await store.getSpeakerContext("device-001");
      expect(context).toBe("");
    });

    it("returns formatted memories grouped by speaker", async () => {
      await store.save("SPEAKER_0", "Alex loves dinosaurs");
      await store.save("SPEAKER_1", "Liam likes trucks");
      const context = await store.getSpeakerContext("device-001");
      expect(context).toContain("## Memories");
      expect(context).toContain("[SPEAKER_0] Alex loves dinosaurs");
      expect(context).toContain("[SPEAKER_1] Liam likes trucks");
    });

    it("handles memories with empty speaker as general", async () => {
      await store.save("", "Group played pirates today");
      const context = await store.getSpeakerContext("device-001");
      expect(context).toContain("[general] Group played pirates today");
    });
  });

  describe("clear", () => {
    it("removes all memories", async () => {
      await store.save("SPEAKER_0", "test memory");
      expect(store.getAll()).toHaveLength(1);
      store.clear();
      expect(store.getAll()).toHaveLength(0);
    });
  });
});
