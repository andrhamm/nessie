import { describe, expect, test } from "bun:test";
import { ConfigSchema, loadConfig } from "../src/config.ts";

describe("ConfigSchema", () => {
  test("parses valid env with defaults", () => {
    const config = ConfigSchema.parse({});
    expect(config.port).toBe(3000);
  });

  test("parses PORT from env string", () => {
    const config = ConfigSchema.parse({ port: "8080" });
    expect(config.port).toBe(8080);
  });

  test("rejects invalid port", () => {
    expect(() => ConfigSchema.parse({ port: "not-a-number" })).toThrow();
  });
});

describe("loadConfig", () => {
  test("returns typed config from process.env", () => {
    const original = process.env.PORT;
    process.env.PORT = "9999";
    try {
      const config = loadConfig();
      expect(config.port).toBe(9999);
    } finally {
      if (original === undefined) {
        delete process.env.PORT;
      } else {
        process.env.PORT = original;
      }
    }
  });

  test("uses defaults when env is empty", () => {
    const original = process.env.PORT;
    delete process.env.PORT;
    try {
      const config = loadConfig();
      expect(config.port).toBe(3000);
    } finally {
      if (original !== undefined) {
        process.env.PORT = original;
      }
    }
  });
});
