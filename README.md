# Soccr — Football Training PWA

Watch a short football skill video, then physically drill the move. Only your **real practice time** counts toward a daily 20-minute goal, which drives a Duolingo-style streak, points, and streak-freezes.

Mobile-first, dark, installable to your phone home screen. No server, no accounts.

## Stack

React 18 · TypeScript · Vite · Tailwind · Framer Motion · Zustand · vite-plugin-pwa · Vitest.

## Local development

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # Vitest — 69 unit tests over the pure domain layer
npm run build        # tsc -b + vite build → dist/
npm run preview      # serve the production build locally
```

Prerequisites: Node ≥ 20.

## Deploy to Netlify

1. Push this repo to GitHub.
2. In Netlify → **Add new site → Import from GitHub**, pick this repo.
3. Netlify detects `netlify.toml`; the build command (`npm run build`), publish directory (`dist`), and SPA redirect are already configured.
4. Click Deploy. On success, open the site.

Every future change (video edit, code change, whatever) auto-redeploys on push. The site is a static bundle — no backend to configure.

## Install as a PWA on a phone

**Chrome on Android**

1. Open the deployed URL.
2. Chrome menu (⋮) → **Add to Home screen** → **Install**.
3. Launch from the home screen. It opens standalone (no address bar).

**iOS Safari** (works, but Chrome-on-iOS uses Safari under the hood)

1. Open the URL in Safari.
2. Share (⤴︎) → **Add to Home Screen**.

The service worker precaches the app shell, so subsequent launches are instant and work offline (except for streaming video, which obviously needs a connection).

## Editing videos and settings — `public/content.json`

Everything the app displays and every runtime setting is driven by a single file: `public/content.json`. Edit it on github.com in your browser, commit, wait ~30s for Netlify to redeploy, hard-reload the app.

You never invent an ID. The app derives a stable internal ID by hashing the video's normalized URL — so **adding, removing, or reordering entries never disturbs any other video's identity**, and your progress against those videos is unchanged.

### Full example

```json
{
  "settings": {
    "sessionTargetMinutes": 20,
    "pointsPerExtraMinute": 10,
    "freezeCostPoints": 100,
    "maxFreezesHeld": 1,
    "recycleWhenLibraryExhausted": true
  },
  "videos": [
    { "url": "https://www.youtube.com/watch?v=BSKlAB_iH1Q", "title": "Elastico drill" },
    { "url": "https://www.instagram.com/reel/CxYz1_abc/",   "title": "Cruyff turn" },
    { "url": "https://www.tiktok.com/@user/video/1234567890", "title": "La Croqueta" }
  ]
}
```

### To add a video

Add one object to `videos`:

```json
{ "url": "https://www.youtube.com/watch?v=NEW_ID", "title": "What the drill is" }
```

Platform (YouTube / Instagram / TikTok / other) is auto-detected from the URL. `title` is optional (defaults to a derived label). Tracking query params (`utm_*`, `fbclid`, `igshid`, YouTube `t=`, etc.) are stripped before hashing, so the same clip pasted twice with different share-links produces the same ID and is treated as one video.

### To change a setting

Edit the number in `settings`. All settings are read at runtime — no code change needed:

| Setting | Meaning |
|---|---|
| `sessionTargetMinutes` | Daily goal (in minutes) that credits the streak |
| `pointsPerExtraMinute` | Points earned per minute of Extra Time practice |
| `freezeCostPoints` | Cost of one streak freeze in the shop |
| `maxFreezesHeld` | Cap on freezes on hand at once (the shop disables Buy at cap) |
| `recycleWhenLibraryExhausted` | When true, once every video has been watched the pool recycles randomly |

### Common errors

If `content.json` has a typo or wrong shape, the app shows a friendly error screen (not a blank page or raw exception) with the parser's message and a Retry button. Fix the file on GitHub, redeploy, retry.

## Collaborating

Anyone with **write access to the repo** can edit `public/content.json`. Add a collaborator on GitHub, or fork the repo and connect the fork to your own Netlify site. The app has no server, so there's nothing else to coordinate.

## Data — how your progress is stored

There are exactly two data stores:

1. **Content** — `public/content.json`, edited by hand on GitHub. Static, versioned, deployed with the app.
2. **Progress** — `localStorage` under `football.progress.v1`. Personal to the device.

The join between them is a URL-hash ID. When you edit `content.json`, no progress is ever wiped:

- Adding a video introduces a new hash ID that isn't in your `seenVideoIds` yet — it appears as new.
- Removing a video leaves an orphan ID in `seenVideoIds`; the app ignores it. Your streak, points, and history are untouched.
- Reordering does nothing (order isn't part of the hash).
- Schema changes are handled by an in-place migrator that preserves all your data (see `src/lib/storage/migrate.ts`).

The service worker **never** touches the progress key.

### Export / Import (the sync mechanism)

Since there's no server, cross-device sync is manual and explicit:

1. On device A → **Settings → Export progress**. Save the `soccr-progress-YYYY-MM-DD.json` file.
2. Get it onto device B (AirDrop, email, cloud).
3. On device B → **Settings → Import…** → pick the file. Choose:
   - **Replace** — overwrite device B's progress with the file's exactly.
   - **Merge** — take the higher streak / points / longest, union the seen-videos, concatenate history (deduped).

Malformed files are rejected with a clear inline error.

## Streak rules

- Completing a Daily Session on a given local calendar day credits `+1` to your streak. Multiple sessions in one day don't stack.
- On app launch, the gap since your last completed day is evaluated:
  - Same day → nothing.
  - Completed yesterday, today not done yet → still fine.
  - **Missed exactly yesterday** with a freeze on hand → the freeze is auto-consumed, streak preserved, banner: "❄︎ A freeze saved your streak."
  - Missed yesterday with no freeze → streak resets.
  - Missed two or more days — freezes do **not** rescue this. Streak resets.

### Timezone

Streaks use the **device's local calendar day** (`Date`'s local year/month/day). If you fly across a timezone, your day flips when your device's clock flips. This is intentionally simple: it means you never have to configure a timezone, but it also means the app can't distinguish "same day" from "day-boundary just crossed" more cleverly than the OS does.

## Core loop

Every round:

1. **Watch** — a video plays. **No clock runs.** This is the most important rule in the app.
   - YouTube: end-of-playback is auto-detected via the IFrame Player API.
   - Instagram / TikTok / other: press the big **Done watching → start practice** button (their embeds don't reliably report end).
2. **Practice** — the huge clock starts, counting real practice time from `Date.now()` timestamps (so a backgrounded tab stays accurate).
3. **Next** — bank this round's practice time, load a new video, go back to step 1.

**Daily** mode has a countdown target and auto-ends the instant total practice reaches it. **Extra Time** is a stopwatch you stop yourself; time × `pointsPerExtraMinute` = points earned. **Manual pick** from the Library plays a specific video and behaves like Extra Time.

## Scripts

- `npm run dev` — Vite dev server (HMR).
- `npm run build` — TypeScript check + production build.
- `npm run preview` — serve the built site.
- `npm test` — run all Vitest specs (69 tests over the pure domain layer).
- `node scripts/generate-icons.mjs` — regenerate `public/icon-192.png` and `public/icon-512.png` from raw pixel data (no image tools required).

## Repo layout

```
public/
  content.json          # hand-edited on GitHub — the only content source
  icon-{192,512}.png    # PWA icons
  favicon.svg
src/
  lib/
    content/            # URL normalization + hash + fetch + schema
    domain/             # Pure TS: selection, session, practiceClock, streak
    storage/            # localStorage load/save/migrate + export/import
  store/                # Zustand stores wrapping the domain
  components/           # UI primitives
  screens/              # Home, Session, Complete, Library, Shop, Settings, Error
  App.tsx, main.tsx, index.css
tests/                  # Vitest specs
netlify.toml            # build config + SPA redirect
vite.config.ts          # includes vite-plugin-pwa (service worker + manifest)
```

## Verification checklist

- [x] `npm test` — 69 tests, 8 files, all passing
- [x] `npm run build` — zero TypeScript errors, clean production bundle
- [x] SPA redirect and PWA plugin wired up
- [x] `public/content.json` seeded with 3 example YouTube videos
- [x] Progress-preservation test proves content edits don't wipe streaks
- [x] Backgrounded-tab test proves the practice clock stays accurate
