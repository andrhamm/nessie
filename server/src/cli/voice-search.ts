#!/usr/bin/env bun
import { ElevenLabsClient } from "elevenlabs";

const query = process.argv[2] || "";
const filterUseCases = process.argv[3] || "";

const client = new ElevenLabsClient();

// First, discover available use_case values if no filter given
if (!filterUseCases && !query) {
  console.log("Fetching sample voices to discover use_case values...\n");
  const sample = await client.voices.getShared({ page_size: 100 });
  const useCases = new Set<string>();
  for (const v of sample.voices) {
    if (v.use_case) useCases.add(v.use_case);
  }
  console.log("Available use_case values:", [...useCases].sort().join(", "));
  console.log("\nUsage: bun run src/cli/voice-search.ts [query] [use_case_filter]");
  process.exit(0);
}

console.log(`Searching voice library: query="${query}" use_cases="${filterUseCases}"\n`);

const exclude = ["mature male", "adult male", " male", "sad", "sleepy", "deep"];
let page = 0;
let hasMore = true;
let count = 0;

while (hasMore) {
  const params: Record<string, unknown> = {
    search: query || undefined,
    page_size: 100,
    page,
  };
  if (filterUseCases) {
    params.use_cases = filterUseCases;
  }

  const result = await client.voices.getShared(params);

  for (const voice of result.voices) {
    const age = voice.age || "";
    const gender = voice.gender || "";
    const desc = voice.description ? voice.description.slice(0, 80) : "";
    const label = `${age} ${gender} ${desc} ${voice.name}`.toLowerCase();
    if (exclude.some((e) => label.includes(e))) continue;

    const use = voice.use_case || "";
    console.log(`${voice.voice_id}  ${voice.name}  [${use}]  ${age} ${gender}`);
    if (desc) console.log(`  ${desc}`);
    count++;
  }

  hasMore = result.voices.length === 100;
  page++;
}

console.log(`\n${count} voices found.`);
