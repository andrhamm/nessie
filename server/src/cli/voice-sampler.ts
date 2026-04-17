#!/usr/bin/env bun
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ElevenLabsClient } from "elevenlabs";

const SAMPLE_SCRIPT = `[excited] Oh wow, a dragon! [gasps] Quick, hide behind the castle!
[whispering] Shh, I think it's coming closer.
[pirate voice] Arr, but Captain Alex isn't scared of any dragon!
[giggles] [normal] Just kidding.
[gentle] Hey, it's okay to be a little scared sometimes. I get scared too.
[curious] What do you think we should do?
[happy] That's such a good idea! Let's try it!`;

const SAMPLE_DIR = join(import.meta.dir, "../../voice-samples");

// Start numbering after existing samples
const START_INDEX = 10;

const EXCLUDE_TERMS = [
  "sexy",
  "seductive",
  "old",
  "elderly",
  "mature",
  "gruff",
  "deep",
  "gravelly",
  "raspy",
  "dark",
  "sinister",
  "villain",
  "horror",
  "scary",
  "male",
  "man",
  "sad",
  "sleepy",
  "drunk",
  "angry",
  "aggressive",
  "adult",
  "serious",
  "sultry",
  "husky",
  "rough",
  "stern",
  "narrator",
  "audiobook",
  "news",
  "corporate",
];

const EXCLUDE_AGES = ["adult", "middle aged", "old"];

const INCLUDE_TERMS = [
  "squeaky",
  "bright",
  "cute",
  "sweet",
  "high-pitched",
  "pixie",
  "fairy",
  "tiny",
  "chipmunk",
  "bubbly",
  "chirpy",
  "peppy",
  "perky",
  "cheerful",
  "giggly",
  "childlike",
  "child",
  "young",
  "girl",
  "princess",
  "magical",
  "whimsical",
  "playful",
  "energetic",
  "lively",
  "sparkle",
  "sprite",
  "elf",
  "creature",
  "cartoon",
  "animated",
  "kawaii",
];

interface ScoredVoice {
  voice_id: string;
  name: string;
  description: string;
  age: string;
  gender: string;
  score: number;
}

import { readdirSync } from "node:fs";

function getExistingSampleNames(): Set<string> {
  try {
    const files = readdirSync(SAMPLE_DIR);
    return new Set(files.map((f) => f.replace(/^\d+_/, "").replace(/\.mp3$/, "")));
  } catch {
    return new Set();
  }
}

async function findCandidates(client: ElevenLabsClient): Promise<ScoredVoice[]> {
  const existing = getExistingSampleNames();
  const candidates: ScoredVoice[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const result = await client.voices.getShared({
      use_cases: "characters_animation",
      page_size: 100,
      page,
    });

    for (const voice of result.voices) {
      const searchText =
        `${voice.name} ${voice.description || ""} ${voice.age || ""} ${voice.gender || ""}`.toLowerCase();

      if (EXCLUDE_TERMS.some((t) => searchText.includes(t))) continue;
      const voiceAge = (voice.age || "").toLowerCase();
      if (EXCLUDE_AGES.some((a) => voiceAge.includes(a))) continue;

      let score = 0;
      for (const term of INCLUDE_TERMS) {
        if (searchText.includes(term)) score++;
      }

      const safeName = voice.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      if (existing.has(safeName)) continue;

      if (score > 0) {
        candidates.push({
          voice_id: voice.voice_id,
          name: voice.name,
          description: (voice.description || "").slice(0, 100),
          age: voice.age || "",
          gender: voice.gender || "",
          score,
        });
      }
    }

    hasMore = result.voices.length === 100;
    page++;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates;
}

async function generateSample(
  client: ElevenLabsClient,
  voice: ScoredVoice,
  index: number,
): Promise<string> {
  const audio = await client.textToSpeech.convert(voice.voice_id, {
    text: SAMPLE_SCRIPT,
    model_id: "eleven_v3",
  });

  const safeName = voice.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `${String(START_INDEX + index + 1).padStart(2, "0")}_${safeName}.mp3`;
  const filepath = join(SAMPLE_DIR, filename);

  const chunks: Uint8Array[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  await writeFile(filepath, buffer);

  return filename;
}

const client = new ElevenLabsClient();

console.log("Scanning voice library for Nessie candidates...\n");
const candidates = await findCandidates(client);
console.log(`Found ${candidates.length} candidates. Top 10:\n`);

const top10 = candidates.slice(0, 10);
for (const [i, v] of top10.entries()) {
  console.log(`${i + 1}. ${v.name} (score: ${v.score}, ${v.age} ${v.gender})`);
  console.log(`   ${v.description}`);
  console.log(`   ID: ${v.voice_id}\n`);
}

console.log(`\nGenerating ${top10.length} samples with v3...\n`);
console.log("Script:");
console.log(SAMPLE_SCRIPT);
console.log("\n---\n");

for (const [i, v] of top10.entries()) {
  process.stdout.write(`${i + 1}/${top10.length} ${v.name}... `);
  const filename = await generateSample(client, v, i);
  console.log(`saved: ${filename}`);
}

console.log(`\nDone! Samples saved to: ${SAMPLE_DIR}`);
console.log("\nPreview them with: open voice-samples/");
