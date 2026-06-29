# Player Settings feature — living plan

Status legend: ⬜ todo · 🔄 in progress · ✅ done

## Locked design decisions (from clarifying Q&A)
- **Email sending**: one `sendMail()` helper. Default impl logs the link to the server console (no creds). A Resend-backed impl is gated behind `RESEND_API_KEY` (dormant until a key exists). No new npm dependency added now.
- **Pending accounts**: live in `users` with new `email` + `email_verified` columns. Unverified = user row, `email_verified=0`, **no player row**. Re-register with same email UPDATEs that row.
- **Legacy accounts**: migration sets all existing users `email_verified=1`, `email=NULL`. Only NEW registrations require email.
- **Email change in Settings**: takes effect immediately, sends a confirmation/notification email. No re-verify gate.
- **Sensitive changes (username/email)**: no password re-entry; send a notification email.
- **Password reset**: forgot-password lives on the **login page only** (logged-out). Not in Settings.
- **Probes-per-send setting**: new `player_settings` table + `PlayerSettingsRow` on `PlayerData`. First column `probes_per_send`.
- **E2E**: Option 1 — helper drives the real verify endpoint using a token read from the shared SQLite DB. `register(page, username, password)` signature stays; helper derives email internally.
- **Nav label**: rename "Account" → "Player Settings", view id `settings`.
- **Broadcast**: dataTransfer `005`, French, announcing email-in-settings.

## Key facts (validated against code)
- Next migration = `029`; next dataTransfer = `005`.
- Adding a PlayerData field touches: `coreTypes.PlayerData`, `serverGetPlayerData`, `serialization.ts` (Serialized type + ser/deser). `serverGetPublicPlayerData` wraps `serverGetPlayerData`.
- New endpoint = 3 edits in `app/api/apiEndPoints.ts` (const map, RequestMap, ResponseMap) + requestTypes + client fn + server fn + route.
- `register()` e2e helper has no `db` param; it will open its own connection to `join(tmpdir(),"protonet-e2e-test.db")`.
- Capacity throw text: `"No more planets for new player."` (serverPlanetManagement.claimPlanet) — now surfaces at verify.
- Client receives sanitized `UserRow` (password_hash blanked) via `/authentication/me`.
- Inline-edit pattern to mirror: `renderNameEditor` in `currentPlanetView.tsx` (planet rename).

## Steps

### Layer 0 — schema & DB
- ✅ **S1** `db/migrations/029_add_player_email_and_settings.sql` + mirror into `db/schema.sql`:
  - `users` += `email TEXT`, `email_verified INTEGER NOT NULL DEFAULT 0`; `UPDATE users SET email_verified=1` (grandfather); partial unique index on `email`.
  - `email_token(token PK, user_id, purpose, created_at, expires_at)`.
  - `player_settings(player_id PK, probes_per_send INTEGER NOT NULL DEFAULT 1)` + backfill `INSERT … SELECT id,1 FROM player`.

### Layer 1 — DB types
- ✅ **S2** `lib/db/dbTypes.ts`: `UserRow` += `email: string | null; email_verified: number;`; new `EmailTokenRow`, `PlayerSettingsRow`.

### Layer 2 — mailer
- ✅ **S3** `lib/mail/mailer.ts`: `sendMail(to,subject,body)`, `buildAppUrl(path)`. Stub logs; Resend extension point documented. Eager, acyclic.

### Layer 3 — auth/token logic
- ✅ **S4** `lib/authentication/auth.ts`: `EmailTokenPurpose` as-const + `EMAIL_TOKEN_PURPOSE_INFOS` map (`{ttlMilliseconds}`) + `getEmailTokenPurposeInfo`; `createEmailToken` (re-issue invalidates prior), `peekEmailToken`, `deleteEmailToken`, `deleteEmailTokensForUser`; `findUserByEmail`, `findUserByUsernameOrEmail`, `createUnverifiedUser`, `updateUnverifiedUser`, `setUserEmailVerified`, `updateUserEmail/Username/Password`; `normalizeEmail`, `isValidEmail`. (createUser/findUserByUsername kept — still used.)

