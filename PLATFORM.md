# PLATFORM.md — what Devvit really allows

Results of the Milestone 1 platform spike, run Nov 12, 2026 in r/lumen_game_dev with app
`lumen-game` v0.0.1.x (Devvit SDK 0.15.2, playtest build). Tested by u/Dry_Promotion2506 on
desktop Chrome 158 (macOS) and the Reddit iOS app (iPhone, iOS 18.7). The spike code lives on
branch `spike/platform` and is not merged.

**Trust this file over SPEC.md and over memory.** Everything here was observed, not read in docs,
unless it says "docs".

## The six questions

| # | Question | Answer | Approach to build |
| --- | --- | --- | --- |
| 1 | Can a snoovatar be shown in the webview? | **Yes**, and it can be a WebGL texture | Direct image from `i.redd.it` with `crossOrigin = 'anonymous'` |
| 2 | Does a realtime broadcast reach two clients? | **Yes**, in 0.2–0.4 s | `realtime.send` / `connectRealtime`, channel `sky_{day}` |
| 3 | Does `setUserFlair` work for the app? | **Yes**, with emoji | Call on each ranked solve; ignore failures |
| 4 | Comment as the user under a stickied comment? | **Yes on iOS; failed once on desktop** | Sticky at post creation; reply with `runAs: 'USER'`; handle failure gracefully |
| 5 | Does a cron task fire? | **Yes**, but a tick can be skipped | Idempotent handler plus the mod menu fallback |
| 6 | Are Journeys events accepted? | **Valid, but never recorded in playtest** | Instrument now; verify on the first published version |

## 1. Snoovatars

- `context.snoovatar` (client, from `@devvit/web/client`) is the current user's snoovatar URL:
  `https://i.redd.it/snoovatar/avatars/<uuid>.png`, 380 x 501 px, about 69 KB. It is `undefined`
  when the account has no avatar. The test account had none at first, so **the no-avatar case is
  ordinary**, not an edge case. The glyph fallback is a first-class path.
- `<img src>` straight from that URL loads under the webview's CSP, on desktop and iOS.
- A plain `<img>` taints a canvas (`SecurityError` on `getImageData`). The same URL loaded with
  `image.crossOrigin = 'anonymous'` is readable. **So a snoovatar can be a Three.js texture**
  as long as the loader sets `crossOrigin`. No overlay workaround is needed (PROMPT D5 fallback
  is not required for the sky).
- Server `reddit.getSnoovatarUrl(username)` returned `undefined` for several minutes after the
  avatar was created, while `context.snoovatar` already had it. Later it returned the same URL.
  **Do not rely on the server lookup being fresh.**
- Server `fetch()` of the `i.redd.it` URL worked with no `permissions.http` entry, and a data URL
  built from it (91 KB of text) displays and is pixel-readable. Works, but is not needed.

**Build:** on a ranked solve the client sends its own `context.snoovatar` with the submission.
The server accepts it only if it is an `https://i.redd.it/snoovatar/` URL, stores it with the sky
lantern and leaderboard row, and falls back to `reddit.getSnoovatarUrl` and then to the glyph.
Other players' lanterns load that URL directly as a texture. Budget: a 380 x 501 PNG per lantern
is too much for 300 lanterns, so the sky draws snoovatars only for the nearest few (count in
`config.ts`), downscaled into one shared atlas, and glyphs or plain lanterns for the rest.

## 2. Realtime

- Server `realtime.send(channel, json)` reaches every connected client. Phone tap to desktop
  screen: 206 ms and 312 ms. Server to same device: 193–392 ms. Tap to own screen (round trip
  through the server): 494–665 ms. All well inside the 2 s target.
- **Channel names may contain only letters, digits and underscores.** A hyphen makes
  `connectRealtime` throw synchronously, which kills any code after it in the module.
  SPEC's `sky-{day}` is invalid; use `sky_{day}`. Always wrap `connectRealtime` in try/catch.
- `connectRealtime` returns immediately; `onConnect` fires shortly after. It worked in inline and
  expanded modes, on desktop and iOS.
- Needs `"permissions": { "realtime": true }`.

## 3. Flair

- `reddit.setUserFlair({ subredditName, username, text, backgroundColor, textColor })` worked from
  the app account in its own subreddit, including an emoji in the text ("Lamplighter 🔥29").
- No extra permission was needed in `devvit.json` beyond the default Reddit API access; the app
  account is a moderator of the subreddit it is installed in.
