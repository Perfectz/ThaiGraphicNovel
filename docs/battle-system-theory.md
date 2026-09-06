# Battle System Theory

This document is a working theory for turning Isekai Thai Quest interactions
into a 90s RPG battle system that teaches spoken Thai. It is intentionally a
discussion document, not a locked spec. Use it to decide what the next prototype
should prove before changing the main Stage3DAdventure flow.

## Design Thesis

The game should treat Thai speech as the player's battle command language.
Instead of separating "lesson mode" from "RPG mode," every important interaction
can become a turn-based encounter where pronunciation, phrase choice, and social
context drive battle outcomes.

The player fantasy:

> Patrick is not winning because he has a sword. Patrick is winning because he
> can greet, ask, apologize, clarify, bargain, and close conversations in Thai
> under pressure.

The battle system should feel like a 90s console RPG: clear command windows,
party stats, enemy pressure, dramatic effects, damage numbers, healing, guarding,
turn order, victory fanfare, and post-battle rewards. The learning system should
remain honest: real Thai phrases are the moves, spoken attempts are the input,
and the battle math reflects pronunciation quality without humiliating the
player.

## Current Ingredients

The codebase already has two useful battle foundations.

### Existing Lesson Battle

Files:

- `src/systems/battleSystem.ts`
- `src/components/BattleHUD.tsx`
- `src/domain/scenarioRules.ts`
- `src/store/gameStore.ts`

What it already models:

- Courage as the player pressure meter.
- Understanding as enemy confidence damage.
- Per-phrase pronunciation attempts.
- Hear, review, skip, and speak actions.
- Stage practice report after completion.
- Phrase effects such as healing.

What it lacks for the desired direction:

- It feels more like a tutor HUD than a dramatic RPG battle.
- The enemy does not meaningfully act turn by turn.
- Command choice is shallow once the current phrase is known.
- It is mostly linear phrase drilling rather than interaction drama.

### Phantasy-Style Battle Demo

Files:

- `src/components/PhantasyBattleDemo.tsx`
- `src/data/phantasyBattleDemo.ts`
- `src/components/BattleStage3D.tsx`
- `src/components/three/battleStageScene.ts`
- `src/styles/battle-demo.css`

What it already models:

- 90s RPG command selection.
- HP, MP, guard, enemy HP, and turn count.
- Standard moves, stronger long replies, Su coaching, Su cover, and counters.
- Pronunciation score converted into damage, healing, guard, and prevention.
- Enemy challenge turns that force a required Thai response.
- 3D battle staging with VFX and damage numbers.

What it lacks for the desired direction:

- It is standalone rather than stage-integrated.
- The data is demo-specific instead of generated from lesson and adventure data.
- No-mic is not first-class in the same way Stage3DAdventure needs it.
- It does not yet connect victory to stage inventory, room state, or progression.

## Target Battle Loop

A full encounter should run like this:

1. **Encounter starts.** A social or magical pressure moment appears: Su trial,
   front desk clerk, street vendor, taxi driver, rift echo, guardian, or hazard.
2. **Enemy presents context.** The opponent or situation asks for something in
   natural language: "Tell me your name," "Ask for the room key," "Say not
   spicy before the wok flares."
3. **Player confirms the contextual action.** Exploration starts from the
   clicked target: the correct action appears above the NPC, item, or object.
   Inside battle, command windows offer Thai tactics for the current turn.
4. **Player speaks or confirms.** Voice mode judges pronunciation; no-mic mode
   lets the player confirm as a lower-confidence accessibility path.
5. **Battle resolves visibly.** Score produces damage, guard, heal, charge,
   debuff, item gain, or scene-state change.
6. **Enemy pressures back.** The encounter asks a forced response, interrupts,
   tests an older phrase, or punishes weak preparation.
7. **Su supports.** Su can coach, demonstrate, cover, translate, or reduce
   pressure, but using support costs tempo, MP, charge, or score potential.
8. **Victory teaches.** The encounter ends with a concise recap: phrase learned,
   best score, practical meaning, and what Patrick can now do.

The important shift: a phrase is no longer just a prompt. It is a move with
social purpose and battle behavior.

## Core Battle Terms

Use player-facing names that support the fiction.

