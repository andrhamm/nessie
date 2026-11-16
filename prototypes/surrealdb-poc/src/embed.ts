import { resolve } from "node:path";
import { env, pipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

/**
 * Set the local model cache directory. Call once at startup before the first
 * `embed()` call. Any subsequent call is a no-op.
 */
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

/** Embed many strings in one call when the pipeline supports it. */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  const extractor = await getExtractor();
  const results: Float32Array[] = [];
  for (const t of texts) {
    const output = await extractor(t, { pooling: "mean", normalize: true });
    results.push(output.data);
  }
  return results;
}
