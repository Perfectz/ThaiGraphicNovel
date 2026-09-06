# Bangkok environment models

Original stylized architecture authored in Blender 4.2.16 LTS for Bangkok Rift. These models are inspired by Bangkok materials and roof forms; they are not reconstructions of a particular temple or historic building.

| Editable source | Runtime export | Structure |
|---|---|---|
| `oldtown-hall.blend` | `public/bangkok/models/oldtown-hall.glb` | Three roof tiers, curved ceramic tiles, floral gable relief, framed windows, teak doors, pilasters and stepped plinth |
| `lumphini-pavilion.blend` | `public/bangkok/models/lumphini-pavilion.glb` | Open four-post pavilion, teak deck, brass collars, curved braces and jade roof |
| `sukhumvit-shophouse.blend` | `public/bangkok/models/sukhumvit-shophouse.glb` | Recessed shopfront, balconies, sun screens, side windows and rooftop condenser |
| `yaowarat-shophouse.blend` | `public/bangkok/models/yaowarat-shophouse.glb` | Shuttered windows, arched hoods, flower boxes, striped awning and sculpted parapet |
| `evening-service.blend` | `public/bangkok/models/evening-service.glb` | Two celadon noodle bowls, chopsticks, separate chilli, pitcher/cups, tea flask and serving table |

The `.blend` scenes include studio lights, a floor and a camera for inspection. The GLB exports contain only the architecture. Materials use portable glTF base color, roughness, metallic and emission settings; no Blender-only procedural shader is required in the game. Structural mesh groups remain independently editable. The Python source also retains the dimensions and construction steps.

Regenerate from the repository root in PowerShell:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' --background --python scripts/blender/build_landmarks.py
```

This rebuilds both `.blend` files and GLBs, and renders inspection images plus a geometry manifest to `artifacts/blender-landmarks/`. Blender may retain its normal `.blend1` backup when a source is rebuilt.

The runtime uses metre units and positions the hall at `(43, 0, 35.5)` and pavilion at `(-24.5, 0, 25)`. Keep the named structural groups: `HallBase`, `HallWalls`, `HallRoof`, `PavilionBase`, `PavilionSupports`, `PavilionRoof`. Hall walls and roof participate in camera cutaways; the roof hides when its supporting walls hide. The open pavilion removes its roof when necessary while keeping its posts and deck. Existing simplified models remain available during loading or failed requests.

Below head height, the hall must fit its existing 8 × 5 metre solid footprint. Pavilion posts must remain at the original four positions and the deck inside 3 × 2.4 metres. Run `node --test tests/blenderLandmarks.test.ts` after editing/exporting, then build and run `node scripts/test-blender-landmarks.mjs` against localhost:5188.

Initial exports: hall 45,714 triangles / 2.31 MB; pavilion 8,942 triangles / 0.38 MB. These are asset counts, not a phone frame-rate guarantee. See the project quality audit for browser evidence and remaining visual limitations.

Regenerate the two street assets with:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' --background --python scripts/blender/build_shophouses.py
```

This script imports the landmark construction helpers without rebuilding the landmarks. It writes studio renders and a manifest to `artifacts/blender-shophouses/`. Sukhumvit is 9,960 triangles / 707,984 bytes; Yaowarat is 12,892 triangles / 848,880 bytes. Both use eight portable materials without external textures.

Street assets have a nominal 5 × 3 metre footprint. Keep `ShopLower` at the origin and `ShopUpper` at game Y=2.6 (Blender Z=2.6). The runtime scales width/depth to the existing obstacle and scales only the upper storeys for building height. Doors and canopy clearance therefore stay consistent. Fourteen buildings use shared geometry from two downloads: six Sukhumvit and eight Yaowarat. The original low foundations, signs and collision footprints remain; the imported upper building and its signs share the existing camera cutaway. Simplified facades remain available during loading or failed requests. Backdrop blocks and Uncle Lek's separate stall retain their existing models.

After changing these assets, run `node --test tests/blenderShophouses.test.ts tests/blenderLandmarks.test.ts tests/city.test.ts tests/cityVisibility.test.ts`, `npm run build`, and `node scripts/test-blender-shophouses.mjs` against localhost:5188. The test parses actual GLB vertices at all district building heights and orientations, checks budgets and fixed door height, then the browser script checks the streets, conversations, phone camp return and failed model requests.

## Companion outing service models

Run `blender --background --python scripts/blender/build_evening_service.py` with the installed Blender executable to regenerate the serving props. The GLB is 437,752 bytes and 9,528 triangles. Its seven named groups (`MealBase`, `MealContents`, `ChilliAdded`, `ChilliAside`, `ParkTable`, `WaterSet`, `TeaSet`) are independently shown by `CityEvening.ts`. The editable `.blend` presents the food and table side by side for inspection; use the builder for export because it writes the parts at their game origins before applying the studio presentation offsets.

The food board sits on Lek's counter at `(35, 1.12, 17.45)`, using the shared `foodStallOrigin`. The pavilion table fits the shared `parkServingTable` collision rectangle; its model origin is `(-24, .26, 24.15)` and top is at Y=1.14. Both drinks are shown before an order; confirming a drink leaves the chosen set in the centre. Committed meal preferences control the filled bowls and chilli. These displays derive from existing save flags and remain after completion/reload. Previewing a phrase does not alter the scene. Simple batched fallback props remain usable if the GLB fails.

Run `node --test tests/eveningService.test.ts tests/eveningOuting.test.ts tests/city.test.ts tests/oldTownCourt.test.ts tests/conversationStaging.test.ts`, build, and `node scripts/test-evening-service.mjs` after changing the service models or their integration. Visual evidence is under `artifacts/evening-service/`.

