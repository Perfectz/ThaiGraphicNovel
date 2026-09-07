# Bangkok Rift — Words Become Power

A 134-second, 1920×1080, 30 fps HyperFrames showcase. Final local output: `renders/bangkok-rift-showcase.mp4`.

The film uses actual game footage, an actual Blender render of the project's environment models, supplied character models integrated into the game, prerecorded OpenAI character voices, original English OpenAI narration, and existing project music. Combat footage uses a prerecorded Thai microphone fixture and a live Realtime API assessment; the visible Clear result produces 22 damage. It does not represent a human pronunciation benchmark or a newly achieved learner improvement.

Captured saves place the party at representative destinations. The film is an edited showcase, not a continuous playthrough. Some shots hold their final frame. AI grading is experimental; Thai-speaker calibration and physical-phone testing remain outstanding.

## Rebuild

From the repository root, the production scripts are:

- `scripts/blender/render_showcase.py`: Blender studio render of the real GLB environment assets.
- `scripts/capture-showcase-world.mjs`: desktop and phone world footage.
- `scripts/test-pronunciation-power.mjs --live --capture`: actual Realtime battle recording and assertions.
- `scripts/showcase-narration.mjs`: authorized OpenAI narration; credentials remain in process memory.
- `scripts/showcase-captions.mjs`: word timestamps from the generated narration.
- `scripts/compose-showcase.mjs`: editable HTML composition and storyboard.

Generated media, raw captures, renders and caches remain local. Retain the `assets` folder alongside this source for editing. `story.json`, `captions.json` and `audio_meta.json` document narration and timing; `BRIEF.md` and `frame.md` document creative choices.

Use HyperFrames **0.8.30** (upgraded from the installed 0.7.55) and modern FFmpeg/FFprobe. On this Windows machine, the Scoop FFmpeg 8.1.1 path must precede the unrelated 2013 Python-installed FFmpeg in PATH. Run `npm run check`, then `npm run render -- --quality high`. The exact rendered command and verification results are recorded in the delivery report.

The headline reveal adapts the installed `lt-mask-reveal` primitive. Main scene text remains in one timeline so the explanatory edit can be adjusted together; the resulting track-density warning is intentional.
