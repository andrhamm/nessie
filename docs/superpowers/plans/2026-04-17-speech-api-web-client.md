# Nessie Speech API + Web Client Implementation Plan

## Goal

Add HTTP speech endpoints and a browser-based voice client to the Nessie server. A user speaks into their mic, the browser transcribes via the Web Speech API, the server runs the NessieAgent and ElevenLabs TTS, and the browser plays back Nessie's voice. This is the first end-to-end voice conversation loop — no hardware required, just a browser tab.

## Architecture

```
Browser (Web Speech API STT)              Bun Server
┌──────────────────────────┐    ┌──────────────────────────────────┐
│  Mic → SpeechRecognition │    │  POST /v1/speech                 │
│  transcript ─────────────┼───>│    → SpeechStore.create()        │
│                          │    │    → async pipeline:             │
│  Poll GET /v1/speech/:id │    │        NessieAgent.respond()     │
│  until status=complete   │<───┤        ElevenLabs TTS            │
│                          │    │    → SpeechStore.update()        │
│  Play response audio     │    │                                  │
│  GET /v1/speech/:id/     │    │  GET /v1/speech/:id              │
│    response_audio   ─────┼───>│    → SpeechStore.get()           │
│                          │    │                                  │
│  Chat UI + LED indicator │    │  GET /v1/speech/:id/response_audio│
└──────────────────────────┘    │    → stored MP3 buffer           │
                                │                                  │
                                │  Static files: public/*          │
                                └──────────────────────────────────┘
```

**Key design decisions:**

1. **Browser-side STT** — Uses `webkitSpeechRecognition` / `SpeechRecognition` to transcribe speech locally. Avoids needing a Whisper pipeline for v1. Server receives text, not audio.
2. **Async pipeline with polling** — POST returns immediately with an ID. Client polls GET until `complete`. This keeps the server stateless per-request and lets us add SSE/WebSocket later without changing the data model.
3. **In-memory store** — Speech requests stored in a `Map<string, SpeechState>`. Good enough for single-server dev; later replaced by Redis or SQLite.
4. **ElevenLabs `textToSpeech.convert()`** — Returns a `stream.Readable` of MP3 data. We buffer it and store the `Uint8Array` in the speech state.

## Tech Stack

| Component | Version/Package |
|-----------|----------------|
| Runtime | Bun |
| Language | TypeScript (strict) |
| AI SDK | `ai@latest` |
| Anthropic provider | `@ai-sdk/anthropic@latest` |
| TTS | `elevenlabs@^1.59.0` |
| Schema validation | `zod@^4.3.6` (Zod v4) |
| Linting | `@biomejs/biome` 2.x |
| Testing | `bun test` |
| Web client | Vanilla HTML + CSS + JS (no framework) |

---

## Task 1: Config — Add ElevenLabs settings

### Goal
Add `ELEVENLABS_API_KEY` and `NESSIE_VOICE_ID` to the config schema so the TTS wrapper and pipeline can read them.

### Why
The TTS wrapper needs credentials and the voice ID. Config is the canonical place to parse environment variables.

### Files

**`src/config.ts`** (modify):

```typescript
import { z } from "zod";

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  NESSIE_VOICE_ID: z.string().min(1).default("emSmWzY0c0xtx5IFMCVv"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${formatted}`);
  }
  return result.data;
}

export const config = loadConfig();
```

**`test/config.test.ts`** (modify — add new tests to existing describe block):

```typescript
import { describe, expect, it } from "bun:test";
import { z } from "zod";

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  NESSIE_VOICE_ID: z.string().min(1).default("emSmWzY0c0xtx5IFMCVv"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

describe("ConfigSchema", () => {
  const validEnv = {
    ANTHROPIC_API_KEY: "sk-ant-test-key",
    ELEVENLABS_API_KEY: "el-test-key",
  };

  it("parses valid config with defaults", () => {
    const result = ConfigSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBe("sk-ant-test-key");
      expect(result.data.ELEVENLABS_API_KEY).toBe("el-test-key");
      expect(result.data.NESSIE_VOICE_ID).toBe("emSmWzY0c0xtx5IFMCVv");
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  it("rejects missing ANTHROPIC_API_KEY", () => {
    const { ANTHROPIC_API_KEY: _, ...rest } = validEnv;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing ELEVENLABS_API_KEY", () => {
    const { ELEVENLABS_API_KEY: _, ...rest } = validEnv;
    const result = ConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects empty ELEVENLABS_API_KEY", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, ELEVENLABS_API_KEY: "" });
    expect(result.success).toBe(false);
  });

  it("accepts custom NESSIE_VOICE_ID", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, NESSIE_VOICE_ID: "custom-voice-id" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NESSIE_VOICE_ID).toBe("custom-voice-id");
    }
  });

  it("rejects empty ANTHROPIC_API_KEY", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, ANTHROPIC_API_KEY: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid NODE_ENV", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, NODE_ENV: "staging" });
    expect(result.success).toBe(false);
  });

  it("accepts valid LOG_LEVEL", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, LOG_LEVEL: "debug" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe("debug");
    }
  });
});
```

**`test/setup.ts`** (modify — add ELEVENLABS env var):

```typescript
// Global test setup
// Set required env vars for tests so config.ts doesn't throw
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "sk-ant-test-key-for-tests";
process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY ?? "el-test-key-for-tests";
process.env.NODE_ENV = "test";
```

### Test
```bash
bun test test/config.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add ELEVENLABS_API_KEY and NESSIE_VOICE_ID to config

ElevenLabs TTS requires an API key and voice ID. NESSIE_VOICE_ID
defaults to emSmWzY0c0xtx5IFMCVv (the selected Nessie voice).
```

---

## Task 2: Speech types — SpeechState and request schemas

### Goal
Define the types and Zod schemas for the speech API: request body, response state machine, and the `SpeechState` data structure.

### Why
These types define the contract between the API endpoints, the store, and the processing pipeline. They need to be tested independently before anything uses them.

### Files

**`src/speech/types.ts`** (new):

```typescript
import { z } from "zod";

/**
 * Status state machine for a speech request:
 *   received → transcribed → responding → complete
 *                                       → error
 * For v1 (browser STT), we skip "received" and start at "transcribed"
 * since the transcript arrives with the POST body.
 */
export const SpeechStatusSchema = z.enum([
  "received",
  "transcribed",
  "responding",
  "complete",
  "error",
]);

export type SpeechStatus = z.infer<typeof SpeechStatusSchema>;

/**
 * POST /v1/speech request body.
 * For v1, the browser sends a text transcript (not audio).
 */
export const SpeechRequestSchema = z.object({
  device_id: z.string().min(1),
  transcript: z.string().min(1),
  speaker_name: z.string().default("Friend"),
  speaker_age: z.number().default(0),
});

export type SpeechRequest = z.infer<typeof SpeechRequestSchema>;

/**
 * Input data accumulated during processing.
 */
export interface SpeechInputData {
  transcript: string;
  speaker: string;
}

/**
 * Response data populated after agent + TTS complete.
 */
export interface SpeechResponseData {
  speech_tagged: string;
  speech_plain: string;
  audio_url: string;
  led_color: string;
  led_mode: string;
  memory_saved: string;
}

/**
 * Full state for a speech request, stored in memory.
 */
export interface SpeechState {
  id: string;
  status: SpeechStatus;
  device_id: string;
  created_at: number;
  input: SpeechInputData | null;
  response: SpeechResponseData | null;
  response_audio: Uint8Array | null;
  error: string | null;
}

/**
 * GET /v1/speech/:id response shape.
 * Only includes fields available at the current status.
 */
export interface SpeechApiResponse {
  id: string;
  status: SpeechStatus;
  input?: {
    transcript: string;
    speaker: string;
  };
  response?: {
    speech_tagged: string;
    speech_plain: string;
    audio_url: string;
    led_color: string;
    led_mode: string;
    memory_saved: string;
  };
  error?: string;
}

/**
 * Build the API response shape from internal state.
 * Only includes data that has been populated so far.
 */
export function toApiResponse(state: SpeechState): SpeechApiResponse {
  const res: SpeechApiResponse = {
    id: state.id,
    status: state.status,
  };

  if (state.input) {
    res.input = {
      transcript: state.input.transcript,
      speaker: state.input.speaker,
    };
  }

  if (state.response) {
    res.response = {
      speech_tagged: state.response.speech_tagged,
      speech_plain: state.response.speech_plain,
      audio_url: state.response.audio_url,
      led_color: state.response.led_color,
      led_mode: state.response.led_mode,
      memory_saved: state.response.memory_saved,
    };
  }

  if (state.error) {
    res.error = state.error;
  }

  return res;
}
```

**`test/speech/types.test.ts`** (new):

```typescript
import { describe, expect, it } from "bun:test";
import {
  type SpeechState,
  SpeechRequestSchema,
  SpeechStatusSchema,
  toApiResponse,
} from "../../src/speech/types";

