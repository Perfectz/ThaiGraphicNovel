# The Last Ferry: the adventure layer

The default route is now a playable story chapter, with the training routine available at `/training` or through **Train at camp**.

The city expansion is in progress. See [the active quality audit](OPEN_WORLD_QUALITY.md) for current scope, verification and remaining gaps. The dated combat verification at the end describes the earlier courtyard build; it does not certify the expanded city.

## What you can play

- Begin in a Sukhumvit hotel and walk Patrick and Su through connected Sukhumvit, Lumphini, Yaowarat, riverside and Old Town districts using WASD, arrow keys, click-to-walk, or phone direction buttons. Map destinations route the party on foot. Dao's city pass unlocks instant returns only to previously visited districts.
- Speak to Su, Mali the innkeeper, Uncle Lek, Niran the ferryman, Dao, Pim and Arun. Conversations teach Thai in the situation where it helps someone.
- Earn a brass key, discover an optional chest, equip a Jade Ward, deliver supper, obtain ferry passes, recover a lantern spark, and restore the river lantern.
- Fight two party encounters in a dedicated 3D river arena. Patrick and Su each have independent HP, action points, and a turn. Choose a word art and target: build energy, break an enemy, weaken a heavy attack, expose a target for a stronger reply, heal or revive an ally. A Lantern Echo heals its companion until defeated. Five word arts build a shared River Duet. Enemy phases offer timed dodge/parry or an untimed steady guard. The Jade Ward reduces damage, provisions consume turns, and victory rewards can only be claimed once.
- Rest at the inn after a setback. Defeat returns the party near the inn with quest items intact. Finish by boarding the last ferry.
- Discover an optional third encounter at the crossroads waystone between the river and Yaowarat. Completing Dao's introduction adds directions to the city map. The Waywarden has compass armor, alternating heavy rounds and a supporting Echo; exposure, break, weakening, counters and the party duet provide different ways through it. A separate challenge button follows the English-first Thai rehearsal, so leaving the conversation does not enter battle. Its one-time reward is 75 XP, 25 coins and a Wayfinder Seal that starts future battles with 20 resonance.

A **Rehearse combat** button on the title and **Battle practice** in town start repeatable sparring, including on completed saves. Sparring uses temporary health and provisions, preserves quest flags, and awards no quest spoils. Practised words still enter the learning record.

## Learning and persistence

Every conversation reply shows its English meaning above or beside the Thai and romanization. Battle ability cards show English meaning, Thai, AP cost, and tactical effect before selection. After choosing a target, the rehearsal shows English, Thai, romanization, reference playback, recording, and explicit confirmation. Selecting a meaning opens a preview without advancing the conversation or battle. The player hears that selected line, records and compares their voice, then explicitly uses the spoken reply. Changing the selection discards the old recording. A text-only alternative stays available and does not count as speaking. The same flow is used by camp conversation choices.

Reference audio, spoken self-checks, and phrase choices are embedded in conversations and battles. Choices are recorded as recognition, not speaking. Using a recorded answer logs a self-reported speaking attempt; it is not an automatic pronunciation assessment. New words also appear in the quest journal and feed the existing training save.

The adventure uses `bangkok-rift-adventure-v1`; the earlier `bangkok-rift-training-v1` save is retained. Quest rewards, inventory, health, position, and battle turns persist. Battles use a nested version-2 checkpoint with party vitals, targets, break, statuses, AP, inventory, and turn phase. Old quiz-battle checkpoints restart their encounter safely while keeping all adventure progress. Leaving a timed attack or reloading returns to an unarmed defense prompt. Individual dialogue lines restart if you leave a conversation; completed quest rewards cannot be collected twice.

Active adventure time contributes to the daily training clock. Hidden tabs and periods longer than 90 seconds without input stop adding time. The controllable player is Patrick; Su follows the recent walking path. Battle scenes place the party in a clear arena, and the restored river lantern gains visible rising light.

## Scope

The opening chapter is being expanded into a connected city. Thirty days of unique RPG story content are not implemented. The 30-day phrase-training route remains available at camp. Further chapters should introduce more relationships, encounter patterns and practical Thai rather than reuse this chapter with different labels.

