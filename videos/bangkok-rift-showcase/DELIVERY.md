# Verified delivery — 7 September 2026

## Video

- `renders/bangkok-rift-showcase.mp4`: **134.000 seconds**, 1920×1080, 30 fps, H.264 + stereo AAC at 48 kHz, 83,305,296 bytes.
- Rendered locally with HyperFrames 0.8.30, high quality, two browser workers, PNG source-frame extraction, FFmpeg 8.1.1. Render time: 10m 50.4s.
- HyperFrames check: no runtime, layout, motion or contrast errors. One reviewed warning: seven scene titles share one editable track.
- Full MP4 decode passed. Chrome played the exported MP4 and advanced its clock without media errors.
- Exported scene frames at 4, 22, 42, 59, 78, 91, 101, 107, 124 and 133 seconds were extracted; Blender framing, live assessment, post-attack HP and the closing phone frame were visually reviewed.
- The final mixed audio was transcribed successfully: all seven narration sections are present. Mean level -24.0 dBFS, sample peak -2.6 dBFS; no clipping detected by this check.
- Verification script: `scripts/verify-showcase.mjs`. Local evidence: `renders/qa/` and repository `artifacts/`.

## Game

- First Light includes optional Realtime audio assessment, damage preview, spoken coaching, spoken questions, and a coached retry that retains the stronger result.
- Production build and scoped ESLint passed; 23 combat/pronunciation/backend tests and 10 Whisper tests passed.
- Actual Realtime tests passed locally on desktop and an emulated phone with prerecorded microphone input; Clear produced 22 damage. The spoken-question test used a labeled assessment fixture and a real recorded English question with a real Realtime spoken answer.
- Touch gameplay passed at 360×640, 390×844 and 844×390, including conversation, battle turns, defense and reload.
- Both required local voice health endpoints returned 200 through port 5188.
- GitHub implementation commit: `118dc310aa4d4d07a66db37e2027d0f5998ca0fb`; hosted packaging fix: `7ab8514b58fe52196304d1f22eabf6c2fc0f8e17`.
- [Shared playtest](https://bangkok-rift-playtest.vercel.app/) points to verified deployment `dpl_3Rk5jN3CjJWD6E9Cret58T5T7J2n`. Hosted function health and the missing-key fallback passed through the actual phone browser UI, with the turn preserved and normal base-damage play available.

## Remaining limits

AI pronunciation estimates are experimental and cover the First Light greeting only. They are not calibrated against Thai-speaker ratings. Physical phone microphones and speakers were not tested. The footage's Thai input is prerecorded and explicitly labeled; it is not a human learning-outcome demonstration.

Hosted Realtime calls remain disabled because Vercel has no server key. An explicit exception to the project's no-persistent-key rule was requested; no hosted key was stored. The local Realtime service is configured and verified. The MP4 is delivered locally, not uploaded to a video hosting service.