describe("SpeechStatusSchema", () => {
  it("accepts valid statuses", () => {
    for (const status of ["received", "transcribed", "responding", "complete", "error"]) {
      const result = SpeechStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = SpeechStatusSchema.safeParse("pending");
    expect(result.success).toBe(false);
  });
});

describe("SpeechRequestSchema", () => {
  it("parses valid request with all fields", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
      transcript: "let's play pirates",
      speaker_name: "Alex",
      speaker_age: 6,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.device_id).toBe("web-001");
      expect(result.data.transcript).toBe("let's play pirates");
      expect(result.data.speaker_name).toBe("Alex");
      expect(result.data.speaker_age).toBe(6);
    }
  });

  it("applies defaults for speaker_name and speaker_age", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
      transcript: "hello nessie",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.speaker_name).toBe("Friend");
      expect(result.data.speaker_age).toBe(0);
    }
  });

  it("rejects missing device_id", () => {
    const result = SpeechRequestSchema.safeParse({
      transcript: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing transcript", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty device_id", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "",
      transcript: "hello",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty transcript", () => {
    const result = SpeechRequestSchema.safeParse({
      device_id: "web-001",
      transcript: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("toApiResponse", () => {
  const baseState: SpeechState = {
    id: "sp_test123",
    status: "received",
    device_id: "web-001",
    created_at: 1713264000000,
    input: null,
    response: null,
    response_audio: null,
    error: null,
  };

  it("returns minimal response for received status", () => {
    const res = toApiResponse(baseState);
    expect(res).toEqual({
      id: "sp_test123",
      status: "received",
    });
    expect(res.input).toBeUndefined();
    expect(res.response).toBeUndefined();
    expect(res.error).toBeUndefined();
  });

  it("includes input when available", () => {
    const state: SpeechState = {
      ...baseState,
      status: "transcribed",
      input: { transcript: "let's play pirates", speaker: "SPEAKER_0" },
    };
    const res = toApiResponse(state);
    expect(res.status).toBe("transcribed");
    expect(res.input).toEqual({
      transcript: "let's play pirates",
      speaker: "SPEAKER_0",
    });
    expect(res.response).toBeUndefined();
  });

  it("includes response when complete", () => {
    const state: SpeechState = {
      ...baseState,
      status: "complete",
      input: { transcript: "let's play pirates", speaker: "SPEAKER_0" },
      response: {
        speech_tagged: "[excited] Arr, Captain!",
        speech_plain: "Arr, Captain!",
        audio_url: "/v1/speech/sp_test123/response_audio",
        led_color: "#FFD700",
        led_mode: "pulse",
        memory_saved: "Likes pirates",
      },
      response_audio: new Uint8Array([1, 2, 3]),
    };
    const res = toApiResponse(state);
    expect(res.status).toBe("complete");
    expect(res.input).toBeDefined();
    expect(res.response).toBeDefined();
    expect(res.response?.speech_tagged).toBe("[excited] Arr, Captain!");
    expect(res.response?.audio_url).toBe("/v1/speech/sp_test123/response_audio");
  });

  it("does not include response_audio binary in API response", () => {
    const state: SpeechState = {
      ...baseState,
      status: "complete",
      input: { transcript: "hello", speaker: "SPEAKER_0" },
      response: {
        speech_tagged: "Hi!",
        speech_plain: "Hi!",
        audio_url: "/v1/speech/sp_test123/response_audio",
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      },
      response_audio: new Uint8Array([1, 2, 3]),
    };
    const res = toApiResponse(state);
    expect("response_audio" in res).toBe(false);
  });

  it("includes error when present", () => {
    const state: SpeechState = {
      ...baseState,
      status: "error",
      error: "Agent failed: rate limit exceeded",
    };
    const res = toApiResponse(state);
    expect(res.status).toBe("error");
    expect(res.error).toBe("Agent failed: rate limit exceeded");
    expect(res.input).toBeUndefined();
    expect(res.response).toBeUndefined();
  });
});
```

### Test
```bash
bun test test/speech/types.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add speech API types and Zod schemas

Define SpeechRequest, SpeechState, SpeechStatus state machine, and
toApiResponse helper. Status progresses: received → transcribed →
responding → complete (or → error).
```

---

## Task 3: Speech store — In-memory state management

### Goal
Implement an in-memory store for speech request state with create, get, update, and cleanup methods.

### Why
The POST endpoint creates entries, the pipeline updates them, and the GET endpoint reads them. This must work before routes or pipeline can be built.

### Files

**`src/speech/store.ts`** (new):

```typescript
import { randomBytes } from "node:crypto";
import type { SpeechResponseData, SpeechState, SpeechStatus } from "./types";

/**
 * Generate a unique speech request ID.
 * Format: sp_ + 12 hex characters.
 */
export function generateSpeechId(): string {
  return `sp_${randomBytes(6).toString("hex")}`;
}

/**
 * In-memory store for speech request state.
 * Entries are automatically cleaned up after maxAge (default 10 minutes).
 */
export class SpeechStore {
  private readonly entries = new Map<string, SpeechState>();
  private readonly maxAgeMs: number;

  constructor(options?: { maxAgeMs?: number }) {
    this.maxAgeMs = options?.maxAgeMs ?? 10 * 60 * 1000;
  }

  /**
   * Create a new speech request entry in "transcribed" state.
   * For v1, the transcript arrives with the POST body so we skip "received".
   */
  create(deviceId: string, transcript: string, speaker: string): SpeechState {
    const id = generateSpeechId();
    const state: SpeechState = {
      id,
      status: "transcribed",
      device_id: deviceId,
      created_at: Date.now(),
      input: { transcript, speaker },
      response: null,
      response_audio: null,
      error: null,
    };
    this.entries.set(id, state);
    return state;
  }

  /**
   * Get a speech request by ID. Returns undefined if not found.
   */
  get(id: string): SpeechState | undefined {
    return this.entries.get(id);
  }

  /**
   * Update the status of a speech request.
   */
  setStatus(id: string, status: SpeechStatus): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.status = status;
    }
  }

  /**
   * Set the response data and audio for a completed request.
   */
  setResponse(id: string, response: SpeechResponseData, audio: Uint8Array): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.response = response;
      entry.response_audio = audio;
      entry.status = "complete";
    }
  }

  /**
   * Set an error on a speech request.
   */
  setError(id: string, error: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.error = error;
      entry.status = "error";
    }
  }

  /**
   * Remove entries older than maxAgeMs.
   * Returns the number of entries removed.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (now - entry.created_at > this.maxAgeMs) {
        this.entries.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Visible for testing. Returns the current entry count.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Visible for testing. Clear all entries.
   */
  clear(): void {
    this.entries.clear();
  }
}
```

**`test/speech/store.test.ts`** (new):

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { SpeechStore, generateSpeechId } from "../../src/speech/store";

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
      store.setResponse("sp_doesnotexist", {
        speech_tagged: "",
        speech_plain: "",
        audio_url: "",
        led_color: "",
        led_mode: "",
        memory_saved: "",
      }, new Uint8Array(0));
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
      s.create("web-001", "old message", "SPEAKER_0");

      // Manually age the entry by overwriting created_at
      const entry = s.get(Array.from(s["entries"].keys())[0] ?? "");
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
      s.create("web-001", "msg1", "SPEAKER_0");
      s.create("web-001", "msg2", "SPEAKER_0");

      // Age both entries
      for (const entry of s["entries"].values()) {
        entry.created_at = Date.now() - 200;
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
```

### Test
```bash
bun test test/speech/store.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add SpeechStore for in-memory speech request state

Map-backed store with create/get/update/cleanup methods. Entries
auto-expire after 10 minutes. Generates sp_ prefixed IDs.
```

---

## Task 4: ElevenLabs TTS wrapper

### Goal
Implement a thin wrapper around the ElevenLabs SDK's `textToSpeech.convert()` method that takes speech text and returns a `Uint8Array` of MP3 audio.

### Why
The pipeline needs TTS as a function call. The wrapper isolates SDK details, handles stream-to-buffer conversion, and accepts a dependency-injected client for testing.

### Design notes

The ElevenLabs SDK's `textToSpeech.convert()` returns a `stream.Readable` (Node.js readable stream). We need to buffer it into a `Uint8Array`. The wrapper:

1. Takes tagged speech text (with `[excited]` etc. — ElevenLabs v3 model understands these)
2. Calls `client.textToSpeech.convert(voiceId, { text, model_id: "eleven_v3", output_format: "pcm_16000" })`
3. Collects the stream into a `Uint8Array`
4. Returns the buffer

The `output_format` parameter uses the `TextToSpeechConvertRequestOutputFormat` type from the SDK. We use `"pcm_16000"` for good quality at reasonable size.

### Files

**`src/tts/elevenlabs.ts`** (new):

```typescript
import type { Readable } from "node:stream";

/**
 * Minimal interface matching what we use from ElevenLabsClient.textToSpeech.
 * Allows dependency injection for testing.
 */
export interface TtsClient {
  textToSpeech: {
    convert(
      voiceId: string,
      request: { text: string; model_id: string; output_format: string },
    ): Promise<Readable>;
  };
}

/**
 * Configuration for the TTS wrapper.
 */
export interface TtsConfig {
  voiceId: string;
  modelId?: string;
  outputFormat?: string;
}

/**
 * Collect a Node.js Readable stream into a single Uint8Array.
 */
async function streamToBuffer(readable: Readable): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of readable) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk as ArrayBuffer));
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * Convert speech text to audio using ElevenLabs TTS.
 *
 * The text should include ElevenLabs v3 audio tags (e.g. [excited])
 * which the model uses for expressive speech synthesis.
 *
 * @param client - ElevenLabs client (or mock implementing TtsClient)
 * @param config - Voice ID and optional model/format overrides
 * @param text - Speech text with optional audio tags
 * @returns MP3 audio as Uint8Array
 */
export async function synthesize(
  client: TtsClient,
  config: TtsConfig,
  text: string,
): Promise<Uint8Array> {
  if (!text.trim()) {
    return new Uint8Array(0);
  }

  const stream = await client.textToSpeech.convert(config.voiceId, {
    text,
    model_id: config.modelId ?? "eleven_v3",
    output_format: config.outputFormat ?? "pcm_16000",
  });

  return streamToBuffer(stream);
}
```

**`test/tts/elevenlabs.test.ts`** (new):

```typescript
import { Readable } from "node:stream";
import { describe, expect, it } from "bun:test";
import { type TtsClient, type TtsConfig, synthesize } from "../../src/tts/elevenlabs";

function createMockClient(responseChunks: Uint8Array[]): TtsClient {
  return {
    textToSpeech: {
      convert: async (_voiceId: string, _request: { text: string; model_id: string; output_format: string }) => {
        return Readable.from(responseChunks);
      },
    },
  };
}

function createFailingClient(error: Error): TtsClient {
  return {
    textToSpeech: {
      convert: async () => {
        throw error;
      },
    },
  };
}

describe("synthesize", () => {
  const config: TtsConfig = {
    voiceId: "test-voice-id",
  };

  it("returns audio buffer from stream", async () => {
    const chunk1 = new Uint8Array([1, 2, 3]);
    const chunk2 = new Uint8Array([4, 5, 6]);
    const client = createMockClient([chunk1, chunk2]);

    const result = await synthesize(client, config, "[excited] Hello!");
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it("returns empty buffer for empty text", async () => {
    const client = createMockClient([new Uint8Array([1, 2, 3])]);
    const result = await synthesize(client, config, "");
    expect(result.length).toBe(0);
  });

  it("returns empty buffer for whitespace-only text", async () => {
    const client = createMockClient([new Uint8Array([1, 2, 3])]);
    const result = await synthesize(client, config, "   ");
    expect(result.length).toBe(0);
  });

  it("passes correct parameters to client", async () => {
    let capturedVoiceId = "";
    let capturedRequest: { text: string; model_id: string; output_format: string } | null = null;

    const client: TtsClient = {
      textToSpeech: {
        convert: async (voiceId, request) => {
          capturedVoiceId = voiceId;
          capturedRequest = request;
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };

    await synthesize(client, { voiceId: "my-voice" }, "[happy] Test text");
    expect(capturedVoiceId).toBe("my-voice");
    expect(capturedRequest?.text).toBe("[happy] Test text");
    expect(capturedRequest?.model_id).toBe("eleven_v3");
    expect(capturedRequest?.output_format).toBe("pcm_16000");
  });

  it("uses custom model_id and output_format when provided", async () => {
    let capturedRequest: { text: string; model_id: string; output_format: string } | null = null;

    const client: TtsClient = {
      textToSpeech: {
        convert: async (_voiceId, request) => {
          capturedRequest = request;
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };

    const customConfig: TtsConfig = {
      voiceId: "test",
      modelId: "eleven_turbo_v2",
      outputFormat: "mp3_22050_32",
    };

    await synthesize(client, customConfig, "Hello");
    expect(capturedRequest?.model_id).toBe("eleven_turbo_v2");
    expect(capturedRequest?.output_format).toBe("mp3_22050_32");
  });

  it("handles single-chunk streams", async () => {
    const client = createMockClient([new Uint8Array([10, 20, 30])]);
    const result = await synthesize(client, config, "Hello");
    expect(result).toEqual(new Uint8Array([10, 20, 30]));
  });

  it("handles empty stream", async () => {
    const client = createMockClient([]);
    const result = await synthesize(client, config, "Hello");
    expect(result.length).toBe(0);
  });

  it("propagates client errors", async () => {
    const client = createFailingClient(new Error("API rate limit"));
    await expect(synthesize(client, config, "Hello")).rejects.toThrow("API rate limit");
  });
});
```

### Test
```bash
bun test test/tts/elevenlabs.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add ElevenLabs TTS wrapper with stream-to-buffer

Thin wrapper around textToSpeech.convert() that returns Uint8Array.
Dependency-injectable TtsClient interface enables unit testing without
hitting the real API.
```

---

## Task 5: Speech pipeline — Async processing

### Goal
Implement the async processing pipeline that takes a speech request, runs NessieAgent, calls TTS, and updates the store at each stage.

### Why
This is the core business logic connecting the API layer to the agent and TTS. It must be testable with mocked dependencies.

### Files

**`src/speech/pipeline.ts`** (new):

```typescript
import type { NessieAgent } from "../agent/nessie-agent";
import type { AgentInput } from "../agent/schemas";
import type { TtsClient, TtsConfig } from "../tts/elevenlabs";
import { synthesize } from "../tts/elevenlabs";
import { stripTags } from "../utils/speech";
import type { SpeechStore } from "./store";

/**
 * Dependencies injected into the pipeline for testability.
 */
export interface PipelineDeps {
  agent: NessieAgent;
  ttsClient: TtsClient;
  ttsConfig: TtsConfig;
  store: SpeechStore;
}

/**
 * Run the speech processing pipeline for a given speech request ID.
 *
 * Pipeline stages:
 *   1. Read transcript from store (already in "transcribed" status)
 *   2. Set status to "responding"
 *   3. Call NessieAgent.respond() with the transcript
 *   4. Call ElevenLabs TTS with the agent's speech output
 *   5. Store response data + audio, set status to "complete"
 *
 * On error at any stage, sets status to "error" with the error message.
 */
export async function runPipeline(
  deps: PipelineDeps,
  speechId: string,
  speakerName: string,
  speakerAge: number,
): Promise<void> {
  const { agent, ttsClient, ttsConfig, store } = deps;

  const state = store.get(speechId);
  if (!state) {
    return;
  }

  if (!state.input) {
    store.setError(speechId, "No input data available");
    return;
  }

  try {
    // Stage 1: Mark as responding
    store.setStatus(speechId, "responding");

    // Stage 2: Build agent input and call the agent
    const agentInput: AgentInput = {
      device_id: state.device_id,
      speaker: {
        id: state.input.speaker,
        name: speakerName,
        age: speakerAge,
        preferences: [],
      },
      text: state.input.transcript,
      ambient: [],
      timestamp: Date.now(),
    };

    const agentOutput = await agent.respond(agentInput);

    // Stage 3: Generate TTS audio (skip if no speech)
    let audioBuffer = new Uint8Array(0);
    if (agentOutput.speech.trim()) {
      audioBuffer = await synthesize(ttsClient, ttsConfig, agentOutput.speech);
    }

    // Stage 4: Store the complete response
    const plainSpeech = stripTags(agentOutput.speech);
    store.setResponse(
      speechId,
      {
        speech_tagged: agentOutput.speech,
        speech_plain: plainSpeech,
        audio_url: `/v1/speech/${speechId}/response_audio`,
        led_color: agentOutput.led_color,
        led_mode: agentOutput.led_mode,
        memory_saved: agentOutput.save_memory,
      },
      audioBuffer,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.setError(speechId, message);
  }
}
```

**`test/speech/pipeline.test.ts`** (new):

```typescript
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "bun:test";
import type { NessieAgent } from "../../src/agent/nessie-agent";
import type { AgentInput, AgentOutput } from "../../src/agent/schemas";
import type { PipelineDeps } from "../../src/speech/pipeline";
import { runPipeline } from "../../src/speech/pipeline";
import { SpeechStore } from "../../src/speech/store";
import type { TtsClient, TtsConfig } from "../../src/tts/elevenlabs";

const MOCK_AGENT_OUTPUT: AgentOutput = {
  speech: "[excited] Arr, Captain Alex! Let's find treasure!",
  led_color: "#FFD700",
  led_mode: "pulse",
  save_memory: "Alex likes pirates",
  memory_speaker: "SPEAKER_0",
};

function createMockAgent(output?: AgentOutput): NessieAgent {
  const respondOutput = output ?? MOCK_AGENT_OUTPUT;
  return {
    respond: async (_input: AgentInput): Promise<AgentOutput> => respondOutput,
    endSession: () => undefined,
  } as unknown as NessieAgent;
}

function createFailingAgent(error: Error): NessieAgent {
  return {
    respond: async () => {
      throw error;
    },
    endSession: () => undefined,
  } as unknown as NessieAgent;
}

function createMockTtsClient(audio?: Uint8Array): TtsClient {
  const audioData = audio ?? new Uint8Array([0xff, 0xfb, 0x90, 0x00]);
  return {
    textToSpeech: {
      convert: async () => Readable.from([audioData]),
    },
  };
}

function createFailingTtsClient(error: Error): TtsClient {
  return {
    textToSpeech: {
      convert: async () => {
        throw error;
      },
    },
  };
}

const TTS_CONFIG: TtsConfig = {
  voiceId: "test-voice-id",
};

describe("runPipeline", () => {
  let store: SpeechStore;
  let deps: PipelineDeps;

  beforeEach(() => {
    store = new SpeechStore();
    deps = {
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
      store,
    };
  });

  it("processes a speech request to completion", async () => {
    const state = store.create("web-001", "let's play pirates", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("complete");
    expect(result?.response?.speech_tagged).toBe(
      "[excited] Arr, Captain Alex! Let's find treasure!",
    );
    expect(result?.response?.speech_plain).toBe("Arr, Captain Alex! Let's find treasure!");
    expect(result?.response?.led_color).toBe("#FFD700");
    expect(result?.response?.led_mode).toBe("pulse");
    expect(result?.response?.memory_saved).toBe("Alex likes pirates");
    expect(result?.response?.audio_url).toBe(`/v1/speech/${state.id}/response_audio`);
  });

  it("stores TTS audio buffer", async () => {
    const audioData = new Uint8Array([1, 2, 3, 4, 5]);
    deps.ttsClient = createMockTtsClient(audioData);

    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.response_audio).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  it("transitions through responding status", async () => {
    const statusLog: string[] = [];

    // Wrap agent to capture status at call time
    const originalRespond = deps.agent.respond.bind(deps.agent);
    deps.agent.respond = async (input: AgentInput) => {
      const current = store.get(state.id);
      statusLog.push(current?.status ?? "unknown");
      return originalRespond(input);
    };

    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    expect(statusLog).toContain("responding");
    expect(store.get(state.id)?.status).toBe("complete");
  });

  it("handles agent error", async () => {
    deps.agent = createFailingAgent(new Error("Model overloaded"));
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("Model overloaded");
  });

  it("handles TTS error", async () => {
    deps.ttsClient = createFailingTtsClient(new Error("TTS rate limit"));
    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("TTS rate limit");
  });

  it("does nothing for unknown speech ID", async () => {
    await runPipeline(deps, "sp_doesnotexist", "Alex", 6);
    expect(store.size()).toBe(0);
  });

  it("sets error when input data is missing", async () => {
    const state = store.create("web-001", "hello", "SPEAKER_0");
    // Manually clear input to simulate edge case
    const entry = store.get(state.id);
    if (entry) {
      entry.input = null;
    }

    await runPipeline(deps, state.id, "Alex", 6);
    const result = store.get(state.id);
    expect(result?.status).toBe("error");
    expect(result?.error).toBe("No input data available");
  });

  it("skips TTS for empty speech", async () => {
    const silentOutput: AgentOutput = {
      speech: "",
      led_color: "#333333",
      led_mode: "solid",
      save_memory: "",
      memory_speaker: "",
    };
    deps.agent = createMockAgent(silentOutput);

    let ttsCalled = false;
    deps.ttsClient = {
      textToSpeech: {
        convert: async () => {
          ttsCalled = true;
          return Readable.from([new Uint8Array([0])]);
        },
      },
    };

    const state = store.create("web-001", "hello", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    expect(ttsCalled).toBe(false);
    expect(store.get(state.id)?.status).toBe("complete");
    expect(store.get(state.id)?.response_audio?.length).toBe(0);
  });

  it("passes speaker info to agent input", async () => {
    let capturedInput: AgentInput | null = null;
    deps.agent = {
      respond: async (input: AgentInput) => {
        capturedInput = input;
        return MOCK_AGENT_OUTPUT;
      },
      endSession: () => undefined,
    } as unknown as NessieAgent;

    const state = store.create("web-001", "hello nessie", "SPEAKER_0");
    await runPipeline(deps, state.id, "Alex", 6);

    expect(capturedInput?.device_id).toBe("web-001");
    expect(capturedInput?.speaker.name).toBe("Alex");
    expect(capturedInput?.speaker.age).toBe(6);
    expect(capturedInput?.speaker.id).toBe("SPEAKER_0");
    expect(capturedInput?.text).toBe("hello nessie");
  });
});
```

### Test
```bash
bun test test/speech/pipeline.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add speech processing pipeline

Async pipeline: transcript → NessieAgent → ElevenLabs TTS → stored
response. Updates SpeechStore status at each stage. Error handling
catches agent and TTS failures gracefully.
```

---

## Task 6: Speech route handlers

### Goal
Implement HTTP route handlers for the speech API endpoints: `POST /v1/speech`, `GET /v1/speech/:id`, and `GET /v1/speech/:id/response_audio`.

### Why
These handlers wire the store and pipeline to HTTP. They must be testable as pure functions that take a `Request` and dependencies, and return a `Response`.

### Design notes

The route handlers are pure functions, not methods on a class. Each takes a `Request` and a `RouteDeps` object, returns a `Response`. This makes them trivially testable without starting a server.

### Files

**`src/speech/routes.ts`** (new):

```typescript
import type { NessieAgent } from "../agent/nessie-agent";
import type { TtsClient, TtsConfig } from "../tts/elevenlabs";
import { runPipeline } from "./pipeline";
import type { SpeechStore } from "./store";
import { SpeechRequestSchema, toApiResponse } from "./types";

/**
 * Dependencies for speech route handlers.
 */
export interface RouteDeps {
  store: SpeechStore;
  agent: NessieAgent;
  ttsClient: TtsClient;
  ttsConfig: TtsConfig;
}

/**
 * POST /v1/speech
 *
 * Receives a transcript and device_id, creates a speech request,
 * kicks off the async pipeline, and returns the request ID.
 */
export async function handleSpeechCreate(
  req: Request,
  deps: RouteDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = SpeechRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return Response.json({ error: "validation failed", details: errors }, { status: 400 });
  }

  const { device_id, transcript, speaker_name, speaker_age } = parsed.data;

  // Create the speech entry
  const state = deps.store.create(device_id, transcript, "SPEAKER_0");

  // Kick off the async pipeline (don't await — let it run in background)
  runPipeline(
    {
      agent: deps.agent,
      ttsClient: deps.ttsClient,
      ttsConfig: deps.ttsConfig,
      store: deps.store,
    },
    state.id,
    speaker_name,
    speaker_age,
  ).catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    deps.store.setError(state.id, `Pipeline crashed: ${message}`);
  });

  return Response.json({ id: state.id }, { status: 201 });
}

/**
 * GET /v1/speech/:id
 *
 * Returns the current state of a speech request.
 */
export function handleSpeechGet(
  id: string,
  deps: RouteDeps,
): Response {
  const state = deps.store.get(id);
  if (!state) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(toApiResponse(state));
}

/**
 * GET /v1/speech/:id/response_audio
 *
 * Returns the TTS audio as audio/L16;rate=16000.
 */
export function handleSpeechAudio(
  id: string,
  deps: RouteDeps,
): Response {
  const state = deps.store.get(id);
  if (!state) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  if (!state.response_audio || state.response_audio.length === 0) {
    return Response.json({ error: "audio not available yet" }, { status: 404 });
  }

  return new Response(state.response_audio, {
    headers: {
      "Content-Type": "audio/L16;rate=16000",
      "Content-Length": String(state.response_audio.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

**`test/speech/routes.test.ts`** (new):

```typescript
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it } from "bun:test";
import type { NessieAgent } from "../../src/agent/nessie-agent";
import type { AgentInput, AgentOutput } from "../../src/agent/schemas";
import {
  type RouteDeps,
  handleSpeechAudio,
  handleSpeechCreate,
  handleSpeechGet,
} from "../../src/speech/routes";
import { SpeechStore } from "../../src/speech/store";
import type { TtsClient, TtsConfig } from "../../src/tts/elevenlabs";

