import { expect, test } from "bun:test";
import { parseScript } from "../src/emotion-map";

const SCRIPT = `[excited] Oh wow, a dragon! [gasps] Quick, hide behind the castle!
[whispering] Shh, I think it's coming closer.
[pirate voice] Arr, but Captain Alex isn't scared of any dragon!
[giggles] [normal] Just kidding.
[gentle] Hey, it's okay to be a little scared sometimes. I get scared too.
[curious] What do you think we should do?
[happy] That's such a good idea! Let's try it!`;

test("parseScript produces one segment per non-empty tag region", () => {
  const segs = parseScript(SCRIPT);
  expect(segs.map((s) => s.source)).toEqual([
    "excited",
    "gasps",
    "whispering",
    "pirate voice",
    "normal",
    "gentle",
    "curious",
    "happy",
  ]);
});

test("parseScript applies [excited] speed/pitch/amplitude overrides", () => {
  const segs = parseScript(SCRIPT);
  const excited = segs.find((s) => s.source === "excited");
  expect(excited).toBeDefined();
  expect(excited?.params.speed).toBe(228);
  expect(excited?.params.pitch).toBe(65);
  expect(excited?.params.amplitude).toBe(110);
});

test("parseScript maps [whispering] to voiceVariant and low amp", () => {
  const segs = parseScript(SCRIPT);
  const w = segs.find((s) => s.source === "whispering");
  expect(w?.params.voiceVariant).toBe("+whisper");
  expect(w?.params.amplitude).toBe(40);
});

test("parseScript treats [gasps] as default params (non-verbal dropped)", () => {
  const segs = parseScript(SCRIPT);
  const gasps = segs.find((s) => s.source === "gasps");
  expect(gasps?.params.speed).toBe(175);
  expect(gasps?.params.pitch).toBe(50);
  expect(gasps?.params.amplitude).toBe(100);
});

test("parseScript strips unknown tags and defaults their text", () => {
  const segs = parseScript("[mystery] hello [normal] world");
  expect(segs.map((s) => s.text)).toEqual(["hello", "world"]);
  const [first] = segs;
  expect(first?.params.pitch).toBe(50);
});

test("parseScript drops [giggles][normal] empty-text region for giggles", () => {
  const segs = parseScript("[giggles] [normal] Just kidding.");
  expect(segs.map((s) => s.source)).toEqual(["normal"]);
  const [first] = segs;
  expect(first?.text).toBe("Just kidding.");
});
