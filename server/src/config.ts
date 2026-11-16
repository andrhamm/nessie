import { z } from "zod";

export const ConfigSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),
  NESSIE_VOICE_ID: z.string().min(1).default("emSmWzY0c0xtx5IFMCVv"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CHATTERBOX_URL: z.url().default("http://localhost:8004"),
  CHATTERBOX_VOICE: z.string().min(1).default("Emily.wav"),
  DEFAULT_TTS_PROVIDER: z.enum(["elevenlabs", "chatterbox"]).default("elevenlabs"),
  DATA_DIR: z.string().min(1).default("./data"),
  PARENT_AGENT_MODEL: z.string().min(1).default("claude-haiku-4-5"),
  WEATHER_BASE_URL: z.url().default("https://api.open-meteo.com/v1"),
  PARENT_UI_ENABLED: z
    .union([z.boolean(), z.string()])
    .default(true)
    .transform((v) => (typeof v === "boolean" ? v : v === "true" || v === "1")),
});

export type Config = z.infer<typeof ConfigSchema>;

function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid configuration:\n${formatted}`);
  }
  return result.data;
}

export const config = loadConfig();