const MOCK_AGENT_OUTPUT: AgentOutput = {
  speech: "[excited] Hello!",
  led_color: "#FFD700",
  led_mode: "pulse",
  save_memory: "",
  memory_speaker: "",
};

function createMockAgent(): NessieAgent {
  return {
    respond: async (_input: AgentInput): Promise<AgentOutput> => MOCK_AGENT_OUTPUT,
    endSession: () => undefined,
  } as unknown as NessieAgent;
}

function createMockTtsClient(): TtsClient {
  return {
    textToSpeech: {
      convert: async () => Readable.from([new Uint8Array([0xff, 0xfb, 0x90])]),
    },
  };
}

const TTS_CONFIG: TtsConfig = { voiceId: "test-voice" };

describe("handleSpeechCreate", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns 201 with speech ID", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello nessie" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^sp_[0-9a-f]{12}$/);
  });

  it("creates entry in store", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });

    const res = await handleSpeechCreate(req, deps);
    const body = (await res.json()) as { id: string };
    const state = deps.store.get(body.id);
    expect(state).toBeDefined();
    expect(state?.input?.transcript).toBe("hello");
  });

  it("returns 405 for non-POST", async () => {
    const req = new Request("http://localhost/v1/speech", { method: "GET" });
    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(405);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid JSON body");
  });

  it("returns 400 for missing device_id", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: "hello" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details: unknown[] };
    expect(body.error).toBe("validation failed");
  });

  it("returns 400 for missing transcript", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty transcript", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "" }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(400);
  });

  it("accepts optional speaker_name and speaker_age", async () => {
    const req = new Request("http://localhost/v1/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_id: "web-001",
        transcript: "hello",
        speaker_name: "Alex",
        speaker_age: 6,
      }),
    });

    const res = await handleSpeechCreate(req, deps);
    expect(res.status).toBe(201);
  });
});

