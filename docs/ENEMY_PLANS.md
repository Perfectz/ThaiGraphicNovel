# Read the field before you speak

The battle menu now has a free **Read enemy plans** command. It shows each living foe’s current target, base damage, special behavior and counterplay. A broken foe instead shows that its turn is cancelled. Desktop displays both plans; phone uses 44-pixel enemy buttons and one card at a time. Reading or changing the selected plan spends no turn, AP, supplies or adventure XP, and never submits a Thai reply.

## Encounter behavior

- **Murmur Wisp:** on even-numbered rounds, Mist Siphon deals 14 base damage and steals up to two AP from the struck ally on an unprotected hit. Steady guard, the ally’s prepared Guard, dodge, parry or weakening the Wisp prevents AP loss. AP never falls below zero. Other rounds retain its ordinary attack. Patrick’s Gentle Flame gives a language-linked way to protect Su’s next turn.
- **Lantern Echo:** after attacking, a surviving Echo restores up to 10 HP to its living companion. Parrying interrupts that heal even if the Echo survives the counter. Breaking or defeating it still prevents the entire turn. The event text reports actual healing rather than claiming 10 HP when the companion is almost full.
- **Keeper:** its existing third-round heavy attack is visible during the player’s planning phase. Building 100 break cancels the pending turn and exposes the enemy; the plan updates immediately.
- **Waywarden:** its existing armor and every-second-round heavy attack are explained before committing a move. Exposure, counterattacks and the duet provide the existing ways around armor.

Timing remains confined to enemy attacks and begins only when the player chooses to face an attack. Reading English, hearing Thai and rehearsing a reply remain untimed. The changes do not grade pronunciation or add a reflex requirement to the untimed route.

## Verification and limits

- Production build and focused ESLint pass. `tests/enemyPlans.test.ts`, `tests/expeditionCombat.test.ts` and `tests/waywarden.test.ts` pass 25 tests covering target selection, non-mutating forecasts, AP bounds, every anti-siphon defense, Echo interruption/healing caps, exact checkpoint restoration, existing party mechanics, and untimed victories in all three encounters.
- `scripts/test-enemy-plans.mjs` completes three browser cases with no console/page errors: desktop weaken/guard with a full Murmur victory; phone AP theft, enemy tabs, successful Echo parry and full victory; and a phone Keeper forecast followed by a break that cancels its heavy attack. The report is `artifacts/enemy-plans/browser/progress.json`, with `finished: true`. Screenshots were inspected after the phone layout was compacted and the camera settled.
- An initial parry verifier omitted the keyboard event’s `code`; its report is retained separately. Another run caught phone crowding and a real development entry re-evaluation warning. The phone layout now omits the redundant battle log while reading plans, and the entry reuses the container’s React root. The final browser run re-evaluates the entry twice and verifies unchanged save state with no duplicate-root warning.
- These changes add tactical distinctions to the existing encounter roster. They add no new dungeon, enemy model or district. Human difficulty preference, physical-phone use, long-session engagement and the broader full-RPG standard remain unproven.
