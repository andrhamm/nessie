import type { NessieAgent } from "../agent/nessie-agent";
import type { AgentInput } from "../agent/schemas";
import { log as appLog, logError } from "../logger";
import type { TtsProviderName, TtsProviderRegistry } from "../tts/provider";
import { selectProvider } from "../tts/provider";
import { stripTags } from "../utils/speech";
import type { SpeechStore } from "./store";
import type { TranscriberClient } from "./transcriber-client";

/**
 * Dependencies injected into the pipeline for testability.
 */
export interface PipelineDeps {
  agent: NessieAgent;
  ttsProviders: TtsProviderRegistry;
  defaultTtsProvider: TtsProviderName;
  store: SpeechStore;
  transcriber: TranscriberClient;
}

/**
 * Run the speech processing pipeline for a given speech request ID.
 *
 * Pipeline stages:
 *   1. If status is "received" (PCM audio path): transcribe audio via TranscriberClient,
 *      populate state.input, advance to "transcribed".
 *   2. Set status to "thinking".
 *   3. Call NessieAgent.respond() with the transcript.
 *   4. Synthesize speech via the selected TTS provider (record latency).
 *   5. Store response data + audio, set status to "complete".
 *
 * If `ttsProviderRequested` is provided and configured, it overrides
 * `defaultTtsProvider` for this request only.
 *
 * On error at any stage, sets status to "error" with the error message.
 */
export async function runPipeline(
  deps: PipelineDeps,
  speechId: string,
  speakerName: string,
  speakerAge: number,
  ttsProviderRequested?: TtsProviderName,
): Promise<void> {
  const { agent, ttsProviders, defaultTtsProvider, store, transcriber } = deps;

  const state = store.get(speechId);
  if (!state) {
    return;
  }

  try {
    const t0 = performance.now();
    const log = (stage: string, detail?: string) => {
      const elapsed = Math.round(performance.now() - t0);
      appLog(`[Pipeline ${speechId}] ${elapsed}ms — ${stage}${detail ? `: ${detail}` : ""}`);
    };

    log("start", `device=${state.device_id} speaker=${speakerName} age=${speakerAge}`);

    // Stage 1: Transcribe PCM audio if we're in "received" status
    if (state.status === "received") {
      if (!state.inputAudio || state.inputAudio.length === 0) {
        store.setError(speechId, "No audio data available");
        return;
      }

      const audioSizeKb = Math.round(state.inputAudio.length / 1024);
      const durationSec = (state.inputAudio.length / 2 / 16000).toFixed(1);
      store.setStatus(speechId, "transcribing");
      log("transcribing", `${audioSizeKb}KB PCM (~${durationSec}s audio)`);

      const transcript = await transcriber.transcribe(state.inputAudio);

      log("transcribed", `"${transcript}"`);

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

    // Stage 2: Mark as thinking (agent inference)
    store.setStatus(speechId, "thinking");
    log("agent", `input: "${currentState.input.transcript}"`);

    // Stage 3: Build agent input (telling the agent which TTS provider will
    // synthesise the response so the prompt can match that provider's tag set)
    // and call the agent
    const effectiveProvider = ttsProviderRequested ?? defaultTtsProvider;
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
      tts_provider: effectiveProvider,
    };

    const agentOutput = await agent.respond(agentInput);

    log(
      "agent done",
      `speech=${agentOutput.speech.length} chars, led=${agentOutput.led_color} ${agentOutput.led_mode}`,
    );
    if (agentOutput.save_memory) {
      log("memory", `saving: "${agentOutput.save_memory}" about ${agentOutput.memory_speaker}`);
    }

    // Stage 4: Select provider and generate TTS audio
    const ttsProvider = selectProvider(ttsProviders, ttsProviderRequested, defaultTtsProvider);
    let audioBuffer: Uint8Array = new Uint8Array(0);
    let ttsLatencyMs = 0;
    if (agentOutput.speech.trim()) {
      store.setStatus(speechId, "speaking");
      log(
        "tts",
        `generating audio via ${ttsProvider.name} for ${stripTags(agentOutput.speech).length} chars`,
      );
      const ttsStart = performance.now();
      audioBuffer = await ttsProvider.synthesize(agentOutput.speech);
      ttsLatencyMs = Math.round(performance.now() - ttsStart);
      log("tts done", `${Math.round(audioBuffer.length / 1024)}KB audio (${ttsLatencyMs}ms)`);
    } else {
      log("tts", "skipped (empty speech)");
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
        tts_provider_used: ttsProvider.name,
        tts_latency_ms: ttsLatencyMs,
      },
      audioBuffer,
    );

    log("complete", "total pipeline done");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError(`[Pipeline ${speechId}] ERROR: ${message}`);
    store.setError(speechId, message);
  }
}
