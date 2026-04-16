import type { AgentInput, AgentOutput } from "../agent/schemas";
import { stripTags } from "../utils/speech";

export interface SpeakerConfig {
  name: string;
  age: number;
}

export function validateSpeakerName(value: string): string | undefined {
  if (!value || value.length === 0) return "Name is required!";
}

export function validateAge(value: string): string | undefined {
  if (!value || value.trim().length === 0) return "Please enter a valid age!";
  const num = Number(value);
  if (Number.isNaN(num) || num < 0) return "Please enter a valid age!";
}

export function buildAgentInput(
  deviceId: string,
  speaker: SpeakerConfig,
  text: string,
): AgentInput {
  return {
    device_id: deviceId,
    speaker: {
      id: "SPEAKER_0",
      name: speaker.name,
      age: speaker.age,
      preferences: [],
    },
    text,
    ambient: [],
    timestamp: Date.now(),
  };
}

export interface FormattedResponse {
  plainSpeech: string;
  taggedSpeech: string;
  ledInfo: string;
  memoryInfo: string | null;
}

export function formatResponse(result: AgentOutput): FormattedResponse {
  const plainSpeech = stripTags(result.speech) || "[no verbal response]";
  const taggedSpeech = result.speech;
  const ledInfo = `${result.led_color} (${result.led_mode})`;
  const memoryInfo = result.save_memory
    ? `"${result.save_memory}" about ${result.memory_speaker || "general"}`
    : null;

  return { plainSpeech, taggedSpeech, ledInfo, memoryInfo };
}

export function isExitCommand(input: string): boolean {
  return input === "exit" || input === "quit";
}

export function checkApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
