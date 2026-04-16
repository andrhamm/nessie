import { describe, expect, it } from "bun:test";
import { z } from "zod";

const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

describe("ConfigSchema", () => {
  it("parses valid config", () => {
    const result = ConfigSchema.safeParse({
      ANTHROPIC_API_KEY: "sk-ant-test-key",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ANTHROPIC_API_KEY).toBe("sk-ant-test-key");
      expect(result.data.NODE_ENV).toBe("development");
      expect(result.data.LOG_LEVEL).toBe("info");
    }
  });

  it("rejects missing ANTHROPIC_API_KEY", () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty ANTHROPIC_API_KEY", () => {
    const result = ConfigSchema.safeParse({ ANTHROPIC_API_KEY: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid NODE_ENV", () => {
    const result = ConfigSchema.safeParse({
      ANTHROPIC_API_KEY: "sk-ant-test-key",
      NODE_ENV: "staging",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid LOG_LEVEL", () => {
    const result = ConfigSchema.safeParse({
      ANTHROPIC_API_KEY: "sk-ant-test-key",
      LOG_LEVEL: "debug",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.LOG_LEVEL).toBe("debug");
    }
  });
});
