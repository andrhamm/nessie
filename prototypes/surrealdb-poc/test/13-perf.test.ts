import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { DateTime, RecordId } from "surrealdb";
import { embed } from "../src/embed.ts";
import { indexOne } from "../src/indexer.ts";
import { writeMdFile } from "../src/seed.ts";
import { setupFixture, type TestFixture } from "./_helpers.ts";

const PERSON_COUNT = 50;
const MEMORY_COUNT = 500;
const EVENT_COUNT = 500;
const JOURNAL_COUNT = 500;
const FILLER_COUNT = 450;
const EDGE_COUNT = 200;

// Deterministic-ish pseudo-random strings so ranking is stable across runs.
const VERBS = [
  "baked",
  "sang",
  "ran",
  "read",
  "built",
  "painted",
  "wrote",
  "danced",
  "climbed",
  "swam",
];
const NOUNS = [
  "cookies",
  "song",
  "marathon",
  "book",
  "tower",
  "picture",
  "story",
  "routine",
  "mountain",
  "lap",
];
const WITH = [
  "with Grandma Dana",
  "with Zoe",
  "with Dad",
  "alone",
  "after lunch",
  "before bed",
  "in the park",
];

function sentence(seed: number): string {
  const v = VERBS[seed % VERBS.length];
  const n = NOUNS[(seed * 7) % NOUNS.length];
  const w = WITH[(seed * 13) % WITH.length];
  return `Alex ${v} a ${n} ${w}.`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx] ?? 0;
}

let f: TestFixture;
let buildMs = 0;

beforeAll(async () => {
  f = await setupFixture("13-perf");

  // Seed persons
  for (let i = 0; i < PERSON_COUNT; i++) {
    const slug = `person-${i}`;
    await writeMdFile(
      f.mdDir,
      `person/${slug}.md`,
      { slug, name: `Person ${i}`, relation: i < 5 ? "grandparent" : "friend" },
      `Person ${i} is friendly and ${sentence(i)}`,
    );
  }
  for (let i = 0; i < MEMORY_COUNT; i++) {
    await writeMdFile(
      f.mdDir,
      `memory/mem-${i}.md`,
      { id: `mem-${i}`, subject: `person/person-${i % PERSON_COUNT}` },
      sentence(i),
    );
  }
  for (let i = 0; i < EVENT_COUNT; i++) {
    const date = `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
    await writeMdFile(
      f.mdDir,
      `event/${date}-evt-${i}.md`,
      {
        id: `evt-${i}`,
        date,
        title: `Event ${i}`,
        status: "past",
        participants: { speakers: ["SPEAKER_0"], persons: [`person-${i % PERSON_COUNT}`] },
      },
      sentence(i + 1000),
    );
  }
  for (let i = 0; i < JOURNAL_COUNT; i++) {
    const date = `2026-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
    await writeMdFile(
      f.mdDir,
      `journal/${date}-jrn-${i}.md`,
      { date, speakers: ["SPEAKER_0"] },
      sentence(i + 2000),
    );
  }
  for (let i = 0; i < FILLER_COUNT; i++) {
    await writeMdFile(
      f.mdDir,
      `memory/filler-${i}.md`,
      { id: `filler-${i}`, subject: "speakers/SPEAKER_0" },
      sentence(i + 3000),
    );
  }

  // Build: walk the tree and indexOne everything.
  const t0 = performance.now();
  const { Glob } = await import("bun");
  const glob = new Glob("**/*.md");
  for await (const rel of glob.scan({ cwd: f.mdDir })) {
    await indexOne(f.db, f.mdDir, rel);
  }
  buildMs = performance.now() - t0;
  console.log(
    `[13-perf] cold rebuild: ${Math.round(buildMs)}ms for ${PERSON_COUNT + MEMORY_COUNT + EVENT_COUNT + JOURNAL_COUNT + FILLER_COUNT} docs`,
  );

  // Add some edges for the traversal bench
  for (let i = 0; i < EDGE_COUNT; i++) {
    const a = i % PERSON_COUNT;
    const b = (i * 7 + 1) % PERSON_COUNT;
    if (a === b) continue;
    await f.db.query(`RELATE $from -> friend_of -> $to`, {
      from: new RecordId("person", `person-${a}`),
      to: new RecordId("person", `person-${b}`),
    });
  }
}, 10 * 60_000);

afterAll(async () => {
  await f.cleanup();
});

describe("13-perf — latency envelope", () => {
  it("cold rebuild is under 2 minutes", () => {
    expect(buildMs).toBeLessThan(120_000);
  });

  it(
    "hybrid query p50/p95 (1000 runs over the memory collection)",
    async () => {
      const queryText = "cookies Grandma baking Christmas";
      const qvec = Array.from(await embed(queryText));
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const t0 = performance.now();
        await f.db.query(
          `
        LET $vs = (SELECT id FROM memory WHERE embedding <|10,100|> $qvec);
        LET $ft = (SELECT id, search::score(1) AS score FROM memory
                   WHERE body @1@ 'cookies baked Grandma' ORDER BY score DESC LIMIT 10);
        RETURN search::rrf([$vs, $ft], 10, 60);
        `,
          { qvec },
        );
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p50 = percentile(samples, 0.5);
      const p95 = percentile(samples, 0.95);
      console.log(
        `[13-perf] hybrid RRF over memory: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`,
      );
      expect(p95).toBeLessThan(100);
    },
    5 * 60_000,
  );

  it(
    "2-hop graph traversal p50/p95 (1000 runs)",
    async () => {
      const samples: number[] = [];
      for (let i = 0; i < 1000; i++) {
        const start = new RecordId("person", `person-${i % PERSON_COUNT}`);
        const t0 = performance.now();
        await f.db.query(`SELECT VALUE ->friend_of->person->friend_of->person FROM $start`, {
          start,
        });
        samples.push(performance.now() - t0);
      }
      samples.sort((a, b) => a - b);
      const p50 = percentile(samples, 0.5);
      const p95 = percentile(samples, 0.95);
      console.log(
        `[13-perf] 2-hop friend_of traversal: p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms`,
      );
      expect(p95).toBeLessThan(20);
    },
    5 * 60_000,
  );
});