describe("handleSpeechGet", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns speech state", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechGet(state.id, deps);
    expect(res.status).toBe(200);
  });

  it("returns correct data shape", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechGet(state.id, deps);
    const body = (await res.json()) as { id: string; status: string; input: { transcript: string } };
    expect(body.id).toBe(state.id);
    expect(body.status).toBe("transcribed");
    expect(body.input.transcript).toBe("hello");
  });

  it("returns 404 for unknown ID", () => {
    const res = handleSpeechGet("sp_doesnotexist", deps);
    expect(res.status).toBe(404);
  });

  it("includes response when complete", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    deps.store.setResponse(
      state.id,
      {
        speech_tagged: "[happy] Hi!",
        speech_plain: "Hi!",
        audio_url: `/v1/speech/${state.id}/response_audio`,
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      },
      new Uint8Array([1, 2, 3]),
    );

    const res = handleSpeechGet(state.id, deps);
    const body = (await res.json()) as {
      status: string;
      response: { speech_plain: string };
    };
    expect(body.status).toBe("complete");
    expect(body.response.speech_plain).toBe("Hi!");
  });

  it("includes error when failed", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    deps.store.setError(state.id, "Something broke");

    const res = handleSpeechGet(state.id, deps);
    const body = (await res.json()) as { status: string; error: string };
    expect(body.status).toBe("error");
    expect(body.error).toBe("Something broke");
  });
});

