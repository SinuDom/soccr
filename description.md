# Soccr — description for an AI working on this codebase

This document explains the app piece by piece: what each module is for, what invariants it
protects, and how the pieces connect. It's written for an AI agent that needs to make changes
without re-deriving the architecture from scratch. For user-facing setup/deploy instructions see
`README.md`; for content-editing rules see `AGENTS.md`.

## One-paragraph summary

Soccr is a mobile-first PWA (React 18 + TypeScript + Vite + Tailwind + Framer Motion + Zustand,
no backend, no accounts) where each of several household users watches a short football-skill
clip and then physically drills the move against a set of per-clip countdown timers. Only real
drill time (driven by those timers, or a wall clock as fallback) counts toward a daily practice
goal defined per-category. Completing every category's goal in one local calendar day credits a
Duolingo-style streak, and any time drilled beyond the goals (or picked manually from the
Library) earns points that can be spent on streak freezes. All content (who the users are, what
videos they have, targets, timers) lives in one hand-edited `public/content.json`; all progress
lives in `localStorage`, keyed by a hash of each video's URL so editing content never disturbs
anyone's history.

## Two data stores, cleanly separated

1. **Content** (`public/content.json`) — static, versioned, deployed with the app, edited by
   hand on GitHub. Loaded at runtime by `src/lib/content/`.
2. **Progress** (`localStorage['football.progress.v1']`) — personal to the device, one record
   per user, managed by `src/lib/storage/` and `src/store/progressStore.ts`.

The join key between them is a **hash of the video's normalized URL** (`src/lib/content/url.ts`),
never a hand-assigned ID. This is the load-bearing design decision of the whole app: content can
be freely added/removed/reordered without ever touching progress data. See "Content pipeline"
below for exactly how normalization/hashing works.

## Directory map

```
src/
  lib/
    content/     URL normalization+hashing, fetch, schema validation, raw→domain types
    domain/      Pure TS, no I/O: categories, session, practiceClock, selection, streak, avatars, types
    storage/     localStorage load/save, migration, export/import (portability)
    chime.ts     Web Audio "drill finished" sound
  store/         Zustand stores (contentStore, progressStore) — the only place domain logic
                 touches React state
  components/    UI primitives (Button, Icon, Modal, DrillTimer, VideoPlayer, PracticeClock, …)
  screens/       One component per route
  App.tsx        Router, boot sequence, version badge
tests/           Vitest specs over the pure domain layer (no React, no DOM, except drillTimer.test.tsx)
public/
  content.json          the only content source, hand-edited on GitHub
  content.schema.json   JSON Schema counterpart (for editors/CI, not used at runtime)
  avatars/               profile-icon collection (21 emoji-style PNGs)
```

Path alias: `@/` → `src/`.

## Content pipeline (`src/lib/content/`)

**`types.ts`** — `RawContentFile`/`RawContentEntry`/etc. are the shapes as they appear in
`content.json` (everything optional where the schema allows it); `Content`/`User`/`Category`/
`VideoRef` (re-exported from `domain/types.ts`) are the normalized, fully-resolved shapes the rest
of the app consumes. `ContentResult`/`ContentError` model fetch/parse/schema failures as a
discriminated union — no exceptions cross this boundary.

**`url.ts`** — the identity system:
- `normalizeUrl` strips a fixed set of tracking params (`utm_*`, `fbclid`, `igshid`, YouTube `t=`,
  etc.), lowercases the host, drops the hash and trailing slash, sorts query params — so two
  share-links to the same clip normalize identically.
- `hashUrl` = `v_` + FNV-1a-32 of the normalized URL. Chosen over `crypto.subtle.digest`
  deliberately: it must run **synchronously** at content-load time, and 32 bits is more than
  enough entropy for a hand-curated library (collision odds ≈ 1e-5 at 10k URLs).
- `detectPlatform` / `extractYouTubeId` / `isYouTubeShort` / `extractInstagramCode` /
  `extractTikTokId` — all host/path pattern matching, used by both validation and the video
  player to route to the right embed.