## Checks

- `npm run test:adventure`: quest gates, reward idempotence, boss prerequisites, defeat recovery, pathfinding, save migration, and checkpoint round-trips.
- `npm run test:expedition`: party order, AP costs, invalid actions, target selection, exposure combinations, break/stagger, guard, equipment, timing windows, Echo healing, provisions, revival, duet, terminal states, checkpoint validation, telegraphs, and no-timing encounter balance.
- `npm run test:expedition:browser`: actual keyboard parry/dodge, recorded Thai casting, English previews, target selection, a complete Keeper fight, phone controls, denied microphone, an early dodge miss, provisions, a complete Murmur fight, checkpoint reload, and defeat recovery.
- `npm run test:adventure:browser`: a fresh-save playthrough of the entire chapter using real UI controls and map travel; keyboard movement; locked/open chest; three NPC quests; both fights; wrong answers; synthetic microphone record/playback; saving and reloading a boss turn; chapter ending; return to training; and phone direction controls.
- `npm run build` and ESLint for `src/bangkok`.
- `node scripts/test-adventure-polish.mjs`: the final boss camera, retreat/rest, movement after combat, active-time tracking, and phone dialogue controls.

Browser screenshots are stored in `artifacts/adventure-verification`. Human Thai-content review and hardware-GPU performance remain separate verification needs; the automated browser uses software graphics.

Speaking-flow verification: `npm run test:speaking-choice` checks NPC English choices, recording/playback, dialogue progression, and phone camp denied-microphone recovery. Battle-specific voice checks are in `test:expedition:browser`. Screenshots of the new battle are stored in `artifacts/expedition-verification`.

## Combat direction

The reference is Expedition 33’s reactive turn-based combat: deliberate party turns punctuated by active defense. This implementation uses original Bangkok river-guardian art and the existing travelling party. It is a first combat slice, not visual parity with a commercial AAA game. No free-aim system or offensive timing minigame is implemented.

Thai practice is never timed and pronunciation is not fabricated from a recording. Players select a useful meaning, hear it, speak it, and confirm; the chosen ability determines the effect. The fictional effect reinforces the phrase’s purpose (greeting opens, a request to slow down breaks pressure, asking to repeat exposes, apologizing repairs). The no-mic path has identical battle effects and logs recognition rather than speaking.

Enemy attacks begin only when the player chooses Face the attack. Dodge has a wide window, parry a narrower one with a 22-damage counter and AP gain. Focus loss pauses an armed attack. Steady guard needs no reaction input and halves damage; the character’s Guard command stacks with it. Reduced-motion settings remove camera/action motion while preserving the timing indicator.

Final layout and sparring check: `node scripts/capture-expedition.mjs` exercises desktop and phone entry, English/Thai rehearsal, readable Thai font sizing, status-panel clearance, checkpoint reload, retreat, repeated entry, and preserved supplies and story flags.

## Earlier courtyard/combat verification — 2026-09-04

- Production build and `eslint src/bangkok` passed. Vite retains its existing large-vendor-chunk warning.
- 32 adventure/combat/training unit tests and 10 Whisper service tests passed. Encounter balance also passed without the optional Jade Ward.
- `node scripts/test-expedition.mjs` passed: desktop Keeper victory, keyboard parry/dodge, selected-line reference audio, synthetic microphone recording/playback, saved defense-phase reload, phone Murmur victory, denied-mic fallback, targeted healing, early defense failure, and defeat recovery; no page errors.
- `node scripts/capture-expedition.mjs` passed on desktop and phone after the framing/Thai-text fixes: completed-save sparring, readable Thai, preserved supplies and health, repeat entry, and checkpoint reload.
- `node scripts/test-adventure.mjs` passed the full fresh-save chapter: keyboard and map movement, locked/unlocked chest, three NPC quests, both encounters, rewards, boss checkpoint reload, ferry ending, return to training, phone direction controls, and conversation recording; no page errors.
- Both `/api/realtime/health` and `/api/whisper/health` returned HTTP 200 with `ok: true` through port 5188.
- Recording automation used synthetic microphone audio. These checks do not certify pronunciation accuracy, Thai-content quality, or performance on a hardware GPU.