describe("handleSpeechAudio", () => {
  let deps: RouteDeps;

  beforeEach(() => {
    deps = {
      store: new SpeechStore(),
      agent: createMockAgent(),
      ttsClient: createMockTtsClient(),
      ttsConfig: TTS_CONFIG,
    };
  });

  it("returns audio with correct content type", async () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const audioData = new Uint8Array([0xff, 0xfb, 0x90, 0x00, 0x00]);
    deps.store.setResponse(
      state.id,
      {
        speech_tagged: "Hi!",
        speech_plain: "Hi!",
        audio_url: `/v1/speech/${state.id}/response_audio`,
        led_color: "#87CEEB",
        led_mode: "solid",
        memory_saved: "",
      },
      audioData,
    );

    const res = handleSpeechAudio(state.id, deps);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/L16;rate=16000");
    expect(res.headers.get("Content-Length")).toBe("5");

    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(audioData);
  });

  it("returns 404 for unknown ID", () => {
    const res = handleSpeechAudio("sp_doesnotexist", deps);
    expect(res.status).toBe(404);
  });

  it("returns 404 when audio not ready", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    const res = handleSpeechAudio(state.id, deps);
    expect(res.status).toBe(404);
    // response_audio is null, not empty Uint8Array
  });

  it("returns 404 for empty audio buffer", () => {
    const state = deps.store.create("web-001", "hello", "SPEAKER_0");
    deps.store.setResponse(
      state.id,
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

    const res = handleSpeechAudio(state.id, deps);
    expect(res.status).toBe(404);
  });
});
```

### Test
```bash
bun test test/speech/routes.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add speech API route handlers

Pure function handlers for POST /v1/speech, GET /v1/speech/:id, and
GET /v1/speech/:id/response_audio. POST kicks off async pipeline and
returns immediately with speech ID.
```

---

## Task 7: Wire routes into server + static file serving

### Goal
Modify `server.ts` to mount the speech API routes and serve static files from the `public/` directory. Modify `index.ts` to set up the agent and TTS dependencies when starting the server.

### Why
This connects everything together — the HTTP layer, the speech pipeline, and the static web client files.

### Design notes

Route matching uses simple string matching on `url.pathname`. The speech routes are:
- `POST /v1/speech` — exact match
- `GET /v1/speech/:id` — regex to extract ID
- `GET /v1/speech/:id/response_audio` — regex to extract ID

Static files are served from `public/` using `Bun.file()`. Only specific extensions are allowed (HTML, CSS, JS, PNG, ICO) to prevent directory traversal.

The server factory `createServer` now accepts optional `RouteDeps` for the speech endpoints. When not provided (e.g. in existing server tests), the speech endpoints return 503.

### Files

**`src/server.ts`** (rewrite):

```typescript
import { readdir, stat } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import type { RouteDeps } from "./speech/routes";
import { handleSpeechAudio, handleSpeechCreate, handleSpeechGet } from "./speech/routes";

const startTime = Date.now();

const STATIC_DIR = resolve(import.meta.dir, "../public");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
};

/**
 * Serve a static file from the public/ directory.
 * Returns null if the file doesn't exist or the extension is not allowed.
 */
async function serveStatic(pathname: string): Promise<Response | null> {
  // Default to index.html for root
  const filePath = pathname === "/" ? "/index.html" : pathname;

  // Prevent directory traversal
  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext];
  if (!mimeType) {
    return null;
  }

  const fullPath = join(STATIC_DIR, filePath);
  const resolved = resolve(fullPath);

  // Ensure resolved path is within STATIC_DIR
  if (!resolved.startsWith(STATIC_DIR)) {
    return null;
  }

  try {
    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  const file = Bun.file(resolved);
  return new Response(file, {
    headers: { "Content-Type": mimeType },
  });
}

// Regex patterns for speech API routes
const SPEECH_ID_PATTERN = /^\/v1\/speech\/([a-z0-9_]+)$/;
const SPEECH_AUDIO_PATTERN = /^\/v1\/speech\/([a-z0-9_]+)\/response_audio$/;

export interface ServerOptions {
  port: number;
  speechDeps?: RouteDeps;
}