| System Term | Player Meaning | Notes |
|---|---|---|
| Courage | Patrick's HP | Lost when pressure overwhelms him; restored by successful needs/repair phrases |
| Focus | MP | Spent on long replies, Su support, and special tactics |
| Understanding | Damage dealt | Enemy confidence, confusion, or resistance drops when Thai lands |
| Clarity | Super charge | Built by clean pronunciation and phrase streaks |
| Pressure | Enemy attack | Questions, impatience, rift pulses, social stakes |
| Guard | Temporary defense | Raised by Su Cover, polite repair, or asking for slower speech |
| Fluency State | Buff/debuff | Examples: Calm, Rushed, Embarrassed, Encouraged, Misheard |

Open question: whether to keep the familiar RPG labels `HP` and `MP` on the
screen, or use `Courage` and `Focus` everywhere. My bias is to use `Courage` and
`Focus` as the main labels, with HP/MP only as internal code concepts.

## Command Families

The Phantasy battle demo's four-command menu is a strong base. For the full
game, command families should be stable across stages while the actual Thai
phrases change.

| Command | Role | Example Result |
|---|---|---|
| Respond | Safe phrase answer | Low cost, reliable progress, modest damage |
| Strong Reply | Longer or more complete answer | Higher reward, costs Focus, harder pronunciation |
| Repair | Apology, clarification, slower repeat | Heals Courage, removes bad states, or lowers pressure |
| Su Coach | Hear and rehearse with Su | Restores Courage or Focus but deals little damage |
| Su Cover | Su politely buys time | Raises Guard or prevents the next penalty |
| Item / Use | Apply a stage object | Passport, keycard, water, map, charm, medicine |
| Super | Spend Clarity | Big narrative effect, stage-specific payoff |

The command menu should not show all families every turn. A Stage 1 tutorial can
show `Respond`, `Hear`, `Review`, and `Su Coach`. A later formal meeting can show
`Simple Reply`, `Formal Reply`, `Repair`, and `Su Cover`.

## How Pronunciation Becomes Battle Math

The judge result should stay the shared contract:

```ts
type PronunciationVerdict = {
  score: number;
  pass: boolean;
  heard: string;
  feedback: string;
  tip: string;
};
```

Battle math should use score bands:

| Score | Result | Battle Meaning |
|---|---|---|
| 85-100 | Excellent | Full effect, bonus Clarity, stylish VFX |
| 70-84 | Strong | Full effect, normal charge |
| 60-69 | Pass | Progresses, lower damage, little or no bonus |
| 45-59 | Almost | No progress unless supported; small Courage loss |
| 0-44 | Miss | Enemy pressure lands; Su gives targeted coaching |

No-mic confirms should complete critical paths but should not count as strong
mastery. They can produce a "Readied" result: reduced damage, no bonus Clarity,
and learner-model records tagged as low-confidence.

## Converting Contextual Hotspot Actions To Battles

The current internal adventure actions can remain as data types, but the
player-facing exploration UI should not ask the player to pick from `Look`,
`Talk`, `Take`, and `Use` after every click. The stage author should define the
right visible action label for each hotspot state, then anchor that label above
the clicked thing.

| Clicked Target | Visible Action | Battle Conversion |
|---|---|
| Su | Start lesson | Tutorial drill or coaching encounter |
| NPC | Ask / Check in / Order / Bargain | Social battle with the NPC's goal as enemy pressure |
| Object | Inspect / Read / Listen | Reveals weakness, hint, or phrase advantage |
| Item | Take / Drink / Hand over | Item reward, heal, or small encounter |
| Gate object | Show / Use / Pay | Battle command, gate opener, or super-condition trigger |
| Locked target | Ask Su / Learn first | Enemy line or Su coaching before battle starts |

Internal action mapping still matters for code ownership:

- `look` drives inspection and hint text.
- `talk` starts social exchanges and battle encounters.
- `take` adds inventory or consumes pickup state.
- `use` applies inventory, phrase gates, and stage-specific tools.

The difference is presentation: the player sees `Inspect reservation`, not
`Look`; `Show passport`, not `Use`; `Order noodles`, not `Talk`.

Example: Stage 2 front desk.

- Explore lobby/front-desk room.
- Click reservation paper, then choose `Inspect reservation`: reveals the clerk
  wants a booking name.
- Click clerk, then choose `Check in`: starts Check-in Encounter.
- Respond: "I have a reservation."
- Strong Reply: "The name is Patrick. I would like to check in."
- Repair: "Please speak slowly."
- Click passport or clerk, then choose `Show passport`: lowers clerk pressure
  for two turns.
- Victory: keycard acquired, stage-clear recap shows check-in phrases.

Example: Stage 3 street food.

