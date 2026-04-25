# espeak-demo

Local TTS prototype: feasibility study of using **eSpeak-NG** (classical formant
synthesizer, ~2 MB, runs anywhere) as the voice for the offline / LAN-first
Nessie variant. Renders the existing ElevenLabs `SAMPLE_SCRIPT` through 6
feminine voice variants × 4 reverb-free sox FX presets, with N=3 timing runs
per combination.

## Status

**Prototype, parked.** Voice quality not acceptable for the Nessie persona at
any voice/FX combination tried. Kept here as a reference for:

- The benchmark harness pattern (mean / min / max RTF aggregation, JSON
  report, listening index HTML).
- The bracket-tag → param-override parser, which is reusable for any local
  TTS engine.
- A documented baseline for how fast a non-neural TTS engine runs on
  Apple Silicon (~150 ms per 5–6 second utterance, RTF ≪ 1).

Future work — Piper / Kokoro / RHVoice — should reuse the same module shapes
(`SynthOptions`, `EspeakSegment`, `RunMetrics`, `BenchReport`).

## Run

```bash
brew install espeak-ng sox
cd prototypes/espeak-demo
bun install
bun run demo
open local-voice-samples/espeak-ng/index.html
```

Output: 24 WAV files + `bench.json` + `index.html` under
`local-voice-samples/espeak-ng/`.

## Layout

```
src/
  index.ts          # CLI orchestrator
  emotion-map.ts    # bracket-tag parser → EspeakSegment[]
  espeak.ts         # espeak-ng adapter (per-segment + sox concat)
  fx.ts             # sox FX presets: dry / fairy / magical / sprite
  bench.ts          # N-run aggregation + bench.json writer
  html-index.ts     # listening UI generator
  wav-utils.ts      # sox --i -D wrapper
  has-binary.ts     # Bun.which wrapper for skipIf guards
test/
  *.test.ts         # one per src module
```

## Spec / plan

- `docs/superpowers/specs/2026-04-18-espeak-demo-design.md`
- `docs/superpowers/plans/2026-04-19-espeak-demo.md`
