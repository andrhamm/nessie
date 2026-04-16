import { describe, expect, test } from "bun:test";
import { $ } from "bun";

describe("CLI", () => {
  test("--help prints usage", async () => {
    const result = await $`bun run src/index.ts --help`.text();
    expect(result).toContain("Usage:");
    expect(result).toContain("serve");
  });

  test("unknown command exits with error", async () => {
    try {
      await $`bun run src/index.ts bogus`.quiet();
    } catch (e: unknown) {
      const err = e as { exitCode: number };
      expect(err.exitCode).toBe(1);
    }
  });
});
