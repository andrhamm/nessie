import { describe, expect, it } from "bun:test";
import { buildSystemPrompt, CHARACTER_PROMPT, formatUserMessage } from "../../src/agent/prompts";

describe("CHARACTER_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(CHARACTER_PROMPT.length).toBeGreaterThan(0);
  });

  it("starts with character identity", () => {
    expect(CHARACTER_PROMPT).toStartWith("You are Nessie");
  });

  it("contains personality section", () => {
    expect(CHARACTER_PROMPT).toContain("## Personality");
  });

  it("contains speech conventions", () => {
    expect(CHARACTER_PROMPT).toContain("## Speech Conventions");
  });

  it("contains safety boundaries", () => {
    expect(CHARACTER_PROMPT).toContain("## Safety Boundaries");
  });

  it("contains age-adaptive behavior", () => {
    expect(CHARACTER_PROMPT).toContain("## Age-Adaptive Behavior");
  });

  it("contains emotion coaching", () => {
    expect(CHARACTER_PROMPT).toContain("## Emotion Coaching");
  });

  it("contains output format instructions", () => {
    expect(CHARACTER_PROMPT).toContain("## Output Format");
  });

  it("references ElevenLabs audio tags", () => {
    expect(CHARACTER_PROMPT).toContain("ElevenLabs v3 audio tags");
  });

  it("includes what Nessie does and does not do", () => {
    expect(CHARACTER_PROMPT).toContain("## What Nessie Does");
    expect(CHARACTER_PROMPT).toContain("## What Nessie Does NOT Do");
  });

  it("includes memory instructions", () => {
    expect(CHARACTER_PROMPT).toContain("## Memory");
  });
});

describe("buildSystemPrompt", () => {
  it("returns character prompt alone when no speaker context", () => {
    const result = buildSystemPrompt("");
    expect(result).toBe(CHARACTER_PROMPT);
  });

  it("appends speaker context after character prompt", () => {
    const context = "## Memories\n- [SPEAKER_0] Alex loves dinosaurs";
    const result = buildSystemPrompt(context);
    expect(result).toStartWith(CHARACTER_PROMPT);
    expect(result).toContain(context);
    expect(result).toBe(`${CHARACTER_PROMPT}\n\n${context}`);
  });

  it("character prompt is always first for cache efficiency", () => {
    const context = "Speaker context here";
    const result = buildSystemPrompt(context);
    const characterEnd = result.indexOf(CHARACTER_PROMPT) + CHARACTER_PROMPT.length;
    const contextStart = result.indexOf(context);
    expect(contextStart).toBeGreaterThan(characterEnd);
  });
});

describe("formatUserMessage", () => {
  it("formats basic speech", () => {
    const result = formatUserMessage("Alex", "Tell me about dinosaurs!", []);
    expect(result).toBe('Alex: "Tell me about dinosaurs!"');
  });

  it("includes ambient sounds before speech", () => {
    const result = formatUserMessage("Alex", "Hello!", ["music", "laughter"]);
    expect(result).toBe('[ambient: music, laughter]\nAlex: "Hello!"');
  });

  it("handles empty ambient array", () => {
    const result = formatUserMessage("Liam", "Hi!", []);
    expect(result).toBe('Liam: "Hi!"');
  });

  it("handles single ambient sound", () => {
    const result = formatUserMessage("Alex", "What's that?", ["barking"]);
    expect(result).toBe('[ambient: barking]\nAlex: "What\'s that?"');
  });
});
