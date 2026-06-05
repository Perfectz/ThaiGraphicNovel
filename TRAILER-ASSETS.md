# Bangkok Rift Trailer Assets

Catalogue of the 18 standalone scene clips, the 3 composed masters, and the underlying engine captures + HyperFrames sources you can edit.

**Visual catalogue:** [`contact-sheet/_all-clips.png`](contact-sheet/_all-clips.png)

---

## 18 standalone scene clips (1920×1080, H.264, scored with title-theme.mp3)

### V1 — 6 scenes (the original polished 60-second arc)

`linkedin-trailer/renders/scenes/` (silent) · `linkedin-trailer/renders/scenes-with-music/` (with music underscore)

| # | Filename | Dur | Treatment |
|---|---|---|---|
| 1 | `scene-1-cold-open.mp4` | 11.7s | "3 days ago this was a visual novel" headline over intro1 cinematic |
| 2 | `scene-2-lobby-pan.mp4` | 12.0s | "A real 3D hotel" + DAY 3 chip + Stage 01 meta |
| 3 | `scene-3-night-market-phrase.mp4` | 13.0s | Phrase card อร่อยมาก / aroi mak khrap / "Delicious" |
| 4 | `scene-4-wok-line-quote.mp4` | 12.0s | "Hold the mic… the AI corrects you" pull quote |
| 5 | `scene-5-su-orbit-stack.mp4` | 7.0s | "Meet Su" + tech stack chips |
| 6 | `scene-6-brand-mark.mp4` | 5.3s | BANGKOK RIFT wordmark · "Built in 3 days with /goals" |

### V2 — 12 scenes (variety building blocks)

`linkedin-trailer-v2/renders/scenes/` (silent) · `linkedin-trailer-v2/renders/scenes-with-music/` (with music underscore)

| # | Filename | Dur | Treatment |
|---|---|---|---|
| 01 | `scene-01-hook-what-if.mp4` | 10.7s | Headline "What if you had to learn Thai by Saturday?" |
| 02 | `scene-02-su-coaching-hud.mp4` | 12.0s | Pull quote over real cue-card mechanic |
| 03 | `scene-03-front-desk.mp4` | 12.0s | Front desk · "Talk your way past the hostess" |
| 04 | `scene-04-phrase-sawatdee.mp4` | 12.0s | Phrase card สวัสดีครับ / sa·wat·dee krap / "Hello" |
| 05 | `scene-05-inventory.mp4` | 12.0s | Stage 2 collect-the-5 list reveal |
| 06 | `scene-06-scenarios-tease.mp4` | 12.3s | Stages 4–10 roadmap chip row |
| 07 | `scene-07-phrase-mai-phet.mp4` | 11.6s | Phrase card ไม่เผ็ด / mai phet / "Not spicy" |
| 08 | `scene-08-atmospheric-lantern.mp4` | 8.1s | Pure mood — "— BANGKOK BY NIGHT —" only |
| 09 | `scene-09-stat-callout.mp4` | 12.0s | "10 phrases · 3 stages · 0 prior Thai" stat block |
| 10 | `scene-10-hook-same-characters.mp4` | 12.0s | "Same characters. Same Bangkok. Different dimension." |
| 11 | `scene-11-pull-quote-tech.mp4` | 12.0s | "Real 3D. Real Thai. Real-time AI." |
| 12 | `scene-12-end-card-coming-soon.mp4` | 8.3s | "Coming soon · Beta opens this week" end card |

---

## 3 composed master cuts

| File | Duration | Content |
|---|---|---|
| `linkedin-trailer/renders/linkedin-trailer.mp4` | 61s | V1's 6 scenes as a single edit (silent) |
| `linkedin-trailer/renders/linkedin-trailer-music.mp4` | 61s | Same, with title-theme underscore |
| `linkedin-trailer-v2/renders/v2a-master.mp4` | 71s | V2 scenes 1–6 sequenced (silent) |
| `linkedin-trailer-v2/renders/v2a-master-music.mp4` | 71s | Same, with music |
| `linkedin-trailer-v2b/renders/v2b-master.mp4` | 64s | V2 scenes 7–12 sequenced (silent) |
| `linkedin-trailer-v2b/renders/v2b-master-music.mp4` | 64s | Same, with music |
| `combined/bangkok-rift-full-inventory.mp4` | 196s | All 3 masters concatenated — every one of the 18 scenes in one viewing |

