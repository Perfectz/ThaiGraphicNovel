# Prerecorded character voices

The current adventure uses 251 local OpenAI speech recordings: 82 Thai references voiced by Su and 169 story/guide/response lines across Su, Mali, Dao, Pim, Arun, Uncle Lek, Niran and Nok. They total 1,846.584 seconds (about 31 minutes). Generation finished with no failed requests. The project-local API key was read only into the generating process; it is absent from recordings, manifests and client code. The original 185-clip pack was extended for Chapter II and then with 47 character responses.

Model selection was checked against the current [OpenAI text-to-speech guide](https://developers.openai.com/api/docs/guides/text-to-speech), which identifies `gpt-4o-mini-tts` as its newest, most reliable TTS model. This is prerecorded Speech API output; the game does not make speech-generation API calls. Eight distinct built-in voices are assigned consistently in `scripts/bangkok-voice-plan.mjs`. The cast is original, with no voice cloning.

## Playback

- Story, discovery and escort conversations, local services, the evening outing and Arun's lantern workshop play their current recorded line. Hear/Stop controls allow replay, and a persistent Story voices toggle controls automatic narration. AI-generated voice disclosure appears beside the controls.
- Correct replies now trigger the authored character response in story, discovery, canal and escort conversations. Evening preferences play the corresponding reaction; confirmed local services play their receipt. These responses replace opening narration. Nok answers Su's invitation in Nok's voice; Dao answers the thanks at the station in Dao's voice. Audio never confirms a route, claims a discovery, completes an escort or buys supplies.
- Every existing Thai reference phrase resolves to the new Su recording. Slow playback preserves pitch. Original Microsoft recordings remain as fallback assets.
- Selecting a Thai meaning, playing a reference or starting microphone practice stops narration. Replaying narration stops the reference. Narration stops on a new line, leaving the conversation or hiding the page. Music and battle effects yield while speech owns audio focus.
- Text remains visible and playback never submits an answer, spends AP or awards speaking practice. Audio download failure leaves the reading/recording flow usable.

## Reproduction

Run from the project directory:

```
node scripts/generate-bangkok-voices.mjs --dry-run
node scripts/generate-bangkok-voices.mjs
node scripts/sync-bangkok-voices.mjs
node scripts/verify-bangkok-voices.mjs
node scripts/test-character-voices.mjs
node scripts/test-response-voices.mjs
node --test tests/responseVoices.test.ts
```

Generation reads `OPENAI_API_KEY` from the environment or local environment files. No key value is logged. Completed clips are cached by model, voice, text and direction fingerprint. Manifest checkpoints are serialized and atomic. The sync step checks all expected recordings and SHA-256 hashes before writing the lightweight client URL index. Generation/transcription incur API charges when run; ordinary playback uses local MP3 files.

For a local verification without paid transcription, use `node scripts/verify-bangkok-voices.mjs --decode-only --out=artifacts/response-voices`. Verification checks the active authored plan against model, speaker voice, exact text, file hash and decoded samples. Historical inactive files are retained but excluded from active totals.

## Evidence and limits

- Latest response pass: 47 new recordings generated successfully; all 251 active files decoded with finite samples, non-silence and acceptable levels. See `artifacts/response-voices/verification.json`. The current official TTS guide was rechecked and still names `gpt-4o-mini-tts` as its newest dedicated TTS model.
- Eight desktop/390px phone response scenarios passed actual playback, exclusive narration, cancellation, mute and unchanged confirmation gates. The separate two-viewport microphone flow passed recording/replay, automatic Mali responses, slow Thai reference playback, persistent mute and cleanup. Both browser reports finish with no console/page errors. The initial new test counted resumed background music as a voice after leaving; its retained report is `initial-music-check.json`, and the corrected check scopes to character audio.
- Production build and focused ESLint pass. 24 adventure, evening, service, escort and response-coverage tests plus ten Whisper tests pass. Both proxied voice services returned HTTP 200. The existing large bundle warning remains.
- All 185 MP3s passed FFmpeg decoding, SHA-256 integrity, finite-sample, duration, non-silence and peak-level checks. `artifacts/openai-voices/verification.json` records each duration and level.
- The Chapter II extension generated 20 more files; one older line is now inactive. Its new files passed decoding and level checks in `artifacts/reunion/audio-verification.json`, and all branch scenes resolve to verified hashes in `voice-coverage.json`. The client sync validates all 204 active files.
- Eight Thai samples were transcribed with `gpt-transcribe` without supplying their expected text. Six matched exactly after whitespace/punctuation normalization. `how-much` returned `เท่าไร` for `เท่าไหร่`; Patrick's name returned `แพทริค` for `แพทริก`. These are recorded as non-exact matches, not silently counted as exact. Transcription is a screening tool, not a pronunciation or tone grade.
- Desktop and 390px phone-emulated Chrome checks passed actual story and reference playback, exclusive audio, slow rate, a MediaRecorder reply using Chrome's synthetic microphone, mute persistence across reload and cleanup when leaving. Browser reports finished with zero console/page errors.
- Production build and focused ESLint pass. All ten Whisper service tests pass, and both proxied voice health endpoints returned HTTP 200.
- A fluent Thai speaker has not reviewed the full pack. Human listening preference, real microphone acoustics and physical-phone behavior remain unverified. This pass does not claim that automated transcription establishes native-quality Thai.

Assets: `public/bangkok/voices/`. Source/fingerprint manifest: `manifest.json`. Client URL index: `src/bangkok/generatedVoices.ts`. Browser evidence: `artifacts/openai-voices/browser/progress.json`.
