# Isekai Thai Quest Game Design Direction

This document is the design source of truth for building the browser game beyond
the current tech demo. It explains what the game is trying to become, which
player behaviors matter, and how new stages should be designed so future work
does not drift into unrelated experiments.

## High Concept

Patrick falls through the Bangkok rift and survives by learning usable Thai with
Su, an AI tutor princess who turns language practice into an adventure. The game
is a 3D browser language RPG where every stage asks the player to learn a small
set of phrases, apply them in a real social situation, and leave with a new tool
for navigating Bangkok.

The fantasy is not "study Thai from a menu." The fantasy is "I am stuck in a
magical Bangkok and my words are the only way forward."

For the battle-forward version of this fantasy, see
`docs/battle-system-theory.md`.

## Design Pillars

1. **Useful Thai first.** Every phrase should be something a real traveler could
   use: greeting, repair, asking for help, ordering food, bargaining, directions,
   health, plans, formality, and conflict resolution.
2. **Adventure context gives the phrase a reason.** The player should always
   know why they are saying a phrase now, who needs to hear it, and what changes
   in the scene after it lands.
3. **Practice leads to application.** Teaching with Su is only the first half of
   a stage. The player should then use at least some phrases with a non-teacher
   NPC or object interaction.
4. **No-mic remains first-class.** Voice practice is the ideal mode, but the game
   must remain finishable by tapping through prompts when the player has no mic,
   no privacy, or a browser permission problem.
5. **Small stages, strong payoffs.** A stage should feel like one meaningful
   travel task, not a full lesson chapter. The reward should be visible in the
   room, the story, the stage-clear card, or the overworld.
6. **3D supports clarity.** The 3D scene should make the social situation
   readable. It should not bury the player under decorative props, complex
   camera work, or constant UI panels.

## Target Player

The first target player is an English-speaking beginner who is curious about
Thai but may be nervous about pronunciation. They need:

- Romanization, phonetic spelling, Thai script, and English meaning together.
- Permission to retry without embarrassment.
- A visible path through each interaction.
- Clear feedback when they succeed, miss, or can bypass the mic.
- Short sessions that can be completed in a browser.

## Core Loop

Each stage should follow this loop:

1. **Arrive.** A short intro establishes the Bangkok problem and the social
   stakes.
2. **Observe.** The player explores a small 3D room, sees the relevant NPCs and
   props, and understands the immediate goal.
3. **Learn.** Su teaches a focused phrase set through a conversation drill.
4. **Apply.** The player uses selected phrases with another NPC, object, or
   pressure moment.
5. **Resolve.** The scene changes state, grants an item or narrative progress,
   and recaps what the player can now say.
6. **Bridge.** The end state points toward the next stage's practical need.

## Contextual Hotspot Actions

The player should not choose from a persistent generic verb list after clicking a
hotspot. Clicking an NPC, item, or object should surface the correct contextual
action above that target in the scene. The interaction becomes:

1. Player clicks or taps the highlighted thing.
2. The target becomes selected.
3. One or more valid action chips appear above the target, anchored in
   screen-space or world-space.
4. The player picks the action.
5. The action starts a phrase prompt, battle encounter, item pickup, or scene
   response.

The system can still keep internal action types for data and logic, but the
player-facing UI should show authored intent labels instead of a stock verb
menu.

| Internal Action | Player-Facing Example | Design Role |
|---|---|---|
| Look | Inspect passport | Build context before a prompt |
| Talk | Ask the clerk | Start a drill, social exchange, or battle |
| Take | Pick up keycard | Move an item into inventory |
| Use | Show reservation | Apply an item, phrase, or gate solution |

Examples:

- Clicking Su shows `Start lesson` above Su.
- Clicking the hostess shows `Check in` above the hostess.
- Clicking the reservation paper shows `Inspect reservation` above the paper.
- Clicking bottled water shows `Take water` or `Drink water`, depending on
  stage state.
- Clicking the spice jar shows `Ask for not spicy` once the phrase is unlocked.

Design rule: each visible action should answer "what will Patrick do here?" in
plain language. If there is only one correct action, show only one action. If
there are multiple valid actions, show a short vertical or radial stack above
the target, ordered by critical-path relevance.

## Stage Shape

A strong stage has:

- One location fantasy.
- One practical language goal.
- One primary NPC and one pressure or application moment.
- Three phrase chunks, each with a clear micro-objective.
- One or two inventory or scene-state gates.
- A stage-clear recap that reinforces the phrases learned.

Avoid stages that are only passive drills. Avoid stages that require unrelated
mechanics before the player understands why they are speaking.

## Current 10-Stage Arc

| Stage | Location | Practical Goal | Development Intent |
|---|---|---|---|
| 1 | Hotel lobby | Polite basics and first needs | Teach the core loop and make Su trustworthy |
| 2 | Front desk | Check in and ask for room details | Add faster NPC speech and service-counter pressure |
| 3 | Street food stall | Order food, control spice, pay | Make language feel useful in a lively public scene |
| 4 | Taxi stand | Destination, fare, route time | Introduce movement across Bangkok and time pressure |
| 5 | Floating market | Browse, bargain, decide | Teach polite negotiation without making it adversarial |
| 6 | Clinic and pharmacy | Symptoms, medicine, timing | Raise stakes while keeping phrases practical |
| 7 | Cafe | Likes, time, invitations | Shift from survival Thai to social connection |
| 8 | Alley emergency | Directions, problems, urgent help | Stress-test help-seeking phrases under rift pressure |
| 9 | Formal meeting | Requests, purpose, respectful close | Teach register and respect before the finale |
| 10 | Rift gate | Negotiate, protect Su, close the rift | Combine the language arc into a story climax |

Stages 1-3 are the shareable tech-demo path. Stages 4-10 can remain authored as
data while their production quality catches up.

## Learning Design Rules

- Keep each phrase tied to a visible situation.
- Keep each turn short enough to fit in the HUD without crowding the scene.
- Give the player a natural-language reason before asking for Thai output.
- Use success text to show scene progress, not just generic praise.
- Make mistakes recoverable through retry, slower coaching, or no-mic confirm.
- Reuse earlier phrases in later stages so retention is part of the adventure.
- Distinguish drill turns from application turns so stage recaps show the right
  learning set.

## 3D Scene Direction

The visual target is "readable interactive diorama." Each room should have a
clear focal point, readable walk paths, and a small number of props that support
the task.

Use these scene priorities:

1. NPC silhouette and hotspot ring are readable from the starting camera.
2. The objective object is visible before the player interacts.
3. The walk path has enough floor clearance for collision and camera framing.
4. Lighting reinforces location mood without hiding prompts or characters.
5. Props explain the place: lobby desk, food stall, taxi sign, clinic counter.

Prop density should increase only when it improves orientation, story, or
interaction. Decorative clutter that blocks the player, increases load cost, or
confuses the hotspot priority is a design regression.

## UI and Accessibility Direction

The DOM HUD is the primary UI layer. WebGL owns the playfield. Keep the
persistent HUD light, text clear, and panels collapsible where possible.

Required UI capabilities:

- Current objective.
- Selected hotspot and contextual action chip above the target.
- Thai prompt, romanization, phonetic spelling, and translation.
- Mic or no-mic action state.
- Verdict feedback and retry path.
- Inventory only when relevant.
- Stage-clear recap.

Accessibility rules:

- No-mic mode must always complete the critical path.
- Captions should be available for Su and NPC voiceover.
- The player should not need fast reactions to pass language prompts.
- Mobile should remain playable even if desktop is the visual target.
- XR and VR features must prioritize comfort over spectacle.

## Narrative Tone

The tone is playful isekai adventure grounded in real travel usefulness. Su can
be magical and expressive, but phrase coaching should stay clear and respectful.
NPCs should feel like people in specific Bangkok situations, not vocabulary
dispensers.

Write Patrick as capable but displaced. Write Su as encouraging, direct, and
occasionally mischievous. Let humor come from the rift situation and social
misunderstanding, not from mocking the Thai language or Thai speakers.

## Stage Acceptance Checklist

Before calling a stage design-ready:

- The stage has one practical travel goal.
- Every phrase is used in context.
- The player knows the next action after each success.
- The stage can be completed with voice and no-mic input.
- Required items and conversations have clear blocked text.
- The stage-clear card recaps the intended learning set.
- The scene has a readable focal point and safe walk path.
- The stage has a focused smoke test or manual verification notes.