Combine the two v2 masters end-to-end for the full 135s second-take trailer:
```
ffmpeg -i v2a-master-music.mp4 -i v2b-master-music.mp4 -filter_complex \
  "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[v][a]" -map "[v]" -map "[a]" \
  v2-combined-music.mp4
```

---

## 9 raw engine captures (source footage for HyperFrames overlays)

`linkedin-trailer-v2/assets/` (also in `linkedin-trailer-v2b/assets/`, `tmp/promo/clips/`)

| ID | File | Stage | Description |
|---|---|---|---|
| 02 | `clip-02.mp4` | 1 | Intro cinematic — Patrick + Su rift arrival (uses `intro1.mp4`) |
| 08 | `clip-08.mp4` | 1 | Hotel lobby pan, HUD-off |
| 09a | `clip-09a.mp4` | 1 | Su lobby with full HUD visible (cue card, verbs, inventory) |
| 10b | `clip-10b.mp4` | 2 | Front desk room, golden art-deco, HUD-off |
| 11b | `clip-11b.mp4` | 3 | Night market stalls, HUD-off |
| 12 | `clip-12.mp4` | 3 | Wok line / cookline, HUD-off |
| 16 | `clip-16.mp4` | 2 | Stage 2 lobby with HUD-on (inventory tray, item pedestals) |
| 20 | `clip-20.mp4` | 1 | Su character beauty orbit (isolated) |
| 21 | `clip-21.mp4` | 3 | Lantern atmospheric orbit (no character) |

All are 1920×1080, 25fps. Re-capture or new angles: see "Pipeline" below.

---

## How to remix

### Change a headline / phrase in an existing clip
1. Open the relevant HyperFrames composition:
   - V1: [`linkedin-trailer/index.html`](linkedin-trailer/index.html)
   - V2 scenes 1–6: [`linkedin-trailer-v2/index.html`](linkedin-trailer-v2/index.html)
   - V2 scenes 7–12: [`linkedin-trailer-v2b/index.html`](linkedin-trailer-v2b/index.html)
2. Edit text or timing
3. Render: `cd <project> && PATH="/c/Users/pzgam/scoop/shims:$PATH" npx hyperframes render --quality standard --workers 1 --output renders/<name>.mp4`
4. Re-slice: `bash linkedin-trailer-v2/slice-clips.sh`

> Always use `--workers 1`. Parallel workers trip the Chrome protocol timeout on this composition's video count.

### Capture new engine footage
1. Start dev server: `npm run dev`
2. Add a clip entry to [`scripts/clip-manifest.json`](scripts/clip-manifest.json)
3. Capture: `npm run promo:record -- --clip=<id> --base http://127.0.0.1:<port>`
4. Encode: `npm run promo:encode`
5. Copy the mp4 into the relevant trailer `assets/` directory

### Generate voice-loop clips (14, 23, 24, 25)
Still TBD — requires `OPENAI_API_KEY` for `npm run voice:gen-demos` to synthesise the male-voice attempt WAVs, then the Whisper service running so `__injectVoiceAttempt` can call into the real judge. The plumbing is already in place ([`src/services/whisperPronunciation.ts`](src/services/whisperPronunciation.ts), [`scripts/gen-voice-demos.mjs`](scripts/gen-voice-demos.mjs)) — just needs the key.

---

## Pipeline reference

```
                      record-promo --clip=NN
[Vite dev server] ─────────────────────────────▶ tmp/promo/clip-NN/clip-NN.webm
                                                       │
                                                       │ encode-clips
                                                       ▼
                                                tmp/promo/clips/clip-NN.mp4
                                                       │
                                                       │ cp into trailer/assets/
                                                       ▼
[HyperFrames composition] ──── npx hyperframes render --workers 1 ───▶ renders/<name>.mp4
                                                       │
                                                       │ slice-clips.sh
                                                       ▼
                                                renders/scenes/scene-NN-<title>.mp4
                                                       │
                                                       │ ffmpeg (music underscore)
                                                       ▼
                                                renders/scenes-with-music/scene-NN-<title>.mp4
```

Notes:
- **`--workers 1`** is required for renders with 5+ videos. Anything more trips the Chrome DevTools protocol timeout.
- **`PATH="/c/Users/pzgam/scoop/shims:$PATH"`** is required to pick up ffmpeg 8.1.1; the Python-bundled ffmpeg-2013 in PATH doesn't support `colorspace=bt709` that HyperFrames sets by default.
- **Engine clips are at 25fps** because that's the Playwright `recordVideo` default. HyperFrames re-conforms to 30fps on output.