export function createServer(options: ServerOptions) {
  const { speechDeps } = options;

  return Bun.serve({
    port: options.port,
    async fetch(req) {
      const url = new URL(req.url);

      // Health check
      if (url.pathname === "/health") {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        return Response.json({
          status: "ok",
          uptime: Math.floor((Date.now() - startTime) / 1000),
        });
      }

      // Speech API: POST /v1/speech
      if (url.pathname === "/v1/speech") {
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        return handleSpeechCreate(req, speechDeps);
      }

      // Speech API: GET /v1/speech/:id/response_audio
      const audioMatch = url.pathname.match(SPEECH_AUDIO_PATTERN);
      if (audioMatch) {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        const id = audioMatch[1];
        if (!id) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        return handleSpeechAudio(id, speechDeps);
      }

      // Speech API: GET /v1/speech/:id
      const speechMatch = url.pathname.match(SPEECH_ID_PATTERN);
      if (speechMatch) {
        if (req.method !== "GET") {
          return Response.json({ error: "method not allowed" }, { status: 405 });
        }
        if (!speechDeps) {
          return Response.json({ error: "speech API not configured" }, { status: 503 });
        }
        const id = speechMatch[1];
        if (!id) {
          return Response.json({ error: "not found" }, { status: 404 });
        }
        return handleSpeechGet(id, speechDeps);
      }

      // Static file serving
      const staticResponse = await serveStatic(url.pathname);
      if (staticResponse) {
        return staticResponse;
      }

      return Response.json({ error: "not found" }, { status: 404 });
    },
  });
}
```

**`src/index.ts`** (modify — add agent/TTS setup to serve command):

```typescript
#!/usr/bin/env bun
import * as p from "@clack/prompts";
import { createServer } from "./server.ts";

const DEFAULT_PORT = 3000;

function printHelp(): void {
  console.log(`
Usage: myapp <command>

Commands:
  serve    Start the HTTP server
  chat     Start an interactive chat with Nessie
  help     Show this help message

Options:
  --help, -h    Show help
`);
}

async function cmdServe(): Promise<void> {
  const { anthropic } = await import("@ai-sdk/anthropic");
  const { generateText } = await import("ai");
  const { ElevenLabsClient } = await import("elevenlabs");
  const { InMemoryStore } = await import("./agent/memory-inmemory");
  const { NessieAgent } = await import("./agent/nessie-agent");
  const { SpeechStore } = await import("./speech/store");
  const { config } = await import("./config");

  const model = anthropic("claude-haiku-4-5");
  const memoryStore = new InMemoryStore();
  const agent = new NessieAgent(
    {
      model,
      memoryStore,
      enableInputScreening: true,
      enableOutputCheck: true,
    },
    { generateText },
  );

  const ttsClient = new ElevenLabsClient({
    apiKey: config.ELEVENLABS_API_KEY,
  });

  const speechStore = new SpeechStore();

  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_PORT;
  const server = createServer({
    port,
    speechDeps: {
      store: speechStore,
      agent,
      ttsClient,
      ttsConfig: {
        voiceId: config.NESSIE_VOICE_ID,
      },
    },
  });

  p.log.success(`Server listening on http://localhost:${server.port}`);
  p.log.info("Speech API enabled at /v1/speech");
  p.log.info(`Voice ID: ${config.NESSIE_VOICE_ID}`);

  // Periodic cleanup of old speech entries (every 5 minutes)
  setInterval(() => {
    const removed = speechStore.cleanup();
    if (removed > 0) {
      p.log.info(`Cleaned up ${removed} expired speech entries`);
    }
  }, 5 * 60 * 1000);
}

