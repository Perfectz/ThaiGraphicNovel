# First Light pronunciation power

First Light now offers optional recorded-speech assessment inside ordinary story battles and sparring. The English meaning appears before recording. The player can listen, record, request a Realtime assessment, ask for spoken coaching or record a question, then retry once and keep the stronger of two graded attempts. Damage and the turn advance only after confirmation.

The four broad AI estimates map to 70%, 100%, 120%, and 140% damage. First Light's normal 18 damage becomes 13, 18, 22, or 25 before enemy exposure/armor. AP, break, targeting and party turns retain their existing rules. Ungraded replies deal base damage. Silence, uncertainty, malformed responses, timeouts and stale turn identifiers never apply a damage bonus or consume a turn by themselves.

This is an experimental first-phrase implementation, not a calibrated Thai pronunciation test. Recognition of words is not proof of correct tones. Reference guidance for ครับ is grounded in [Thai-language.com's tone reference](https://www.thai-language.com/ref/tones) and [consonant reference](https://www.thai-language.com/ref/consonants). Human Thai-speaker calibration and broader phrase coverage remain future work.

## Service

`POST /api/realtime/battle` accepts bounded mono PCM16 recordings at 24 kHz. The server connects directly to OpenAI Realtime (`gpt-realtime-2.1`, overridable with `OPENAI_BATTLE_VOICE_MODEL`). It retrieves the committed audio item before requesting a response. A strict application parser validates the returned labeled fields; the game computes damage. Coaching produces audio and a visible transcript. Follow-up questions include the earlier assessment as context. Raw user audio is not saved by this feature.

The server reads `OPENAI_API_KEY` from its environment; the browser never receives that key. Local development uses the existing Realtime server and Vite proxy. The Vercel function is deployable but requires a separately configured server environment key. Follow the repository's secret-storage policy before configuring hosted credentials.

Limits: 20-second phrase recordings, 15-second spoken questions, two graded attempts and three coaching requests per open card. A per-process, per-IP hourly request guard reduces accidental repeated usage; it is not a durable global spending cap or authentication system. The hosted playtest should gain durable quotas before broad distribution.

## Verification

- `npm run build`
- `npm run test:pronunciation` and `npm run test:expedition`
- `npm run test:whisper`
- `node scripts/test-pronunciation-power.mjs --phone` checks retry and best-result damage with controlled API fixtures.
- `node scripts/test-pronunciation-power.mjs --live --capture` checks the real API with a prerecorded Thai microphone fixture; a clear result dealt 22 damage in the recorded demo.
- `--live --phone --question` uses a labeled assessment fixture to isolate the real spoken-question/coaching flow.
- Local health checks cover both `/api/realtime/health` and `/api/whisper/health` through port 5188.

Phone automation uses browser emulation. Physical iPhone/Android microphone and audio playback behavior still needs device playtesting. Live model output can be uncertain even on intelligible speech; those attempts remain ungraded.
