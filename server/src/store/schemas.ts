import { EDGE_TYPES, type EdgeType, EMBEDDING_DIM, ENTITY_KINDS, type EntityKind } from "./types";

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
