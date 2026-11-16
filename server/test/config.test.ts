import { describe, expect, it } from "bun:test";
import { z } from "zod";

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1),
  NESSIE_VOICE_ID: z.string().min(1).default("emSmWzY0c0xtx5IFMCVv"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CHATTERBOX_URL: z.url().default("http://localhost:8004"),
  CHATTERBOX_VOICE: z.string().min(1).default("Emily.wav"),
  DEFAULT_TTS_PROVIDER: z.enum(["elevenlabs", "chatterbox"]).default("elevenlabs"),
  PARENT_AGENT_MODEL: z.string().min(1).default("claude-sonnet-4-6"),
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
      expect(result.data.CHATTERBOX_URL).toBe("http://localhost:8004");
      expect(result.data.CHATTERBOX_VOICE).toBe("Emily.wav");
      expect(result.data.DEFAULT_TTS_PROVIDER).toBe("elevenlabs");
      expect(result.data.PARENT_AGENT_MODEL).toBe("claude-sonnet-4-6");
    }
  });

  it("accepts custom CHATTERBOX_URL", () => {
    const result = ConfigSchema.safeParse({
      ...validEnv,
      CHATTERBOX_URL: "https://tts.home.lan:9000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CHATTERBOX_URL).toBe("https://tts.home.lan:9000");
    }
  });

  it("rejects non-URL CHATTERBOX_URL", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, CHATTERBOX_URL: "not a url" });
    expect(result.success).toBe(false);
  });

  it("rejects empty CHATTERBOX_VOICE", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, CHATTERBOX_VOICE: "" });
    expect(result.success).toBe(false);
  });

  it("accepts DEFAULT_TTS_PROVIDER=chatterbox", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, DEFAULT_TTS_PROVIDER: "chatterbox" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.DEFAULT_TTS_PROVIDER).toBe("chatterbox");
    }
  });

  it("rejects unknown DEFAULT_TTS_PROVIDER", () => {
    const result = ConfigSchema.safeParse({ ...validEnv, DEFAULT_TTS_PROVIDER: "whisper" });
    expect(result.success).toBe(false);
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

describe("real ConfigSchema", () => {
  it("allows ELEVENLABS_API_KEY to be absent", async () => {
    const { ConfigSchema: RealSchema } = await import("../src/config");
    const result = RealSchema.safeParse({ ANTHROPIC_API_KEY: "sk-ant-test-key" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ELEVENLABS_API_KEY).toBeUndefined();
    }
  });
});
