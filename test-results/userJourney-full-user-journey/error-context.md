# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: userJourney.test.ts >> full user journey
- Location: tests\e2e\userJourney.test.ts:5:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('div.border').filter({ hasText: 'Iron :' })
Expected substring: "Iron : 2000"
Received string:    "Iron : 030/h"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('div.border').filter({ hasText: 'Iron :' })
    14 × locator resolved to <div class="flex flex-col items-center gap-1 border border-gray-400 rounded px-6 py-2">…</div>
       - unexpected value "Iron : 030/h"

```

```yaml
- text: "Iron : 0 30/h"
```

# Test source

```ts
  195 | }
  196 | 
  197 | export function getConstructionId(planetId: number, db: Database.Database): number
  198 | {
  199 |     const row: { id: number } = db.prepare(
  200 |         "SELECT id FROM ship_construction WHERE planet_id = ? ORDER BY id LIMIT 1"
  201 |     ).get(planetId) as { id: number };
  202 | 
  203 |     return row.id;
  204 | }
  205 | 
  206 | export function getFleetByOrigin(planetOriginId: number, db: Database.Database): FleetRow
  207 | {
  208 |     const row: FleetRow = db.prepare(
  209 |         "SELECT id, is_return_trip FROM fleet_movement WHERE planet_origin_id = ? ORDER BY id LIMIT 1"
  210 |     ).get(planetOriginId) as FleetRow;
  211 | 
  212 |     return row;
  213 | }
  214 | 
  215 | export function fleetExists(fleetId: number, db: Database.Database): boolean
  216 | {
  217 |     const row: { count: number } = db.prepare("SELECT COUNT(*) AS count FROM fleet_movement WHERE id = ?").get(fleetId) as { count: number };
  218 |     return row.count > 0;
  219 | }
  220 | 
  221 | // Rewind a started_at so `legs` completions (each one single-leg duration long) are already in
  222 | // the past — the server resolves them all on the next reload. legs=1 finishes one ship/upgrade
  223 | // or a one-way trip; legs=2 finishes a round trip or the 2nd ship of a batch.
  224 | export function forceComplete(table: "ship_construction" | "building_upgrade" | "fleet_movement", id: number, db: Database.Database, legs: number = 1): void
  225 | {
  226 |     const row: TimedRow | undefined = db.prepare(
  227 |         `SELECT id, duration_at_start_time FROM ${table} WHERE id = ?`
  228 |     ).get(id) as TimedRow | undefined;
  229 | 
  230 |     if (row === undefined || row.duration_at_start_time === null)
  231 |     {
  232 |         throw new Error(`Cannot force-complete ${table} ${id}: row missing or not started.`);
  233 |     }
  234 | 
  235 |     const newStartedAt: number = Date.now() - (row.duration_at_start_time * legs) - 5000;
  236 |     db.prepare(`UPDATE ${table} SET started_at = ? WHERE id = ?`).run(newStartedAt, id);
  237 | }
  238 | 
  239 | // Schedule single-leg completion `msFromNow` in the future so the server still reports it as
  240 | // in-progress on reload, and the client animation tick resolves it locally afterwards.
  241 | export function scheduleCompletionInMs(table: "ship_construction" | "building_upgrade" | "fleet_movement", id: number, msFromNow: number, db: Database.Database): void
  242 | {
  243 |     const row: TimedRow | undefined = db.prepare(
  244 |         `SELECT id, duration_at_start_time FROM ${table} WHERE id = ?`
  245 |     ).get(id) as TimedRow | undefined;
  246 | 
  247 |     if (row === undefined || row.duration_at_start_time === null)
  248 |     {
  249 |         throw new Error(`Cannot schedule ${table} ${id}: row missing or not started.`);
  250 |     }
  251 | 
  252 |     const newStartedAt: number = Date.now() + msFromNow - row.duration_at_start_time;
  253 |     db.prepare(`UPDATE ${table} SET started_at = ? WHERE id = ?`).run(newStartedAt, id);
  254 | }
  255 | 
  256 | //#endregion
  257 | 
  258 | //#region UI helpers
  259 | 
  260 | export async function reloadGame(page: Page): Promise<void>
  261 | {
  262 |     await page.reload();
  263 |     await expect(page.getByRole("button", { name: PLANET_BUTTON_PATTERN })).toBeVisible();
  264 | }
  265 | 
  266 | export async function goToView(page: Page, view: "Game" | "Upgrades" | "Shipyard" | "Fleets" | "Planets" | "Stats"): Promise<void>
  267 | {
  268 |     await page.getByRole("button", { name: view, exact: true }).click();
  269 | }
  270 | 
  271 | export async function selectedPlanetAddress(page: Page): Promise<string>
  272 | {
  273 |     const text: string = await page.getByRole("button", { name: PLANET_BUTTON_PATTERN }).textContent() ?? "";
  274 |     const match: RegExpMatchArray | null = text.match(/\((\d+:\d+:\d+)\)/);
  275 |     return match !== null ? match[1] : "";
  276 | }
  277 | 
  278 | export function buildingCard(page: Page, buildingName: string): Locator
  279 | {
  280 |     return page.locator("div.w-64").filter({ hasText: buildingName });
  281 | }
  282 | 
  283 | // The top bar renders one card per resource: a "<name> : <amount>" line above a "<amount>/h"
  284 | // production line. Scope by the name line so each resource's card resolves to a single element.
  285 | export function resourceCard(page: Page, resourceName: string): Locator
  286 | {
  287 |     return page.locator("div.border").filter({ hasText: `${resourceName} :` });
  288 | }
  289 | 
  290 | // Assert a resource card shows the expected stockpile and hourly production. Both are matched as
  291 | // substrings of the one card, so the "0/h" of one resource can't collide with the "30/h" of another.
  292 | export async function expectResourceCard(page: Page, resourceName: string, quantity: number, productionPerHour: number): Promise<void>
  293 | {
  294 |     const card: Locator = resourceCard(page, resourceName);
> 295 |     await expect(card).toContainText(`${resourceName} : ${quantity}`);
      |                        ^ Error: expect(locator).toContainText(expected) failed
  296 |     await expect(card).toContainText(`${productionPerHour}/h`);
  297 | }
  298 | 
  299 | export function buildUpgradeButton(page: Page, buildingName: string): Locator
  300 | {
  301 |     return buildingCard(page, buildingName).getByRole("button", { name: /Build Upgrade/ });
  302 | }
  303 | 
  304 | // One quantity input lives in the build row that also shows the ship's name. Used in both the
  305 | // shipyard and the fleet views.
  306 | export function shipRowQuantityInput(page: Page, shipName: string): Locator
  307 | {
  308 |     return page.locator("div.border")
  309 |         .filter({ hasText: shipName })
  310 |         .filter({ has: page.locator("input[type=\"number\"]") })
  311 |         .locator("input[type=\"number\"]")
  312 |         .first();
  313 | }
  314 | 
  315 | export async function buildShips(page: Page, shipName: string, quantity: number): Promise<void>
  316 | {
  317 |     await shipRowQuantityInput(page, shipName).fill(String(quantity));
  318 |     await page.getByRole("button", { name: "Build all" }).click();
  319 | }
  320 | 
  321 | // "N owned" appears once per buildable ship row, so scope to the row carrying the ship name to
  322 | // avoid matching another ship type that also shows "0 owned".
  323 | export function shipOwned(page: Page, shipName: string, count: number): Locator
  324 | {
  325 |     return page.locator("div.border").filter({ hasText: shipName }).getByText(`${count} owned`, { exact: true });
  326 | }
  327 | 
  328 | export function fleetActionSelect(page: Page): Locator
  329 | {
  330 |     return page.locator("select").filter({ has: page.getByRole("option", { name: "Station" }) });
  331 | }
  332 | 
  333 | export async function sendFleet(page: Page, shipName: string, shipQuantity: number, target: PlanetRow, actionLabel: "Station" | "Collect"): Promise<void>
  334 | {
  335 |     await shipRowQuantityInput(page, shipName).fill(String(shipQuantity));
  336 |     await page.getByPlaceholder("P").fill(String(target.slot));
  337 |     await page.getByPlaceholder("S").fill(String(target.system));
  338 |     await page.getByPlaceholder("G").fill(String(target.galaxy));
  339 |     await fleetActionSelect(page).selectOption({ label: actionLabel });
  340 |     await page.getByRole("button", { name: "Send fleet" }).click();
  341 | }
  342 | 
  343 | export function fleetMovementRow(page: Page, origin: PlanetRow, target: PlanetRow): Locator
  344 | {
  345 |     return page.getByText(`${planetAddress(origin)} → ${planetAddress(target)}`);
  346 | }
  347 | 
  348 | //#endregion
```