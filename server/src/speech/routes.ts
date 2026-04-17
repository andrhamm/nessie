import type { NessieAgent } from "../agent/nessie-agent";
import type { TtsClient, TtsConfig } from "../tts/elevenlabs";
import { runPipeline } from "./pipeline";
import type { SpeechStore } from "./store";
import type { TranscriberClient } from "./transcriber-client";
import { SpeechRequestSchema, toApiResponse } from "./types";

/**
 * Dependencies for speech route handlers.
 */
export interface RouteDeps {
  store: SpeechStore;
  agent: NessieAgent;
  ttsClient: TtsClient;
  ttsConfig: TtsConfig;
  transcriber: TranscriberClient;
}

/**
 * POST /v1/speech
 *
 * Accepts two modes:
 *
 * Mode A — JSON transcript (legacy browser STT):
 *   Content-Type: application/json
 *   Body: { device_id, transcript, speaker_name?, speaker_age? }
 *
 * Mode B — Raw PCM audio (AudioWorklet):
 *   Content-Type: application/octet-stream
 *   Header: X-Device-Id: <device-id>
 *   Body: raw Int16 PCM bytes at 16 kHz mono
 *
 * Both modes return { id } with status 201.
 */
export async function handleSpeechCreate(req: Request, deps: RouteDeps): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }

  const contentType = req.headers.get("Content-Type") ?? "";

  // --- Mode B: raw PCM binary ---
  if (contentType.startsWith("application/octet-stream")) {
    const deviceId = req.headers.get("X-Device-Id");
    if (!deviceId || deviceId.trim().length === 0) {
      return Response.json({ error: "X-Device-Id header is required" }, { status: 400 });
    }

    let pcmBytes: Uint8Array;
    try {
      const buffer = await req.arrayBuffer();
      pcmBytes = new Uint8Array(buffer);
    } catch {
      return Response.json({ error: "failed to read request body" }, { status: 400 });
    }

    if (pcmBytes.length === 0) {
      return Response.json({ error: "audio body is empty" }, { status: 400 });
    }

    const state = deps.store.createFromAudio(deviceId.trim(), pcmBytes);

    // Kick off the async pipeline (don't await — let it run in background)
    runPipeline(
      {
        agent: deps.agent,
        ttsClient: deps.ttsClient,
        ttsConfig: deps.ttsConfig,
        store: deps.store,
        transcriber: deps.transcriber,
      },
      state.id,
      "Friend",
      0,
    ).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      deps.store.setError(state.id, `Pipeline crashed: ${message}`);
    });

    return Response.json({ id: state.id }, { status: 201 });
  }

  // --- Mode A: JSON transcript ---
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
      transcriber: deps.transcriber,
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
 * Returns the raw PCM bytes stored for this speech request (if any).
 * For requests created via the JSON path (browser STT), returns 404.
 */
export function handleSpeechInputAudio(id: string, deps: RouteDeps): Response {
  const state = deps.store.get(id);
  if (!state) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  if (!state.inputAudio || state.inputAudio.length === 0) {
    return Response.json({ error: "input audio not available" }, { status: 404 });
  }

  return new Response(state.inputAudio, {
    headers: {
      "Content-Type": "audio/L16;rate=16000",
      "Content-Length": String(state.inputAudio.length),
    },
  });
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
