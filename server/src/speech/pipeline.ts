import type { NessieAgent } from "../agent/nessie-agent";
import type { AgentInput } from "../agent/schemas";
import type { TtsClient, TtsConfig } from "../tts/elevenlabs";
import { synthesize } from "../tts/elevenlabs";
import { stripTags } from "../utils/speech";
import type { SpeechStore } from "./store";
import type { TranscriberClient } from "./transcriber-client";

/**
 * Dependencies injected into the pipeline for testability.
 */
export interface PipelineDeps {
  agent: NessieAgent;
  ttsClient: TtsClient;
  ttsConfig: TtsConfig;
  store: SpeechStore;
  transcriber: TranscriberClient;
}

/**
 * Run the speech processing pipeline for a given speech request ID.
 *
 * Pipeline stages:
 *   1. If status is "received" (PCM audio path): transcribe audio via TranscriberClient,
 *      populate state.input, advance to "transcribed".
 *   2. Set status to "responding".
 *   3. Call NessieAgent.respond() with the transcript.
 *   4. Call ElevenLabs TTS with the agent's speech output.
 *   5. Store response data + audio, set status to "complete".
 *
 * On error at any stage, sets status to "error" with the error message.
 */
export async function runPipeline(
  deps: PipelineDeps,
  speechId: string,
  speakerName: string,
  speakerAge: number,
): Promise<void> {
  const { agent, ttsClient, ttsConfig, store, transcriber } = deps;

  const state = store.get(speechId);
  if (!state) {
    return;
  }

  try {
    // Stage 1: Transcribe PCM audio if we're in "received" status
    if (state.status === "received") {
      if (!state.inputAudio || state.inputAudio.length === 0) {
        store.setError(speechId, "No audio data available");
        return;
      }

      const transcript = await transcriber.transcribe(state.inputAudio);

      // Populate input data and advance status
      const entry = store.get(speechId);
      if (entry) {
        entry.inputTranscript = transcript;
        entry.input = { transcript, speaker: "SPEAKER_0" };
        entry.status = "transcribed";
      }
    }

    // Re-fetch state after potential mutation above
    const currentState = store.get(speechId);
    if (!currentState) {
      return;
    }

    if (!currentState.input) {
      store.setError(speechId, "No input data available");
      return;
    }

    // Stage 2: Mark as responding
    store.setStatus(speechId, "responding");

    // Stage 3: Build agent input and call the agent
    const agentInput: AgentInput = {
      device_id: currentState.device_id,
      speaker: {
        id: currentState.input.speaker,
        name: speakerName,
        age: speakerAge,
        preferences: [],
      },
      text: currentState.input.transcript,
      ambient: [],
      timestamp: Date.now(),
    };

    const agentOutput = await agent.respond(agentInput);

    // Stage 4: Generate TTS audio (skip if no speech)
    // eslint-disable-next-line prefer-const
    let audioBuffer: Uint8Array = new Uint8Array(0);
    if (agentOutput.speech.trim()) {
      audioBuffer = await synthesize(ttsClient, ttsConfig, agentOutput.speech);
    }

    // Stage 5: Store the complete response
    const plainSpeech = stripTags(agentOutput.speech);
    store.setResponse(
      speechId,
      {
        speech_tagged: agentOutput.speech,
        speech_plain: plainSpeech,
        audio_url: `/v1/speech/${speechId}/response_audio`,
        led_color: agentOutput.led_color,
        led_mode: agentOutput.led_mode,
        memory_saved: agentOutput.save_memory,
      },
      audioBuffer,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    store.setError(speechId, message);
  }
}
