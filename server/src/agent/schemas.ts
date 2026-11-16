import { z } from "zod";

export const SpeakerSchema = z.object({
  id: z.string().describe("Speaker identifier, e.g. SPEAKER_0"),
  name: z.string().describe("Display name if known, otherwise same as id"),
  age: z.number().describe("Estimated age if known, 0 if unknown"),
  preferences: z.array(z.string()).describe("Known preferences"),
});

export type Speaker = z.infer<typeof SpeakerSchema>;

export const AgentInputSchema = z.object({
  device_id: z.string().describe("Unique device identifier"),
  speaker: SpeakerSchema.describe("The speaker who said this"),
  text: z.string().describe("Transcribed speech"),
  ambient: z.array(z.string()).describe("Ambient sounds detected"),
  timestamp: z.number().describe("Unix timestamp ms"),
  tts_provider: z
    .enum(["elevenlabs", "chatterbox"])
    .optional()
    .describe(
      "TTS provider that will synthesize the response. Shapes the system prompt to match what that provider supports (different tag vocabularies).",
    ),
});

export type AgentInput = z.infer<typeof AgentInputSchema>;

export const AgentOutputSchema = z.object({
  speech: z
    .string()
    .describe(
      "Character speech with ElevenLabs v3 audio tags. Empty string if no verbal response.",
    ),
  led_color: z.string().describe("Hex color for LED reflecting dominant mood"),
  led_mode: z.enum(["solid", "pulse", "flash"]).describe("LED animation mode"),
  save_memory: z
    .string()
    .describe(
      "A fact or preference to remember about this interaction. Empty string if nothing noteworthy.",
    ),
  memory_speaker: z
    .string()
    .describe("Speaker ID this memory is about. Empty string if general or no memory to save."),
});

export type AgentOutput = z.infer<typeof AgentOutputSchema>;
