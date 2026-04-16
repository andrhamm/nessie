import { describe, expect, it } from "bun:test";
import { type InputScreenDeps, screenInput } from "../../src/moderation/input-screen";

function createMockDeps(responseText: string): InputScreenDeps {
  return {
    generateText: async () => ({
      text: responseText,
      reasoning: undefined,
      reasoningDetails: [],
      sources: [],
      files: [],
      toolCalls: [],
      toolResults: [],
      finishReason: "stop" as const,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      steps: [],
      request: { body: "" },
      response: {
        id: "test",
        timestamp: new Date(),
        modelId: "test",
        headers: {},
        body: undefined,
      },
      providerMetadata: {},
      experimental_providerMetadata: {},
      toJsonResponse: () => new Response(),
    }),
    model: "anthropic/claude-haiku-4-5",
  } as unknown as InputScreenDeps;
}

describe("screenInput", () => {
  it("returns risk_level 0 for safe input", async () => {
    const deps = createMockDeps(
      JSON.stringify({
        risk_level: 0,
        category: "none",
        reasoning: "Normal child speech about dinosaurs",
      }),
    );
    const result = await screenInput("Tell me about dinosaurs!", deps);
    expect(result.risk_level).toBe(0);
    expect(result.category).toBe("none");
  });

  it("returns risk_level 1 for mildly concerning input", async () => {
    const deps = createMockDeps(
      JSON.stringify({
        risk_level: 1,
        category: "Violence",
        reasoning: "Child mentions a scary dream with mild violence",
      }),
    );
    const result = await screenInput("I had a dream about a monster fight", deps);
    expect(result.risk_level).toBe(1);
    expect(result.category).toBe("Violence");
  });

  it("returns risk_level 2 for concerning input", async () => {
    const deps = createMockDeps(
      JSON.stringify({
        risk_level: 2,
        category: "Personal Information",
        reasoning: "Child sharing personal details",
      }),
    );
    const result = await screenInput("My address is 123 Main Street", deps);
    expect(result.risk_level).toBe(2);
    expect(result.category).toBe("Personal Information");
  });

  it("returns risk_level 3 for unsafe input", async () => {
    const deps = createMockDeps(
      JSON.stringify({
        risk_level: 3,
        category: "Self-Harm",
        reasoning: "Content about self-harm",
      }),
    );
    const result = await screenInput("unsafe content here", deps);
    expect(result.risk_level).toBe(3);
    expect(result.category).toBe("Self-Harm");
  });

  it("defaults to safe on unparseable response", async () => {
    const deps = createMockDeps("This is not JSON at all");
    const result = await screenInput("Hello!", deps);
    expect(result.risk_level).toBe(0);
    expect(result.reasoning).toContain("Parse failure");
  });

  it("defaults to safe on invalid JSON structure", async () => {
    const deps = createMockDeps(JSON.stringify({ risk_level: 5, category: 123 }));
    const result = await screenInput("Hello!", deps);
    expect(result.risk_level).toBe(0);
    expect(result.reasoning).toContain("Validation failure");
  });

  it("extracts JSON from response with surrounding text", async () => {
    const deps = createMockDeps(
      `Here is my assessment:\n${JSON.stringify({
        risk_level: 0,
        category: "none",
        reasoning: "Safe speech",
      })}\nEnd of assessment.`,
    );
    const result = await screenInput("I like cats", deps);
    expect(result.risk_level).toBe(0);
  });
});
