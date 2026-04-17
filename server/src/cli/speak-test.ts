#!/usr/bin/env bun
import { ElevenLabsClient, play } from "elevenlabs";

const text =
  process.argv[2] ||
  "[excited] Oh wow! [gasps] Did you say dinosaurs?! [playfully] I LOVE dinosaurs! [giggles]";

const voiceId = process.argv[3] || "JBFqnCBsd6RMkjVDRZzb";

console.log(`Voice: ${voiceId}`);
console.log(`Text: ${text}`);
console.log("Generating...");

const client = new ElevenLabsClient();

const audio = await client.textToSpeech.convert(voiceId, {
  text,
  model_id: "eleven_v3",
});

console.log("Playing...");
await play(audio);
console.log("Done.");