- Not tested: a subreddit where user flair is disabled. Treat every call as fallible.

## 4. Comments

- App account: `reddit.submitComment({ id: postId, text, runAs: 'APP' })` then
  `comment.distinguish(true)` created and stickied the results comment. Author: `lumen-game`.
- User account: `reddit.submitComment({ id: stickyCommentId, text, runAs: 'USER' })` posted a reply
  under the sticky, authored by the player (`Dry_Promotion2506`), from the Reddit iOS app.
  Emoji and a two-line body came through.
- **The same call failed once on desktop web, earlier**, with
  `INVALID_ARGUMENT: failed to mint edge context: ... refresh token does not exist`.
  It was the first user action after `asUser` was added to the app. Cause not established: it may
  be a first-use or desktop-session condition. Not re-tested on desktop after the iOS success.
  **Open item for Milestone 5: re-test on desktop and Android.** Either way the Share button must
  show a calm failure line ("Could not post. Try again from the Reddit app.") and never block.
- Needs `"reddit": { "asUser": ["SUBMIT_COMMENT"] }`.
- Docs, not observed: until the app version is approved, `runAs: 'USER'` posts as the app account
  for anyone who is not the app owner. Only the owner was tested. This is why the app goes to
  review on Nov 17–18 (PROMPT D3).

## 5. Scheduler

- A task declared in `devvit.json` with `"cron": "*/1 * * * *"` and an `/internal/scheduler/...`
  endpoint started firing within a minute of upload, with no further setup.
- Over ten firings one minute was skipped (22:59, then 24:59). **Cron is not exactly-once.**
  The daily-post handler must be idempotent and must also catch up: if today's post is missing
  when any request arrives after 00:00 UTC, the mod menu action (and a second cron a few minutes
  later) creates it.
- Removing a cron task from `devvit.json` does not cancel it (docs). Observed fix:
  `scheduler.listJobs()` then `scheduler.cancelJob(id)` from inside the handler stopped it.
  The spike's job has been cancelled.

## 6. Journeys

- All five calls (`appReady`, `startJourney`, `journeyProgress`, `journeyInteraction`,
  `endJourney` with `complete` and `game { win, score }`) were accepted as valid and returned
  `JOURNEY_RECEIPT_DENIED_PLAYTEST`: "Journey telemetry is not recorded for playtest app
  versions." So **nothing can be verified until a version is published.** A second reason to
  publish early. After publishing expect `DENIED_NOT_ALLOWLISTED` until Reddit approves the
  journey map, then `VALID`.
- Needs `"permissions": { "journeys": true }` and the `@devvit/analytics` package (0.15.2).
- `journeyInteraction` requires `actionDetails` (a string) in this SDK version, even if empty.
- The package's ready-made route adapter (`createTelemetryRouter`) is an **Express** router. This
  repo uses Hono. Two workable routes: call the server `telemetry` client from our own Hono routes
  (used in the spike), or write five small Hono routes at the paths the client helper expects
  (`/journey/start`, `/progress`, `/interaction`, `/end`, `/app-ready`). Decide in Milestone 5.
- The client helper keeps the journey ID in `sessionStorage`. See "Storage" below: on iOS that
  does not survive the move from the feed view to full screen, so `Journey.Start` fires in the
  expanded game view, after the Play tap, not in the preview.

## Other things observed

### View sizes (CSS pixels)

| Device | Mode | Viewport | Screen | Pixel ratio |
| --- | --- | --- | --- | --- |
| iPhone, Reddit iOS app | inline, `height: tall` | 398 x 512 | 430 x 932 | 3 |
| iPhone, Reddit iOS app | expanded | **430 x 701** | 430 x 932 | 3 |
| Desktop Chrome | expanded (modal) | 375 x 596 | 1470 x 956 | 2 |

- **Expanded mode is not full screen.** Reddit's top and bottom bars take about 230 px on a
  932 px phone. The game must fit 430 x 701 there, and proportionally less on a 360 x 640 phone
  (expect roughly 360 x 410–480). Camera framing and the two bars are designed for that, and
  measured at run time, never assumed.
- **Update Nov 15:** Maulik's desktop test of v0.0.1.48 showed the expanded view as a wide
  dialog (about 1100 px, with a size selector reading "Desktop"), and the landscape layout
  switched on there. The 375 px measurement below was the dialog's phone size.
