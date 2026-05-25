# 3D Adventure Architecture

`Stage3DAdventure` is the React state machine for the playable 3D lesson rooms.
Keep new code in the smallest module that owns the concern:

- `src/components/Stage3DAdventure.tsx`: React state, command flow, voice practice flow, room transitions, and renderer lifecycle.
- `src/components/Stage3DAdventure.camera.ts`: camera presets, mobile viewport rules, auto-follow target math, two-shot conversation framing, and room bounds.
- `src/components/Stage3DAdventure.hotspots.ts`: hotspot meshes, raycast tagging, click priority, inventory formatting, and missing-item helpers.
- `src/components/Stage3DAdventure.npcRig.ts`: rig model URLs, fallback animation choice, NPC model attachment, and per-hotspot animation controllers.
- `src/components/Stage3DAdventure.types.ts`: mutable Three.js handles shared between React state, room rebuilds, and the animation loop.
- `src/components/three/collision.ts`: player collision collection and movement resolution.
- `src/components/three/sceneHelpers.ts`: reusable authored-room primitives and Three.js disposal helpers.

When adding a room, keep the lesson data in `src/data/adventures/` and use the
scene helper primitives instead of creating raw meshes inside the React component.
When adding a new NPC rig, extend the hotspot model id type, add a rig adapter in
`src/components/three/`, and register it in `Stage3DAdventure.npcRig.ts`.

Verification after 3D changes:

- `npm run build`
- Browser smoke at `http://127.0.0.1:5188/`
- If voice practice changed, also run `npm run test:whisper` and check the local health endpoints.
