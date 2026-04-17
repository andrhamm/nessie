// @ts-nocheck — vanilla JS, no TypeScript checking
(() => {
  const chatArea = document.getElementById("chat-area");
  const micBtn = document.getElementById("mic-btn");
  const micLabel = document.getElementById("mic-label");
  const textInput = document.getElementById("text-input");
  const sendBtn = document.getElementById("send-btn");
  const statusBadge = document.getElementById("status-badge");
  const led = document.getElementById("led");
  const transcriptPreview = document.getElementById("transcript-preview");
  const transcriptText = document.getElementById("transcript-text");

  let isListening = false;
  let isProcessing = false;
  const POLL_INTERVAL_MS = 500;
  const DEVICE_ID = "web-client-001";

  // --- AudioWorklet mic capture ---
  let audioContext = null;
  let micStream = null;
  let workletNode = null;
  let audioChunks = [];
  let workletReady = false;

  /**
   * Convert a Float32Array of samples to a Int16 PCM Uint8Array.
   */
  function float32ToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
    }
    return int16;
  }

  /**
   * Initialise AudioContext + AudioWorklet on first use.
   * Must be called from a user gesture.
   */
  async function initAudio() {
    if (workletReady) return;

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext({ sampleRate: 16000 });
      await audioContext.audioWorklet.addModule("/pcm-worklet.js");

      const source = audioContext.createMediaStreamSource(micStream);
      workletNode = new AudioWorkletNode(audioContext, "pcm-worklet");

      workletNode.port.onmessage = (event) => {
        if (isListening) {
          // Accumulate Float32Array chunks while button is held
          audioChunks.push(new Float32Array(event.data));
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      workletReady = true;
    } catch (err) {
      console.error("Audio init failed:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setStatus("Mic denied", "error");
      } else {
        setStatus("Mic unavailable", "error");
      }
      micBtn.disabled = true;
      micLabel.textContent = "No mic";
    }
  }

  // --- PCM Audio Playback ---
  const playPcmAudio = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength === 0) return;
      const playCtx = new AudioContext({ sampleRate: 16000 });
      const pcmData = new Int16Array(buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768;
      }
      const audioBuffer = playCtx.createBuffer(1, floatData.length, 16000);
      audioBuffer.getChannelData(0).set(floatData);
      const source = playCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(playCtx.destination);
      source.start();
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  };

  // --- Helpers ---
  const setStatus = (text, type) => {
    statusBadge.textContent = text;
    statusBadge.className = `status-badge${type ? ` ${type}` : ""}`;
  };

  const setLed = (color, mode) => {
    led.style.background = color;
    led.style.boxShadow = `0 0 8px ${color}99`;
    led.className = `led${mode ? ` ${mode}` : ""}`;
  };

  const scrollToBottom = () => {
    chatArea.scrollTop = chatArea.scrollHeight;
  };

  const escapeHtml = (text) => {
    const el = document.createElement("span");
    el.textContent = text;
    return el.innerHTML;
  };

  const addUserMessage = (text) => {
    const div = document.createElement("div");
    div.className = "message user";
    div.innerHTML = `<div class="message-bubble"><p>${escapeHtml(text)}</p></div>`;
    chatArea.appendChild(div);
    scrollToBottom();
  };

  const addNessieMessage = (data) => {
    const div = document.createElement("div");
    div.className = "message nessie";
    const plainText = data.response.speech_plain || "[no response]";
    const audioUrl = data.response.audio_url;
    const tagged = data.response.speech_tagged;
    const memory = data.response.memory_saved;

    let metaHtml = "";
    if (audioUrl) {
      metaHtml += `<button type="button" class="replay-btn" data-audio="${escapeHtml(audioUrl)}">Replay</button>`;
    }
    if (tagged && tagged !== plainText) {
      metaHtml += `<span class="tagged" title="${escapeHtml(tagged)}">Show tags</span>`;
    }
    if (memory) {
      metaHtml += `<span class="memory-badge">Remembered: ${escapeHtml(memory)}</span>`;
    }

    div.innerHTML =
      `<div class="message-bubble"><p>${escapeHtml(plainText)}</p>` +
      `${metaHtml ? `<div class="message-meta">${metaHtml}</div>` : ""}` +
      `</div>`;

    chatArea.appendChild(div);
    scrollToBottom();

    const replayBtn = div.querySelector(".replay-btn");
    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
        playPcmAudio(replayBtn.getAttribute("data-audio"));
      });
    }

    const tagSpan = div.querySelector(".tagged");
    if (tagSpan) {
      tagSpan.addEventListener("click", () => {
        const p = div.querySelector("p");
        if (!p) return;
        if (p.textContent === plainText) {
          p.textContent = tagged;
          tagSpan.textContent = "Hide tags";
        } else {
          p.textContent = plainText;
          tagSpan.textContent = "Show tags";
        }
      });
    }
  };

  const addThinking = () => {
    const div = document.createElement("div");
    div.className = "message nessie";
    div.id = "thinking";
    div.innerHTML =
      '<div class="message-bubble"><p><span class="spinner"></span>Nessie is thinking...</p></div>';
    chatArea.appendChild(div);
    scrollToBottom();
  };

  const removeThinking = () => {
    const el = document.getElementById("thinking");
    if (el) el.remove();
  };

  // --- Listening control ---
  const startListening = async () => {
    if (isProcessing) return;

    // Lazily initialise audio on first press (requires user gesture)
    await initAudio();
    if (!workletReady) return;

    isListening = true;
    audioChunks = [];
    transcriptText.textContent = "";
    transcriptPreview.hidden = false;
    micBtn.classList.add("listening");
    micLabel.textContent = "Listening...";
    setStatus("Listening", "listening");
    transcriptText.textContent = "Listening...";
  };

  const stopListening = (submit) => {
    if (!isListening) return;
    isListening = false;
    micBtn.classList.remove("listening");
    micLabel.textContent = "Hold to talk";
    transcriptPreview.hidden = true;
    setStatus("Ready", "");

    if (submit && audioChunks.length > 0) {
      // Merge all Float32 chunks into one flat array
      const totalSamples = audioChunks.reduce((n, c) => n + c.length, 0);
      const merged = new Float32Array(totalSamples);
      let offset = 0;
      for (const chunk of audioChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const int16 = float32ToInt16(merged);
      const pcmBytes = new Uint8Array(int16.buffer);
      sendAudio(pcmBytes);
    }
    audioChunks = [];
  };

  // --- API ---
  const pollForCompletion = async (speechId) => {
    for (let i = 0; i < 120; i++) {
      const res = await fetch(`/v1/speech/${speechId}`);
      if (!res.ok) throw new Error("Failed to poll");
      const data = await res.json();

      if (data.status === "responding") setStatus("Thinking...", "processing");
      else if (data.status === "transcribed") setStatus("Processing...", "processing");
      else if (data.status === "received") setStatus("Transcribing...", "processing");

      if (data.status === "complete" || data.status === "error") return data;

      await new Promise((r) => {
        setTimeout(r, POLL_INTERVAL_MS);
      });
    }
    throw new Error("Timed out");
  };

  const sendAudio = async (pcmBytes) => {
    if (isProcessing) return;
    isProcessing = true;
    micBtn.disabled = true;
    sendBtn.disabled = true;
    textInput.disabled = true;

    addUserMessage("[voice message]");
    addThinking();
    setStatus("Processing...", "processing");

    try {
      const res = await fetch("/v1/speech", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Device-Id": DEVICE_ID,
        },
        body: pcmBytes,
      });
      if (!res.ok) throw new Error("POST failed");
      const { id } = await res.json();
      const result = await pollForCompletion(id);

      removeThinking();

      if (result.status === "error") {
        const errDiv = document.createElement("div");
        errDiv.className = "message nessie";
        errDiv.innerHTML = `<div class="message-bubble" style="background:#fde8e8"><p>Oops: ${escapeHtml(result.error || "Unknown error")}</p></div>`;
        chatArea.appendChild(errDiv);
        setStatus("Error", "error");
      } else if (result.response) {
        if (result.response.led_color) setLed(result.response.led_color, result.response.led_mode);
        if (result.response.audio_url) playPcmAudio(result.response.audio_url);

        // Update the "[voice message]" placeholder with the actual transcript
        if (result.input?.transcript) {
          const lastUserMsg = chatArea.querySelector(".message.user:last-of-type p");
          if (lastUserMsg) lastUserMsg.textContent = result.input.transcript;
        }

        addNessieMessage(result);
        setStatus("Ready", "");
      }
    } catch (err) {
      removeThinking();
      const errDiv = document.createElement("div");
      errDiv.className = "message nessie";
      errDiv.innerHTML = `<div class="message-bubble" style="background:#fde8e8"><p>${escapeHtml(err.message)}</p></div>`;
      chatArea.appendChild(errDiv);
      setStatus("Error", "error");
    } finally {
      isProcessing = false;
      micBtn.disabled = false;
      sendBtn.disabled = false;
      textInput.disabled = false;
    }
  };

  const sendTranscript = async (text) => {
    if (isProcessing) return;
    isProcessing = true;
    micBtn.disabled = true;
    sendBtn.disabled = true;
    textInput.disabled = true;

    addUserMessage(text);
    addThinking();
    setStatus("Processing...", "processing");

    try {
      const res = await fetch("/v1/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: DEVICE_ID, transcript: text }),
      });
      if (!res.ok) throw new Error("POST failed");
      const { id } = await res.json();
      const result = await pollForCompletion(id);

      removeThinking();

      if (result.status === "error") {
        const errDiv = document.createElement("div");
        errDiv.className = "message nessie";
        errDiv.innerHTML = `<div class="message-bubble" style="background:#fde8e8"><p>Oops: ${escapeHtml(result.error || "Unknown error")}</p></div>`;
        chatArea.appendChild(errDiv);
        setStatus("Error", "error");
      } else if (result.response) {
        if (result.response.led_color) setLed(result.response.led_color, result.response.led_mode);
        if (result.response.audio_url) playPcmAudio(result.response.audio_url);
        addNessieMessage(result);
        setStatus("Ready", "");
      }
    } catch (err) {
      removeThinking();
      const errDiv = document.createElement("div");
      errDiv.className = "message nessie";
      errDiv.innerHTML = `<div class="message-bubble" style="background:#fde8e8"><p>${escapeHtml(err.message)}</p></div>`;
      chatArea.appendChild(errDiv);
      setStatus("Error", "error");
    } finally {
      isProcessing = false;
      micBtn.disabled = false;
      sendBtn.disabled = false;
      textInput.disabled = false;
    }
  };

  // --- Events ---

  // Mic: hold to talk (mousedown/up + touch)
  micBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startListening();
  });
  micBtn.addEventListener("mouseup", () => {
    stopListening(true);
  });
  micBtn.addEventListener("mouseleave", () => {
    if (isListening) stopListening(true);
  });
  micBtn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      startListening();
    },
    { passive: false },
  );
  micBtn.addEventListener("touchend", () => {
    stopListening(true);
  });

  // Space bar hold-to-talk (when not in text input)
  document.addEventListener("keydown", (e) => {
    if (
      e.code === "Space" &&
      document.activeElement !== textInput &&
      !isProcessing &&
      !isListening
    ) {
      e.preventDefault();
      startListening();
    }
  });
  document.addEventListener("keyup", (e) => {
    if (e.code === "Space" && document.activeElement !== textInput && isListening) {
      stopListening(true);
    }
  });

  // Text input (fallback)
  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const text = textInput.value.trim();
      if (text && !isProcessing) {
        textInput.value = "";
        sendTranscript(text);
      }
    }
  });

  sendBtn.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (text && !isProcessing) {
      textInput.value = "";
      sendTranscript(text);
    }
  });
})();
