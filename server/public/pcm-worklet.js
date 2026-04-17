class PcmWorklet extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input?.[0]) {
      this.port.postMessage(input[0]); // Float32Array chunk
    }
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
