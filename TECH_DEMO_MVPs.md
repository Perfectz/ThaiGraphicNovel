# Tech Demo MVPs — Pre-Share Checklist

A sequenced list of small, shippable milestones to take Bangkok Rift / Isekai Thai Quest from "Q1 engine port complete" to "demo I can hand to a stranger and feel proud of". Scoped tightly to the first 3 stages — Stage 1 (Hotel Lobby), Stage 2 (Front Desk), Stage 3 (Night Market). Stages 4–10 stay locked.

Each MVP has an acceptance criterion and a difficulty tag. **🟢 autonomous** = I can finish without you. **🟡 needs review** = I'll do the work, you review when you're back. **🔴 needs input** = needs a decision or asset from you before it can start.

The list is ordered roughly by criticality. If you only have a weekend on return, MVPs 0 → 3 are the minimum demo-shareable bar.

---

## MVP 0 — Finish the in-flight Q1 tasks 🟢

Three tasks landed marked-complete in the task list but only partially shipped during the last working session:

- **0a. Non-mic mode wired into gameplay.** The `'no-mic'` value is in the `VoiceJudgeMode` union and shows up in Settings, but the Stage3DAdventure UI doesn't honour it yet. When the player picks No-mic, the bottom panel still shows "Connect Whisper Mic" and "Hold To Speak". Need: hide both, replace with a single "Confirm Phrase" button that calls `skipActivePrompt()`. No mic permission requests anywhere in the no-mic codepath.
- **0b. Stages 4–10 visibly locked.** Currently still selectable from LessonRoadmap. Need: lock icon + "Coming after launch — this is a 3-stage demo" tooltip, click-disabled. Add a "Tech demo · 3 stages" chip on the title screen.
- **0c. Polish pass on Stages 2 and 3.** Stage 1 got polish during the last session (chandelier, hotel signage). Stages 2 and 3 didn't get the same treatment. Match the visual density bump from Stage 1.

**Acceptance:** all three Q1 leftover tasks pass a manual playthrough.

---

## MVP 1 — End-of-demo splash 🟢

When the player clears Stage 3, the current "Continue Journey" button just dumps them back to the overworld where Stages 4–10 are locked. That's a cliff. Replace with a proper demo-end splash:

- Title: "End of the Bangkok Rift tech demo."
- Body: "You learned 10 polite phrases and ordered street food in Thai. The full game continues with taxi rides, floating markets, clinics, embassy negotiations, and the rift gate closing finale."
- Two CTAs: "Replay any stage" (back to LessonRoadmap), "Send feedback" (mailto or form link — see MVP 1b)
- Show the 10 phrases learned with romanization, as a small "Phrases you can now say in Bangkok" list
- Bonus: a credits roll (Patrick / Su / your name / "Made with React + Three.js + OpenAI Realtime")

**MVP 1b — feedback channel:** 🔴 you decide where feedback goes. Options:
- A `mailto:` link to your email (zero infra)
- A Google Form / Tally form URL (more structured)
- A short feedback section in-app that POSTs somewhere

Pick one and tell me on return; I'll wire it.

**Acceptance:** complete Stage 3, see splash, click feedback link, lands somewhere meaningful.

---

## MVP 2 — Title screen welcomes first-time players 🟢

The current TitleScreen needs a first-time-player path. Right now it likely assumes the player knows what this is.

- Hero copy: **"Bangkok Rift — a 3-stage Thai language tech demo"**
- One-line elevator: "Patrick falls through a magic rift into Bangkok and learns survival Thai with Su. ~25 minutes."
- Three buttons: **Start the demo** (jumps to Stage 1 intro video), **Continue** (only if save exists), **Settings**
- Below the buttons: small chips: "Voice or No-Mic mode", "WebGL 2 · ~50 MB assets", "Headphones recommended"
- "About" link in the corner → modal with credits + tech stack + what's NOT in the demo

**Acceptance:** open the title screen cold, a friend who has never seen the game can figure out what to click first.

---

## MVP 3 — Mic-denied auto-fallback 🟢

A player who clicks "Allow mic" then accidentally denies, or who's on a device with no mic, currently gets stuck on the "Connect AI Mic" button. Need:

- Detect mic permission denial / `getUserMedia` failure at the Stage3DAdventure level
- Toast: "Mic permission denied — switched to No-mic mode. Tap Confirm Phrase to advance."
- Persist the switch to `voiceJudgeMode = 'no-mic'` in localStorage so they don't hit the same wall next stage

**Acceptance:** deny mic in browser permissions, can still finish Stage 1.

---

## MVP 4 — Three.js error boundary 🟢

If a GLB fails to load or Three.js throws mid-scene, the player sees a frozen canvas. Need:

- Catch Three.js / GLTFLoader failures with a per-stage error UI
- "Stage failed to load. [Reload stage] [Return to map] [Report bug]"
- Sentry-style breadcrumb log so a bug report has useful context (no PII)

**Acceptance:** corrupt one of the GLB URLs and verify graceful failure instead of black screen.

---

## MVP 5 — Loading polish 🟡

Currently the load overlay says "Loading Hotel Lobby Basics…" with a spinner. Fine, but feels engineering-grade. Upgrade:

- Stage-themed loading copy ("Tuning the Bangkok rift…", "Setting up the night market…")
- Progressive load hints — show what's loading (Patrick rig, room geometry, audio coach)
- Min-display time of 800ms so the splash doesn't strobe on fast machines
- Smooth crossfade into the scene instead of a hard cut

