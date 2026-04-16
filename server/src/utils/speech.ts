/**
 * Strip ElevenLabs v3 audio tags (square-bracket directives) from speech text.
 * Normalizes whitespace and trims the result.
 *
 * @example
 * stripTags("[excited] Oh wow! [giggles]") // "Oh wow!"
 */
export function stripTags(speech: string): string {
  return speech
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
