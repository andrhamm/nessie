/**
 * Ported from @audio/decode-wav@1.1.0 (MIT). Copyright (c) audiojs.
 * Logic byte-for-byte equivalent to the upstream decode-wav.js.
 * See ./NOTICE for license and attribution.
 *
 * WAV decoder — pure JS/TS / ESM.
 * Decodes PCM WAV audio to Float32Array samples (8/16/24/32-bit int, 32/64-bit float).
 *
 *   const { channelData, sampleRate } = await decode(wavbuf);
 */

export interface DecodedWav {
  channelData: Float32Array[];
  sampleRate: number;
}

export interface WavDecoder {
  decode(data: Uint8Array | null | undefined): DecodedWav;
  flush(): DecodedWav;
  free(): void;
}

interface WavFmt {
  float: boolean;
  channels: number;
  sampleRate: number;
  blockSize: number;
  bitDepth: number;
}

interface WavHeader extends WavFmt {
  dataStart: number;
}

const EMPTY: DecodedWav = Object.freeze({
  channelData: [] as Float32Array[],
  sampleRate: 0,
}) as DecodedWav;

export default async function decode(src: Uint8Array | ArrayBuffer): Promise<DecodedWav> {
  const dec = await decoder();
  try {
    return dec.decode(src instanceof Uint8Array ? src : new Uint8Array(src));
  } finally {
    dec.free();
  }
}

export async function decoder(): Promise<WavDecoder> {
  let hdr: WavHeader | null = null;
  let left: Uint8Array | null = null;
  let freed = false;
  return {
    decode(data: Uint8Array | null | undefined): DecodedWav {
      if (freed) throw Error("Decoder already freed");
      if (!data?.length) return EMPTY;
      let chunk: Uint8Array = data;
      if (left) {
        chunk = cat(left, chunk);
        left = null;
      }
      if (!hdr) {
        hdr = scanWavHdr(chunk);
        if (!hdr) {
          left = chunk.slice();
          return EMPTY;
        }
        chunk = chunk.subarray(hdr.dataStart);
      }
      const fb = hdr.blockSize;
      const complete = Math.floor(chunk.length / fb) * fb;
      if (!complete) {
        if (chunk.length) left = chunk.slice();
        return EMPTY;
      }
      if (chunk.length > complete) left = chunk.subarray(complete).slice();
      return decodeRaw(chunk.subarray(0, complete), hdr);
    },
    flush(): DecodedWav {
      left = null;
      return EMPTY;
    },
    free(): void {
      freed = true;
      left = null;
      hdr = null;
    },
  };
}

function cat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length);
  r.set(a);
  r.set(b, a.length);
  return r;
}

function s4(b: Uint8Array, o: number): string {
  return String.fromCharCode(
    b[o] as number,
    b[o + 1] as number,
    b[o + 2] as number,
    b[o + 3] as number,
  );
}

function scanWavHdr(b: Uint8Array): WavHeader | null {
  if (b.length < 12) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (s4(b, 0) !== "RIFF" || s4(b, 8) !== "WAVE") throw TypeError("Not a WAV file");
  let pos = 12;
  let fmt: WavFmt | null = null;
  while (pos + 8 <= b.length) {
    const type = s4(b, pos);
    const size = dv.getUint32(pos + 4, true);
    if (type === "fmt ") {
      if (pos + 24 > b.length) return null;
      const fid = dv.getUint16(pos + 8, true);
      if (fid !== 1 && fid !== 3) throw TypeError(`Unsupported WAV format: 0x${fid.toString(16)}`);
      fmt = {
        float: fid === 3,
        channels: dv.getUint16(pos + 10, true),
        sampleRate: dv.getUint32(pos + 12, true),
        blockSize: dv.getUint16(pos + 20, true),
        bitDepth: dv.getUint16(pos + 22, true),
      };
    } else if (type === "data") {
      if (!fmt) return null;
      return { ...fmt, dataStart: pos + 8 };
    }
    pos += 8 + size;
  }
  return null;
}

function decodeRaw(raw: Uint8Array, hdr: WavHeader): DecodedWav {
  const { channels: nCh, bitDepth, float: isFloat, sampleRate, blockSize } = hdr;
  const frames = Math.floor(raw.length / blockSize);
  if (!frames) return EMPTY;
  const ch: Float32Array[] = Array.from({ length: nCh }, () => new Float32Array(frames));
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let p = 0;
  if (isFloat && bitDepth === 64) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < nCh; c++) {
        (ch[c] as Float32Array)[i] = dv.getFloat64(p, true);
        p += 8;
      }
  } else if (isFloat && bitDepth === 32) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < nCh; c++) {
        (ch[c] as Float32Array)[i] = dv.getFloat32(p, true);
        p += 4;
      }
  } else if (bitDepth === 8) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < nCh; c++) {
        const v = (raw[p++] as number) - 128;
        (ch[c] as Float32Array)[i] = v < 0 ? v / 128 : v / 127;
      }
  } else if (bitDepth === 16) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < nCh; c++) {
        const v = dv.getInt16(p, true);
        p += 2;
        (ch[c] as Float32Array)[i] = v < 0 ? v / 32768 : v / 32767;
      }
  } else if (bitDepth === 24) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < nCh; c++) {
        let v = (raw[p] as number) | ((raw[p + 1] as number) << 8) | ((raw[p + 2] as number) << 16);
        p += 3;
        if (v >= 0x800000) v -= 0x1000000;
        (ch[c] as Float32Array)[i] = v < 0 ? v / 8388608 : v / 8388607;
      }
  } else if (bitDepth === 32) {
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < nCh; c++) {
        const v = dv.getInt32(p, true);
        p += 4;
        (ch[c] as Float32Array)[i] = v < 0 ? v / 2147483648 : v / 2147483647;
      }
  } else {
    throw TypeError(`Unsupported WAV bit depth: ${bitDepth}`);
  }
  return { channelData: ch, sampleRate };
}
