import { parse, stringify } from "yaml";

export interface ParsedMd {
  frontmatter: Record<string, unknown>;
  body: string;
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

/** Parse a markdown file with optional `--- yaml ---` frontmatter. */
export function parseMd(source: string): ParsedMd {
  const match = source.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: source };
  }
  const yamlText = match[1] ?? "";
  const body = match[2] ?? "";
  const parsed = (parse(yamlText) ?? {}) as Record<string, unknown>;
  return { frontmatter: parsed, body };
}

/** Serialize back to `--- yaml ---\nbody` format. */
export function serializeMd(parsed: ParsedMd): string {
  const hasFrontmatter = Object.keys(parsed.frontmatter).length > 0;
  if (!hasFrontmatter) {
    return parsed.body;
  }
  const yamlText = stringify(parsed.frontmatter).trimEnd();
  return `---\n${yamlText}\n---\n${parsed.body}`;
}
