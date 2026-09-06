# Bangkok Rift: thirty days to Thailand

The training route is available at `/training` and through **Train at camp** in the new [Last Ferry adventure](THE_LAST_FERRY.md). The earlier implementation remains at `/legacy`; `/battle-demo` and `/microgames` retain their routes and existing saves. The training save key is `bangkok-rift-training-v1`.

## Daily learning design

The thirty-day route draws on the existing first nine lesson scenarios (82 phrases), with three final days combining practical arrival, meal, and travel phrases. The user can revisit or preview any day. Day numbers represent curriculum progress, not elapsed calendar days.

The daily suggested hour is 5 minutes of review, 10 listening/echoing, 15 situational phrase choices, 15 speaking practice, 10 recall, and 5 reflection. These are practice allocations, not mandatory timers or a claim of sixty minutes of unique story footage. Activities finish when their phrase queue is complete and can be replayed to continue rehearsal. The timer counts active foreground use and pauses after 90 seconds without interaction.

Review dates use local calendar days. Successful self-reported recall increases the interval across distinct days (1, 3, 7, then 14); repeated same-day success cannot inflate the interval. A missed recall makes the phrase due again. Recognition and spoken-practice counts are separate from recall. None of these measures establishes real-world fluency.

Recording locally is ephemeral and stays in browser memory. The optional voice coach uses the existing local Whisper or configured Realtime adapter. No new API key persistence was introduced. Wording recognition is described honestly; the UI does not turn transcript edit distance into a tone score. Local recording requires explicit mic action and supports stop, playback, and reference comparison. Unsupported/denied mic access can be replaced with phrase-choice practice without awarding spoken credit.

## Art and implementation

- `src/bangkok/BangkokWorld.ts`: Three.js riverfront diorama, hotel, food stalls, tropical foliage, animated ferry and lanterns, rigged Patrick and Su, and the recall wisp. Static geometry is batched by material; moving props retain their transforms. A single render pass and an adaptive resolution/shadow reduction support slower devices. Disposal covers models, textures, geometry, observers, and input listeners.
- `src/bangkok/BangkokGame.tsx`: camp, thirty-day route, six activity flows, phrasebook, progress, and accessible help/route dialogs.
- `src/bangkok/curriculum.ts`: content selection, queues, and situational prompts using shared phrase IDs.
- `src/bangkok/learning.ts`: immutable progression, review scheduling, versioned save validation.
- `src/bangkok/useTrainingVoice.ts`: ephemeral recording, reference playback, dynamic voice service adapters, stale-response guards, and a recoverable timeout.

The art is inspired by Bangkok, not a navigable geographic reconstruction. Three rendered districts provide scenery for the thirty curriculum days; the later days are training content, not thirty separately built maps.

## Reference assets

`public/bangkok/river-skyline.png` was generated with the built-in Codex image-generation tool. Prompt: a wide, text-free premium stylized Bangkok/Chao Phraya blue-hour skyline, golden Thai temple roofs and prang, contemporary towers, violet/coral sky, and a clear foreground river for a real Three.js hotel and market diorama.

The 82 MP3s in `public/bangkok/audio` use Microsoft Edge synthetic Thai speech through `edge-tts`, voice `th-TH-NiwatNeural`, rate -8%. Their exact texts and provenance are stored alongside them. `scripts/training-audio-plan.mjs` derives the texts from existing lesson data; `scripts/generate-training-audio.py` generates missing recordings. Voice files are not human recordings and have not had a comprehensive Thai-speaker review.

Learning references:
- https://pubmed.ncbi.nlm.nih.gov/23681928/ — retrieval versus imitation in foreign vocabulary learning.
- https://www.tatnews.org/2024/10/10-essential-thai-phrases-every-tourist-should-know/ — practical tourist phrase priorities.
- https://github.com/openai/whisper/blob/main/model-card.md — ASR scope and limitations.

## Verification

Run `npm run build`, `node --test tests/training.test.ts`, `npm run test:units`, `npm run test:whisper`, and `node scripts/test-training.mjs` with Vite on port 5188. The browser check completes all six activities, exercises wrong answers, records and plays synthetic microphone input, reloads a checkpoint, checks all audio assets, selects a later day, searches the phrasebook, and verifies a phone flow. Screenshots are written under `artifacts/bangkok-verification`.

`node scripts/test-training-recovery.mjs` also checks switching between choices and microphone, recording/playback, a returning learner's next-day button, and permission-denied recovery on a phone. Permission denial is injected; recording uses the browser's synthetic microphone device.

### Checked on September 4, 2026

- Production build passed. The shared vendor chunk still triggers the existing 600 kB size warning.
- Nine learning tests, fifteen existing unit tests, and ten Whisper tests passed.
- Both training browser scripts passed, with no page errors. The existing desktop/mobile battle-menu regression check also passed.
- All 82 reference MP3s were served successfully; a reference was decoded and submitted through the live Whisper endpoint. The silence check correctly rejected empty audio.
- Realtime and Whisper health endpoints both returned HTTP 200 and `ok: true` through Vite.
- The new Bangkok files pass ESLint without warnings. The full source lint has zero errors and eight warnings in earlier components/hooks.
- The test browser uses ANGLE/SwiftShader software rendering. Settled desktop samples were about 82–92 ms per frame after adaptive quality reduction. Gameplay remains usable in the automation, but this is not a smooth-frame-rate result or evidence of performance on a hardware GPU. A real-device performance pass remains outstanding.

The live Whisper reference/silence checks verify audio handling, not human pronunciation quality. A real learner session and Thai-speaker content/voice review remain necessary for validating learning effectiveness and tone feedback.