- Desktop expanded is a phone-shaped modal, 375 px wide (measured Nov 12, Chrome, as the app
  owner). The phone layout serves it.
- **Landscape layout (added Nov 15).** The game measures its view and switches to a landscape
  layout when it is at least 760 px wide and 1.2 times wider than tall (`VIEW.wideMinWidth`,
  `VIEW.wideMinAspect`): bars centred, result card and lists in a right-hand column, island
  framed in the rest. Checked locally at 1100 x 700. **It does not trigger in a 375 px modal.**
  Whether Reddit ever gives the expanded view more width on desktop (a larger modal, a
  fullscreen control; `devvit.json`'s schema speaks of entry points "opened fullscreen") is
  **not known**: Claude cannot open reddit.com.
- **What a normal user sees on desktop: NOT YET CHECKED.** To check, Maulik opens the post in a
  private window with a second, non-moderator account (and once signed out) and notes: (1) is the
  playtest version's post visible at all to them; (2) the feed card's size and whether "Light the
  lanterns" opens the modal; (3) the modal's size (a screenshot is enough) and whether it can be
  enlarged; (4) signed out: does the game play, and what does Lock in say. Results go here.
- WebGL2 is available on both. Max texture 16384. Pixel ratio 3 on the phone, so the cap of 2 in
  the performance budget matters.

### Storage between views

| | Desktop | iOS app |
| --- | --- | --- |
| `sessionStorage` written inline, read expanded | carried | **not carried** |
| `localStorage` written inline, read expanded | carried | carried |

Never pass state between the preview and the game through `sessionStorage`. Use the server.

### Reduced motion

The test phone reports `prefers-reduced-motion: reduce`. Real players have this on. The
reduced-motion variants of nightfall and the lantern release are a main path, and Maulik's own
phone will show them unless the setting is turned off for testing.

### Post data and context

- `submitCustomPost({ postData })` round-trips: the object was readable as `context.postData` on
  the server and the client, in both modes. Key order is not preserved.
- `context.userId` (`t2_...`), `context.username`, `context.postId` (`t3_...`) and
  `context.subredditName` were present for a logged-in user on client and server.
- `requestExpandedMode(event, 'entryName')` opened a different entry from the inline view. Two
  entry points may point at the same HTML file.
- A menu action's `navigateTo` must not use the `t3_` prefix in a `/comments/` URL: the page
  failed to load (`ERR_HTTP2_PROTOCOL_ERROR`). Strip the prefix or use the post's `permalink`.

### Tooling

- The Devvit CLI login token expired within a few hours and `devvit playtest` failed with
  `401 Unauthorized`. `npx devvit login` fixes it. Expect this at the start of a session.
- The app name `lumen` was taken; the app is `lumen-game`. The playtest subreddit is
  `r/lumen_game_dev` (set in `devvit.json` under `dev.subreddit`).
- Node 22.18 builds and runs; the CLI prints a warning recommending Node 24.
- The server bundle built and ran with `@devvit/analytics` and its Express dependency included.

## Not tested yet

| Item | Why it matters | When |
| --- | --- | --- |
| Android (Reddit app webview) | Performance target device; WebGL, pixel ratio, viewport | Before Milestone 3 exit |
| Logged-out viewer | `context.userId` absent; play must still work | Milestone 5 |
| Second account: `runAs: 'USER'` falls back to the app account | Confirms the docs; affects two-phone test | Milestone 5 |
| Comment as user on desktop web, second attempt | One failure seen | Milestone 5 |
| Small phone (360 x 640) expanded viewport | Layout floor | Milestone 3 |
| Journeys receipts on a published version | Only then are events recorded | After publishing |
| Realtime with many clients, message size and rate limits | Shared sky at scale | Milestone 5 |

## Added Nov 13

- `devvit playtest` uploads whenever its watched output folders change, with no wait for the
  build to finish after the first one. Vite's `emptyOutDir` makes every rebuild start by deleting
  the output, so an upload can catch an empty dist/client: the post then shows
  "Not Found: failed to get webview assets ... preview.html" (seen on v0.0.1.14). Fixed by
  building into a staging folder and publishing only checked builds (see CLAUDE.md).
- `devvit upload` stops if `scripts.build` exits non-zero ("scripts.build failed"), so a check
  appended to the build command blocks a bad upload.
- iOS Safari only lets an AudioContext start or resume inside a touchend/pointerup/click, not a
  pointerdown/touchstart; after the phone is locked the context is "interrupted" and needs a new
  gesture.
