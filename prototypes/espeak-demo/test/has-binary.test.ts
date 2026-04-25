import { expect, test } from "bun:test";
import { hasBinary } from "../src/has-binary";

test("hasBinary returns true for sh", () => {
  expect(hasBinary("sh")).toBe(true);
});

test("hasBinary returns false for missing binary", () => {
  expect(hasBinary("this-binary-does-not-exist-zzz-xyz")).toBe(false);
});
