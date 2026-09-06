# Sukhumvit hotel wall craft

An original Blender-authored environment refinement for the starting hotel: three arched teak and jade panels with raised botanical leaves and a central lotus, plus two open woven wall lanterns. These replace the earlier flat botanical pictures and rectangular lights. They reuse the hotel's existing palette and remain against its western wall, above walking height.

- Editable scene: `art/blender/hotel-furnishings.blend`.
- Generator: `scripts/blender/build_hotel_furnishings.py`, with the collection authored in `scripts/blender/hotel_wall_craft.py`.
- Runtime asset: `public/bangkok/models/hotel-furnishings.glb`.
- Final bundle: five structural parts, 35,518 triangles, 1,591,808 bytes. The new wall collection adds 12,896 triangles to the earlier furniture. It uses material colors and geometry without extra texture requests.
- Rebuild with Blender 4.2: `blender --background --python-exit-code 1 --python scripts/blender/build_hotel_furnishings.py`.
- Studio detail: `artifacts/blender-hotel/hotel-wall-craft.png`.

The wall collection is batched separately. The procedural fallback stays within its own preserved group and hides only after the complete replacement bundle loads. Keeping the fallback out of room-wide static batches matters: otherwise its meshes are reparented into the room and remain visible even after the empty group is hidden. The browser check asserts the fallback still owns its meshes, as well as checking its visibility and inspecting screenshots.

Verification evidence lives in `artifacts/blender-hotel-wall/browser/`, with build, unit-test and Blender reopen logs under `artifacts/blender-hotel/`. The browser script exercises desktop, phone emulation, blocked replacement, and blocked replacement plus missing legacy bed cases. No quests, Thai content, speech services or save formats were changed in this asset pass.

Final validation: production build and focused ESLint passed; all 13 geometry, city navigation and resource tests passed. Blender 4.2.16 reopened the saved scene and found the new collection. All four browser cases passed in installed Chrome 152 on AMD Direct3D11, with no unexpected console or page errors. The checks cover English-first check-in, chest rewards, walking outside, save reload, and phone camp return. Studio, desktop, phone journal and fallback views were visually inspected. Phone coverage is desktop emulation; physical-phone performance and the previously documented SwiftShader compatibility issue remain outside this pass's verification.
