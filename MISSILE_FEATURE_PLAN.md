# New Units + Missiles — Living Plan

Status legend: [ ] todo · [~] in progress · [x] done (rechecked against code) · [!] ripple/needs attention

After every phase: re-read the touched code, verify EACH step is actually finished, and update this file
(statuses + "Ripple" notes for anything that changes later phases).

---

## Phase 1 — Unit categories + new static content  — STATUS: [x] done (typecheck clean)
- [x] gameTypes: `UnitCategory` enum (Ship/Defense/Satellite/Missile)
- [x] gameTypes: `UnitStats.category` (required) + `missileStorageSlotCost?`
- [x] gameTypes: new `UnitType` RocketLauncher(6)/SolarSatellite(7)/InterplanetaryMissile(8)/InterceptorMissile(9)
- [x] gameTypes: `BuildingType.MissileSilo(15)`
- [x] staticData: `category` on all 5 existing units (all Ship)
- [x] staticData: 4 new units (OGame stats + requirements + slot costs)
- [x] staticData: Missile Silo building (20000/20000/1000, x2, Shipyard>=1)
- [x] staticData: `UNIT_CATEGORY_INFOS` (ReadonlyMap<UnitCategory, UnitCategoryInfo>), `MISSILE_STORAGE_SLOTS_PER_SILO_LEVEL=10`
- [x] staticDataHelpers: `getUnitCategory`, `getUnitCategoryInfo`, `getUnitCategoryDisplayName` (delegates to the info), `getUnitsByCategory`, `getMissileStorageSlotCost`

Recheck/ripple:
- Only 2 production sites iterate ALL units: `shipyardView.tsx` (Phase 2) and `fleetView.tsx` (Phase 6). Confirmed via grep.
- Immobile units carry speed value 0 / space 0 — inert because fleets are Ship-only (Phase 6 + server guard). No load-time speed math.
- [!] Tests iterate units / may assert counts — deploy gate runs them; we are dev-only and do NOT run tests unprompted. Flagged, not acted.

## Phase 2 — Shipyard view split by category, exclude missiles — STATUS: [x] done (typecheck clean)
- [x] shipyardView: `renderUnitBuildSection`/`renderUnitBuildSections` group by Ship/Defense/Satellite, exclude Missile
- [x] shipyardView: `SHIPYARD_UNIT_CATEGORIES` const; `renderShipyardBody` uses it; removed unused `ThingType` import
- [x] server `tryBuildUnitsLogic`: reject Missile-category (anti-cheat symmetry)

Recheck/ripple:
- grep confirms no dangling `renderUnitBuildRows`/`ThingType`/all-unit iteration in shipyardView; server guard at serverRequestFunctions.ts:1170.
- Active-construction (right side) reads `unitConstructions`, which never contains missiles (separate queue) → automatically missile-free. No change needed.
- No new ripple to later phases.

## Phase 3 — Missile construction subsystem (separate concurrent queue) — STATUS: [x] done (typecheck clean, migration applied, dev server loads modules: /api/playerData=401 not 500)
Mirror of UnitConstruction. Touch points enumerated:
- [x] schema.sql: `missile_construction` + `missile_construction_unit`
- [x] migration 025 (player index only, matching unit_construction) — applied to dev DB
- [x] dbTypes: `MissileConstructionRow`, `MissileConstructionUnitRow`
- [x] coreTypes: `MissileConstruction` type; `PlanetDataContext.MissileConstruction(11)`; varname map `missileConstructions`; `DynamicPlanetData.missileConstructions`; `EmptyPlanetData`
- [x] anchorEvent: `AnchorEventType.MissileConstruction(7)`
- [x] `missileConstructionAnchorEvent.ts` (findNext + resolve)
- [x] applyProgress: push findNext + resolve switch case
- [x] `missileConstructionData.ts` (durations via silo level, costs, max-affordable, capacity helpers)
- [x] serverDynamicData: get + update + switch case + getDynamicPlanetData wiring
- [x] serialization: SerializedDynamicPlanetData.missileConstructions
- [x] thingTypes: `Thing.MissileConstruction(12)`; thingData: THING_DISPLAY_NAMES + THING_DEFINITIONS
- [x] requirementValueGetters: `hasFreeMissileStorageSlot()`
- [x] staticData GLOBAL_REQUIREMENTS: `MissileConstruction` (silo-not-upgrading + hasFreeMissileStorageSlot)
- [x] requirements: `getFailedMissileBuildRequirements` (reuses existing `getUnitRequirements`, keyed MissileConstruction — no new dup helper)
- [x] serverRequestFunctions: `rescaleMissileConstructionTimes` + dispatch
- [x] serverProgress: `resolveMissileConstructionAnchorEventToDB` + switch case

