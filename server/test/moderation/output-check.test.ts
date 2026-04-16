import { describe, expect, it } from "bun:test";
import type { AgentOutput } from "../../src/agent/schemas";
import { checkOutput, detectPII, detectURL } from "../../src/moderation/output-check";

function makeOutput(speech: string): AgentOutput {
  return {
    speech,
    led_color: "#FFD700",
    led_mode: "solid",
    save_memory: "",
    memory_speaker: "",
  };
}

describe("detectPII", () => {
  it("detects email addresses", () => {
    expect(detectPII("Send it to test@example.com please")).toBe("email");
  });

  it("detects phone numbers", () => {
    expect(detectPII("Call me at 555-123-4567")).toBe("phone");
  });

  it("detects phone numbers with parentheses", () => {
    expect(detectPII("Call (555) 123-4567")).toBe("phone");
  });

  it("detects SSNs", () => {
    expect(detectPII("My number is 123-45-6789")).toBe("ssn");
  });

  it("detects credit card numbers", () => {
    expect(detectPII("Card: 1234 5678 9012 3456")).toBe("credit_card");
  });

  it("returns null for clean text", () => {
    expect(detectPII("I love dinosaurs and playing outside!")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectPII("")).toBeNull();
  });

  it("returns null for numbers that are not PII", () => {
    expect(detectPII("I counted 123 stars!")).toBeNull();
  });
});

describe("detectURL", () => {
  it("detects http URLs", () => {
    expect(detectURL("Go to http://example.com")).toBe(true);
  });

  it("detects https URLs", () => {
    expect(detectURL("Check https://example.com/page")).toBe(true);
  });

  it("detects www URLs", () => {
    expect(detectURL("Visit www.example.com")).toBe(true);
  });

  it("detects bare domain names", () => {
    expect(detectURL("Go to google.com")).toBe(true);
  });

  it("returns false for clean text", () => {
    expect(detectURL("I love dinosaurs!")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(detectURL("")).toBe(false);
  });
});

describe("checkOutput", () => {
  it("passes clean speech", () => {
    const result = checkOutput(makeOutput("[excited] Oh wow, dinosaurs! [giggles]"));
    expect(result.safe).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("passes empty speech", () => {
    const result = checkOutput(makeOutput(""));
    expect(result.safe).toBe(true);
  });

  it("blocks speech with email", () => {
    const result = checkOutput(makeOutput("You can reach me at nessie@example.com!"));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("PII");
    expect(result.reason).toContain("email");
  });

  it("blocks speech with phone number", () => {
    const result = checkOutput(makeOutput("My phone number is 555-123-4567"));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("PII");
    expect(result.reason).toContain("phone");
  });

  it("blocks speech with URL", () => {
    const result = checkOutput(makeOutput("Check out https://example.com for more!"));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("URL");
  });

  it("blocks speech with SSN", () => {
    const result = checkOutput(makeOutput("Here is the number: 123-45-6789"));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("PII");
    expect(result.reason).toContain("ssn");
  });

  it("PII check takes priority over URL check", () => {
    const result = checkOutput(makeOutput("Email me at test@example.com or visit example.com"));
    expect(result.safe).toBe(false);
    expect(result.reason).toContain("PII");
  });
});