**`schema.ts`** (`validateContent`) — hand-written validator (not the JSON Schema file, which is
just documentation for editors) that:
- Accepts three shapes for backward compatibility, from newest to oldest: `users[].categories[]`
  (current), `users[].videos[]` (legacy flat list per user, becomes one implicit "Practice"
  category), and top-level `videos[]` (legacy single-user, becomes a synthetic user "Everyone").
- Slugifies user names and category names/ids into stable slug ids (`slugifyUserId`), rejecting
  collisions.
- Enforces video URL uniqueness **per user across all of that user's categories** (not just
  within one category) — duplicate hashes throw with a descriptive message.
- Derives `title` from the URL host+path when omitted; keeps optional `description`,
  `timerTitles`, `timer`.
- Returns `{ ok: false, message }` rather than throwing outward, so `fetchContent` can surface a
  friendly parse/schema error screen instead of a blank page.

**`fetchContent.ts`** — fetches `/content.json?t=<now>` with `cache: 'no-store'` (cache-busting is
belt-and-suspenders on top of the service worker's own NetworkFirst rule for this path — see
"PWA/build" below), then threads the result through `JSON.parse` → `validateContent`, mapping each
failure point to a `ContentError.kind` (`network` | `parse` | `schema`).

## Domain layer (`src/lib/domain/`) — pure, no I/O, fully unit-tested

**`types.ts`** — the canonical shapes: `VideoRef`, `Category` (id/name/targetMinutes/videos),
`User` (id/name/categories), `Settings`, `HistoryEntry`, `DrillDayProgress` (today's in-progress
drill state — see below), `Progress` (per-user persisted state), `Vault` (outer multi-user
container keyed by user id). `CURRENT_SCHEMA_VERSION` / `CURRENT_VAULT_VERSION` version the two
nested shapes independently; bump these + add a migrator (see storage/migrate.ts) whenever a
field's meaning changes — **never** rename the localStorage key itself.

