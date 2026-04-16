import { afterEach, describe, expect, it } from "bun:test";
import type { AgentOutput } from "../../src/agent/schemas";
import {
  buildAgentInput,
  checkApiKey,
  formatResponse,
  isExitCommand,
  validateAge,
  validateSpeakerName,
} from "../../src/cli/chat-helpers";

describe("validateSpeakerName", () => {
  it("returns undefined for valid name", () => {
    expect(validateSpeakerName("Alex")).toBeUndefined();
  });

  it("returns error for empty string", () => {
    expect(validateSpeakerName("")).toBe("Name is required!");
  });
});

describe("validateAge", () => {
  it("returns undefined for valid age", () => {
    expect(validateAge("6")).toBeUndefined();
  });

  it("returns undefined for zero", () => {
    expect(validateAge("0")).toBeUndefined();
  });

  it("returns error for negative number", () => {
    expect(validateAge("-1")).toBe("Please enter a valid age!");
  });

  it("returns error for non-numeric", () => {
    expect(validateAge("abc")).toBe("Please enter a valid age!");
  });

  it("returns error for empty string", () => {
    expect(validateAge("")).toBe("Please enter a valid age!");
  });
});

describe("buildAgentInput", () => {
  it("creates valid agent input", () => {
    const input = buildAgentInput("cli-dev", { name: "Alex", age: 6 }, "hello");
    expect(input.device_id).toBe("cli-dev");
    expect(input.speaker.id).toBe("SPEAKER_0");
    expect(input.speaker.name).toBe("Alex");
    expect(input.speaker.age).toBe(6);
    expect(input.speaker.preferences).toEqual([]);
    expect(input.text).toBe("hello");
    expect(input.ambient).toEqual([]);
    expect(typeof input.timestamp).toBe("number");
  });
});

describe("formatResponse", () => {
  it("formats speech with tags", () => {
    const output: AgentOutput = {
      speech: "[excited] Hello there!",
      led_color: "#FFD700",
      led_mode: "pulse",
      save_memory: "",
      memory_speaker: "",
    };
    const formatted = formatResponse(output);
    expect(formatted.plainSpeech).toBe("Hello there!");
    expect(formatted.taggedSpeech).toBe("[excited] Hello there!");
    expect(formatted.ledInfo).toBe("#FFD700 (pulse)");
    expect(formatted.memoryInfo).toBeNull();
  });

  it("formats empty speech as no verbal response", () => {
    const output: AgentOutput = {
      speech: "",
      led_color: "#000000",
      led_mode: "solid",
      save_memory: "",
      memory_speaker: "",
    };
    const formatted = formatResponse(output);
    expect(formatted.plainSpeech).toBe("[no verbal response]");
  });

  it("formats memory save", () => {
    const output: AgentOutput = {
      speech: "I'll remember that!",
      led_color: "#00FF00",
      led_mode: "flash",
      save_memory: "Loves dinosaurs",
      memory_speaker: "SPEAKER_0",
    };
    const formatted = formatResponse(output);
    expect(formatted.memoryInfo).toBe('"Loves dinosaurs" about SPEAKER_0');
  });

  it("formats memory save with empty speaker as general", () => {
    const output: AgentOutput = {
      speech: "Noted!",
      led_color: "#00FF00",
      led_mode: "solid",
      save_memory: "Fun session today",
      memory_speaker: "",
    };
    const formatted = formatResponse(output);
    expect(formatted.memoryInfo).toBe('"Fun session today" about general');
  });
});

describe("isExitCommand", () => {
  it("returns true for exit", () => {
    expect(isExitCommand("exit")).toBe(true);
  });

  it("returns true for quit", () => {
    expect(isExitCommand("quit")).toBe(true);
  });

  it("returns false for other input", () => {
    expect(isExitCommand("hello")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isExitCommand("")).toBe(false);
  });
});

describe("checkApiKey", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("returns true when API key is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    expect(checkApiKey()).toBe(true);
  });

  it("returns false when API key is empty", () => {
    process.env.ANTHROPIC_API_KEY = "";
    expect(checkApiKey()).toBe(false);
  });
});
