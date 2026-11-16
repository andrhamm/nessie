import { resolve } from "node:path";
import { env, pipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

export function configureEmbedCache(dir: string): void {
  env.cacheDir = resolve(dir);
  env.allowRemoteModels = true;
}

type FeatureExtractor = (text: string, opts?: unknown) => Promise<{ data: Float32Array }>;
let extractorPromise: Promise<FeatureExtractor> | null = null;

async function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      "feature-extraction",
      EMBEDDING_MODEL,
    ) as unknown as Promise<FeatureExtractor>;
  }
  return extractorPromise;
}

/** Embed a single piece of text into a 384-dim mean-pooled unit vector. */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.data;
}

/** Reset the singleton — only used in tests. */
export function _resetExtractorForTests(): void {
  extractorPromise = null;
}
