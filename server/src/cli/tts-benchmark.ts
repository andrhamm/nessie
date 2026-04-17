#!/usr/bin/env bun
import { ElevenLabsClient } from "elevenlabs";

const VOICE_ID = "emSmWzY0c0xtx5IFMCVv";
const TEXT =
  "[excited] Oh wow! [gasps] Did you say dinosaurs?! [playfully] I LOVE dinosaurs! [giggles] Want to go on an adventure?";
const RUNS = 3;

const formats = ["mp3_44100_128", "pcm_16000", "pcm_22050", "pcm_24000"] as const;

const client = new ElevenLabsClient();

console.log(`Benchmarking ElevenLabs TTS (${RUNS} runs per format)`);
console.log(`Voice: ${VOICE_ID}`);
console.log(`Model: eleven_v3`);
console.log(`Text: ${TEXT.length} chars\n`);

for (const format of formats) {
  const times: number[] = [];
  const sizes: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();

    const audio = await client.textToSpeech.convert(VOICE_ID, {
      text: TEXT,
      model_id: "eleven_v3",
      output_format: format,
    });

    const chunks: Uint8Array[] = [];
    for await (const chunk of audio) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const elapsed = performance.now() - start;
    times.push(elapsed);
    sizes.push(buffer.length);

    process.stdout.write(".");
  }

  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

  console.log(`\n${format}:`);
  console.log(`  avg time: ${Math.round(avgTime)}ms`);
  console.log(`  avg size: ${Math.round(avgSize / 1024)}KB`);
  console.log(`  runs: ${times.map((t) => `${Math.round(t)}ms`).join(", ")}`);
}
