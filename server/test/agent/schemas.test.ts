import { describe, expect, it } from "bun:test";
import { AgentInputSchema, AgentOutputSchema, SpeakerSchema } from "../../src/agent/schemas";

describe("SpeakerSchema", () => {
  it("parses a valid speaker", () => {
    const result = SpeakerSchema.safeParse({
      id: "SPEAKER_0",
      name: "Alex",
      age: 6,
      preferences: ["dinosaurs", "purple"],
    });
    expect(result.success).toBe(true);
  });

  it("parses speaker with empty preferences", () => {
    const result = SpeakerSchema.safeParse({
      id: "SPEAKER_0",
      name: "Unknown",
      age: 0,
      preferences: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = SpeakerSchema.safeParse({
      name: "Alex",
      age: 6,
      preferences: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = SpeakerSchema.safeParse({
      id: "SPEAKER_0",
      age: 6,
      preferences: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-number age", () => {
    const result = SpeakerSchema.safeParse({
      id: "SPEAKER_0",
      name: "Alex",
      age: "six",
      preferences: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-array preferences", () => {
    const result = SpeakerSchema.safeParse({
      id: "SPEAKER_0",
      name: "Alex",
      age: 6,
      preferences: "dinosaurs",
    });
    expect(result.success).toBe(false);
  });
});

describe("AgentInputSchema", () => {
  const validInput = {
    device_id: "device-001",
    speaker: {
      id: "SPEAKER_0",
      name: "Alex",
      age: 6,
      preferences: ["dinosaurs"],
    },
    text: "Tell me about dinosaurs!",
    ambient: [],
    timestamp: 1713264000000,
  };

  it("parses valid input", () => {
    const result = AgentInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("parses input with ambient sounds", () => {
    const result = AgentInputSchema.safeParse({
      ...validInput,
      ambient: ["music", "laughter"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing device_id", () => {
    const { device_id: _, ...rest } = validInput;
    const result = AgentInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing text", () => {
    const { text: _, ...rest } = validInput;
    const result = AgentInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing timestamp", () => {
    const { timestamp: _, ...rest } = validInput;
    const result = AgentInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing speaker", () => {
    const { speaker: _, ...rest } = validInput;
    const result = AgentInputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("parses input with empty text", () => {
    const result = AgentInputSchema.safeParse({ ...validInput, text: "" });
    expect(result.success).toBe(true);
  });

  it("parses input with special characters in text", () => {
    const result = AgentInputSchema.safeParse({
      ...validInput,
      text: '[excited] Let\'s play! <tag> & "quotes"',
    });
    expect(result.success).toBe(true);
  });
});

describe("AgentOutputSchema", () => {
  const validOutput = {
    speech: "[excited] Oh wow, dinosaurs! [giggles]",
    led_color: "#FFD700",
    led_mode: "pulse" as const,
    save_memory: "Alex loves dinosaurs",
    memory_speaker: "SPEAKER_0",
  };

  it("parses valid output", () => {
    const result = AgentOutputSchema.safeParse(validOutput);
    expect(result.success).toBe(true);
  });

  it("parses output with empty speech (no verbal response)", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      speech: "",
    });
    expect(result.success).toBe(true);
  });

  it("parses output with empty save_memory (nothing to remember)", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      save_memory: "",
      memory_speaker: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts led_mode solid", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      led_mode: "solid",
    });
    expect(result.success).toBe(true);
  });

  it("accepts led_mode flash", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      led_mode: "flash",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid led_mode", () => {
    const result = AgentOutputSchema.safeParse({
      ...validOutput,
      led_mode: "blink",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing speech", () => {
    const { speech: _, ...rest } = validOutput;
    const result = AgentOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing led_color", () => {
    const { led_color: _, ...rest } = validOutput;
    const result = AgentOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing led_mode", () => {
    const { led_mode: _, ...rest } = validOutput;
    const result = AgentOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing save_memory", () => {
    const { save_memory: _, ...rest } = validOutput;
    const result = AgentOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects missing memory_speaker", () => {
    const { memory_speaker: _, ...rest } = validOutput;
    const result = AgentOutputSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