**Acceptance:** load Stage 3 on a slow throttled connection, the transition feels intentional not janky.

---

## MVP 6 — Audio coverage script 🟢

Q2 of the 2-year roadmap calls for `scripts/audio-coverage.mjs`. Build it now since it powers later voice-acting work:

- For each lesson scenario × each chunk × each phrase, check what audio file IDs are referenced and whether they exist on disk
- Report per stage: covered / partial / missing
- Add to CI as a non-blocking informational job

**Acceptance:** `npm run audio:coverage` outputs a table. Stage 1 reports ~100% coverage, Stages 2 and 3 show explicit gaps.

---

## MVP 7 — Captions for all Su VO 🟡

Currently Su's voice plays without captions. Two reasons to add captions:

1. Accessibility — players with hearing difficulty or who play muted (work / public transit) need them
2. Comprehension — Su's lines have inline Thai vocab in parentheses; seeing it written helps learning

The text already exists in `stageOneSuVoiceLines.ts`, `stageTwoSuBriefing.ts`, and the conversation deck. Need:

- A small captions strip at the bottom of the screen during Su VO playback
- Toggle in Settings → "Show captions during Su voiceover"
- Default: on

**Acceptance:** play Stage 1 muted with captions on; the experience is comprehensible.

---

## MVP 8 — Stage selector for testers 🟢

For sharing with friends, add a debug-style jump-to-stage menu (gated by a URL param or settings toggle so end users don't see it):

- `?tester=1` query param unlocks a "Jump to stage" picker in the settings modal
- Direct-jump to Stage 1 / 2 / 3 with one click, no save required
- Useful for: bug reports, friend who only wants to see Stage 3, design review

**Acceptance:** open `/?tester=1`, jump straight to Stage 3 night market.

---

## MVP 9 — Browser compat smoke 🟡

Run the 3-stage playthrough in:

- Chrome desktop (current dev target — should pass)
- Firefox desktop
- Safari desktop (iOS Safari quirks: WebAudio autoplay, GLB CORS)
- Chrome Android
- iOS Safari (this one will surface the most issues)

Fix critical-path breakages. Acceptable to add "Best on desktop Chrome / Safari" advisory chip if mobile needs more time.

**Acceptance:** at least 3 of 5 browsers can finish Stage 1 end-to-end.

---

## MVP 10 — Deploy + share URL 🔴

The demo is shareable when it's deployable. Need from you:

- A hosting target (Vercel / Netlify / Cloudflare Pages / your own server)
- A subdomain or path (e.g. `bangkokrift.yourdomain.com`)
- Decide what to do about the server-side `OPENAI_API_KEY` in production: ship without a default (everyone uses No-mic or pastes their own key), or you front the API costs (need usage limits)
- Build config: `npm run build` already works. Need a CI deploy step.

I can scaffold the Vercel / Netlify configs and CI workflow once you pick a target.

**Acceptance:** a shareable URL works for someone who has never seen the repo.

---

## MVP 11 — README & runbook 🟢

For anyone landing on the repo (including future you after a long pause):

- README explains what the game is, how to run it locally (`npm install`, `npm run dev`)
- `.env.example` documents what env vars matter
- `docs/architecture.md` — one-page tour of the codebase (Q1 of the 2-year roadmap already shipped a big chunk of this; just needs writing up)
- `docs/voice-pipeline.md` — how Whisper + Realtime + No-mic interact

**Acceptance:** someone clones the repo and runs the demo in under 5 minutes following the README.

---

## MVP 12 — Trailer / screenshot kit 🔴

For posting the demo: a small marketing kit.

- 30-second screen capture showing the loop (intro video → stand-up → drill → stage clear)
- 5 hero screenshots at 1920x1080
- One-pager: title, tagline, demo URL, "play the demo" CTA, key bindings, credits

Needs your call on: voiceover (yours or a stock one?), background music in the trailer, tone (playful or earnest?). I can rough-cut from existing assets once you decide.

**Acceptance:** a trailer.mp4 and 5 screenshots committed under `docs/marketing/`, ready to post.

---

# What I'm going to work on while you're away

Picking off the 🟢 autonomous items in roughly this order:

1. **MVP 0a** — wire no-mic mode through gameplay (highest impact, blocks accessibility)
2. **MVP 0b** — lock stages 4–10
3. **MVP 1** — end-of-demo splash (placeholder feedback link — `mailto:pzgambo@gmail.com` for now, easy to swap)
4. **MVP 3** — mic-denied auto-fallback
5. **MVP 4** — Three.js error boundary
6. **MVP 0c** — polish Stages 2 and 3
7. **MVP 6** — audio coverage script
8. **MVP 2** — title screen welcome
9. **MVP 7** — captions
10. **MVP 8** — tester jump menu
11. **MVP 11** — README and docs

That's 11 of the 13. The ones I'll leave for your return:

- **MVP 1b** (feedback channel choice)
- **MVP 5** (loading polish — partially needs your aesthetic call)
- **MVP 9** (browser compat — best done by you on real devices)
- **MVP 10** (deploy — needs your hosting target)
- **MVP 12** (trailer — needs your creative call)

# Commit cadence

I'll work on a new branch `tech-demo-mvps` so your main stays green. Each MVP lands as a single focused commit with the acceptance criterion checked. When you're back, you can review the branch as a coherent narrative and merge what you like.

Have fun with your friends.
