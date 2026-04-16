import type { AgentOutput } from "../agent/schemas";

export interface ModerationResult {
  safe: boolean;
  reason?: string;
}

// Patterns that should never appear in child-directed speech
const PII_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
  },
  {
    name: "phone",
    pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
  },
  {
    name: "ssn",
    pattern: /\d{3}-\d{2}-\d{4}/,
  },
  {
    name: "credit_card",
    pattern: /\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/,
  },
];

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+|\b[a-zA-Z0-9-]+\.(com|org|net|io|dev|co)\b/;

/**
 * Check speech text for PII patterns.
 * Returns the name of the first matching pattern, or null if clean.
 */
export function detectPII(text: string): string | null {
  for (const { name, pattern } of PII_PATTERNS) {
    if (pattern.test(text)) {
      return name;
    }
  }
  return null;
}

/**
 * Check speech text for URLs.
 */
export function detectURL(text: string): boolean {
  return URL_PATTERN.test(text);
}

/**
 * Validate agent output using rule-based checks.
 * Fast, no API call needed.
 */
export function checkOutput(output: AgentOutput): ModerationResult {
  // Skip checks if speech is empty (no verbal response)
  if (output.speech === "") {
    return { safe: true };
  }

  const piiMatch = detectPII(output.speech);
  if (piiMatch) {
    return { safe: false, reason: `PII detected in speech: ${piiMatch}` };
  }

  if (detectURL(output.speech)) {
    return { safe: false, reason: "URL detected in speech" };
  }

  return { safe: true };
}