### Layer 4 — player_settings accessor (REFACTORED to DataContext pattern)
- ✅ **S5** `lib/gameplay/dynamicData/player/playerSettingsData.ts` is now a **pure helper** (like researchData.ts), NO DB: `getProbesPerSend(playerData)`, `setProbesPerSend(playerData, value)` (floors to min 1 inline — no max, no clamp fn).
  - DB read/write moved to `serverDynamicData.ts`: `getDynamicPlayerSettingsData` (insert-or-ignore default + SELECT) in `getDynamicPlayerData`; `updatePlayerSettings` (UPSERT) under `DataContext.PlayerSettings` in `serverUpdatePlayerDataContext`.

### Layer 5 — PlayerData wiring (REFACTORED: settings is a PlayerDataContext)
- ✅ **S6** `playerSettings: PlayerSettingsRow` lives on **`DynamicPlayerData`** (NOT top-level PlayerData). Added `PlayerDataContext.PlayerSettings = 11` + map entry; `thingHelpers` getThingValues/setSpecificThingValue early-throw PlayerSettings (mirrors Messages/CurrentlyResearching — keeps it out of the Thing-value union). `serialization.ts` carries it in `SerializedDynamicPlayerData`; `testDataBuilders.buildDynamicPlayerData` includes it. `tryUpdatePlayerSettingsLogic` mutates via `PlayerSettings.setProbesPerSend` then writes `ServerDynamicData.serverUpdatePlayerDataContext(playerId, DataContext.PlayerSettings, dynamicPlayerData)`. `createPlayer` no longer inserts (row auto-created on first read). Views read via `PlayerSettings.getProbesPerSend`. **typecheck: exit 0.**

### Layer 6 — request types + endpoints
- ✅ **S7** `requestTypes.ts`: removed `BaseAuthenticationClientRequest`; added `Register_ClientRequest {username,email,password}`, `Login_ClientRequest {identifier,password}`, Verify/Resend/RequestReset/ResetPassword/ChangeEmail/ChangeUsername/UpdatePlayerSettings req+resp. ChangeEmail/ChangeUsername return `userRow` (sanitized).
- ✅ **S8** `apiEndPoints.ts`: re-typed Login/Register; registered 7 new endpoints ×3 places. UpdatePlayerSettings endpoint = `settings/update`; ResendVerification request = `null`.

### Layer 7 — server logic
- ✅ **S9** register rewrite (unverified, no player, re-register updates by email; username-collision logic) + `serverTryVerifyEmailRequest` (peek token → createPlayer → setVerified+deleteToken; no-room leaves token; already-verified = success) + `serverTryResendVerificationRequest`. `createPlayer` now inserts a player_settings row. French verification email.
- ✅ **S10** login by `findUserByUsernameOrEmail` (returns resolved username) + `serverTryRequestPasswordResetRequest` (no enumeration, verified+email only) + `serverTryResetPasswordRequest`.
- ✅ **S11** `serverTryChangeEmailRequest` (immediate + confirm/notify emails), `serverTryChangeUsernameRequest` (notify email), `tryUpdatePlayerSettingsLogic` (clamp, player-state action). Added `Auth.findUserById`, `Mailer` import.

### Layer 8 — routes
- ✅ **S12** new routes created: verify, resendVerification, requestPasswordReset, resetPassword, changeEmail, changeUsername, settings/update.

### Layer 9 — client fns
- ✅ **S13** `clientRequestFunctions.ts`: login→identifier, register→(username,email,password); added verify/resend/requestReset/resetPassword/changeEmail/changeUsername + `clientTryUpdatePlayerSettingsRequest` (psController, applies returned playerData).

