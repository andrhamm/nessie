import { describe, expect, it } from "bun:test";
import {
  buildNessSystemPrompt,
  NESS_CHARACTER_PROMPT,
  renderNessRuntimeContext,
} from "../../src/agent/parent-prompts";

describe("NESS_CHARACTER_PROMPT", () => {
  it("instructs Ness to resolve relative dates rather than ask for YYYY-MM-DD", () => {
    expect(NESS_CHARACTER_PROMPT).toContain("Resolve relative dates yourself");
    expect(NESS_CHARACTER_PROMPT).toContain("Never ask the parent to reformat");
  });

  it("lists concrete relative-date examples the model should handle", () => {
    expect(NESS_CHARACTER_PROMPT).toMatch(/tomorrow/i);
    expect(NESS_CHARACTER_PROMPT).toMatch(/next Tuesday/i);
    expect(NESS_CHARACTER_PROMPT).toMatch(/weekend/i);
  });

  it("tells Ness to ask one short question when a reference is ambiguous", () => {
    expect(NESS_CHARACTER_PROMPT).toMatch(/ambiguous|clarifying question/i);
  });
});

describe("renderNessRuntimeContext", () => {
  it("includes the current date in ISO form and a human label", () => {
    const now = new Date("2026-04-18T14:32:00");
    const ctx = renderNessRuntimeContext(now);
    expect(ctx).toContain("## Right Now");
    expect(ctx).toContain("2026-04-18");
    expect(ctx).toMatch(/Saturday 18 April 2026/);
  });

  it("includes the local clock", () => {
    const now = new Date("2026-04-18T14:32:00");
    const ctx = renderNessRuntimeContext(now);
    expect(ctx).toMatch(/Local clock: 14:32/);
  });

  it("tells the model to resolve relative dates against this date", () => {
    const ctx = renderNessRuntimeContext(new Date());
    expect(ctx).toMatch(/Resolve any relative date/i);
  });
});

describe("buildNessSystemPrompt", () => {
  it("puts the character prompt first and the runtime context last", () => {
    const now = new Date("2026-04-18T00:00:00");
    const prompt = buildNessSystemPrompt(now);
    expect(prompt.startsWith(NESS_CHARACTER_PROMPT)).toBe(true);
    const runtime = prompt.slice(NESS_CHARACTER_PROMPT.length);
    expect(runtime).toContain("## Right Now");
    expect(runtime).toContain("2026-04-18");
  });
});