## Six city memory objects

`city-memories.blend` contains the six original exploration props: the guest journal, soi route board, volunteer basket, recipe display, ferryman's carved boat and unfinished lantern. Rebuild with the installed Blender executable and `--background --python scripts/blender/build_discoveries.py`.

The builder exports `public/bangkok/models/city-memories.glb` before arranging the objects for its studio render. Each named group uses the matching discovery ID and a local origin at the existing world interaction point. Use the builder for game exports; the saved studio presentation offsets are not world placements. Current export: 18,436 triangles, 913,904 bytes, no external textures. The studio floor, camera and lights are excluded from GLB.

The runtime loads one pack when adventure actors are created, batches each prop by material and hides its simple fallback only after all six named groups are present. World teardown owns loaded resources; late loads are explicitly released. Discovery phrases, proximity rules and one-time rewards remain governed by the adventure state.

Validate using `node --test tests/discoveryModels.test.ts tests/discoveries.test.ts tests/worldResources.test.ts`, `npm run build`, and `node scripts/test-discovery-models.mjs` against localhost:5188. Studio and browser evidence lives under `artifacts/blender-discoveries/`.

## Travel lanterns and workshop negotiation

`travel-lanterns.blend` contains the carved teak/brass lamp and the simpler bamboo/paper lamp. Regenerate using the installed Blender executable with `--background --python scripts/blender/build_travel_lantern.py`. The builder exports both named variants at the origin before arranging the studio preview. Current GLB: 4,540 triangles, 215,288 bytes. The editable source reopens in Blender 4.2.16.

Keep the `Carved` and `Paper` groups and the carrying handle at Y=0.73. Stock models stand at `(28.4, .94, 30.3)` and `(29.6, .94, 30.3)` on Arun's existing workbench. The purchased model is rendered at 0.6 scale, hanging from Su's actual `RightHand` joint; the fallback retains the same handle height. Loaded clones share resources and remain covered by world teardown. The optional asset pack starts loading only when adventure actors are created.

`lanternTrade.ts` owns the serializable quote and purchase state. Previewing or practising a phrase never spends coins or changes the quote. Confirming the selected reply updates the offer; confirming a purchase charges 30, 24 or 18 game coins, grants 40 XP once and equips the corresponding lantern. Leaving retains the current quote. Both designs reveal uncollected city memory markers from 14 metres rather than 8. These are fictional game prices and gameplay distances.

Run `node --test tests/lanternTrade.test.ts tests/questJournal.test.ts tests/adventure.test.ts`, build, then `node scripts/test-travel-lantern.mjs` against localhost:5188. The verifier uses isolated saves and a synthetic microphone for its recorded-reply case; it does not measure human pronunciation.

## Uncle Lek's street-food cart

`lek-food-stall.blend` is the editable original Blender cart, with a red enamel cabinet, steel drawers and vents, wheels, stock pot and ladle, stacked bowls, condiments and a striped canvas canopy. Run the installed Blender executable with `--background --python scripts/blender/build_food_stall.py` to regenerate the scene, GLB and studio render. Current export: 8,287 triangles, 434,936 bytes. Studio floor, lights and camera are excluded from the GLB.

Keep the `Counter`, `Equipment` and `Canopy` structural groups. The runtime places the asset at `foodStallOrigin` `(35, 0, 17.45)`. All geometry below head height stays inside `foodStallCounter`; the whole cart stays in front of the shop walls. The east edge leaves a route through X=36.5 to Old Town. The existing meal board uses the same origin at Y=1.12, and equipment stays to its left. Canopy/equipment are independent camera cutaways; the noodle sign follows the canopy's visibility. The simple fallback stays until all required parts load. World teardown owns loaded resources, including late-load cleanup.

The new solid counter recovers old saves locally if a player or follower was standing inside it. Cooking steam uses the stock-pot location and hides with the equipment or reduced motion. No phrase, quest reward or voice behavior changes. Validate with `node --test tests/foodStall.test.ts tests/city.test.ts tests/questJournal.test.ts tests/eveningService.test.ts tests/conversationStaging.test.ts tests/cityWayfinding.test.ts tests/cityMotion.test.ts`, `npm run build`, and `node scripts/test-food-stall.mjs` at localhost:5188. `--presentation` checks the phone meal and wide canopy views separately. Evidence lives in `artifacts/blender-food-stall/`.

## Old Town community archive

`oldtown-archive.blend` contains five original teak gallery buildings around a lotus courtyard. Run Blender with `--background --python scripts/blender/build_archive.py` to regenerate the scene and GLB. The current export is 154,504 triangles and 8,779,528 bytes. Low plaster sills belong to `ArchiveBase` and remain visible when the upper walls and ceramic roofs cut away. The optional `refine_archive_cutaways.py` updates earlier saved archive scenes without rebuilding the geometry from scratch.

The model uses world coordinates from `src/bangkok/archive-layout.json`, shared by navigation through `archiveLayout.ts`. Keep `ArchiveBase`, `ArchiveFurniture`, and each room's `Walls` and `Roof` groups. Runtime room signs and planting are in `CityScenery`; required model groups, fallback visibility and room cutaways are managed by `CityArchive`. Only the architecture is exported; studio lighting and camera remain in the editable scene.

Verify `node --test tests/archive.test.ts tests/city.test.ts tests/cityBackdrop.test.ts tests/questJournal.test.ts`, build, then `node scripts/test-archive.mjs` and `node scripts/test-archive.mjs --phone`. The microphone test uses synthetic audio and proves recording flow, not pronunciation quality. Browser and model evidence are under `artifacts/archive/`.
