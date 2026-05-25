# Level 3 Intro Seedance Prompt

Reference image: `docs/storyboards/level-03-intro-five-frame-storyboard-no-text.png`

## Prompt

```yaml
characters:
  patrick:
    identity: Bald adult man with black sunglasses, trimmed goatee, red leather jacket with glowing orange rift seams, black shirt, fingerless gloves, blue jeans.
    personality: Surprised but trying to act brave; moves like a player character entering a new RPG zone.
  su:
    identity: Blonde cyber-magic Thai guide with hair in a bun, translucent coral jacket, black outfit, glowing blue tech markings around her neck and body.
    personality: Calm, focused coach; gestures clearly as she explains the objective.
  street_food_vendor:
    identity: Young Thai night-market cook with black hair, orange patterned bandana, black shirt and apron, holding a spoon with a small chili charm.
    personality: Friendly, confident, inviting Patrick to choose a dish.

cinematic_style:
  medium: 2D anime game intro cinematic based on the provided storyboard and project sprite art.
  look: Neon Bangkok night market, wet reflective pavement, warm lantern light, cyan sky-train glow, orange steam, red floating chili spirits, polished RPG cutscene framing.
  motion: Slow parallax camera, subtle sprite-style character movement, drifting steam, flickering lanterns, passing sky-train lights, glowing icon-only phrase UI cards.
  continuity: Keep Patrick, Su, and the vendor consistent with the reference image. Do not redesign costumes, faces, hairstyles, or color palette.

description:
  Level 3 begins at a Bangkok night market food stall after Patrick leaves hotel check-in. The intro teaches the player that the goal is to talk to the cook, choose food, control spice level, ask for water, pay the bill, and compliment the meal. The key phrase is "mai phet khrap" meaning "not spicy, please."

video_prompt:
  Create a 12-second 2D anime game intro cinematic using the five storyboard frames as the shot plan. Start wide on the neon street-food market beneath the sky-train, with steam rising from stalls and red chili spirits floating above the food carts. Patrick enters frame surprised, reacting silently to the market. Su steps beside him and explains the mission through gestures: food first, talk, choose, spice, pay. Cut to the smiling street-food vendor inviting Patrick toward the stall as three glowing food-choice icons appear. Push in on an icon-only phrase tutorial card while Su watches Patrick practice the "not spicy, please" phrase without any visible words. End with Patrick, Su, and the vendor framed together as a glowing spoon-saber reward ignites above the stall, implying the Level 3 route has opened.

visual_dynamics:
  - Frame 1: Wide establishing shot under the sky-train. Patrick looks up, startled by neon stalls, steam, and floating chili spirits.
  - Frame 2: Medium two-shot. Su points toward the stalls and gives the mission structure: talk, choose, spice, pay.
  - Frame 3: Vendor shot. The street-food vendor smiles and presents dishes while choice icons hover near the stall.
  - Frame 4: Tutorial focus. An icon-only phrase card glows as Patrick practices "not spicy, please" and Su evaluates him.
  - Frame 5: Reward beat. Patrick, Su, and vendor share the frame; a glowing spoon-saber appears as the intro resolves into gameplay.

scene_sequences:
  - time: 0-2.5s
    shot: Wide market reveal with slow left-to-right pan, sky-train light streaks, wet pavement reflections, Patrick entering from foreground.
  - time: 2.5-5s
    shot: Su joins Patrick, points toward the stall row, and a soft UI glow highlights the path forward.
  - time: 5-7.5s
    shot: Vendor presents the food stall; glowing circular choice icons appear for dish selection.
  - time: 7.5-10s
    shot: Icon-only phrase card close-up; Patrick speaks the phrase while Su watches for clean pronunciation.
  - time: 10-12s
    shot: Group hero frame with spoon-saber reward glow, lantern flicker, steam, and a final camera push toward the stall.

audio_context:
  music: Upbeat Thai night-market groove with light percussion, city ambience, soft synth pads, and brief magical shimmer on phrase cards.
  sound_design: Sky-train pass, sizzling wok, market chatter, lantern flicker, rift shimmer, UI chime when "MAI PHET" appears, reward sparkle at the end.

avoid:
  - Do not make the scene photorealistic.
  - Do not change Patrick's red jacket, bald head, sunglasses, or goatee.
  - Do not change Su's coral jacket, blonde bun, or cyber-magic markings.
  - Do not replace the Bangkok night-market setting with a generic restaurant.
  - Do not add extra main characters.
  - Do not render any visible text, subtitles, captions, letters, words, labels, numbers, signs, or written UI.
```
