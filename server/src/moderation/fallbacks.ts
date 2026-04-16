import type { AgentOutput } from "../agent/schemas";

/**
 * Canned safe responses for when moderation blocks content.
 * Each response stays in character and redirects to safe activity.
 */
const SAFE_RESPONSES: ReadonlyArray<AgentOutput> = [
  {
    speech:
      "[gentle] Hmm, that's something you should talk to a grown-up about! [playfully] Want to play a game instead?",
    led_color: "#87CEEB",
    led_mode: "pulse",
    save_memory: "",
    memory_speaker: "",
  },
  {
    speech:
      "[curious] Ooh, that's a really interesting question! [pauses] I think a grown-up would know way more about that than me! [excited] Hey, want to hear a silly joke?",
    led_color: "#87CEEB",
    led_mode: "pulse",
    save_memory: "",
    memory_speaker: "",
  },
  {
    speech:
      "[playfully] You know what I was just thinking about? [excited] What if we made up a story together? You pick the first character!",
    led_color: "#FFD700",
    led_mode: "pulse",
    save_memory: "",
    memory_speaker: "",
  },
  {
    speech:
      "[gentle] I'm not sure about that one. [happy] But I DO know a really cool fact about dolphins! Want to hear it?",
    led_color: "#90EE90",
    led_mode: "solid",
    save_memory: "",
    memory_speaker: "",
  },
];

/**
 * Get a random safe fallback response.
 * Uses a different response each time to feel less robotic.
 */
export function getSafeFallback(): AgentOutput {
  const index = Math.floor(Math.random() * SAFE_RESPONSES.length);
  const response = SAFE_RESPONSES[index];
  if (!response) {
    // Unreachable given SAFE_RESPONSES is non-empty, but satisfies noUncheckedIndexedAccess
    return SAFE_RESPONSES[0] as AgentOutput;
  }
  return { ...response };
}

/**
 * The sanitized input message sent to the agent when risk level is 2.
 * Replaces the child's actual words with a safe description.
 */
export const SANITIZED_INPUT_MESSAGE =
  "The child asked about a sensitive topic. Please respond with a gentle, age-appropriate deflection and redirect to a fun activity.";
