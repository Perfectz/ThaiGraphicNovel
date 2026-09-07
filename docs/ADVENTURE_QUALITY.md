# Adventure quality audit — 6 September 2026

The standard is a coherent Thai-learning adventure, not the number of menus or lessons. This remains a work in progress; it is not yet comparable in scope, visual finish, or sustained play to the reference games.

## Reference criteria

- **Language changes what happens.** Chants of Sennaar connects observation, language and exploration. For this game, understanding an English intention and attempting its Thai expression should help a person or resolve an obstacle. Reference: https://www.focus-entmt.com/en/games/chants-of-sennaar
- **Places reward curiosity.** Expedition 33 combines a world map, distinct explorable locations and secrets. Bangkok Rift needs connected places with things to notice and do, not only a chain of contact buttons. Reference: https://www.expedition33.com/post/release-date-announce
- **The party persists through the adventure.** Supplies, abilities, battles and discoveries must affect the same campaign. Reference: https://www.expedition33.com/post/your-first-look-at-gameplay-from-clair-obscur-expedition-33

## Current evidence and remaining gaps

| Requirement | Evidence | Remaining gap |
| --- | --- | --- |
| Start at a Sukhumvit hotel | Fresh campaign browser run begins with Su and Mali | More ambient life and personal reasons to return |
| Travel among Bangkok-inspired places | Eight areas now include an explorable Thonburi canal quarter; the ferry moves the saved party between banks, with walking routes within each bank and a two-bridge canal loop | Compact fictional geography; district scale and activities still need expansion |
| Battles belong to the main story | Fresh local and public campaign runs beat Murmur and Keeper and board the ferry without practice; story formations now stand on their actual world terrain, with the Murmur retaining its exploration silhouette | More encounters and contextual tactics; greater animation variety |
| Exploration beyond errands | Archive adds five connected rooms, three records, a deduction and permission-based dialogue | Local desktop and phone browser runs passed the complete quest, microphone flow and reloads; model fallback was confirmed off |
| Speak with understood intent | English previews, reference audio and optional recorded replies | Full phrase pack needs fluent-speaker review; live pronunciation coaching is not deployed |
| Worth an hour every day | Thirty authored outings and persistent review records exist; discovered city memories offer contextual return visits using the same spaced recall record | No hour-long learner study or month-long retention evidence; content breadth and transfer need further work |
| Beautiful, coherent 3D presentation | Original Blender landmarks and connected rendered districts; Sukhumvit now has a modeled two-car elevated train and guideway | Reused character models, limited animation variety and uneven staging remain visible |

## Battles within the districts

Optional stories now develop the party’s command list. Repairing the canal lantern teaches Su a targeted guard and AP support art; investigating the archive teaches Patrick an exposure and weakening art. Each reuses a phrase practised in its source story, appears in the journal reward, and remains available in main-story encounters. The party menu shows both earned arts and where to learn the others. This gives exploration a tactical consequence while preserving the eight starter abilities and the untimed speaking flow. Two new arts do not establish the variety or long-term learning value of a full JRPG.

`tests/worldArts.test.ts` follows the quest rules, checks locked actions, legacy saves, effect duration, teamwork and invalid targets. `scripts/test-world-arts.mjs` starts with each story’s prerequisites complete, performs the actual final reply, checks the unlock in the party menu, walks to the Murmur, uses the new art through the speaking UI, and reloads its effects. Run desktop and phone, with a fresh main-story regression for the starting abilities. Evidence is under `artifacts/world-arts/`. This verifies the changed reward-to-combat flow; it is not a fresh playthrough of every prerequisite or a pronunciation assessment.

`battleStaging.ts` places the party and opponents on Lumphini, Old Town and crossroads terrain. Combat never changes the saved approach position. The same world geometry, district streaming, lighting and view cutaways serve exploration and story battles; the separate river platform remains a practice setting. This strengthens continuity between finding an encounter and fighting it. It does not add encounters or establish the tactical depth, animation quality or learning outcomes of the reference games.

Verify the formation and lunge/dodge envelopes against real world collision data using `tests/battleStaging.test.ts`. `scripts/test-battle-sites.mjs` checks actual rendered cast coordinates, phone silhouette separation, English preview without spending a turn, recorded replies, reload, defense and retreat for all three encounters and practice. Run desktop, phone and reduced-motion cases, inspect screenshots for occlusion, then run the fresh hotel-to-ferry campaign. The original arena’s loaded and fallback models are checked in practice by `scripts/test-river-arena.mjs`. Evidence belongs under `artifacts/battle-sites/`. Phone viewport tests use synthetic microphone input; physical phones and human speech evaluation remain unverified.

## Thonburi assessment

