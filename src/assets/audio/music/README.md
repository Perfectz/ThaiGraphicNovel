# Music tracks

Background music for the game. Each track loops via `useGameMusic` and obeys
the `musicEnabled` / `musicVolume` settings in `services/soundSettings`.

The open-world adventure uses `bangkok/adventureScore.ts` to route the four
existing tracks: hotel/lumphini to stage 1, Sukhumvit/riverside to stage 2,
Yaowarat/battles to stage 3, and Old Town/title/ending to the title theme.
Connecting paths retain the last district theme. `MusicPlayer` waits for a
settled destination before crossfading, retains playback positions and limits
active sources to two. It starts after a user gesture and pauses on hidden tabs.
Thai practice surfaces reserve audio focus through `musicFocus`, keeping music
paused during reference listening, recording and playback until practice closes.
This routing adds no new compositions or dedicated battle track.

## Naming

```
title-theme.mp3                # Title screen / main menu
stage-01-hotel-lobby.mp3       # Stage 1 gameplay theme
stage-02-front-desk.mp3        # Stage 2 gameplay theme
stage-03-night-market.mp3      # Stage 3 gameplay theme
stage-NN-<slug>.mp3            # Per-stage gameplay theme (stage-01, stage-02, …)
battle-theme.mp3               # (future) shared combat track
boss-rift-gate.mp3             # (future) finale-specific track
```

Slug is a short lowercase-hyphen identifier of the stage location, matching
the `lessonScenarios` ids: `hotel-lobby`, `night-market`, `floating-market`,
`cafe-interior`, `rift-gate`, etc.

## Source

Tracks originated in `humandropbox/` (the raw human handoff folder). They
were renamed and moved here for bundling — never import directly from
`humandropbox/` in app code. Vite fingerprints the bundled URL so cache
busting works on deploy.

## Adding a new track

1. Drop the file as `stage-NN-<slug>.mp3`.
2. Import it in `App.tsx`'s `musicTrackUrl` selector with `?url`.
3. Branch on `currentScene` / `activeScenarioIndex` to route to the new track.

For the open-world adventure, import the new track in `BangkokAdventure.tsx`
and update its theme map and `adventureScore.ts` instead of the legacy selector.

## Format

- `.mp3` at 128–192 kbps. Stereo. ~3–5 MB per track to keep the initial
  load reasonable; the loader prefetches the active track only.
- Loop points should be clean — trim leading silence and ensure the tail
  matches the head amplitude so the HTML `<audio loop>` seam is invisible.
