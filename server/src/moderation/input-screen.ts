import type { generateText, LanguageModel } from "ai";
import { z } from "zod";
import { formatCategoriesForPrompt } from "./categories";

export const InputScreenResultSchema = z.object({
  risk_level: z.number().min(0).max(3),
  category: z.string(),
  reasoning: z.string(),
});

export type InputScreenResult = z.infer<typeof InputScreenResultSchema>;

const INPUT_SCREEN_PROMPT = `You are a content moderation system for a children's toy. Evaluate the following child speech for safety risks.

## Unsafe Categories
${formatCategoriesForPrompt()}

## Risk Levels
- 0: Completely safe, normal child speech
- 1: Mildly concerning but acceptable (e.g., a child mentioning a scary dream)
- 2: Concerning content that should be handled carefully (e.g., child repeating something inappropriate they heard)
- 3: Unsafe content that must be blocked (e.g., explicit content, self-harm, sharing personal info)

Respond with ONLY a JSON object with these fields:
- risk_level: number 0-3
- category: the category name if risk > 0, otherwise "none"
- reasoning: brief explanation`;

export interface InputScreenDeps {
  generateText: typeof generateText;
  model: LanguageModel;
}

export async function screenInput(text: string, deps: InputScreenDeps): Promise<InputScreenResult> {
  const { text: responseText } = await deps.generateText({
    model: deps.model,
    system: INPUT_SCREEN_PROMPT,
    prompt: `Evaluate this child's speech:\n\n"${text}"`,
    temperature: 0,
  });

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    // If we can't parse, assume safe to avoid false blocks
    return { risk_level: 0, category: "none", reasoning: "Parse failure — defaulting to safe" };
  }

  const parsed = InputScreenResultSchema.safeParse(JSON.parse(jsonMatch[0]));
  if (!parsed.success) {
    return {
      risk_level: 0,
      category: "none",
      reasoning: "Validation failure — defaulting to safe",
    };
  }

  return parsed.data;
}
