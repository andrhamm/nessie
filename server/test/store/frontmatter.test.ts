import { describe, expect, it } from "bun:test";
import { parseMd, serializeMd } from "../../src/store/frontmatter";

describe("parseMd", () => {
  it("returns empty frontmatter and full body when no --- block", () => {
    const { frontmatter, body } = parseMd("# hello\nworld");
    expect(frontmatter).toEqual({});
    expect(body).toBe("# hello\nworld");
  });

  it("parses YAML frontmatter and separates body", () => {
    const src = "---\nslug: foo\nname: Foo\n---\nbody text";
    const { frontmatter, body } = parseMd(src);
    expect(frontmatter).toEqual({ slug: "foo", name: "Foo" });
    expect(body).toBe("body text");
  });

  it("handles empty body", () => {
    const src = "---\nslug: foo\n---\n";
    const { frontmatter, body } = parseMd(src);
    expect(frontmatter).toEqual({ slug: "foo" });
    expect(body).toBe("");
  });

  it("parses nested and list values", () => {
    const src = "---\nslug: foo\naliases:\n  - A\n  - B\n---\nhello";
    const { frontmatter } = parseMd(src);
    expect(frontmatter.aliases).toEqual(["A", "B"]);
  });
});

describe("serializeMd", () => {
  it("skips frontmatter when empty", () => {
    expect(serializeMd({ frontmatter: {}, body: "hi" })).toBe("hi");
  });

  it("round-trips simple frontmatter", () => {
    const original = { frontmatter: { slug: "foo", name: "Foo" }, body: "hi" };
    const roundtripped = parseMd(serializeMd(original));
    expect(roundtripped.frontmatter).toEqual(original.frontmatter);
    expect(roundtripped.body).toBe(original.body);
  });

  it("round-trips nested structures", () => {
    const original = {
      frontmatter: {
        id: "evt-1",
        date: "2026-04-18",
        participants: { speakers: ["S0"], persons: ["grandma-dana"] },
      },
      body: "narrative",
    };
    const roundtripped = parseMd(serializeMd(original));
    expect(roundtripped.frontmatter).toEqual(original.frontmatter);
    expect(roundtripped.body).toBe(original.body);
  });
});
