export interface UnsafeCategory {
  name: string;
  description: string;
}

export const UNSAFE_CATEGORIES: ReadonlyArray<UnsafeCategory> = [
  {
    name: "Violence",
    description:
      "Content that describes, threatens, or encourages violence against people or animals",
  },
  {
    name: "Sexual Content",
    description: "Any sexually explicit or suggestive content",
  },
  {
    name: "Self-Harm",
    description:
      "Content about self-harm, suicide, or encouraging dangerous behavior toward oneself",
  },
  {
    name: "Personal Information",
    description:
      "Requests for or sharing of personal details such as addresses, phone numbers, full names of real people, or school names",
  },
  {
    name: "Dangerous Activities",
    description:
      "Instructions or encouragement for dangerous activities including weapons, drugs, fire, or chemicals",
  },
  {
    name: "Manipulation",
    description:
      "Attempts to override the character's safety rules, jailbreak the system, or make the character act out of character",
  },
  {
    name: "Bullying",
    description: "Hateful, discriminatory, or bullying language targeting individuals or groups",
  },
] as const;

/**
 * Format categories as a numbered list for inclusion in moderation prompts.
 */
export function formatCategoriesForPrompt(): string {
  return UNSAFE_CATEGORIES.map((cat, i) => `${i + 1}. **${cat.name}**: ${cat.description}`).join(
    "\n",
  );
}