Recheck CATCHES (found during recheck, fixed):
- thingHelpers `getThingValues`/`setSpecificThingValue` needed an explicit throw-guard for `MissileConstruction` (the union now includes it; without the guard the control-flow narrowing that makes the final `return` typecheck breaks). Added both. — would have failed typecheck.
- `tests/helpers/testDataBuilders.ts` builds DynamicPlanetData (in typecheck scope) → added `missileConstructions: []`.
Ripple to later phases: none beyond what Phases 4/5 already cover. Missile queue is fully independent of the shipyard queue (start-gate is `missileConstructions.length === 0`).
Runtime cycle note: `requirementValueGetters → missileConstructionData → staticData → requirementValueGetters` is safe (same shape as the pre-existing `staticData ↔ requirementValueGetters` cycle; all imports used only inside closures). Verified: dev server serves /api/playerData=401 (module graph initializes, no TDZ crash).

## Phase 4 — BuildMissiles + DestroyMissiles actions — STATUS: [x] done (typecheck clean; both routes load: POST=401 not 500)
- [x] apiEndPoints (register both, 3 edits each)
- [x] requestTypes shapes (mirror BuildUnits)
- [x] clientRequestFunctions: clientTryBuildMissilesRequest / clientTryDestroyMissilesRequest
- [x] tryBuildMissilesLogic (Missile-only, cap by afford THEN free slots, write MissileConstruction; start-gate independent of unit queue)
- [x] tryDestroyMissilesLogic (instant/free, cap to owned, write UnitQuantity, Missile-only)
- [x] routes buildMissiles + destroyMissiles

Recheck/ripple: typecheck clean; both POST routes return 401 (auth) not 500 → modules+logic load. Phase 5 view depends on these client fns + MissileConstructionData capacity helpers + getFailedMissileBuildRequirements — all present. No later-phase plan change.

## Phase 5 — Missile Silo view (gated on built) — STATUS: [x] done (typecheck clean; GET / = 200 compiles authed tree; visual proof deferred to consolidated end check)
- [x] missileSiloView.tsx (capacity readout; Build section ICBM/Interceptor w/ requirement gating + preview capped by afford+storage; Destroy section per-owned-missile input capped to owned + instant/free button; Queue = missileConstructions)
- [x] mainWindowElement route "missileSilo"
- [x] sideBarElement Buildings sub-item shown only if selected planet MissileSilo level >= 1 (guarded getSelectedPlanetBuildingLevel, try/catch -> 0)

Recheck/ripple: typecheck clean; authed page compiles under Turbopack (GET / = 200). Edge: switching to a silo-less planet while on missileSilo view -> nav item hides but view stays; handled gracefully (0/0 slots, build rows show requirement failures), no crash. No later-phase plan change.
DEFERRED: live screenshot of the view with a built silo -> consolidated browser verification at the very end (needs seeded account + silo level).

## Phase 6 — Fleets split (Ships + Missiles stub) — STATUS: [x] done (typecheck clean; GET / = 200; sendFleet route loads = 401)
- [x] sideBarElement: Fleets parent -> Ships (view "fleets", existing) + Missiles stub (view "fleetsMissiles", only if selected planet ICBM >= 1); getSelectedPlanetUnitQuantity guarded helper
- [x] fleetView: unit list -> getUnitsByCategory(Ship) only
- [x] server trySendFleetLogic: reject non-Ship category (anti-cheat symmetry)
- [x] missileFleetView.tsx stub (owned missiles list + dashed "Missile launch — coming soon" stump); NO send action
- [x] mainWindowElement route "fleetsMissiles"

