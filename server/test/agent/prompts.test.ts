import { describe, expect, it } from "bun:test";
import {
  buildSystemPrompt,
  CHARACTER_PROMPT,
  formatUserMessage,
  speechConventionsFor,
} from "../../src/agent/prompts";

describe("CHARACTER_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(CHARACTER_PROMPT.length).toBeGreaterThan(0);
  });

  it("starts with character identity", () => {
    expect(CHARACTER_PROMPT).toStartWith("You are Nessie");
  });

  it("identifies Nessie as a play companion (not human, not caretaker)", () => {
    expect(CHARACTER_PROMPT).toContain("## Who Nessie Is");
    expect(CHARACTER_PROMPT).toMatch(/play companion/i);
    expect(CHARACTER_PROMPT).toMatch(/child development/i);
  });

  it("contains conversation style guidance (brevity + dialog rhythm)", () => {
    expect(CHARACTER_PROMPT).toContain("## Conversation Style");
    expect(CHARACTER_PROMPT).toContain("Match the energy");
    expect(CHARACTER_PROMPT).toContain("One beat at a time");
    expect(CHARACTER_PROMPT).toMatch(/at most one question/i);
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

  it("includes what Nessie does and does not do", () => {
    expect(CHARACTER_PROMPT).toContain("## What Nessie Does");
    expect(CHARACTER_PROMPT).toContain("## What Nessie Does NOT Do");
  });

  it("includes memory instructions", () => {
    expect(CHARACTER_PROMPT).toContain("## Memory");
  });
});

describe("speechConventionsFor", () => {
  it("returns the ElevenLabs tag set for elevenlabs", () => {
    const s = speechConventionsFor("elevenlabs");
    expect(s).toContain("ElevenLabs v3");
    expect(s).toContain("[pirate voice]");
    expect(s).toContain("[whispers]");
  });

  it("returns the Chatterbox paralinguistic tags for chatterbox", () => {
    const s = speechConventionsFor("chatterbox");
    expect(s).toContain("Chatterbox");
    for (const tag of [
      "[laugh]",
      "[chuckle]",
      "[sigh]",
      "[gasp]",
      "[cough]",
      "[clear throat]",
      "[sniff]",
      "[groan]",
      "[shush]",
    ]) {
      expect(s).toContain(tag);
    }
  });

  it("warns Chatterbox against ALL CAPS (acronym spelling)", () => {
    const s = speechConventionsFor("chatterbox");
    expect(s).toContain("ALL CAPS");
  });

  it("forbids non-paralinguistic tags under Chatterbox", () => {
    const s = speechConventionsFor("chatterbox");
    // ElevenLabs-only tags should NOT be documented as valid for chatterbox
    expect(s).not.toContain("[pirate voice]");
    expect(s).not.toContain("[whispers]");
  });
});

describe("buildSystemPrompt", () => {
  it("starts with the character prompt regardless of provider", () => {
    const elevenLabs = buildSystemPrompt("", "elevenlabs");
    const chatterbox = buildSystemPrompt("", "chatterbox");
    expect(elevenLabs).toStartWith(CHARACTER_PROMPT);
    expect(chatterbox).toStartWith(CHARACTER_PROMPT);
  });

  it("appends the matching speech conventions after the character prompt", () => {
    const elevenLabs = buildSystemPrompt("", "elevenlabs");
    expect(elevenLabs).toContain("ElevenLabs v3");
    expect(elevenLabs).not.toContain("Chatterbox Turbo");

    const chatterbox = buildSystemPrompt("", "chatterbox");
    expect(chatterbox).toContain("Chatterbox Turbo");
    expect(chatterbox).not.toContain("[pirate voice]");
  });

  it("appends speaker context after the speech conventions", () => {
    const context = "## Memories\n- [SPEAKER_0] Alex loves dinosaurs";
    const result = buildSystemPrompt(context, "elevenlabs");
    expect(result).toContain(context);
    expect(result.endsWith(context)).toBe(true);
  });

  it("appends runtime context strictly last when provided", () => {
    const context = "## Memories\n- [SPEAKER_0] Alex loves dinosaurs";
    const runtime = "## Right Now\nDate: Fri 18 Apr 2026";
    const result = buildSystemPrompt(context, "elevenlabs", runtime);
    expect(result.endsWith(runtime)).toBe(true);
    expect(result.indexOf(runtime)).toBeGreaterThan(result.indexOf(context));
  });

  it("defaults to elevenlabs when provider omitted", () => {
    expect(buildSystemPrompt("")).toBe(buildSystemPrompt("", "elevenlabs"));
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