**`categories.ts`** — category-level derivations, all pure functions over `DrillDayProgress`:
- `drillDayFor(drillDay, todayISO)` rolls a stale (yesterday's) or missing record over to a fresh
  one for today — this is the "new day resets today's drill progress" mechanic.
- `categoryPracticeMs` derives a category's credited practice time **from the `finished` map**
  (which timer-indices of which videos finished today) rather than persisting a second
  category-keyed counter — so it self-corrects for categories added after the drill day was
  created.
- `isCategoryComplete` — true once either `completedCategories` contains it (a full daily session
  auto-ended) or the derived practice time alone reaches the target (drilling piecemeal across
  visits can also complete a category without ever running a full session).
- `allCategoriesComplete` / `dailyGoalProgress` — the day's overall goal is the AND of every
  practiceable (non-empty) category; the single Home progress bar is a target-minutes-weighted
  average of each category's (capped) progress.
- `markCategoryCompleted` — idempotent append to `completedCategories`.

**`selection.ts`** — the "which video next" algorithm, per **library** (i.e., per category's video
list, or the whole user's library for manual mode): pick uniformly from the unseen pool; once
exhausted, advance `cycleNumber`, clear only the seen-ids that belong to *this* library (ids from
other categories are left alone so recycling one category doesn't reset others), and pick from
the full library again. `pruneOrphans` is available but recycling doesn't require it — the
set-difference against `libraryIds` naturally ignores ids that no longer exist in content.

**`session.ts`** — an in-memory (never persisted mid-session) state machine for one watch+drill
session: `startSession` → repeated `setActiveMs` (fed by drill timers) → either `pressNext`
(banks the round, advances to a new video) or `tickDaily` (auto-closes the session once
`totalPracticeMs >= targetMs`) or `stopExtra`/`endEarly`. `baselineMs` seeds the session with
drill time already credited *today* before this visit, so a daily goal can be resumed across app
restarts without double counting.

**`practiceClock.ts`** — a tiny wall-clock abstraction (`newClock`/`startClock`/`stopClock`/
`elapsedNow`) whose elapsed math is always `Date.now()` deltas, never `setInterval` tick-counting
— this is what keeps practice time accurate through a backgrounded/throttled tab. Used as the
fallback timer for videos that have no configured drill `timer` (see Session screen).

**`streak.ts`** — the calendar-day streak state machine:
- `toLocalDateString`/`parseLocalDate`/`daysBetween` — local (device) calendar-day arithmetic,
  deliberately not UTC or a real timezone library (see README's "Timezone" section for the
  tradeoff this implies).
- `evaluateOnLaunch` — run once per app boot (and again on every user switch, so a stale streak
  doesn't linger until next launch): gap 0–1 day is fine; gap of exactly 2 days consumes one
  freeze if held (streak preserved, `lastCompletedDate` back-dated to "yesterday"); gap ≥ 2
  without a freeze, or gap ≥ 3 regardless, resets the streak to 0. Freezes never rescue more than
  one missed day.
- `applyDailyCompletion` — idempotent per calendar day.
- `awardPoints` / `buyFreeze` — points arithmetic and the freeze-shop purchase guard (blocked by
  `maxFreezesHeld` or insufficient points).

**`avatars.ts`** — static list of the 21 selectable profile icons (`public/avatars/*.png`) plus
`avatarIconUrl`.

## Storage layer (`src/lib/storage/`)

**`keys.ts`** — `PROGRESS_KEY = 'football.progress.v1'`. `LEGACY_KEYS` is an empty array today
(no earlier key has ever existed) but is the designated hook for a future key rename — the
comment on this file is a hard rule: never change `PROGRESS_KEY` without adding the old key here
and a migrator.

**`migrate.ts`** — two independent migration ladders:
- Per-user `Progress` (`migrateProgress`, gated by `schemaVersion`): array of `{from, to,
  migrate}` steps applied in sequence; unknown/missing versions fall back to merging onto
  `DEFAULT_PROGRESS` rather than throwing, so corrupt/ancient data still loads with sane
  defaults instead of crashing.
- Outer `Vault` (`migrateVault`, gated implicitly by shape-sniffing): detects whether the raw
  blob already looks like a `Vault` (`{users: {...}}`), looks like a bare legacy v1 `Progress`
  object (has `currentStreak`/`seenVideoIds`/etc. at the top level — wrapped under the synthetic
  id `'default'`), or is neither (fresh `DEFAULT_VAULT`). The rename from `'default'` to a real
  content user id happens later, in `progressStore.reconcileWithContent`, once the content file's
  user list is known.

**`progress.ts`** — `load`/`save`/`reset` against `localStorage`, with a `safeStorage()` in-memory
fallback for non-browser environments (tests, SSR). `load` **never throws**; malformed JSON comes
back as `{ vault: DEFAULT_VAULT, corrupted: true }` so the UI (Settings screen) can offer
import/reset instead of silently wiping history. `save` retries once with each user's `history`
trimmed to the last 200 entries on `QuotaExceededError`.

**`portability.ts`** — the export/import ("sync") mechanism:
- `exportToBlob` — the whole `Vault` (all users) as a dated `.json` Blob.
- `parseImportedText` — forgiving parse: accepts either vault or legacy single-user shape,
  requires at least 2 recognizable field names as a sanity check before accepting.
- `mergeVault`/`mergeProgress` — non-destructive merge across two vaults, per-user: **max**, not
  sum, of streak/points/longest-streak (so merging never double-counts); union of
  `seenVideoIds`; history de-duped by `(date, mode, startedAt)` and re-sorted; the fresher (later
  local-date) `drillDay` wins so today's in-progress goal survives a same-day merge; local
  `avatarIcon` wins over the import's. `activeUserId` always comes from the *local* vault so
  importing never silently switches which profile is showing.

## Zustand stores (`src/store/`) — the only place domain logic touches React

**`contentStore.ts`** — thin wrapper around `fetchContent`: `status` (`idle`/`loading`/`ready`/
`error`), `content`, `error`, `load`/`refetch`. `getUser(content, userId)` is the one lookup
helper every screen uses to resolve the active user.

**`progressStore.ts`** — owns the `Vault`, the `activeUserId`, and a `progress` field that is
always a *view* onto `vault.users[activeUserId]` (kept in sync by every mutator, never derived
lazily). Every mutation goes through `commitActive`/`persistVault`, which writes the new vault to
`localStorage` on every call (there is no debouncing/batching — writes are cheap JSON blobs).
Notable methods and what they encode:
- `hydrate()` — load from storage; called once on boot, before content is known.
- `reconcileWithContent(users)` — called once, right after content first loads: ensures every
  content user has a `Progress` slot, migrates the legacy `'default'` slot into the first real
  user id (without clobbering an existing slot at that id), falls back to the first user if
  `activeUserId` doesn't match anyone in content, and runs `evaluateOnLaunch` on the (now
  resolved) active user.
- `switchUser(userId)` — also re-runs `evaluateOnLaunch`, because a user who wasn't active at
  midnight would otherwise show a stale streak until the next full app launch.
- `creditDailyCategory(...)` — marks one category done, checks whether *all* categories are now
  done (crediting the streak via `applyDailyCompletion` only then), appends the history entry
  with `completedDaily` set accordingly, and folds any overshoot time into today's `extraMs`
  tally. Returns whether the whole daily goal is now complete (drives the SessionComplete screen's
  branching).
- `bankExtraTime(...)` — extra/manual sessions: awards points, adds to today's `extraMs`, appends
  history.
- `recordDrillFinished(...)` — persists that one specific drill-timer index on one video finished
  today (idempotent — re-finishing the same index is a no-op), accumulating `drillDay.practiceMs`.
  This is what lets a user quit mid-drill and resume later without losing credit.
- `buyFreeze`, `replaceVault`/`mergeVault` (Settings import), `resetActiveUser` (wipes one user's
  `Progress` back to `DEFAULT_PROGRESS`, leaves other users and all content untouched),
  `setAvatarIcon`.

## Screens (`src/screens/`) — one per route, wired in `App.tsx`

`App.tsx`'s `Boot` component hydrates progress and loads content in parallel on mount, then runs
`reconcileWithContent` exactly once (guarded by a ref) as soon as content arrives; it renders a
loading state, the `ErrorScreen` on content failure, or the router.

- **`/` → `ProfileSelect`** — Netflix-style avatar grid, one tile per content user; picking one
  calls `switchUser` and navigates to `/home`. A pencil badge opens `IconPickerModal` to assign
  one of the 21 avatar PNGs (or clear back to the initial-letter fallback) — this works for any
  user, not just the active one.
- **`/home` → `Home`** — streak flame, points, freeze count, one folded daily-progress bar
  (`dailyGoalProgress` across all categories), today's extra-time tally, and the primary
  Start-daily-session action (as the bottom dock's raised center button on phones, an inline
  button with a live-progress fill on desktop/tablet).
- **`/session/:mode` → `SessionScreen`** — the core loop; `:mode` in the URL is vestigial (kept
  for old deep links) — the actual mode is derived from query params: `?video=` picks manual mode
  for one specific video, `?cat=` deep-links a category (otherwise the in-screen `CategoryPicker`
  asks first when a user has more than one practiceable category), `?lib=1` is "library mode" —
  just play the clip, no drill timers, no time tracked at all (used by the Library's Play button).
  See "Core session mechanics" below — this file is the most stateful/subtle one in the app.
- **`/session/complete` → `SessionComplete`** — reads results from query params
  (`mode`/`ms`/`pts`/`cat`/`all`), fires `Confetti`, and branches copy/CTA on whether this was a
  full daily-goal completion, a single-category completion with categories still remaining
  (offers a "Next: {category}" button), or an extra/manual session (shows points earned).
- **`/library` → `Library`** — read-only list of every video, grouped by category, each row
  showing seen/new status and a Play button that opens the session in library mode
  (`?video=…&lib=1`).
- **`/shop` → `Shop`** — spend points on a streak freeze; disabled at `maxFreezesHeld` or
  insufficient points, small celebratory pulse animation on success.
- **`/settings` → `Settings`** — shows all content users + their per-user stats (read-only,
  content itself is edited on GitHub), the raw content `settings` values, a re-fetch-content
  button, vault export/import (with a Replace vs Merge modal), and a danger-zone reset scoped to
  the active user only.
- **`ErrorScreen`** — shown when content fails to load/parse/validate; headline+hint keyed by
  `ContentError.kind`, shows the raw parser message, offers Retry.

## Core session mechanics (deep dive — `SessionScreen`)

This is the file most likely to bite a future change, so the invariants are worth stating
explicitly:

- **Practice time is driven by drill timers, not a running clock.** `DrillTimers` (in
  `DrillTimer.tsx`) reports a live *sum* of all its child timers' contributions via
  `onElapsedChange`; `SessionScreen` feeds that straight into `setActiveMs`. A video with no
  configured `timer` falls back to a `requestAnimationFrame` wall clock instead (see the effect
  guarded by `!v.timer`), matching the old auto-run behavior — but **library mode never runs any
  clock at all**, and **daily-mode target-completion is driven exclusively by the drill timers**
  (`targetMs != null` disables the wall-clock fallback even for untimed videos, intentionally).
- **Auto-end is held while a drill is mid-run.** `tickDaily` would normally close the session the
  instant `totalPracticeMs >= targetMs`, but `handleDrillActiveChange`/`drillActiveRef` suppress
  that call while any timer is running/paused, so a goal reached mid-drill shows a banner
  ("finish the running drill to wrap up") instead of yanking the video away; the auto-end fires
  the moment the running timer finishes or is reset.
- **A completed category still opens the same flow, but as an "extra" session.** If
  `isCategoryComplete` is already true when a category is picked, `sessionMode` is downgraded from
  `'daily'` to `'extra'` (no target, stopwatch semantics, timers rerun freely, banks into points +
  `extraMs` on Stop) rather than blocking the category entirely.
- **Daily sessions resume, they don't restart.** `baselineMs` seeds from
  `categoryPracticeMs(progress.drillDay, todayISO, category)`, and `finishedSnapshotRef` snapshots
  which timer indices were already finished today for the *current* video so `DrillTimer`
  instances start in the "done" (but re-runnable) state without double-crediting. The snapshot is
  deliberately frozen per video-visit (not recomputed on every store update) — recomputing live
  would retroactively mark an in-progress rerun as "already counted" and drop its contribution.
- **`handleTimerFinished` persists per-timer-index completion** via `recordDrillFinished`, which
  is idempotent per `(videoId, timerIndex)` per day — this is what makes cross-visit resumption
  and cross-video-recycling-within-a-category safe.
- **Manual/Library plays draw from the whole user library**; daily/extra draw from just the
  active category's videos.
- **Video selection** always goes through `pickNextVideo`/`markSeen`/`advanceCycle` — never pick a
  video ad hoc, or the unseen-pool/cycle bookkeeping in `progressStore` will drift out of sync
  with what was actually shown.

## Components (`src/components/`)

- **`VideoPlayer.tsx`** — platform dispatch: YouTube uses the real IFrame Player API (loaded
  once, globally cached as `ytApiPromise`) so `onEnded` fires from `PlayerState.ENDED` — this is
  the only platform where "watch phase" can auto-advance. Instagram/TikTok/other are opaque
  iframes that cannot reliably report completion, so they render a manual "Done watching → start
  practice" button instead (only shown when `loop` is false — during the drilling phase, embeds
  loop instead). YouTube Shorts (`isYouTubeShort`) get a portrait 9:16 frame instead of 16:9 so
  they don't letterbox. An 8-second watchdog timer calls `onLoadError` if nothing signals success,
  surfacing the Skip UI.
- **`DrillTimer.tsx`** — `DrillTimer` is one countdown (idle → running ⇄ paused → done → rerunnable);
  `DrillTimers` renders one per `timerTitles` entry (or a single unlabeled one when a video has
  just a bare `timer` and no titles) and aggregates them: only one timer may run at a time (the
  others show `locked`, with a shake animation on a blocked tap), and it reports the aggregate sum
  (for session practice time), the aggregate "all done at least once" flag (gates whether "Next"
  needs a confirmation), and per-finish events (for persistence). A `preCounted` timer starts
  already in the `done` state contributing 0 live time, because its earlier completion is already
  folded into the session's `baselineMs`.
- **`PracticeClock.tsx`** — presentational only; never derives elapsed time itself, just formats
  whatever `elapsedMs` it's given and force-renders on `requestAnimationFrame` while `running` so
  the parent's `Date.now()`-based math visibly ticks. Exports `formatClock` (mm:ss / h:mm:ss),
  reused by `DrillTimer`.
- **`BottomDock.tsx`** — phone-only (`lg:hidden`) bottom nav with a raised center Start button;
  desktop/tablet screens render equivalent actions inline instead (see each screen's `hidden
  lg:grid` blocks).
- **`chime.ts`** (in `lib/`, not `components/`, but tightly coupled to `DrillTimer`) — synthesizes
  a two-note-plus-octave bell arpeggio via Web Audio, no audio asset. Because a drill timer
  finishes long after any user gesture, a single shared `AudioContext` is created/unlocked
  (`unlockChime`) *inside* the Start/Resume tap handler and reused when the timer later fires
  (`playFinishedChime`) — this is required for the sound to be allowed to play at all on mobile
  browsers.
- **`Button.tsx` / `Icon.tsx` / `Modal.tsx` / `ProgressRing.tsx` / `StreakFlame.tsx` /
  `Confetti.tsx` / `IconPickerModal.tsx`** — standard presentational primitives; no domain logic.

## PWA / build (`vite.config.ts`)

- `__APP_VERSION__` is injected at build time from `package.json`'s `version` field and rendered
  as the small bottom-left version badge in `App.tsx` — **`AGENTS.md` mandates bumping this via
  `npm version <patch|minor|major> --no-git-tag-version` on every change**, so a stale-looking
  version badge in the deployed app is a real signal, not cosmetic.
- `vite-plugin-pwa` precaches the app shell cache-first, but explicitly denylists
  `/content.json` from the navigate fallback and instead serves it `NetworkFirst` with a 3s
  timeout — this is what lets a `content.json` hand-edit on GitHub show up after redeploy without
  waiting for a service-worker cache-bust. The service worker never touches the
  `football.progress.v1` localStorage key.
- Manifest is `display: 'standalone'`, `orientation: 'portrait'` — this is a portrait-first app;
  landscape/desktop layouts (the `lg:` breakpoints scattered through screens) are a secondary,
  later-added responsive treatment, not the primary target.

## Testing (`tests/`, Vitest)

Tests target the **pure domain layer** almost exclusively (`categories`, `selection`, `session`,
`streak`, `progressStore`, `migrate`, `portability`, `url`/content-schema) plus one DOM test for
`DrillTimer`. When changing domain logic, run `npm test` — it's fast (jsdom, no real network/
storage) and is the primary correctness net for this app; there is no E2E/browser test suite.

## Conventions worth preserving

- Keep domain logic (`src/lib/domain`) free of React and I/O; it should stay trivially
  unit-testable. New game-rule logic belongs there, not inline in a screen or store.
- Never invent a video/user id — always derive via `hashUrl`/`slugifyUserId` so content edits stay
  non-destructive to progress.
- Never mutate `Progress`/`Vault` in place; every store mutator builds a new object and routes
  through `commitActive`/`persistVault` so the localStorage write and the React state update never
  drift apart.
- Any change to what's stored under `PROGRESS_KEY` needs a bump to `CURRENT_SCHEMA_VERSION` (or
  `CURRENT_VAULT_VERSION`) plus a migrator in `migrate.ts` — never a silent shape change, and
  never a key rename without adding the old key to `LEGACY_KEYS`.
- Any change to `public/content.json`'s shape needs a matching update to `content.schema.json`
  (validated per `AGENTS.md`) **and** to `validateContent` in `src/lib/content/schema.ts` — the
  JSON Schema file documents the shape for humans/editors, but the hand-written validator is what
  actually runs.
