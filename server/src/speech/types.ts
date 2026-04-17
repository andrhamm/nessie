import { z } from "zod";

/**
 * Status state machine for a speech request:
 *   received → transcribed → responding → complete
 *                                       → error
 * For v1 (browser STT), we skip "received" and start at "transcribed"
 * since the transcript arrives with the POST body.
 */
export const SpeechStatusSchema = z.enum([
  "received",
  "transcribed",
  "responding",
  "complete",
  "error",
]);

export type SpeechStatus = z.infer<typeof SpeechStatusSchema>;

/**
 * POST /v1/speech request body.
 * For v1, the browser sends a text transcript (not audio).
 * For v2 (AudioWorklet), the body is raw PCM bytes with X-Device-Id header.
 */
export const SpeechRequestSchema = z.object({
  device_id: z.string().min(1),
  transcript: z.string().min(1),
  speaker_name: z.string().default("Friend"),
  speaker_age: z.number().default(0),
});

export type SpeechRequest = z.infer<typeof SpeechRequestSchema>;

/**
 * Input data accumulated during processing.
 */
export interface SpeechInputData {
  transcript: string;
  speaker: string;
}

/**
 * Response data populated after agent + TTS complete.
 */
export interface SpeechResponseData {
  speech_tagged: string;
  speech_plain: string;
  audio_url: string;
  led_color: string;
  led_mode: string;
  memory_saved: string;
}

/**
 * Full state for a speech request, stored in memory.
 */
export interface SpeechState {
  id: string;
  status: SpeechStatus;
  device_id: string;
  created_at: number;
  /** Raw PCM bytes from the client (set before transcription). */
  inputAudio?: Uint8Array;
  /** Transcript produced by server-side transcription or sent directly by client. */
  inputTranscript?: string;
  input: SpeechInputData | null;
  response: SpeechResponseData | null;
  response_audio: Uint8Array | null;
  error: string | null;
}

/**
 * GET /v1/speech/:id response shape.
 * Only includes fields available at the current status.
 */
export interface SpeechApiResponse {
  id: string;
  status: SpeechStatus;
  input?: {
    transcript: string;
    speaker: string;
  };
  response?: {
    speech_tagged: string;
    speech_plain: string;
    audio_url: string;
    led_color: string;
    led_mode: string;
    memory_saved: string;
  };
  error?: string;
}

/**
 * Build the API response shape from internal state.
 * Only includes data that has been populated so far.
 */
export function toApiResponse(state: SpeechState): SpeechApiResponse {
  const res: SpeechApiResponse = {
    id: state.id,
    status: state.status,
  };

  if (state.input) {
    res.input = {
      transcript: state.input.transcript,
      speaker: state.input.speaker,
    };
  }

  if (state.response) {
    res.response = {
      speech_tagged: state.response.speech_tagged,
      speech_plain: state.response.speech_plain,
      audio_url: state.response.audio_url,
      led_color: state.response.led_color,
      led_mode: state.response.led_mode,
      memory_saved: state.response.memory_saved,
    };
  }

  if (state.error) {
    res.error = state.error;
  }

  return res;
}
