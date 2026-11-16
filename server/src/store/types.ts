import { z } from "zod";

export const ENTITY_KINDS = [
  "person",
  "memory",
  "event",
  "journal",
  "profile",
  "routine",
  "constraint",
  "runtime_config",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export const EDGE_TYPES = [
  "sibling_of",
  "classmate_of",
  "parent_of",
  "spouse_of",
  "friend_of",
  "last_contacted",
  "mentions",
] as const;

/** Edge types Ness/Nessie can RELATE between two persons (excludes
 * operational edges like last_contacted/mentions which are managed by
 * note_contact_event and automatic indexing). */
export const PERSON_PERSON_EDGES = [
  "sibling_of",
  "parent_of",
  "spouse_of",
  "friend_of",
  "classmate_of",
] as const;

export type PersonPersonEdge = (typeof PERSON_PERSON_EDGES)[number];

export type EdgeType = (typeof EDGE_TYPES)[number];

export const EMBEDDING_DIM = 384;

/**
 * Zod schemas for the frontmatter of each entity kind. Each is `passthrough`
 * so parents can add experimental fields without breaking validation.
 */

export const PersonFrontmatterSchema = z
  .object({
    slug: z.string().min(1),
    name: z.string().min(1),
    aliases: z.array(z.string()).optional(),
    relation: z
      .enum([
        "self",
        "parent",
        "sibling",
        "grandparent",
        "aunt",
        "uncle",
        "cousin",
        "friend",
        "classmate",
        "teacher",
        "coach",
        "neighbour",
        "pet",
        "other",
      ])
      .optional(),
    known_to: z.array(z.string()).optional(),
    lives: z.string().optional(),
    birthday: z.string().optional(),
    last_mentioned: z.string().optional(),
    last_contact: z
      .object({
        date: z.string(),
        type: z.enum([
          "visit",
          "call",
          "video_call",
          "play_date",
          "text",
          "event",
          "mentioned_only",
        ]),
        event_ref: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export const MemoryFrontmatterSchema = z
  .object({
    id: z.string().min(1),
    subject: z.string().min(1),
    tags: z.array(z.string()).optional(),
    created: z.string().optional(),
    source: z.enum(["nessie", "ness", "parent"]).optional(),
  })
  .passthrough();

export const EventFrontmatterSchema = z
  .object({
    id: z.string().min(1),
    date: z.string(),
    time: z.string().optional(),
    title: z.string().min(1),
    status: z.enum(["past", "scheduled", "cancelled"]).optional(),
    participants: z
      .object({
        speakers: z.array(z.string()).default([]),
        persons: z.array(z.string()).default([]),
      })
      .optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const JournalFrontmatterSchema = z
  .object({
    date: z.string(),
    speakers: z.array(z.string()).default([]),
    persons_mentioned: z.array(z.string()).optional(),
    refs: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  })
  .passthrough();

export const ProfileFrontmatterSchema = z
  .object({
    speaker: z.string().min(1),
    name: z.string().min(1),
    age: z.number().int().nonnegative(),
    pronouns: z.string().optional(),
  })
  .passthrough();

export const SimpleUpdatedFrontmatterSchema = z
  .object({
    updated: z.string().optional(),
  })
  .passthrough();

export const RuntimeConfigFrontmatterSchema = z
  .object({
    updated: z.string().optional(),
    location: z
      .object({
        label: z.string().min(1),
        lat: z.number().optional(),
        lon: z.number().optional(),
      })
      .optional(),
    timezone: z.string().optional(),
    default_voice: z.string().optional(),
    default_provider: z.enum(["elevenlabs", "chatterbox"]).optional(),
  })
  .passthrough();

export type RuntimeConfig = z.infer<typeof RuntimeConfigFrontmatterSchema>;

export const FRONTMATTER_SCHEMAS = {
  person: PersonFrontmatterSchema,
  memory: MemoryFrontmatterSchema,
  event: EventFrontmatterSchema,
  journal: JournalFrontmatterSchema,
  profile: ProfileFrontmatterSchema,
  routine: SimpleUpdatedFrontmatterSchema,
  constraint: SimpleUpdatedFrontmatterSchema,
  runtime_config: RuntimeConfigFrontmatterSchema,
} as const satisfies Record<EntityKind, z.ZodType>;

export interface Doc {
  kind: EntityKind;
  /** Slug portion of the SurrealDB record ID (also derived from the filename). */
  slug: string;
  /** Path relative to the md root. */
  path: string;
  frontmatter: Record<string, unknown>;
  body: string;
  /** ISO timestamp of the file's last modification. */
  mtime: string;
}

export interface SearchHit {
  kind: EntityKind;
  slug: string;
  path: string;
  body: string;
  score?: number;
}

export interface SearchOptions {
  kinds?: EntityKind[];
  limit?: number;
  /** If true, use FTS only. If false (default), hybrid vector+FTS with RRF. */
  lexicalOnly?: boolean;
}

export interface ListFilter {
  /** Match an exact frontmatter field value. */
  frontmatter?: Record<string, unknown>;
  limit?: number;
}

export interface EventRange {
  from?: string;
  to?: string;
  status?: "past" | "scheduled" | "cancelled";
}