async function main(args: string[]): Promise<void> {
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  switch (command) {
    case "serve":
      await cmdServe();
      break;
    case "chat": {
      const { runChat } = await import("./cli/chat");
      await runChat();
      break;
    }
    default:
      p.log.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main(process.argv.slice(2));
```

**`test/server.test.ts`** (modify — update existing tests, add speech route tests):

```typescript
import { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { AgentInput, AgentOutput } from "../src/agent/schemas";
import type { RouteDeps } from "../src/speech/routes";
import { createServer } from "../src/server.ts";
import { SpeechStore } from "../src/speech/store";
import type { TtsClient, TtsConfig } from "../src/tts/elevenlabs";

const MOCK_AGENT_OUTPUT: AgentOutput = {
  speech: "[happy] Hello friend!",
  led_color: "#87CEEB",
  led_mode: "solid",
  save_memory: "",
  memory_speaker: "",
};

function createTestDeps(): RouteDeps {
  return {
    store: new SpeechStore(),
    agent: {
      respond: async (_input: AgentInput): Promise<AgentOutput> => MOCK_AGENT_OUTPUT,
      endSession: () => undefined,
    } as RouteDeps["agent"],
    ttsClient: {
      textToSpeech: {
        convert: async () => Readable.from([new Uint8Array([0xff, 0xfb, 0x90])]),
      },
    } as TtsClient,
    ttsConfig: { voiceId: "test-voice" } as TtsConfig,
  };
}

describe("server", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;

  beforeAll(() => {
    server = createServer({ port: 0 });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  test("GET /health returns ok", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  test("GET /unknown returns 404", async () => {
    const res = await fetch(`${baseUrl}/unknown`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("not found");
  });

  test("POST /health returns 405", async () => {
    const res = await fetch(`${baseUrl}/health`, { method: "POST" });
    expect(res.status).toBe(405);
  });

  test("POST /v1/speech returns 503 when speech deps not configured", async () => {
    const res = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });
    expect(res.status).toBe(503);
  });
});

describe("server with speech deps", () => {
  let server: ReturnType<typeof createServer>;
  let baseUrl: string;
  let deps: RouteDeps;

  beforeAll(() => {
    deps = createTestDeps();
    server = createServer({ port: 0, speechDeps: deps });
    baseUrl = `http://localhost:${server.port}`;
  });

  afterAll(() => {
    server.stop();
  });

  test("POST /v1/speech creates speech request", async () => {
    const res = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello nessie" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    expect(body.id).toMatch(/^sp_[0-9a-f]{12}$/);
  });

  test("GET /v1/speech/:id returns speech state", async () => {
    const createRes = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });
    const { id } = (await createRes.json()) as { id: string };

    // Wait briefly for pipeline to run
    await new Promise((r) => setTimeout(r, 100));

    const res = await fetch(`${baseUrl}/v1/speech/${id}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; status: string };
    expect(body.id).toBe(id);
  });

  test("GET /v1/speech/unknown returns 404", async () => {
    const res = await fetch(`${baseUrl}/v1/speech/sp_doesnotexist`);
    expect(res.status).toBe(404);
  });

  test("GET /v1/speech/:id/response_audio returns audio after completion", async () => {
    const createRes = await fetch(`${baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: "web-001", transcript: "hello" }),
    });
    const { id } = (await createRes.json()) as { id: string };

    // Wait for pipeline to complete
    await new Promise((r) => setTimeout(r, 200));

    const res = await fetch(`${baseUrl}/v1/speech/${id}/response_audio`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/L16;rate=16000");
  });

  test("GET /health still works with speech deps", async () => {
    const res = await fetch(`${baseUrl}/health`);
    expect(res.status).toBe(200);
  });
});
```

### Test
```bash
bun test test/server.test.ts
```

### Verify
```bash
bun test && bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: wire speech routes into server with static file serving

Mount POST/GET /v1/speech endpoints and static file serving from
public/ directory. Server accepts optional speechDeps; returns 503
when not configured. Index.ts sets up agent + TTS for serve command.
```

---

## Task 8: Web client HTML + CSS

### Goal
Create the web client HTML and CSS files that provide the chat UI, push-to-talk button, and LED color indicator.

### Why
This is the user-facing interface for the voice conversation. It needs to be complete and functional — the JS in Task 9 will bring it to life.

### Design notes

The layout has:
- A header with Nessie's name and an LED indicator circle
- A chat area showing messages (user on right, Nessie on left)
- A bottom bar with the push-to-talk button and a text input fallback
- Status indicator showing pipeline progress

The design uses CSS variables for easy theming and a warm, playful aesthetic appropriate for a children's toy.

### Files

**`public/index.html`** (new):

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nessie</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <div id="app">
    <header>
      <div class="header-left">
        <div id="led" class="led"></div>
        <h1>Nessie</h1>
      </div>
      <div class="header-right">
        <span id="status-badge" class="status-badge">Ready</span>
      </div>
    </header>

    <main id="chat-area">
      <div class="message nessie">
        <div class="message-bubble">
          <p>Hi there! Press and hold the big button to talk to me, or type below.</p>
        </div>
      </div>
    </main>

    <footer>
      <div class="input-row">
        <button
          id="mic-btn"
          class="mic-btn"
          aria-label="Push to talk"
        >
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <div class="text-input-group">
          <input
            id="text-input"
            type="text"
            placeholder="Or type a message..."
            autocomplete="off"
          />
          <button id="send-btn" class="send-btn" aria-label="Send">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
      <div id="transcript-preview" class="transcript-preview" hidden>
        <span class="transcript-label">Hearing:</span>
        <span id="transcript-text"></span>
      </div>
    </footer>
  </div>

  <script src="/app.js"></script>
</body>
</html>
```

**`public/style.css`** (new):

```css
:root {
  --bg: #faf8f5;
  --surface: #ffffff;
  --text: #2d2d2d;
  --text-muted: #888888;
  --nessie-bubble: #e8f4f8;
  --user-bubble: #d4e8d4;
  --accent: #5ba4cf;
  --accent-hover: #4a8fb8;
  --danger: #e74c3c;
  --border: #e0ddd8;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --radius: 12px;
  --radius-sm: 8px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  background: var(--bg);
  color: var(--text);
}

#app {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 600px;
  margin: 0 auto;
}

/* Header */
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow);
  z-index: 10;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 700;
  color: var(--accent);
}

.led {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #87ceeb;
  box-shadow: 0 0 6px rgba(135, 206, 235, 0.6);
  transition: background 0.5s ease, box-shadow 0.5s ease;
}

.led.pulse {
  animation: led-pulse 1.5s ease-in-out infinite;
}

.led.flash {
  animation: led-flash 0.4s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@keyframes led-flash {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.status-badge {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 12px;
  background: #e8f4e8;
  color: #3a8a3a;
  font-weight: 500;
}

.status-badge.processing {
  background: #fff3e0;
  color: #e67e22;
}

.status-badge.error {
  background: #fde8e8;
  color: var(--danger);
}

.status-badge.listening {
  background: #e8e0f4;
  color: #7b3fa0;
}

/* Chat area */
main {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message {
  display: flex;
  max-width: 85%;
}

.message.nessie {
  align-self: flex-start;
}

.message.user {
  align-self: flex-end;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: var(--radius);
  line-height: 1.5;
  font-size: 15px;
  word-wrap: break-word;
}

.message.nessie .message-bubble {
  background: var(--nessie-bubble);
  border-bottom-left-radius: 4px;
}

.message.user .message-bubble {
  background: var(--user-bubble);
  border-bottom-right-radius: 4px;
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-muted);
}

.message-meta .tagged {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.message-meta .tagged:hover {
  color: var(--accent);
}

.replay-btn {
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  color: var(--text-muted);
}

.replay-btn:hover {
  background: var(--nessie-bubble);
  color: var(--text);
}

/* Footer */
footer {
  padding: 12px 16px;
  background: var(--surface);
  border-top: 1px solid var(--border);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.04);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mic-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: 3px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.mic-btn:hover {
  background: var(--accent);
  color: white;
}

.mic-btn.listening {
  background: var(--danger);
  border-color: var(--danger);
  color: white;
  animation: mic-pulse 1s ease-in-out infinite;
}

@keyframes mic-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

.mic-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  animation: none;
}

.text-input-group {
  flex: 1;
  display: flex;
  gap: 8px;
}

#text-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 15px;
  background: var(--bg);
  color: var(--text);
  outline: none;
  transition: border-color 0.15s;
}

#text-input:focus {
  border-color: var(--accent);
}

.send-btn {
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.send-btn:hover {
  background: var(--accent-hover);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.transcript-preview {
  margin-top: 8px;
  padding: 6px 10px;
  background: #f0e8f8;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: #7b3fa0;
}

.transcript-label {
  font-weight: 600;
}

/* Spinner */
.spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 6px;
  vertical-align: middle;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Memory badge */
.memory-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #fff3e0;
  border-radius: 10px;
  font-size: 11px;
  color: #e67e22;
}
```

### Test
No unit tests for HTML/CSS. Verified by visual inspection in browser during Task 9.

### Verify
```bash
bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add web client HTML and CSS

Chat UI with Nessie branding, push-to-talk mic button, text input
fallback, LED color indicator, status badge, and message bubbles.
Responsive layout capped at 600px width.
```

---

## Task 9: Web client JavaScript — Speech recognition, API calls, audio playback

### Goal
Implement the client-side JavaScript that ties together the Web Speech API for speech recognition, the server API for processing, and audio playback for Nessie's responses.

### Why
This is the final piece that makes the voice conversation work end-to-end in the browser.

### Design notes

**Speech recognition:** Uses `webkitSpeechRecognition` (Chrome) or `SpeechRecognition` (Firefox/Safari). Falls back to text-only mode if not available. `continuous: false`, `interimResults: true` for live transcript preview.

**Push-to-talk flow:**
1. User clicks mic button (or presses space) to start listening
2. Browser shows live transcript in the preview area
3. User clicks again (or releases space) to stop
4. Final transcript is sent to `POST /v1/speech`
5. Client polls `GET /v1/speech/:id` every 500ms until `complete` or `error`
6. On complete: play audio, show message, update LED

**Text fallback:** Users can also type in the text input and press Enter or click Send.

**Audio playback:** Creates an `Audio` object from the response audio URL. The replay button creates a new Audio from the same URL.

### Files

**`public/app.js`** (new):

```javascript
// @ts-nocheck — vanilla JS, no TypeScript checking
(function () {
  "use strict";

  // --- DOM elements ---
  const chatArea = document.getElementById("chat-area");
  const micBtn = document.getElementById("mic-btn");
  const textInput = document.getElementById("text-input");
  const sendBtn = document.getElementById("send-btn");
  const statusBadge = document.getElementById("status-badge");
  const led = document.getElementById("led");
  const transcriptPreview = document.getElementById("transcript-preview");
  const transcriptText = document.getElementById("transcript-text");

  // --- State ---
  let isListening = false;
  let isProcessing = false;
  let recognition = null;
  let currentTranscript = "";
  const POLL_INTERVAL_MS = 500;
  const DEVICE_ID = "web-" + Math.random().toString(36).slice(2, 8);

  // --- Speech Recognition Setup ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = function (event) {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      currentTranscript = final || interim;
      transcriptText.textContent = currentTranscript;
    };

    recognition.onend = function () {
      if (isListening) {
        stopListening();
        if (currentTranscript.trim()) {
          sendTranscript(currentTranscript.trim());
        }
      }
    };

    recognition.onerror = function (event) {
      console.error("Speech recognition error:", event.error);
      stopListening();
      if (event.error === "not-allowed") {
        setStatus("Mic access denied", "error");
      }
    };
  } else {
    micBtn.disabled = true;
    micBtn.title = "Speech recognition not supported in this browser. Use text input.";
  }

  // --- Functions ---

  function setStatus(text, type) {
    statusBadge.textContent = text;
    statusBadge.className = "status-badge" + (type ? " " + type : "");
  }

  function setLed(color, mode) {
    led.style.background = color;
    led.style.boxShadow = "0 0 6px " + color + "99";
    led.className = "led" + (mode ? " " + mode : "");
  }

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function addUserMessage(text) {
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = '<div class="message-bubble"><p>' + escapeHtml(text) + "</p></div>";
    chatArea.appendChild(div);
    scrollToBottom();
  }

  function addNessieMessage(data) {
    const div = document.createElement("div");
    div.className = "message nessie";

    const plainText = data.response.speech_plain || "[no response]";
    const audioUrl = data.response.audio_url;
    const tagged = data.response.speech_tagged;
    const memory = data.response.memory_saved;

    let metaHtml = "";
    if (audioUrl) {
      metaHtml += '<button class="replay-btn" data-audio="' + audioUrl + '">Replay</button>';
    }
    if (tagged && tagged !== plainText) {
      metaHtml += '<span class="tagged" title="' + escapeHtml(tagged) + '">Show tags</span>';
    }
    if (memory) {
      metaHtml += '<span class="memory-badge">Remembered: ' + escapeHtml(memory) + "</span>";
    }

    div.innerHTML =
      '<div class="message-bubble"><p>' +
      escapeHtml(plainText) +
      "</p>" +
      (metaHtml ? '<div class="message-meta">' + metaHtml + "</div>" : "") +
      "</div>";

    chatArea.appendChild(div);
    scrollToBottom();

    // Attach replay handler
    const replayBtn = div.querySelector(".replay-btn");
    if (replayBtn) {
      replayBtn.addEventListener("click", function () {
        const url = replayBtn.getAttribute("data-audio");
        if (url) {
          playAudio(url);
        }
      });
    }

    // Attach tag toggle handler
    const tagSpan = div.querySelector(".tagged");
    if (tagSpan) {
      tagSpan.addEventListener("click", function () {
        const p = div.querySelector("p");
        if (!p) return;
        if (p.textContent === plainText) {
          p.textContent = tagged;
          tagSpan.textContent = "Hide tags";
        } else {
          p.textContent = plainText;
          tagSpan.textContent = "Show tags";
        }
      });
    }
  }

  function addThinkingIndicator() {
    const div = document.createElement("div");
    div.className = "message nessie";
    div.id = "thinking-indicator";
    div.innerHTML =
      '<div class="message-bubble"><p><span class="spinner"></span>Nessie is thinking...</p></div>';
    chatArea.appendChild(div);
    scrollToBottom();
  }

  function removeThinkingIndicator() {
    const el = document.getElementById("thinking-indicator");
    if (el) {
      el.remove();
    }
  }

  function addErrorMessage(text) {
    const div = document.createElement("div");
    div.className = "message nessie";
    div.innerHTML =
      '<div class="message-bubble" style="background:#fde8e8"><p>' +
      escapeHtml(text) +
      "</p></div>";
    chatArea.appendChild(div);
    scrollToBottom();
  }

  function escapeHtml(text) {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  }

  function playAudio(url) {
    var audio = new Audio(url);
    audio.play().catch(function (err) {
      console.error("Audio playback failed:", err);
    });
  }

  function startListening() {
    if (!recognition || isProcessing) return;
    isListening = true;
    currentTranscript = "";
    transcriptText.textContent = "";
    transcriptPreview.hidden = false;
    micBtn.classList.add("listening");
    setStatus("Listening...", "listening");
    recognition.start();
  }

  function stopListening() {
    isListening = false;
    micBtn.classList.remove("listening");
    transcriptPreview.hidden = true;
    try {
      recognition.stop();
    } catch (_) {
      // already stopped
    }
  }

  async function sendTranscript(text) {
    if (isProcessing) return;
    isProcessing = true;
    micBtn.disabled = true;
    sendBtn.disabled = true;
    textInput.disabled = true;

    addUserMessage(text);
    addThinkingIndicator();
    setStatus("Processing...", "processing");

    try {
      // POST to create speech request
      const createRes = await fetch("/v1/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: DEVICE_ID,
          transcript: text,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create speech request");
      }

      const createData = await createRes.json();
      const speechId = createData.id;

      // Poll until complete
      const result = await pollForCompletion(speechId);

      removeThinkingIndicator();

      if (result.status === "error") {
        addErrorMessage("Oops! Something went wrong: " + (result.error || "Unknown error"));
        setStatus("Error", "error");
      } else if (result.status === "complete" && result.response) {
        // Update LED
        setLed(result.response.led_color, result.response.led_mode);

        // Play audio
        if (result.response.audio_url) {
          playAudio(result.response.audio_url);
        }

        // Show message
        addNessieMessage(result);
        setStatus("Ready", "");
      }
    } catch (err) {
      removeThinkingIndicator();
      addErrorMessage("Connection error: " + err.message);
      setStatus("Error", "error");
    } finally {
      isProcessing = false;
      micBtn.disabled = false;
      sendBtn.disabled = false;
      textInput.disabled = false;
    }
  }

  async function pollForCompletion(speechId) {
    var maxAttempts = 120; // 60 seconds at 500ms interval
    for (var i = 0; i < maxAttempts; i++) {
      var res = await fetch("/v1/speech/" + speechId);
      if (!res.ok) {
        throw new Error("Failed to fetch speech status");
      }
      var data = await res.json();

      // Update status badge with pipeline stage
      if (data.status === "responding") {
        setStatus("Nessie is thinking...", "processing");
      } else if (data.status === "transcribed") {
        setStatus("Processing...", "processing");
      }

      if (data.status === "complete" || data.status === "error") {
        return data;
      }

      await new Promise(function (resolve) {
        setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }

    throw new Error("Request timed out");
  }

  // --- Event Listeners ---

  // Mic button: click to toggle listening
  micBtn.addEventListener("click", function () {
    if (isListening) {
      stopListening();
      if (currentTranscript.trim()) {
        sendTranscript(currentTranscript.trim());
      }
    } else {
      startListening();
    }
  });

  // Text input: Enter to send
  textInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      var text = textInput.value.trim();
      if (text && !isProcessing) {
        textInput.value = "";
        sendTranscript(text);
      }
    }
  });

  // Send button
  sendBtn.addEventListener("click", function () {
    var text = textInput.value.trim();
    if (text && !isProcessing) {
      textInput.value = "";
      sendTranscript(text);
    }
  });

  // Space bar for push-to-talk (only when not typing)
  document.addEventListener("keydown", function (e) {
    if (
      e.code === "Space" &&
      document.activeElement !== textInput &&
      !isProcessing
    ) {
      e.preventDefault();
      if (!isListening) {
        startListening();
      }
    }
  });

  document.addEventListener("keyup", function (e) {
    if (e.code === "Space" && document.activeElement !== textInput) {
      if (isListening) {
        stopListening();
        if (currentTranscript.trim()) {
          sendTranscript(currentTranscript.trim());
        }
      }
    }
  });
})();
```

### Test
No unit tests for browser JS. Test manually:

1. Start the server: `bun run serve`
2. Open `http://localhost:3000` in Chrome (best Web Speech API support)
3. Verify:
   - Chat UI renders correctly
   - Typing a message and pressing Enter sends it
   - Push-to-talk button starts/stops speech recognition (Chrome only)
   - Space bar triggers push-to-talk when not focused on text input
   - Status badge updates during processing
   - Nessie's response appears with play/replay button
   - LED indicator changes color and animation
   - Show/hide tags toggle works
   - Memory badge appears when agent saves a memory

### Verify
```bash
bun run lint && bunx tsc --noEmit
```

### Commit
```
feat: add web client JS with speech recognition and audio playback

Vanilla JS client using Web Speech API for speech-to-text, polling
for pipeline completion, audio playback via Audio API, and chat UI
rendering. Falls back to text-only when speech recognition is not
available.
```

---

## Summary

### Files created (8 new)
- `src/speech/types.ts` — SpeechState, SpeechRequest, status enum, toApiResponse
- `src/speech/store.ts` — SpeechStore with Map-backed state management
- `src/speech/pipeline.ts` — Async processing: agent + TTS
- `src/speech/routes.ts` — HTTP route handlers
- `src/tts/elevenlabs.ts` — ElevenLabs TTS wrapper with stream-to-buffer
- `public/index.html` — Chat UI
- `public/style.css` — Styles
- `public/app.js` — Browser-side speech recognition + API client

### Files modified (4)
- `src/config.ts` — Add ELEVENLABS_API_KEY, NESSIE_VOICE_ID
- `src/server.ts` — Rewrite with speech routes + static file serving
- `src/index.ts` — Set up agent/TTS deps for serve command
- `test/setup.ts` — Add ELEVENLABS_API_KEY test env var

### Test files created (5 new)
- `test/speech/types.test.ts`
- `test/speech/store.test.ts`
- `test/speech/pipeline.test.ts`
- `test/speech/routes.test.ts`
- `test/tts/elevenlabs.test.ts`

### Test files modified (2)
- `test/config.test.ts` — Add ElevenLabs config tests
- `test/server.test.ts` — Add speech route integration tests

### Task dependency order
```
Task 1 (config) ─────────────────────────────────────┐
Task 2 (types) ──────────────────────────────────────┤
Task 3 (store) ── depends on Task 2 ────────────────┤
Task 4 (TTS wrapper) ───────────────────────────────┤
Task 5 (pipeline) ── depends on Tasks 2, 3, 4 ─────┤
Task 6 (routes) ── depends on Tasks 2, 3, 5 ───────┤
Task 7 (server wiring) ── depends on Tasks 1-6 ─────┤
Task 8 (HTML/CSS) ── independent ────────────────────┤
Task 9 (client JS) ── depends on Tasks 7, 8 ────────┘
```

Tasks 1, 2, 4, and 8 can all be done in parallel. Task 3 depends on 2. Task 5 depends on 2, 3, 4. Task 6 depends on 5. Task 7 depends on 1, 6. Task 9 depends on 7, 8.

### Future iterations
1. **Server-side Whisper STT** — Accept audio upload, transcribe with Whisper, skip browser STT
2. **SSE/WebSocket** — Replace polling with server-sent events for real-time status
3. **Persistent store** — Replace in-memory Map with SQLite or Redis
4. **Speaker diarization** — Identify different speakers from audio
5. **Conversation history UI** — Show previous sessions, replay history
