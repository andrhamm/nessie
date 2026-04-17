import type { NessieAgent } from "../agent/nessie-agent";
import type { TtsClient, TtsConfig } from "../tts/elevenlabs";
import { runPipeline } from "./pipeline";
import type { SpeechStore } from "./store";
import { SpeechRequestSchema, toApiResponse } from "./types";

/**
 * Dependencies for speech route handlers.
 */
export interface RouteDeps {
  store: SpeechStore;
  agent: NessieAgent;
  ttsClient: TtsClient;
  ttsConfig: TtsConfig;
}

/**
 * POST /v1/speech
 *
 * Receives a transcript and device_id, creates a speech request,
 * kicks off the async pipeline, and returns the request ID.
 */
export async function handleSpeechCreate(req: Request, deps: RouteDeps): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const parsed = SpeechRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return Response.json({ error: "validation failed", details: errors }, { status: 400 });
  }

  const { device_id, transcript, speaker_name, speaker_age } = parsed.data;

  // Create the speech entry
  const state = deps.store.create(device_id, transcript, "SPEAKER_0");

  // Kick off the async pipeline (don't await — let it run in background)
  runPipeline(
    {
      agent: deps.agent,
      ttsClient: deps.ttsClient,
      ttsConfig: deps.ttsConfig,
      store: deps.store,
    },
    state.id,
    speaker_name,
    speaker_age,
  ).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    deps.store.setError(state.id, `Pipeline crashed: ${message}`);
  });

  return Response.json({ id: state.id }, { status: 201 });
}

/**
 * GET /v1/speech/:id
 *
 * Returns the current state of a speech request.
 */
export function handleSpeechGet(id: string, deps: RouteDeps): Response {
  const state = deps.store.get(id);
  if (!state) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json(toApiResponse(state));
}

/**
 * GET /v1/speech/:id/input_audio
 *
 * For browser STT iteration, there is no server-side input audio —
 * the browser transcribes locally and sends text. Always returns 404.
 */
export function handleSpeechInputAudio(_id: string, _deps: RouteDeps): Response {
  return Response.json({ error: "input audio not available" }, { status: 404 });
}

/**
 * GET /v1/speech/:id/response_audio
 *
 * Returns the TTS audio as audio/L16;rate=16000.
 */
export function handleSpeechResponseAudio(id: string, deps: RouteDeps): Response {
  const state = deps.store.get(id);
  if (!state) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  if (!state.response_audio || state.response_audio.length === 0) {
    return Response.json({ error: "audio not available yet" }, { status: 404 });
  }

  return new Response(state.response_audio, {
    headers: {
      "Content-Type": "audio/L16;rate=16000",
      "Content-Length": String(state.response_audio.length),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
