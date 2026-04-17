// @ts-nocheck — vanilla JS, no TypeScript checking
(() => {
  // --- DOM elements ---
  const chatArea = document.getElementById("chat-area");
  const micBtn = document.getElementById("mic-btn");
  const textInput = document.getElementById("text-input");
  const sendBtn = document.getElementById("send-btn");
  const statusBadge = document.getElementById("status-badge");
  const led = document.getElementById("led");
  const transcriptPreview = document.getElementById("transcript-preview");
  const transcriptText = document.getElementById("transcript-text");
  const deviceIdEl = document.getElementById("device-id");

  // --- State ---
  let isListening = false;
  let isProcessing = false;
  let recognition = null;
  let currentTranscript = "";
  const POLL_INTERVAL_MS = 500;
  const DEVICE_ID = "web-client-001";

  // Show device ID in header
  if (deviceIdEl) {
    deviceIdEl.textContent = DEVICE_ID;
  }

  // --- Speech Recognition Setup ---
  const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (SpeechRecognitionAPI) {
    recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      currentTranscript = final || interim;
      transcriptText.textContent = currentTranscript;
    };

    recognition.onend = () => {
      if (isListening) {
        stopListening();
        if (currentTranscript.trim()) {
          sendTranscript(currentTranscript.trim());
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      stopListening();
      if (event.error === "not-allowed") {
        setStatus("Mic access denied", "error");
      }
    };
  } else {
    // Graceful fallback: disable mic button, show notice
    micBtn.disabled = true;
    micBtn.title = "Speech recognition not supported. Use text input.";
    const notice = document.createElement("div");
    notice.className = "notice";
    notice.textContent = "Voice input not available in this browser — use the text field below.";
    const footer = document.querySelector("footer");
    if (footer) {
      footer.insertBefore(notice, footer.firstChild);
    }
  }

  // --- Audio playback: raw PCM 16-bit signed LE, 16kHz mono ---
  // Browsers cannot natively decode raw PCM. We use the Web Audio API to
  // create an AudioBuffer directly from the bytes.

  const playPcmAudio = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error("Failed to fetch audio:", response.status);
        return;
      }
      const buffer = await response.arrayBuffer();
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const pcmData = new Int16Array(buffer);
      const floatData = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] = pcmData[i] / 32768;
      }
      const audioBuffer = audioContext.createBuffer(1, floatData.length, 16000);
      audioBuffer.getChannelData(0).set(floatData);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();
    } catch (err) {
      console.error("Audio playback failed:", err);
    }
  };

  // --- Helper functions ---

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
      (metaHtml ? `<div class="message-meta">${metaHtml}</div>` : "") +
      "</div>";

    chatArea.appendChild(div);
    scrollToBottom();

    // Replay button: play PCM audio again
    const replayBtn = div.querySelector(".replay-btn");
    if (replayBtn) {
      replayBtn.addEventListener("click", () => {
        const url = replayBtn.getAttribute("data-audio");
        if (url) {
          playPcmAudio(url);
        }
      });
    }

    // Tag toggle: show/hide bracketed speech tags
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

  const addThinkingIndicator = () => {
    const div = document.createElement("div");
    div.className = "message nessie";
    div.id = "thinking-indicator";
    div.innerHTML =
      '<div class="message-bubble"><p><span class="spinner"></span>Nessie is thinking...</p></div>';
    chatArea.appendChild(div);
    scrollToBottom();
  };

  const removeThinkingIndicator = () => {
    const el = document.getElementById("thinking-indicator");
    if (el) {
      el.remove();
    }
  };

  const addErrorMessage = (text) => {
    const div = document.createElement("div");
    div.className = "message nessie";
    div.innerHTML = `<div class="message-bubble" style="background:#fde8e8"><p>${escapeHtml(text)}</p></div>`;
    chatArea.appendChild(div);
    scrollToBottom();
  };

  const startListening = () => {
    if (!recognition || isProcessing) return;
    isListening = true;
    currentTranscript = "";
    transcriptText.textContent = "";
    transcriptPreview.hidden = false;
    micBtn.classList.add("listening");
    setStatus("Listening...", "listening");
    recognition.start();
  };

  const stopListening = () => {
    isListening = false;
    micBtn.classList.remove("listening");
    transcriptPreview.hidden = true;
    try {
      recognition.stop();
    } catch (_) {
      // already stopped — ignore
    }
  };

  const pollForCompletion = async (speechId) => {
    const maxAttempts = 120; // 60 seconds at 500ms interval
    for (let i = 0; i < maxAttempts; i++) {
      const res = await fetch(`/v1/speech/${speechId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch speech status");
      }
      const data = await res.json();

      // Update status badge to reflect pipeline stage
      if (data.status === "responding") {
        setStatus("Nessie is thinking...", "processing");
      } else if (data.status === "transcribed") {
        setStatus("Processing...", "processing");
      }

      if (data.status === "complete" || data.status === "error") {
        return data;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, POLL_INTERVAL_MS);
      });
    }

    throw new Error("Request timed out after 60 seconds");
  };

  const sendTranscript = async (text) => {
    if (isProcessing) return;
    isProcessing = true;
    micBtn.disabled = true;
    sendBtn.disabled = true;
    textInput.disabled = true;

    addUserMessage(text);
    addThinkingIndicator();
    setStatus("Processing...", "processing");

    try {
      // POST to create speech request
      const createRes = await fetch("/v1/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: DEVICE_ID,
          transcript: text,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.json();
        throw new Error(err.error || "Failed to create speech request");
      }

      const createData = await createRes.json();
      const speechId = createData.id;

      // Poll until complete or error
      const result = await pollForCompletion(speechId);

      removeThinkingIndicator();

      if (result.status === "error") {
        addErrorMessage(`Oops! Something went wrong: ${result.error || "Unknown error"}`);
        setStatus("Error", "error");
      } else if (result.status === "complete" && result.response) {
        // Update LED indicator
        if (result.response.led_color) {
          setLed(result.response.led_color, result.response.led_mode);
        }

        // Play response audio (raw PCM via Web Audio API)
        if (result.response.audio_url) {
          playPcmAudio(result.response.audio_url);
        }

        // Add Nessie's message to chat
        addNessieMessage(result);
        setStatus("Ready", "");
      }
    } catch (err) {
      removeThinkingIndicator();
      addErrorMessage(`Connection error: ${err.message}`);
      setStatus("Error", "error");
    } finally {
      isProcessing = false;
      micBtn.disabled = !recognition; // keep disabled if no speech support
      sendBtn.disabled = false;
      textInput.disabled = false;
    }
  };

  // --- Event Listeners ---

  // Mic button: click to toggle listening
  micBtn.addEventListener("click", () => {
    if (isListening) {
      stopListening();
      if (currentTranscript.trim()) {
        sendTranscript(currentTranscript.trim());
      }
    } else {
      startListening();
    }
  });

  // Text input: Enter key sends message
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

  // Send button click
  sendBtn.addEventListener("click", () => {
    const text = textInput.value.trim();
    if (text && !isProcessing) {
      textInput.value = "";
      sendTranscript(text);
    }
  });

  // Space bar: push-to-talk shortcut (only when not focused on text input)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== textInput && !isProcessing) {
      e.preventDefault();
      if (!isListening && recognition) {
        startListening();
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.code === "Space" && document.activeElement !== textInput) {
      if (isListening) {
        stopListening();
        if (currentTranscript.trim()) {
          sendTranscript(currentTranscript.trim());
        }
      }
    }
  });
})();