- Click spice jar, then choose `Inspect spice`: reveals a spicy hazard.
- Click vendor, then choose `Order noodles`: starts Food Order Encounter.
- Respond: "I want this."
- Strong Reply: "Not spicy, please."
- Repair: "I cannot eat spicy food."
- Click water, then choose `Drink water`: heal if Courage drops.
- Enemy pressure: wok flare forces "mai phet" counter response.
- Victory: food acquired, vendor respects the order.

## Encounter Types

Not every battle should be a literal fight. The system works best if "enemy" is
the pressure source.

| Encounter Type | Opponent | What Victory Means |
|---|---|---|
| Tutorial Trial | Su | Player understands the phrase family |
| Service Counter | Clerk, vendor, pharmacist | Transaction succeeds politely |
| Social Pressure | Friend, official, guide | Relationship or trust improves |
| Hazard | Rift pulse, alley storm, spice flare | Player stabilizes the situation |
| Review Echo | Memory of a previous phrase | Spaced repetition without breaking fiction |
| Boss | Rift Guardian or major gatekeeper | Combined language mastery moves the story |

This lets the battle UI stay dramatic without making every Thai speaker feel
like an enemy. The opponent is often pressure, confusion, urgency, or the rift.

## Stage Structure With Battles

A battle-forward stage can still keep exploration.

1. **Room intro:** walkable 3D location with a clear objective.
2. **Setup hotspot:** clicking a target reveals a contextual action above it.
3. **Mini drill:** Su teaches or previews the required phrases.
4. **Main encounter:** 3-6 RPG turns using the stage phrases.
5. **Pressure spike:** forced response, older phrase callback, or item use.
6. **Victory:** item, trust, route, or story beat.
7. **Recap:** phrase list, scores, focus phrases, and next practical need.

The tech demo can start with smaller battles:

- Stage 1: Su Basics Trial, 10 short tutorial turns.
- Stage 2: Front Desk Check-in, 5-6 service-counter turns.
- Stage 3: Night Market Order, 5-6 vendor and spice-pressure turns.

## Stage 1 Conversion Sketch

The current Stage 1 already has the fiction for this in
`docs/first-level-comic.md`: Su turns the lobby into a safe tutorial battle
where phrases build Understanding, Courage keeps Patrick standing, and asking
for water heals.

Recommended Stage 1 battle flow:

1. Rift arrival cinematic.
2. Patrick stands up in the lobby.
3. Su starts "Thai Basics Trial."
4. Turns 1-3: First Contact.
5. Turns 4-7: Polite Repair.
6. Turns 8-10: First Needs.
7. Thirst phrase becomes the first obvious heal.
8. Three clean passes charge `Wai of Clarity`.
9. Final super stabilizes the lobby rift.
10. Hostess application moment unlocks after the trial, either as a short
    follow-up encounter or as the first non-Su battle.

Open question: should the hostess application remain exploration-first after
the Su battle, or should the Su battle end and immediately transition into a
second small front-desk battle? My bias is to keep it as a second small battle,
because it proves "practice leads to application" in the same RPG language.

## Data Model Direction

Do not hard-code battle turns inside React components. The battle system needs a
data shape that can be derived from lesson and adventure data.

Candidate shape:

```ts
type BattleEncounterConfig = {
  id: string;
  title: string;
  opponentName: string;
  opponentRole: string;
  stageId: string;
  introLine: string;
  victoryLine: string;
  defeatLine: string;
  turns: BattleTurnConfig[];
  rewards: BattleReward[];
};

type BattleTurnConfig = {
  id: string;
  topic: string;
  pressureLine: string;
  simple: BattleTechniqueConfig;
  strong?: BattleTechniqueConfig;
  repair?: BattleTechniqueConfig;
  coach?: BattleTechniqueConfig;
  cover?: BattleTechniqueConfig;
  counter?: BattleTechniqueConfig;
  requiredForVictory?: boolean;
};

type BattleTechniqueConfig = {
  id: string;
  kind: 'standard' | 'strong' | 'repair' | 'coach' | 'cover' | 'item' | 'super' | 'counter';
  phraseId?: string;
  targetPhrase: string;
  romanization: string;
  phoneticSpelling?: string;
  translation: string;
  effect: BattleEffect;
  focusCost?: number;
  clarityCost?: number;
};
```

Key rule: `phraseId` should point back to `lessonScenarios` whenever possible so
audio coverage, learner memory, stage recaps, and pronunciation prompts stay
consistent.

