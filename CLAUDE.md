# Coding Standards

These standards are extracted from the existing codebase. Match them exactly when adding or modifying code.

## Formatting

### Braces — Allman style, always
Opening brace on its own line, even for single-statement bodies. **No K&R braces anywhere.**

```ts
if (value === null)
{
    return null;
}

for (const item of items)
{
    process(item);
}
```

### Blank lines around blocks
- Blank line **before** an `if`/`for`/`while`/`switch` block (when it follows other statements).
- Blank line **after** the closing brace before the next statement (when the next statement isn't a closing brace itself).
- Blank line between functions.

```ts
const costParts: string[] = [];

for (const [resourceType, resourceCost] of singleCostMap)
{
    costParts.push(`${resourceCost} ${ThingType.getSpecificThingName(...)}`);
}

return costParts;
```

### Inline object/array literals
When assigning a multi-line object or array literal to a typed variable, the `=` ends the line and the `{` or `(` starts the next line. Same Allman style as control flow.

```ts
const fleetPlayerData: FleetData.FleetPlayerData =
{
    playerData: originPlayerData,
    fullPlanetData: associatedFullPlanetData,
}

const element: ReactElement =
(
    <div className="...">
        ...
    </div>
);
```

## Types and declarations

### `type` over `interface`
Use `type` for everything. `interface` is only used for the three response-map indirection types in `apiEndPoints.ts`. Don't introduce new `interface` declarations elsewhere.

### Explicit type annotations on every local variable
Every `const` and `let` gets an explicit type, even when inference would work. This is non-negotiable — it's how the codebase reads.

```ts
const galaxyDifference: number = Math.abs(origin.galaxy - target.galaxy);
const matchingPlanet: PlayerDataType.FullPlanetData | undefined = fullPlanetDatas.find(...);
let nextTime: number | null = null;
```

### Explicit return types on every function
Including `void`. Including inline arrow functions assigned to variables.

```ts
function getDistance(origin: PlanetAddress, target: PlanetAddress): number
export function applyPlayerUpdate(playerId: number, ...): PlayerDataType.PlayerData
const handleQuantityChange = (e: ChangeEvent<HTMLInputElement>): void =>
```

### Enum-like consts, not TS `enum`
Use `as const` objects with a derived type alias. Never the `enum` keyword.

```ts
export const RequirementOperator =
{
    GreaterThan: 1,
    GreaterOrEqual: 2,
    Equal: 3,
    LesserOrEqual: 4,
    LesserThan: 5,
} as const;
export type RequirementOperator = typeof RequirementOperator[keyof typeof RequirementOperator];
```

`Thing`, `DataContext`, `AnchorEventType`, `FleetMovementResolution` all follow this. Member-access form is `Thing.Ship`, not bare constants — except for game-content enums (`BUILDING_1`, `RESOURCE_1`, `SMALL_TRANSPORT`) which stay as top-level `SCREAMING_SNAKE_CASE` exports for legacy clarity.

### Display names live in `ReadonlyMap`
Each enum-like family has a parallel `*_DISPLAY_NAMES: ReadonlyMap<...>` constant. Add to both when adding a new variant.

## Variables

### `const` by default
`let` is used only when reassignment is genuinely needed (~30 uses in the entire codebase vs. ~740 `const`). Don't reach for `let` to "set a default and maybe overwrite it."

### Prefer local variables to clarify code
Extract intermediate values into named, typed locals even when they're used once. The goal is readability, not minimal LOC.
Ensure local variables are named clearly by what they represent, do not abreviate (not "req", use "requirement").

```ts
// Yes
const remainingMs: number | null = ShipData.getShipConstructionBatchRemainingMs(fullPlanetData);
if (remainingMs === null)
{
    return null;
}

// Not
if (ShipData.getShipConstructionBatchRemainingMs(fullPlanetData) === null) { return null; }
```

### Build the return value, then return it
Especially for React elements and complex objects:
```ts
const element: ReactElement =
(
    <div>...</div>
);

return element;
```

## Control flow

### Early return, always
Bail out as soon as a precondition fails. No deep nesting.

```ts
if (failedShipRequirements.length > 0)
{
    return ...;
}
// happy path continues unindented
```

### No `if (!x)`
There are **zero** `if (!x)` patterns in the codebase. Compare explicitly:

- `value === null` / `value !== null`
- `value === undefined` / `value !== undefined`
- `condition === false` / `condition === true`
- `array.length > 0` / `array.length === 0`
- `map.size === 0`

### `== null` only at network boundaries
The default is strict (`=== null`, `=== undefined`). The loose `== null` / `!= null` is reserved for checking deserialized server responses, and **must be accompanied by the standard comment**:

```ts
// Use != instead of !== here to catch everything that's very weird.
if (serverResponseData.error != null)
```

### `switch` statements use braces per case
Each `case` gets its own braced block. Always include a `default` that throws an `UNREACHABLE` error when the cases are supposed to be exhaustive.
If default has a single line, dont add braced block. If it has multiple lines or a comment, add braced block.

```ts
switch (anchorEvent.type)
{
    case AnchorEvent.AnchorEventType.BuildingUpgrade:
    {
        resolveBuildingUpgradeAnchorEventToDB(...);
        break;
    }
    case AnchorEvent.AnchorEventType.ShipConstructionBatch:
    {
        resolveShipBatchConstructionAnchorEventToDB(...);
        break;
    }
    default:
        throw new Error(`UNREACHABLE: Missing ... case: ${anchorEvent.type}`);
}
```

## Imports

### Namespace imports for all internal modules
Every internal module is imported as `import * as Alias from "@/..."`. There are ~290 namespace imports vs. ~36 named imports in the codebase. The named imports are reserved for:
- React (`useState`, `useEffect`, `ChangeEvent`, `ReactElement`, …)
- Next.js (`NextResponse`, `cookies`, `useRouter`, …)
- Node built-ins (`join` from `"path"`)

```ts
// Yes
import * as PlayerDataType from "@/lib/gameplay/gameplayData/player/playerDataTypes";
import * as ShipData from "@/lib/gameplay/gameplayData/dynamic/shipData";

// Yes (framework)
import { useState, ChangeEvent, ReactElement } from "react";

// No
import { PlayerData } from "@/lib/gameplay/gameplayData/player/playerDataTypes";
```

### Alias matches the file's purpose, not its filename
`playerDataTypes.ts` → `PlayerDataType` (singular concept). `requirements.ts` → `Requirement`. `clientRequestFunctions.ts` → `ClientRequestFunctions`. Pick the alias that reads well at call sites.
Imports with "formula" should drop the "formula"

```ts
// yes
import * as BuildingCost from "@/lib/gameplay/coreData/formula/buildingCostFormulas";

//no
import * as BuildingCostFormula from "@/lib/gameplay/coreData/formula/buildingCostFormulas";
```

### Path alias `@/` for all internal paths
Never relative imports between top-level folders.

## Naming

| Kind | Convention | Example |
|---|---|---|
| Files | `camelCase.ts` / `camelCase.tsx` | `serverProgress.ts`, `shipyardView.tsx` |
| Folders | `camelCase` | `progressUpdate/`, `coreData/` |
| Types | `PascalCase` | `PlayerData`, `BuildingUpgradeAnchorEvent` |
| Functions | `camelCase`, verb-first | `getDistance`, `computeBuildingUpgradeCost`, `applyPlayerUpdate`, `resolveAnchorEvent`, `renderShipImage`, `buildSingleShipCostParts` |
| Local variables | `camelCase` | `nextAnchorEvent`, `costParts` |
| File-local constants | `SCREAMING_SNAKE_CASE` | `BASE_GROWTH_FACTOR`, `PREVIEW_MAX_SHIP_LINES` |
| Exported game-content constants | `SCREAMING_SNAKE_CASE` | `BUILDING_1`, `SHIPYARD_BUILDING_TYPE` |
| Enum-like object keys | `PascalCase` | `Thing.Ship`, `RequirementOperator.Equal` |
| DB row fields | `snake_case` | `building_upgrade_completes_at`, `ship_construction_batch_completes_at` |
| DB row types | `PascalCase` with `Row` suffix | `PlayerRow`, `ShipConstructionRow`, `FleetMovementRow` |

### Verb prefixes have meaning
- `get*` — read existing data, may return `null`
- `compute*` — pure derivation from inputs (formulas, costs, durations)
- `build*` — assemble a value from parts
- `resolve*` — apply an anchor event / finalize state
- `apply*` — mutate state forward in time
- `try*` — request paths that can fail and return a response object
- `render*` — return a `ReactElement`
- `serialize*` / `deserialize*` — wire-format conversions
- `clientTry*` / `serverUpdate*` / `serverGet*` — prefix indicates the side it runs on

### Side prefixes for client/server symmetry
Functions that have client and server counterparts use `client*` / `server*` prefixes (`clientTryBuildShipsRequest`, `serverUpdatePlanetRow`, `serverGetPlayerData`). Keep this when adding new network-crossing code.

## React / components

### Functional components, `props` parameter, explicit `ReactElement` return
```ts
type ShipyardViewProps =
{
    clientDataStateResult: UseClientDataState.ClientDataStateResult;
};

export function ShipyardView(props: ShipyardViewProps): ReactElement
{
    ...
}
```

Don't destructure props in the parameter list. Access via `props.x` (or extract to a typed local at the top of the body).

### Split components into `render*` helpers
A non-trivial view is broken into a tree of `renderX(...)`-suffixed helpers, each returning a `ReactElement` (or `ReactElement | null`). The top-level exported component is thin — it wires state and delegates to a `render*Body` helper.

### `#region` markers organize long files
Long files use:
```ts
//#region pure helpers
//#endregion

//#region rendering helpers
//#endregion

//#region state + handlers
//#endregion
```

### State hooks: dedicated `use*` wrappers
Component-internal state with non-trivial setters gets wrapped in a local `useX` function returning a typed object (see `useRequestedQuantities` in `shipyardView.tsx`).

### `try/catch` around top-level component bodies that can throw on missing data
The pattern is:
```ts
try
{
    const x = ...mayThrow();
    return renderBody(props, x);
}
catch (error: unknown)
{
    console.error("⚠️:", error);
    return <HelperElements.EmptyElement />;
}
```

## Errors and logging

### `throw new Error(...)`, not `throw "string"`
`throw new Error(...)`.

### Unreachable cases throw with the `UNREACHABLE:` prefix
```ts
throw new Error(`UNREACHABLE: Unknown RequirementOperator ${operator}`);
```

### Warning logs use the warning-sign prefix
```ts
console.error("⚠️:", error);
console.error("⚠️:", `Building type ${buildingType} has no calculatable cost.`);
```

Only `console.error` — no `console.log` or `console.warn` in production paths.

### Errors include identifying context
Always include the id/type/value that produced the error.

```ts
throw new Error(`Building upgrade failed for planetId ${planetId}: Invalid response from server.`);
```

## API routes

Route handlers are paper-thin: parse the request, hand off to a `ServerRequestFunctions` logic function via `handlePlayerStateActionRequest`.

```ts
export async function POST(request: Request): Promise<NextResponse>
{
    const clientRequest: APIEndPoint.RequestForAction<typeof APIEndPoint.ActionRequest.BuildShips> = await request.json();
    return ServerRequestFunctions.handlePlayerStateActionRequest(
        (playerId: number, serverData: ServerDataType.ServerData) =>
            ServerRequestFunctions.tryBuildShipsLogic(playerId, serverData, clientRequest)
    );
}
```

New action/data endpoints must be registered in `apiEndPoints.ts` in **three** places: the const map, the `*RequestMap`, and the `*ResponseMap`.

## DB types

- One `*Row` type per table in `lib/db/dbTypes.ts`.
- Fields are `snake_case` to mirror SQL.
- All ids and timestamps are `number` (epoch ms for times).
- Nullable foreign keys are `number | null` (e.g. `player_target_id`, `owner_player_id`).

## Comments

- Module-level comments at the top of a file explain *why* the file exists, not *what* (see `serialization.ts`).
- Inline comments explain non-obvious intent ("Keep server data param here even if unused for future ease when we will use it").
- Don't write Javadoc-style `/** */` blocks — none exist in the codebase.

## Anti-patterns to avoid

- `if (!x)` — always compare explicitly
- K&R brace style — always Allman
- Implicit return types — always annotate
- Inferred local types — always annotate
- `enum` keyword — use `as const` objects
- `import { Foo } from "@/..."` for internal modules — use `import * as Alias`
- Destructuring props in the parameter list
- `console.log` in committed code
- Reaching for `let` when `const` works