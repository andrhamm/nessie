import { describe, expect, it } from "bun:test";
import { stripTags } from "../../src/utils/speech";

describe("stripTags", () => {
  it("removes a single tag", () => {
    expect(stripTags("[excited] Hello!")).toBe("Hello!");
  });

  it("removes multiple tags", () => {
    expect(stripTags("[excited] Oh wow! [giggles] Amazing!")).toBe("Oh wow! Amazing!");
  });

  it("removes tags with spaces inside", () => {
    expect(stripTags("[pirate voice] Arr matey!")).toBe("Arr matey!");
  });

  it("removes action tags", () => {
    expect(stripTags("[laughs] Ha ha! [pauses] Wait...")).toBe("Ha ha! Wait...");
  });

  it("handles empty brackets", () => {
    expect(stripTags("[] Hello")).toBe("Hello");
  });

  it("handles text with no tags", () => {
    expect(stripTags("Just plain text")).toBe("Just plain text");
  });

  it("handles empty string", () => {
    expect(stripTags("")).toBe("");
  });

  it("normalizes multiple spaces after tag removal", () => {
    expect(stripTags("[tag]  [tag]  hello")).toBe("hello");
  });

  it("trims leading/trailing whitespace", () => {
    expect(stripTags("  [excited]  Hello!  ")).toBe("Hello!");
  });

  it("handles tags at the end", () => {
    expect(stripTags("Hello! [giggles]")).toBe("Hello!");
  });

  it("handles adjacent tags", () => {
    expect(stripTags("[excited][gasps] Wow!")).toBe("Wow!");
  });

  it("handles complex real-world speech", () => {
    const speech = "[pirate voice] Arr, Captain Alex! [whispers] I think I see a whale! [gasps]";
    expect(stripTags(speech)).toBe("Arr, Captain Alex! I think I see a whale!");
  });

  it("preserves parentheses and other punctuation", () => {
    expect(stripTags("[gentle] It's okay (really). Don't worry!")).toBe(
      "It's okay (really). Don't worry!",
    );
  });

  it("does not remove angle brackets or curly braces", () => {
    expect(stripTags("<html> {code} [tag] text")).toBe("<html> {code} text");
  });
});