## Integration Architecture

The likely architecture is:

- Keep `Stage3DAdventure` as the exploration room and encounter launcher.
- Add a reusable battle encounter screen or overlay that can be entered from a
  hotspot command.
- Reuse `BattleStage3D` for battle presentation where possible.
- Move the Phantasy demo reducer into a pure battle domain module before using
  it in production.
- Keep pronunciation sessions shared with the current voice services.
- Persist attempts through the same learner model planned in
  `MVP_SRS_PEDAGOGY.md`.

Possible ownership:

| Concern | Future Home |
|---|---|
| Battle encounter schema | `src/data/battles/types.ts` |
| Stage battle configs | `src/data/battles/stage01-*.ts` |
| Pure battle reducer | `src/domain/battle/` |
| Battle UI shell | `src/components/battle/` |
| Battle 3D scene | `src/components/three/battleStageScene.ts` |
| Pronunciation integration | existing `src/services/*Pronunciation.ts` |
| Stage launch/return | `Stage3DAdventure.tsx` or a dispatcher helper |

## Migration Plan

### Prototype 1: Extract The Demo Brain

Goal: make the Phantasy battle demo reusable without changing the live game.

- Move demo reducer types and math into a pure module.
- Keep the existing demo screen working.
- Add unit tests for score-to-damage, guard, healing, and enemy challenge.

### Prototype 2: Stage 1 Su Trial As Battle Data

Goal: run Stage 1's ten basics through the battle shell.

- Generate battle turns from Stage 1 phrase data.
- Use Su as the safe tutorial opponent.
- Keep no-mic completion working.
- End with the same stage-clear recap.

### Prototype 3: Hostess Application Encounter

Goal: prove exploration-to-battle conversion.

- Clicking the desk or hostess reveals a contextual `Check in` action that
  starts a short encounter.
- Required Su drill gates the encounter.
- Victory grants the keycard or room-ready payoff.

### Prototype 4: Stage 2 And 3 Conversion

Goal: prove the system works for service interactions.

- Stage 2: check-in battle with clerk pressure and passport/keycard item use.
- Stage 3: food-order battle with spice hazard and water/heal interaction.

### Prototype 5: Review Echo Battles

Goal: connect RPG battles to durable learning.

- Pull weak or due phrases from learner memory.
- Frame the review as a rift echo encounter.
- Reward clean recall with Clarity, Focus, or overworld progress.

## Design Risks

| Risk | Mitigation |
|---|---|
| Battles make conversations feel hostile | Treat "enemy" as pressure; write NPCs as people, not monsters |
| RPG math obscures the language | Keep phrase text larger than damage numbers; always show meaning |
| Long battles slow learning | Keep service encounters to 3-6 turns; reserve 10 turns for tutorials or bosses |
| Pronunciation failure feels punishing | Misses should coach first, punish second; no hard fail for early stages |
| No-mic undermines mastery | Let no-mic progress story but record low-confidence practice |
| Too much data duplication | Reference `phraseId` and derive prompt/audio/recap from lesson data |
| Stage3DAdventure grows again | Put battle reducer, configs, and UI in battle-owned modules |

## Questions To Talk Through

1. Should Stage 1 become a full battle immediately, or should the battle system
   first appear only at the final application moment?
2. Should the main labels be RPG-standard `HP/MP`, or in-fiction
   `Courage/Focus`?
3. Should Su be a party member with commands, or a contextual support system?
4. Should every phrase have a simple and strong version, or only selected key
   phrases?
5. Should missed pronunciation consume a turn, or allow retry before enemy
   pressure advances?
6. How often should older phrases reappear inside new battles?
7. Should victory require reducing enemy pressure to zero, completing required
   turns, or both?
8. Should battle scenes replace the 3D adventure room during encounters, or
   appear as an overlay transformation of the current room?

## Working Recommendation

Start with a conservative hybrid:

- Keep 3D exploration as the stage wrapper.
- Convert major `talk` interactions into short battle encounters.
- Use the Phantasy battle demo as the visual and mechanical north star.
- Keep Courage, Focus, Understanding, and Clarity as the primary teaching stats.
- Treat Su as a support party member, not an opponent except in tutorial trials.
- Use battle turns to apply Thai phrases under pressure, not to add unrelated
  combat mechanics.

The next useful prototype is Stage 1's Su Basics Trial built as real battle data
behind the existing Phantasy-style UI. If that feels good, convert the hostess
application exchange next.