The Thonburi addition gives the ferry a playable destination and a return route. Its delivery asks the player to request repetition, identify a footbridge, and find coloured shutters beside a tree. It moves closer to the reference criterion that words and observation lead somewhere in the world. Four original Blender timber-house instances now replace the simple blocks, with louvred shutters, doors, carved trim and tiled roofs. Separate facade and roof cutaways preserve the blue-shutter landmark during conversation. Repeated house forms, a reused character rig, sparse waterside detail and limited activity density still keep this quarter below the target. Canal-side timber houses and everyday boat traffic are visual references, not a geographic recreation: [Thonburi canal observations](https://www.travelfish.org/sight_profile/thailand/bangkok_and_surrounds/bangkok/bangkok/1785).

## Thonburi verification contract

The canal-garden activity adds a different kind of exploration task after the letter: spatial directions move a boat through a course in the existing 3D waterway. Delivery order is free, the floating nursery must be navigated around, and stopping at each quay plants persistent flowers. Party rewards and learning records belong to the same save. This advances the language-changes-the-world criterion; the two-lane course is still compact, and its transfer to unaided real-world direction giving has not been measured.

Direction vocabulary was checked against [Thai Language Hut’s directions lesson](https://thailanguagehut.com/learn-thai-phrase-give-direction/). New reference phrases use the existing [OpenAI text-to-speech workflow](https://developers.openai.com/api/docs/guides/text-to-speech). An initial left-turn recording transcribed with a shortened vowel; it was regenerated with a focused pronunciation instruction and then transcribed as the expected Thai. All three new direction recordings matched their intended words in transcription. This does not establish a fluent speaker’s approval of lexical tones or pedagogy.

Verify `tests/canalNavigation.test.ts` and `tests/canalGardenWorld.test.ts` together with city, quest, Thonburi, resource and campaign checks. Run `scripts/test-canal-garden.mjs` for desktop and phone, plus `--phone --fallback --reduced`. The verifier must exercise English preview without mutation, recording, an obstructed direction, stopping away from a quay, a chosen delivery order, reload after the first delivery, visible planted quays, one-time rewards, recall, and the completed Journal entry. Keep the full hotel-to-ferry and Thonburi delivery regressions. Evidence lives under `artifacts/canal-garden/`.

`thonburi.ts` shares floor rectangles, house footprints, contacts, delivery rules and landing positions across navigation, rendering and saves. Require the Keeper victory and proximity before boarding. Persist a crossing destination; arrival moves the party without replay rewards. Cross-river map routes lead to the departure landing, while the city pass cannot jump between banks. Existing east-bank reunion progress retains its objective.

Run the city, atlas, ferry and Thonburi unit checks, build, and `scripts/test-thonburi.mjs` on desktop and phone. Verify a resumed outward crossing, actual arrival, cancellation, wrong-house rejection, both direction steps, a spoken reply, one-time delivery rewards, reload, walking both footbridges and returning by ferry. Recheck the fresh main-story route. Store evidence under `artifacts/thonburi/`. Voice decoding confirms playable files, not native-speaker review or learning efficacy.

## Archive verification contract

Verify a real walk from the hotel, permission and cancellation, both directions around the rooms, all three clues, a wrong deduction, recorded document/thank-you replies, roof cutaways, one-time rewards, reload persistence and phone layout. The generated model must load, not silently use its fallback. Record actual results under `artifacts/archive/`.

## City chart verification contract

`cityAtlas.ts` routes with the same `walkable` and `findPath` functions as the world. The SVG draws the shared district, road, archive, riverside and obstacle geometry. Verify routes from the hotel to every district, rejected water/furniture/wall targets, keyboard selection, chart-to-world travel through Lumphini and the archive, reload persistence and unchanged quest flags. Run `node --test tests/cityAtlas.test.ts tests/city.test.ts tests/archive.test.ts`, build, and `node scripts/test-city-atlas.mjs` (also `--phone`). Evidence goes in `artifacts/city-atlas/`. This proves navigation behavior; it does not establish parity with the reference games or long-term learning outcomes.

## Return-visit verification contract

`fieldReview.ts` exposes only discovered, due memories not yet reviewed today. `RecallLine` is shared with travel missions: English intent precedes Thai, hinted attempts cannot claim unaided recall, and spoken attempts remain separate from the memory self-check. Only confirming a review writes its date. Field reviews never change adventure rewards. Verify discovery, cancellation, recording/playback, reload, due markers, a subsequent due visit, and a hinted result on desktop and phone using `scripts/test-field-review.mjs`. The test uses synthetic microphone input and controlled review dates, not a longitudinal human learning study. Recheck the shared journey flow with `scripts/test-journey-adaptation.mjs --only=familiar-hotel`. Evidence is under `artifacts/field-review/`.

## Sukhumvit railway verification contract

Parse the actual exported geometry to verify its train motion envelope, wheel height, pier footprints and download budget. Browser checks must confirm the requested model loaded, walk from the hotel to the street and Dao, exercise normal and reduced motion, preserve fallbacks after a failed download, and return using the city pass before reloading. On phones, verify the compact quest card retains navigation and its details can be reopened. Run `tests/cityRailway.test.ts` and `scripts/test-skytrain.mjs`; store evidence under `artifacts/blender-skytrain/`. This improves the identity and visibility of Sukhumvit but does not resolve the larger geography, animation or learning-study gaps above.