Recheck/ripple: typecheck clean; GET / 200; sendFleet 401. Espionage send (probe=Ship) still passes the new Ship guard — verified by reasoning (planetView ONE_PROBE is Ship). No later-phase plan change.

## Phase 7 — Solar Satellite energy — STATUS: [x] done (typecheck clean; module graph loads 401/200)
- [x] gameTypes: `UnitPlanetValueProductionFormulasType` + `UnitPlanetValueStats` + `UnitStats.unitPlanetValueStats?`
- [x] unitPlanetValueProductionFormulas.ts (TemperatureScaled: per-unit = max(0, floor((temp°C + offset)/divider)))
- [x] calculatedValueData: implemented `computeUnitPlanetValueDatas` (iterates planet units, accumulates energy) — already merged into computePlanetValueDatas, so it feeds the energy ratio throttle automatically
- [x] staticData: Solar Satellite energy stat (Energy, offset 160, divider 6 — OGame-style)

Recheck/ripple: typecheck clean; module graph loads (the new calculatedValueData→unitPlanetValueProductionFormulas→staticData→requirementValueGetters→calculatedValueData cycle is functions-only, same safe shape as the existing building-value cycle; verified /api/playerData=401). Final phase — no later phases.

---
## FINAL cross-phase recheck (all phases vs code)
- All 7 phases [x]; every phase typecheck-clean at completion; whole feature typechecks.
- DB: schema.sql + migration 025 both present; migration applied to dev DB.
- Runtime: dev server serves /login, /, /api/serverDataState (200), /api/playerData + all new POST routes (401 auth, not 500) → module graph + cycles initialize.
- Anti-cheat symmetry verified in code: BuildUnits rejects Missile; BuildMissiles/DestroyMissiles reject non-Missile; SendFleet rejects non-Ship.
- OUTSTANDING (non-code): unit/building art assets (fallbacks exist); test suites not run (per no-unprompted-testing) — some unit tests may assert old unit counts and need updating before a deploy gate; migration-safety fixture unchanged (025 is additive, pending actions survive).
- TODO before any deploy: run test suites and fix any count-based assertions; author art; delete MISSILE_FEATURE_PLAN.md (working artifact).
- DEFERRED visual proof: DONE — consolidated browser verification below.

## Consolidated browser verification (dev, account "missiletest", seeded planet) — ALL PASS, 0 console errors
- Phase 7: top-bar Energy 340/0 from 10 Solar Satellites (~34 each via (temp°C+160)/6). Satellite energy feeds the planet-value pipeline.
- Phase 2: Shipyard shows sections Ships / Defenses / Satellites (Rocket Launcher under Defenses, Solar Satellite under Satellites); NO missiles.
- Phase 5: Missile Silo nav item appears (silo built); view shows "11/50 slots" (5×10 cap; 3 ICBM×2 + 5 int×1 used), build rows w/ OGame costs, destroy rows, empty queue.
- Phase 3+4 build: queued 2 ICBM -> Queue "Interplanetary Missile x2" counting down 59m59s; storage 11->15 (queued counted); missile queue starts immediately, independent of shipyard (concurrent).
- Phase 4 destroy: destroyed 2 ICBM -> owned 3->1 instantly/free; storage 15->11 (slots freed); in-progress build untouched.
- Phase 6: Fleets -> Ships + Missiles sub-items (ICBM owned). Ships view lists only Small Transport (owned Solar Satellite + missiles excluded). Missiles stub lists owned missiles + "Missile launch — Coming soon." stump, no send.
- Cleanup: throwaway db/seedMissileTest.ts deleted. Test account "missiletest" remains in dev DB (harmless).

## Post-review round 2 (convention fix + test barrage + bug found)
Convention fix (user caught: 2nd time):
- Replaced the bare `UNIT_CATEGORY_DISPLAY_NAMES: ReadonlyMap<X,string>` with the codebase's `*_INFOS` shape: added `UnitCategoryInfo` type (gameTypes), `UNIT_CATEGORY_INFOS: ReadonlyMap<UnitCategory, UnitCategoryInfo>` (staticData), and a `getUnitCategoryInfo` accessor (staticDataHelpers, throws on missing) that `getUnitCategoryDisplayName` now delegates to. Saved memory [[feedback-enum-info-map-convention]] + indexed in MEMORY.md so it never recurs.

