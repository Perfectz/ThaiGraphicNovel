# Adventure and learning benchmark

Reviewed against the current worktree and primary product descriptions on 6 September 2026. These are selected design benchmarks, not a claim that the games have equivalent teaching outcomes or that this project has reached their quality.

## What the references demand

- [Clair Obscur: Expedition 33](https://www.expedition33.com/overview) combines party builds and character synergies with reactive dodge, parry and counter actions. For this project, combat should offer understandable tactical decisions and satisfying consequences while leaving Thai reading and speaking untimed.
- [Heaven's Vault](https://www.inklestudios.com/heavensvault/) connects language decipherment with free exploration and a story that remembers choices. The applicable standard is that understanding changes what the player can do and discover; language should serve the adventure.
- [Influent](https://playinfluent.com/) connects vocabulary learning to freely exploring a 3D environment. The applicable standard is learning tied to concrete things and situations, with agency over pace. This is a design reference, not evidence of Thai conversational proficiency.

## Current assessment

| Requirement | Current evidence | Judgment and remaining work |
| --- | --- | --- |
| Start in a Sukhumvit hotel | `hotelStart` in `city.ts`; fresh-start hotel browser routes; Blender room assets | Implemented and exercised. |
| Travel among distinct Bangkok sections | Six areas in `city.ts`; navigation tests; three-host mission walked through hotel, Sukhumvit and Yaowarat this pass | Connected exploration works. The map is a compressed fictional arrangement, not an accurate street map. District-specific discoveries and meaningful decisions need more depth. |
| A motivated adventure | Last Ferry story, branching A Promise Kept follow-up, optional canal/escort/evening/lantern stories, quest tracking, visible river departure | The ferry chapter now leads to a social chapter with a chosen venue, two invitation orders and a visible reunion. Both follow-up routes are walked in desktop/phone browser checks. Thirty mission variations are still not thirty distinct story chapters; long-term surprise remains weaker than the references. |
| Tactical JRPG combat | Party turns, target selection, AP, exposure, defense timing, provisions and free enemy forecasts in `expeditionCombat.ts` | Murmur AP theft and Echo healing interruption add distinct counterplay; Keeper and Waywarden attacks can be inspected before committing. Twenty-five focused tests and desktop/phone combat checks support these mechanics. They do not prove a rich encounter roster, dramatic pacing or parity with Expedition 33. |
| Understand English before speaking Thai | English-first previews, explicit recording, replay and text fallback | Verified in desktop and phone-emulated flows. |
| Use language to decide what happens | This pass adds situation-based English intention choices before second-round recall at every travel stop | A concrete improvement over being handed the answer. The choice now tests understanding of the situation before language production. The reunion chapter also turns a Thai schedule choice into a different destination and relationship memory. More NPC reactions and consequences remain desirable. |
| Recoverable learning mistakes | Wrong intention keeps the same turn, costs no resources and persists a review marker; self-reported recall cannot override it | Verified through reload and model tests. Helped meanings stay due; recordings remain separate from recall success. |
| Useful daily return | Thirty outings, due phrases, adaptive recall, saved passport and active practice tracking | Infrastructure exists. A sustained hour-long session, month-long retention and real travel transfer are unproven. |
| Beautiful, readable 3D presentation | Original Blender assets, lighting recovery and inspected desktop/phone scenes | Improved, but overall art consistency, physical-phone performance and the earlier SwiftShader issue remain open. |
| Thai speaking quality | Existing Thai phrases, reference audio, local recording and optional services | Service health and automated flow tests do not substitute for native-speaker content review or human pronunciation assessment. |

## This pass's verification

`tests/journeyIntent.test.ts` exercises all 30 outings' intention options, stable choice order, support persistence, stale/paused action rejection, exact-turn scope, malformed metadata, speech/recall separation and review scheduling. Together with journey adaptation, city journeys and training, 26 tests pass. Build and focused ESLint pass; ten Whisper tests pass and both proxied voice health endpoints respond HTTP 200.

`scripts/test-journey-intent.mjs` passes desktop and 390 × 844 phone-emulation cases: no Thai answer before choosing an intention, wrong-choice recovery, unchanged resources/mission cursor, reload persistence, supported recall remaining due, later unaided recall, and advancing to the next stop. The initial verifier sampled before conversation staging moved Patrick into place; its failure is retained as `artifacts/journey-intentions/initial-staging-check.json`. The corrected verifier waits for the actors and saved position to settle.

`scripts/test-city-journeys.mjs` passes the full eighteen-attempt outing through Mali, Dao and Lek: nine guided practices, nine intention/recall encounters, recorded replies, hints, reload, one completion reward, replay without duplicate reward and phone microphone denial. Final reports under `artifacts/journey-intentions/` contain `finished: true` and no unexpected browser errors. Recordings use Chrome's fake media input, not a human speaking Thai.

This evidence supports the implemented improvement. It does not establish the full requested quality bar, so the overall goal remains active.
