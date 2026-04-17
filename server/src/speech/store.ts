import { randomBytes } from "node:crypto";
import type { SpeechResponseData, SpeechState, SpeechStatus } from "./types";

/**
 * Generate a unique speech request ID.
 * Format: sp_ + 12 hex characters.
 */
export function generateSpeechId(): string {
  return `sp_${randomBytes(6).toString("hex")}`;
}

/**
 * In-memory store for speech request state.
 * Entries are automatically cleaned up after maxAge (default 10 minutes).
 */
export class SpeechStore {
  private readonly entries = new Map<string, SpeechState>();
  private readonly maxAgeMs: number;

  constructor(options?: { maxAgeMs?: number }) {
    this.maxAgeMs = options?.maxAgeMs ?? 10 * 60 * 1000;
  }

  /**
   * Create a new speech request entry in "transcribed" state.
   * For v1 (browser STT), the transcript arrives with the POST body so we skip "received".
   */
  create(deviceId: string, transcript: string, speaker: string): SpeechState {
    const id = generateSpeechId();
    const state: SpeechState = {
      id,
      status: "transcribed",
      device_id: deviceId,
      created_at: Date.now(),
      inputTranscript: transcript,
      input: { transcript, speaker },
      response: null,
      response_audio: null,
      error: null,
    };
    this.entries.set(id, state);
    return state;
  }

  /**
   * Create a new speech request entry in "received" state from raw PCM audio.
   * The pipeline will transcribe the audio before responding.
   */
  createFromAudio(deviceId: string, pcmBytes: Uint8Array): SpeechState {
    const id = generateSpeechId();
    const state: SpeechState = {
      id,
      status: "received",
      device_id: deviceId,
      created_at: Date.now(),
      inputAudio: pcmBytes,
      input: null,
      response: null,
      response_audio: null,
      error: null,
    };
    this.entries.set(id, state);
    return state;
  }

  /**
   * Get a speech request by ID. Returns undefined if not found.
   */
  get(id: string): SpeechState | undefined {
    return this.entries.get(id);
  }

  /**
   * Update the status of a speech request.
   */
  setStatus(id: string, status: SpeechStatus): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.status = status;
    }
  }

  /**
   * Set the response data and audio for a completed request.
   */
  setResponse(id: string, response: SpeechResponseData, audio: Uint8Array): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.response = response;
      entry.response_audio = audio;
      entry.status = "complete";
    }
  }

  /**
   * Set an error on a speech request.
   */
  setError(id: string, error: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.error = error;
      entry.status = "error";
    }
  }

  /**
   * Remove entries older than maxAgeMs.
   * Returns the number of entries removed.
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, entry] of this.entries) {
      if (now - entry.created_at > this.maxAgeMs) {
        this.entries.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Visible for testing. Returns the current entry count.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Visible for testing. Clear all entries.
   */
  clear(): void {
    this.entries.clear();
  }
}
