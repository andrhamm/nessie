import { beforeEach, describe, expect, it } from "bun:test";
import { generateSpeechId, SpeechStore } from "../../src/speech/store";

describe("generateSpeechId", () => {
  it("produces string starting with sp_", () => {
    const id = generateSpeechId();
    expect(id.startsWith("sp_")).toBe(true);
  });

  it("produces 15-character IDs (sp_ + 12 hex)", () => {
    const id = generateSpeechId();
    expect(id.length).toBe(15);
  });

  it("produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateSpeechId()));
    expect(ids.size).toBe(100);
  });
});

describe("SpeechStore", () => {
  let store: SpeechStore;

  beforeEach(() => {
    store = new SpeechStore();
  });

  describe("create", () => {
    it("creates entry in transcribed status", () => {
      const state = store.create("web-001", "hello nessie", "SPEAKER_0");
      expect(state.id).toMatch(/^sp_[0-9a-f]{12}$/);
      expect(state.status).toBe("transcribed");
      expect(state.device_id).toBe("web-001");
      expect(state.input?.transcript).toBe("hello nessie");
      expect(state.input?.speaker).toBe("SPEAKER_0");
      expect(state.response).toBeNull();
      expect(state.response_audio).toBeNull();
      expect(state.error).toBeNull();
    });

    it("sets created_at to current time", () => {
      const before = Date.now();
      const state = store.create("web-001", "hello", "SPEAKER_0");
      const after = Date.now();
      expect(state.created_at).toBeGreaterThanOrEqual(before);
      expect(state.created_at).toBeLessThanOrEqual(after);
    });

    it("increments store size", () => {
      expect(store.size()).toBe(0);
      store.create("web-001", "hello", "SPEAKER_0");
      expect(store.size()).toBe(1);
      store.create("web-001", "world", "SPEAKER_0");
      expect(store.size()).toBe(2);
    });
  });

  describe("get", () => {
    it("returns entry by ID", () => {
      const created = store.create("web-001", "hello", "SPEAKER_0");
      const found = store.get(created.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it("returns undefined for unknown ID", () => {
      const found = store.get("sp_doesnotexist");
      expect(found).toBeUndefined();
    });
  });

  describe("setStatus", () => {
    it("updates status", () => {
      const state = store.create("web-001", "hello", "SPEAKER_0");
      store.setStatus(state.id, "responding");
      const found = store.get(state.id);
      expect(found?.status).toBe("responding");
    });

    it("does nothing for unknown ID", () => {
      store.setStatus("sp_doesnotexist", "responding");
      expect(store.size()).toBe(0);
    });
  });

  describe("setResponse", () => {
    it("sets response data, audio, and status to complete", () => {
      const state = store.create("web-001", "hello", "SPEAKER_0");
      const responseData = {
        speech_tagged: "[happy] Hi!",
        speech_plain: "Hi!",
        audio_url: `/v1/speech/${state.id}/response_audio`,
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      };
      const audio = new Uint8Array([1, 2, 3, 4]);
      store.setResponse(state.id, responseData, audio);

      const found = store.get(state.id);
      expect(found?.status).toBe("complete");
      expect(found?.response?.speech_tagged).toBe("[happy] Hi!");
      expect(found?.response_audio).toEqual(new Uint8Array([1, 2, 3, 4]));
    });

    it("does nothing for unknown ID", () => {
      store.setResponse(
        "sp_doesnotexist",
        {
          speech_tagged: "",
          speech_plain: "",
          audio_url: "",
          led_color: "",
          led_mode: "",
          memory_saved: "",
        },
        new Uint8Array(0),
      );
      expect(store.size()).toBe(0);
    });
  });

  describe("setError", () => {
    it("sets error and status", () => {
      const state = store.create("web-001", "hello", "SPEAKER_0");
      store.setError(state.id, "TTS failed");
      const found = store.get(state.id);
      expect(found?.status).toBe("error");
      expect(found?.error).toBe("TTS failed");
    });

    it("does nothing for unknown ID", () => {
      store.setError("sp_doesnotexist", "fail");
      expect(store.size()).toBe(0);
    });
  });

  describe("cleanup", () => {
    it("removes entries older than maxAge", () => {
      const s = new SpeechStore({ maxAgeMs: 100 });
      const state = s.create("web-001", "old message", "SPEAKER_0");

      // Manually age the entry by overwriting created_at via get()
      const entry = s.get(state.id);
      if (entry) {
        entry.created_at = Date.now() - 200;
      }

      const removed = s.cleanup();
      expect(removed).toBe(1);
      expect(s.size()).toBe(0);
    });

    it("keeps recent entries", () => {
      const s = new SpeechStore({ maxAgeMs: 60000 });
      s.create("web-001", "fresh message", "SPEAKER_0");
      const removed = s.cleanup();
      expect(removed).toBe(0);
      expect(s.size()).toBe(1);
    });

    it("returns count of removed entries", () => {
      const s = new SpeechStore({ maxAgeMs: 100 });
      const state1 = s.create("web-001", "msg1", "SPEAKER_0");
      const state2 = s.create("web-001", "msg2", "SPEAKER_0");

      // Age both entries via get()
      for (const id of [state1.id, state2.id]) {
        const entry = s.get(id);
        if (entry) {
          entry.created_at = Date.now() - 200;
        }
      }

      const removed = s.cleanup();
      expect(removed).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all entries", () => {
      store.create("web-001", "hello", "SPEAKER_0");
      store.create("web-001", "world", "SPEAKER_0");
      expect(store.size()).toBe(2);
      store.clear();
      expect(store.size()).toBe(0);
    });
  });
});
