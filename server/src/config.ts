import { z } from "zod";

export const ConfigSchema = z
  .object({
    port: z.coerce.number().int().positive().default(3000),
  })
  .readonly();

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  return ConfigSchema.parse({
    port: process.env.PORT,
  });
}