OGame check: solar satellite formula confirmed = floor((temp°C + 160)/6) per sat — constants (offset 160, divider 6) already matched; no change.

Tests added (all three layers) — FULL SUITE GREEN:
- unit (tests/unit): missileRequirements (ICBM silo>=4+Impulse, Interceptor silo>=2, storage-full gate, build-while-building concurrency rules both directions), missileStorage (capacity = silo×10, used = owned+queued by slot cost, max-storable + max-affordable caps), solarSatelliteEnergy (per-sat by temperature, linear scale, floor-at-0, pipeline integration), unitCategory (categories, getUnitsByCategory, *_INFOS display names, slot costs).
- integration (tests/integration): missileConstructionPipeline (resolve → owned; missile + shipyard queues resolve concurrently in one pass; queue advances first→second).
- e2e (tests/e2e/missiles.test.ts): silo nav gating, build-queue-complete, destroy instant/free capped, shipyard excludes missiles, Fleets Ships/Missiles split, solar-satellite top-bar energy (225 @110°C), missile+ship concurrent queues.
- Helpers: testDataBuilders missile-construction builders; e2eHelpers forceComplete+getMissileConstructionId support missile_construction.

Bug FOUND + FIXED by running the suite:
- `e2eHelpers.buildingCard(page, name)` used a substring `hasText` filter → after adding the Missile Silo building (whose card shows "Shipyard >= 1" as a requirement), `buildingCard('Shipyard')` matched 2 cards and userJourney e2e failed (strict-mode violation). Fixed the helper to scope by the exact name node (`has: getByText(name, {exact:true})`). Verified all callers pass exact full names; full e2e re-run = 84 passed.

Final suite run: typecheck ✅ · test:typecheck ✅(1) · unit ✅(512) · integration ✅(72) · e2e ✅(84) · migration-safety ✅ (full 024→025 chain, in-flight actions survive; required restoring data/game.db from backup.23 since I'd advanced it to 025, then re-migrated back).

Anti-cheat server guards: CLOSED — added 4 e2e tests that POST forged cross-category payloads straight to the endpoints (/api/buy/buildUnits with a missile, /buildMissiles + /destroyMissiles with a ship, /sendFleet with a non-ship) and assert HTTP 400 with the guard's reason. Hits the real route + DB.

Server-side enforcement (round 3, forged-request POSTs): build capped to storage when client asks for 100 (silo 4 → 20 stored, resources spent); destroy capped to owned (own 3, ask 100 → 0, no underflow); ICBM rejected server-side without Impulse Drive; missile build blocked while the silo upgrades; missile build ALLOWED while the shipyard upgrades (concurrent facilities) — proves the build-while-building rules are enforced in the server logic, not just the UI/helpers. Plus integration: multi-quantity decrement + shortest-first ordering within one missile construction.
Final counts: unit 512 · integration 74 · e2e 93 (missiles.test.ts = 16) · migration-safety ✅ · typechecks ✅.

## Assets / follow-ups (non-blocking)
- [ ] /units/{6,7,8,9}.png + /buildings/buildingType_15/{tier}.png (onError fallbacks exist; cannot author art)
- [ ] migration-safety fixture + unit tests touching unit counts (do NOT run unprompted)

---

## Plan changes log
- 2026-06-26: Decisions locked: separate concurrent missile queue (OGame-accurate); OGame-accurate storage cap (10 slots/silo level, ICBM 2 / interceptor 1); Missiles fleet subview = STUB, no missile fleet action.
- Phase 3: capacity gate = boolean requirement `hasFreeMissileStorageSlot()` (mirrors `hasFreeFleetSlot`) + per-request quantity cap (mirrors resource affordability). `Thing.MissileConstruction` added to THING_DISPLAY_NAMES (describe path).
