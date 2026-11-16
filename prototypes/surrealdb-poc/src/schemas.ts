/**
 * SurrealQL schema for the prototype. Each entity kind gets a schemaless
 * table with a shared set of indexed fields (path, body, embedding) so we
 * can query uniformly across kinds. Graph edges are their own relation
 * tables populated via RELATE.
 */

export const ENTITY_KINDS = [
  "person",
  "memory",
  "event",
  "journal",
  "profile",
  "routine",
  "constraint",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

export const EDGE_TYPES = [
  "sibling_of",
  "classmate_of",
  "parent_of",
  "friend_of",
  "last_contacted",
  "mentions",
] as const;

export type EdgeType = (typeof EDGE_TYPES)[number];

/**
 * Embedding dimension for Xenova/all-MiniLM-L6-v2.
 */
export const EMBEDDING_DIM = 384;

/**
 * Analyzer applied to body text for BM25. Tokenizers split on whitespace,
 * class transitions, and punctuation; snowball filter stems English.
 */
const ANALYZER = `
DEFINE ANALYZER OVERWRITE doc_analyzer
  TOKENIZERS blank, class, camel, punct
  FILTERS snowball(english), lowercase;
`;

function entityTableStatements(kind: EntityKind): string[] {
  return [
    `DEFINE TABLE OVERWRITE ${kind} SCHEMALESS;`,
    `DEFINE FIELD OVERWRITE path ON TABLE ${kind} TYPE string;`,
    `DEFINE FIELD OVERWRITE kind ON TABLE ${kind} TYPE string;`,
    `DEFINE FIELD OVERWRITE frontmatter ON TABLE ${kind} TYPE object;`,
    `DEFINE FIELD OVERWRITE body ON TABLE ${kind} TYPE string;`,
    `DEFINE FIELD OVERWRITE embedding ON TABLE ${kind} TYPE array<float>;`,
    `DEFINE FIELD OVERWRITE mtime ON TABLE ${kind} TYPE datetime;`,
    `DEFINE INDEX OVERWRITE ${kind}_path ON TABLE ${kind} FIELDS path UNIQUE;`,
    `DEFINE INDEX OVERWRITE ${kind}_fts ON TABLE ${kind} FIELDS body FULLTEXT ANALYZER doc_analyzer BM25 HIGHLIGHTS;`,
    `DEFINE INDEX OVERWRITE ${kind}_hnsw ON TABLE ${kind} FIELDS embedding HNSW DIMENSION ${EMBEDDING_DIM} TYPE F32 DIST COSINE EFC 150 M 12;`,
  ];
}

function edgeTableStatements(edge: EdgeType): string[] {
  return [
    `DEFINE TABLE OVERWRITE ${edge} TYPE RELATION SCHEMALESS;`,
    `DEFINE FIELD OVERWRITE date ON TABLE ${edge} TYPE option<datetime>;`,
  ];
}

export const SCHEMA_STATEMENTS: string[] = [
  ANALYZER,
  ...ENTITY_KINDS.flatMap(entityTableStatements),
  ...EDGE_TYPES.flatMap(edgeTableStatements),
];
