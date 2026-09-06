# A Promise Kept

Chapter II unlocks after the Last Ferry crossing and return. An unfinished chapter becomes the default journal objective when the previous tracked story is complete. Niran asks the player to arrange a meeting with Mali and Arun, connecting the river pier, Sukhumvit hotel, Old Town workshop and one of two final venues.

- “I am free this evening” chooses a meal with Lek in Yaowarat. “Is tomorrow okay?” chooses Pim’s Lumphini pavilion. The plan is saved and cannot be silently replaced.
- Mali and Arun can be visited in either order. The player uses “Let’s go together” and “Where shall we meet?” in the invitations, then asks for water and says goodbye at the reunion. The interface shows the canonical English meaning before Thai practice; a recording is encouraged, and a text reply remains available.
- Selecting a meaning and rehearsing do not advance the chapter. The explicit confirmation validates the current host, step, reply, distance, battle and active travel mission. Practice credit remains separate from story progress.
- The chosen venue contains independently posed 3D guests during the reunion conversation. Their geometry and materials are shared with existing residents; their skeletons are independent and cleaned up by world teardown. The gathering camera keeps the guests above the dialogue panel.
- Completion awards 120 XP, two rice parcels and two teas once. The journal records a different social outcome: Mali asks Arun about a hotel lantern after the meal, or Niran promises Mali a ferry ride after the park meeting. These are narrative memories, not new playable errands.
- “Tomorrow” advances narrative time upon arrival; it does not require a real-world wait or implement a city-wide day/night simulation. Guests appear during the reunion scene rather than simulating independent journeys across the map.

The new authored and guide lines are prerecorded with the existing OpenAI cast. The active index now contains 204 clips: 82 Thai references and 122 story/guide lines, totaling 1,517.856 seconds. Twenty newly generated files passed decoding, finite-sample, duration and audio-level checks; one earlier line is no longer in the active index. All ten branch/step combinations resolve to hash-verified recordings. Existing Thai references were reused.

## Verification

`tests/reunion.test.ts` checks both plans and both invitation orders with continuous path traversal, normalization/reload recovery, prerequisite and mission/battle guards, wrong/stale replies and one-time rewards. Together with quest-journal, evening-outing and ferry regressions, 16 tests pass. The production build, focused ESLint and ten Whisper tests pass; both Vite-proxied voice health endpoints return HTTP 200.

Audio evidence: `artifacts/reunion/audio-verification.json` and `voice-coverage.json`. The final browser report at `artifacts/reunion/browser/progress.json` has `finished: true`, two completed routes and no console/page errors. The verifier walks from the hotel, performs both invitation orders across desktop and phone emulation, checks English previews, uses a synthetic microphone on desktop, reloads between visits and before completion, inspects guest framing and verifies the saved reward and journal memory. Desktop and phone farewell screenshots were visually inspected.

Early checks found and recorded three issues: a save assertion ran before conversation staging settled, the farewell panel obscured Niran before the camera adjustment, and a strict test distance excluded Pim’s legitimate approach point two metres away. The saved initial reports distinguish those test corrections from the actual camera fix. All verification processes completed before subsequent source edits.

Final visual review also caught the party overlapping from the gathering camera and a building obscuring one guest. The gathering now uses the conversation angle, scores guest positions against that angle, and includes guests in scenery cutaways before rendering. The subsequent `artifacts/reunion/gathering-check/progress.json` completes both venues with all six character centres in frame and separated; final screenshots were inspected. This focused run verifies the last rendering changes after the full travel checks. `artifacts/ferry-passage/browser/phone/progress.json` separately passes the existing crossing, replay, return and camp/reload flow: the new chapter only takes over ordinary interaction when explicitly tracked, and its dedicated nearby button is always available when eligible.

This adds a branching social chapter, not a claim of a full month of authored story. Native Thai review, real microphone acoustics, physical-phone coverage, long-session engagement and RPG encounter variety remain outside this pass's evidence.