### Layer 10 — pages & views
- ✅ **S14** login page: single `Username or email` input + "Forgot password?" sub-flow (calls requestPasswordReset, generic success msg).
- ✅ **S15** register page: added `Email` input (type=email), passes to register.
- ✅ **S16** `app/reset-password/page.tsx` (reads token from `window.location`, sets new password, success screen → login).
- ✅ **S17** `app/verify/page.tsx` (link target: token→verify→redirect) + `components/views/verifyPendingView.tsx` (resend + logout) + gate in `app/page.tsx` (don't fetch player data unless verified).
- ✅ **S18** `playerSettingsView.tsx` (replaces accountView, deleted): Game (probes input) + Account (email/username inline edit → refresh cuController, delete). Shared `components/helpers/inlineTextEditor.tsx`; **also refactored `currentPlanetView.renderNameEditor` to use it** (dedup; `key={planetId}` preserves planet-switch reset; placeholder+Save selectors preserved for planetName.test).
- ✅ **S19** sidebar label → "Player Settings", view id `settings`; mainWindow routes `settings` → PlayerSettingsView; accountView.tsx deleted.
- ✅ **S20** planetView: `getEspionageProbeQuantities` = min(probes_per_send, available) used in gate + fuel + send; title now "Send N espionage probe(s)". Default 1 preserves old behavior.
  - **Test-sweep note (S26)**: title string changed "Send 1 espionage probe" → "Send N espionage probe(s)"; check espionage.test.ts doesn't assert the old title.

### Layer 11 — broadcast
- ✅ **S21** `db/dataTransfers/005_announce_email_settings.ts` (French; references "Player Settings" tab; mirrors 002).

### Layer 12 — tests
- ✅ **S22** e2e helpers: `register` keeps `(page,username,password)` signature, derives `username@e2e.test`, reads verify token from its own DB conn + visits `/verify`; `registerExpectingNoRoom` fails at verify; login placeholder "Username or email"; deleteAccount → "Player Settings"; goToView union updated; `emailForUsername` exported.
- ✅ **S23** userJourney.test.ts needs NO body edits — capacity fill loop consumes slots via register→verify; final case asserts no-room at verify (all through helpers).
- ✅ **S24** migration-safety: NO fixture change — synthetic players injected before db:migrate, so 029's player_settings backfill covers them; `getDynamicPlayerSettingsData` is defensive; snapshots don't touch users/player_settings. 029 applies cleanly on the copy.
- ✅ **S25** `tests/e2e/accountSettings.test.ts` (NEW, not run per no-unprompted-testing): verify-gate, login-by-email, change-username (DB assert), probes-persist (DB assert). Pure unit tests avoided (auth/playerSettings... settings now pure but auth.ts still DB-eager).
- ✅ **S26** swept tests: no refs to old "Account" label, bare 'Username' placeholder, or the changed spy-title string.

### Layer 13 — verify build
- ✅ **S27** `pnpm typecheck` → exit 0 (after the DataContext refactor + thingHelpers guards).

## Architecture correction (post-review)
User flagged: `playerSettingsData.ts` must not touch the DB. Refactored — settings became `PlayerDataContext.PlayerSettings` on `DynamicPlayerData`; pure helper + DB split between playerSettingsData (pure) and serverDynamicData (SQL). See memory `feedback_data_helpers_pure_db_in_serverdynamicdata.md`.

## Change log (updated after each step)
- **S1** migration 029 + schema.sql: users += email, email_verified, verify_token, reset_token; idx_users_email; player_settings. (No separate token table — collapsed to columns on users, no expiry.)
- **S2** dbTypes: UserRow += email/email_verified/verify_token/reset_token; PlayerSettingsRow.
- **Email tokens collapsed (post-review)**: dropped the `email_token` table + `EmailTokenPurpose`/INFOS/4 helpers; tokens now live as `users.verify_token`/`users.reset_token` (random hex, no expiry). auth.ts: `createVerifyToken`/`createResetToken`/`findUserByVerifyToken`/`findUserByResetToken`/`clearVerifyToken`/`clearResetToken`. Re-issue overwrites the column (old link dies); verify clears only on success (no-room retry still works).
  - Downstream note for S6: any code building a `UserRow` literal now needs email/email_verified — sweep for `password_hash:` literals.
