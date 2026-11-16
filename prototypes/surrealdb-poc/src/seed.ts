import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { serializeMd } from "./frontmatter.ts";

/**
 * Write a single .md file with frontmatter + body. Creates parent dirs.
 */
export async function writeMdFile(
  mdDir: string,
  relPath: string,
  frontmatter: Record<string, unknown>,
  body: string,
): Promise<string> {
  const abs = resolve(join(mdDir, relPath));
  const dir = abs.substring(0, abs.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(abs, serializeMd({ frontmatter, body }), "utf8");
  return abs;
}

/**
 * Seed a handful of canonical sample docs (one per entity kind) useful for
 * tests that want a warm starting point without generating large corpora.
 */
export async function seedSampleCorpus(mdDir: string): Promise<void> {
  await writeMdFile(
    mdDir,
    "routine.md",
    { updated: "2026-04-18T09:00Z" },
    `# Default routine

- Mornings are school-drop-off (weekdays) or slow and quiet (weekends)
- After school: snack, homework, free play until 17:30
- Dinner at 18:00
- Bedtime routine starts at 19:30
`,
  );

  await writeMdFile(
    mdDir,
    "constraints.md",
    { updated: "2026-04-18T09:00Z" },
    `# Active constraints

- Alex needs a bath sometime today, finished before bedtime routine
- No new scary stories this week (Alex had a nightmare)
`,
  );

  await writeMdFile(
    mdDir,
    "profile/SPEAKER_0.md",
    { speaker: "SPEAKER_0", name: "Alex", age: 6, pronouns: "she/her" },
    `Alex is curious, loud in the mornings, quiet in the evenings. Loves
dinosaurs, especially T-Rex.`,
  );

  await writeMdFile(
    mdDir,
    "person/grandma-dana.md",
    {
      slug: "grandma-dana",
      name: "Dana",
      aliases: ["Gran Dana", "Nana"],
      relation: "grandparent",
      known_to: ["SPEAKER_0"],
      lives: "Seattle",
    },
    `Grandma Dana bakes raviolis every Christmas and saves the first plate
for Alex. Calls on Sundays.`,
  );

  await writeMdFile(
    mdDir,
    "memory/mem-001.md",
    {
      id: "mem-001",
      subject: "person/grandma-dana",
      tags: ["food", "tradition"],
      created: "2026-04-14",
      source: "parent",
    },
    `Grandma Dana makes homemade raviolis every Christmas and always saves
the first plate for Alex.`,
  );

  await writeMdFile(
    mdDir,
    "event/2026-03-29-easter.md",
    {
      id: "evt-2026-03-29-easter",
      date: "2026-03-29",
      time: "10:00",
      title: "Easter at Grandma Dana's",
      status: "past",
      participants: {
        speakers: ["SPEAKER_0"],
        persons: ["grandma-dana"],
      },
      tags: ["holiday", "family"],
    },
    `Easter brunch at Grandma Dana's. Egg hunt in the garden.`,
  );

  await writeMdFile(
    mdDir,
    "journal/2026-04-16-dinosaurs.md",
    {
      date: "2026-04-16",
      speakers: ["SPEAKER_0"],
      persons_mentioned: ["grandma-dana"],
      refs: ["memory/mem-001.md"],
      tags: ["play_session", "dinosaurs"],
    },
    `Alex spent the whole afternoon acting out a T-Rex discovery expedition.
Mentioned wanting to tell Grandma Dana about it.`,
  );
}
