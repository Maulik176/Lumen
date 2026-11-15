# HANDOFF.md — briefs for work Fable is not building

Written Nov 14, 2026. Each brief is complete: goal, files, behaviour, edge cases, tests, and what
"done" means. Read `CLAUDE.md` first (rules, layout, decisions), then the brief. Do one brief per
session. If a brief seems to need a design decision it does not contain, ask Maulik.

Rules that apply to every brief:
- No new look. Reuse `src/client/game.css` (panels, buttons, fonts) and `UI` / `BIOME_LOOK` /
  `LOOK` in `src/shared/config.ts`. Every number goes in `config.ts` with a comment.
- TypeScript strict, no casts, named exports. `npm test`, `npm run test:types`, `npm run lint`,
  `npm run build` must pass. The build check must pass before any upload.
- Copy is one calm line, from `COPY` in `config.ts`. No emoji in the game UI.
- Test at 430x701 and 360x460 with `npm run debug`, and with `?calm=1`.

Order: 1 (feed card) → 2 (Archipelago) → 3 (trailer mode) → 4 (performance). Brief 5 is cut work,
kept only in case there is time after everything else.

---

## Brief 1 · Feed card restyle (`src/client/preview.*`)

**Goal.** The inline card a Redditor sees in the feed. It must paint in under 1 second from the
post's own data, with no request and no Three.js, and score above 80 on Lighthouse mobile. This is
an approval requirement and the first impression.

**Now.** `preview.html`, `preview.ts`, `preview.css` exist with placeholder styling. The post's
data arrives as `context.postData`, read with `readPostData()` from `src/shared/api.ts`
(`day`, `name`, `weekday`, `par`, `lanterns`).

**Build.**
1. Extend `PostData` and `toPostData()` in `src/shared/api.ts` with `biome` and a compact
   silhouette: `rows` exactly as in `PublicIsland` (it is small; the 2 KB post-data limit holds for
   a 9x9: check with a test that `JSON.stringify(toPostData(island)).length < 1800` for all 90 days).
   Sources, lanterns and terrain are all in `rows`; the solution is not, so nothing is spoiled.
2. Draw the island as an inline SVG from `rows`: an isometric diamond grid (tile width 2 units,
   height 1 unit; tile (x, y) centre at `((x - y), (x + y) / 2)`), one polygon per tile coloured
   from `BIOME_LOOK[biome]` (`groundA`/`groundB`, `water`, `rock` for rock, `crown` for tree),
   a small warm circle for each lantern (`LOOK.lanternWarm`, unlit look: 60% opacity) and a bright
   diamond for each sun. No beams. Under it, a darker tapered polygon for the hanging rock.
   Put the drawing function in `src/shared/silhouette.ts` returning an SVG string, pure and tested
   (snapshot for days 1, 5, 12).
3. Layout (height `regular`, about 320 px; must also work at 240 px tall): sky gradient background
   from the biome's dusk colours (`skyTop[1]` to `skyHorizon[1]`), silhouette centred, then
   `Lumen #12 · Thursday` (small caps line), the island name in Young Serif, one line from
   `COPY.previewLine`, the button `COPY.playButton`, and a quiet `par 4` under it.
   On Sundays with a creator, a line "Island by u/name" (field `creator?: string` in `PostData`;
   leave it unused for now).
4. Font: reuse `assets/fonts/young-serif.woff2` with `font-display: swap`; inline all CSS in the
   HTML (`<style>`), so first paint needs one file. Keep `preview.ts` tiny: no imports beyond
   `@devvit/web/client`, `shared/api`, `shared/silhouette`, `shared/config`.
5. After paint, one `fetch('/api/today')` (exists after Milestone 5; until then skip silently on
   failure) fills: streak ("7 days"), "1,284 lanterns tonight" with a strip of up to 24 small warm
   dots, and on a return visit the player's medal plus `COPY.comeBack` in place of the button line.
   Fade these in; never shift layout (reserve the space).
6. `requestExpandedMode(event, 'game')` stays synchronous inside the click handler.

**Edge cases.** No post data (old post): show "Lumen" and the button only. Logged out: same card,
no streak. Very long name: one line, ellipsis. Taps only: no hover-dependent UI, no scroll capture.

**Tests.** `silhouette.test.ts` (snapshots, every tile kind drawn, 4x4 to 9x9 fit the viewBox);
post-data size test for all 90 days; `readPostData` accepts the new fields and old posts.

**Done when.** Lighthouse mobile above 80 on the inline post (method in SPEC, "Inline mode
requirements"), paints from post data with the network blocked, looks like the game.

---

## Brief 2 · The Archipelago as a 2D night map (`src/client/archipelago.*`)

**Goal.** Every past island floats on one night map. Each glows by how many people lit it; yours
show your medal. Tap one to play it unranked. Maulik's decision: a 2D map, not 3D.

**Depends on** Milestone 5 (Redis keys `stats:{day}`, `sub:{day}:{userId}`). Check `PLATFORM.md`
and `src/server/core/` for the real key helpers before starting.

**Server.** `GET /api/archipelago` in `src/server/routes/api.ts`:
returns `{ today: number, days: ArchipelagoDay[] }` where
`ArchipelagoDay = { day, name, weekday, biome, par, rows, solves: number, medal: Medal | null }`
for every day from 1 to today (never future days), newest first. Read `solves` from
`stats:{day}` and the caller's medal from their submission record; one grouped read per kind
(no per-day round trips: use `mGet`/hash reads). Logged out: `medal` is always null. Cache the
solves part for 60 s with the cache helper. Type it in `src/shared/api.ts`.

**Client.** New entry point `archipelago` in `devvit.json` (`archipelago.html`, expanded), opened
from the result card button "Explore the Archipelago" (`requestExpandedMode(event, 'archipelago')`).
- Background: night sky (`skyTop[2]` → `skyHorizon[2]` of today's biome) with CSS stars.
- A vertical scroll of islands in a loose two-column stagger, newest at the top. Each island is
  the silhouette SVG from Brief 1 at about 130 px, with a soft glow behind it whose strength is
  `log(1 + solves)` scaled against the busiest day, the name in Young Serif, `#12 · Thu`, and the
  player's medal as a small word (`COPY.medal*`) if they have one. Today's island is marked
  "Tonight". Weeks are separated by a thin line and the biome's name.
- Tap an island → `location.assign('game.html?day=N&archive=1')`. This stays inside the same
  expanded view and needs no server call. (`requestExpandedMode` cannot carry a day, and nothing
  may be passed through `sessionStorage`: CLAUDE.md rule 8b.) `main.ts` already reads `?day=`.
  Add `archive=1` → unranked: the lock-in request sends `ranked: false`, the server records
  nothing for boards, streaks or the sky, and the result card says "Unranked" under the medal.
- A back control returns to the game's result card: `history.back()`.

**Edge cases.** Day 1 only (launch day): one island, centred, with the line "More islands arrive
each night." 90 days: the list must stay smooth (plain DOM, `content-visibility: auto` on rows).
Request fails: `COPY.loadFailed`.

**Tests.** Route test with `@devvit/test`: never returns future days, medal only for the caller,
logged out works. A DOM-free test of the glow scaling function.

**Done when.** From a result card you can open the map, see every past day with glow and your
medals, tap one, play it, and its result is not on the leaderboard.

---

## Brief 3 · Trailer mode (`src/client/trailer.*`)

**Goal.** One take for the demo video: a scripted camera plays dusk, a solve, nightfall, the
lantern release and a sky full of lanterns, with no interface and no hands. Maulik records the
screen. Dev-only: reachable only by the app owner.

**Build.**
- Entry point `trailer` (`trailer.html`, expanded) and a mod menu item "Lumen trailer" that
  creates a post with `entry: 'trailer'` (see `src/server/routes/menu.ts`). `GET /api/trailer`
  returns `{ ok: false }` unless `context.userId` is the app owner (compare with the subreddit's
  mods via `reddit.getModerators`); the page shows nothing otherwise.
- `trailer.ts` reuses `createIslandView` (`src/client/game/scene.ts`), `startPlay`/`tapTile`
  (`src/shared/play.ts`), `createSound`, and the stored par solution. The server sends the
  solution only on this owner-only route (`islandForDay(day).solution`).
- Script, times in `config.ts` (`TRAILER`): 0 s island at dusk, slow quarter turn (call
  `view.rotate()` once) → 3 s place each solution piece in order, 700 ms apart, by calling the
  same `apply(tapTile(...))` path as the game so sounds and travelling light play (a mirror that
  needs "\" takes two taps 250 ms apart; a prism three) → when all lit, hold 1.2 s → `nightfall`
  → `release` → hold on the sky 4 s → fade to the title "Lumen" in Young Serif with
  "A new island every night." Total under 40 s.
- Use day 12 by default (`?day=`), biome from the island, `teach: false`, the owner's snoovatar
  as rider. Hide all HUD. `?calm=1` must still work.
- Needs the Shared Night Sky from Milestone 5 for "a sky full of lanterns": call the same sky
  module with the real list for that day; if fewer than 40 lanterns exist, the trailer may
  replay the stored list for that day's most active past day. Never invent usernames on screen:
  in trailer mode other lanterns carry no names.

**Tests.** A pure function `trailerSteps(island)` that turns a solution into timed taps: test that
replaying its taps through `play.ts` lights every lantern for days 1, 5, 12.

**Done when.** Opening the trailer post as the owner plays the whole sequence once without input,
and a non-owner sees an empty page.

---

## Brief 4 · Performance tuning

**Goal.** Meet every row of SPEC's performance budget on a real mid-range Android and report the
numbers. Tune, do not redesign.

**Measure first** with `?perf=1` (fps, draw calls, triangles, pixel ratio) in the Reddit app on the
Android phone, and in desktop Chrome with 4x CPU slowdown: island at rest, placing pieces, the
"All lit" prompt, nightfall, the lantern rise, the result card. Write the table into `PLAN.md`
under Milestone 7.

**Levers, cheapest first** (all in `src/client/game/`):
1. `VIEW.maxPixelRatio` / `lowPixelRatio` / `slowFrameMs` / `slowFramesBeforeDrop` in `config.ts`.
2. `antialias` in `scene.ts`: turn off when the pixel ratio is 2 or more.
3. Star count and cloud count in `sky.ts` (move the constants to `config.ts`).
4. Lantern light spill (`lanterns.ts`): one flat disc per lantern; drop it under a config flag
   `VIEW.lightSpill` when the adaptive drop has triggered.
5. The beam shader (`beams.ts`): the shape drawing is the costly part; skip it for white light
   already (it is), keep it for colours.
6. Render on demand: the loop renders every frame. When nothing animates (no float in calm mode,
   no travelling light, lanterns settled) skip `renderer.render`. Keep it simple: a `dirty until`
   timestamp extended by any change and by `!calm`.
7. Bundle: `npm run build`, check `dist/client/game.js` gzipped (now 155 KB; budget 450 KB).

**Do not** add shadows, post-processing or real-time lights, or change geometry counts upward.

**Also check.** No allocations per frame: record a 10 s Performance profile on desktop during
play and during the lantern rise; the JS heap should not saw-tooth. Known offenders to fix if they
show: none measured yet. WebGL context loss: `scene.ts` prevents the default but does not rebuild;
on `webglcontextrestored`, reload the page (`location.reload()`), which is acceptable.

**Done when.** A table of measured numbers per budget row, 60 fps typical and never under 45 on
the Android phone, and no change to the look that Maulik can see.

---

## Brief 5 · Island Builder and the Sunday community island (CUT)

**Status.** Cut on Nov 14 by Maulik. Sundays use the generated `sunday` template
(`GENERATOR.templates.sunday`), which is already in `content/puzzles.json`. Build this only if
Briefs 1 to 4 and all of Fable's work are finished and Maulik says go.

**Goal.** A player builds an island, the server proves it solvable and sets par, it posts from the
player's account, and each Saturday the best one of the week becomes Sunday's island.

**Client** (`src/client/builder.*`, entry point `builder`, expanded): a 2D grid editor reusing the
silhouette drawing from Brief 1 at full size. Size picker 5 to 8. A palette of six tools: sun
(tap again to turn it), lantern (tap again to cycle its colour, with the shape badge), rock, tree,
water, eraser. Inventory steppers for mirrors (1–8) and prisms (0–2). A name field, 24 characters,
letters, digits and spaces only. A "Check" button calls the server; the result line shows
"Solvable in 4" or the refusal. "Publish" appears only after a successful check of the current
board. Limits from `BOARD` in `config.ts`.

**Server.** `POST /api/islands/check { puzzle }` → `validatePuzzle` (`src/shared/validate.ts`),
then `solve(puzzle, { nodeLimit: SOLVER.builderNodeLimit })`. `limit` → refuse with
`COPY.builderTooComplex`. `unsolvable`, par 0, or `solutionCount` above
`GENERATOR.maxMinimumSolutions` → refuse with a one-line reason. Return par and the difficulty
score (`rateDifficulty`, decoys 0). `POST /api/islands { puzzle, name }` re-runs the check (never
trust the client's), then `reddit.submitCustomPost({ runAs: 'USER', userGeneratedContent: { text:
name }, entry: 'default', postData: {...} })`, stores `island:{postId}` (puzzle text, par,
creator username) and adds the post to `islands:week:{n}` (sorted set, score 0). Cap: 3 per user
per week (`islands:count:{week}:{userId}`). Remember `runAs: 'USER'` only works for everyone once
the app version is approved (PLATFORM.md).

**Sunday pick.** Scheduler task `sunday-pick` (`0 20 * * 6`): for each post in this week's set,
read its Reddit score; take the highest whose difficulty is inside
`GENERATOR.templates.sunday.difficulty` and whose par is inside `.par`; write it as Sunday's
island (`puzzle:override:{day}`) with `creator`, and set the creator's flair to "Islandwright".
None qualifies → do nothing; the generated Sunday stays. Idempotent.

**Play.** `/api/island` must serve `island:{postId}` for builder posts (unranked) and the
override on Sundays (ranked). The feed card shows "Island by u/name".

**Tests.** Check route refuses unsolvable, too large, too loose and over-budget boards; publish
re-validates; weekly cap; Sunday pick chooses correctly among fixtures, respects the bands, falls
back, and running it twice changes nothing.

---

**Status, Nov 15: Briefs 1 (feed card), 2 (Archipelago, as a 2D night map), 3 (trailer; armed
from the mod menu rather than a separate post) and most of 4 (performance) are built.** Left
from Brief 4: fps on the Android phone, a heap profile, render-on-demand. The briefs above are
kept for reference.

# Milestone 5 briefs (written Nov 14, after the server core was built)

**Status, Nov 14 late: Briefs 6, 7, 8 and 9 are built** (commits dd5370b, 8ca5f61, 3880a03,
c483beb). Differences from the briefs: the board opens by tapping the time and place line on the
result card ("1:23 · #3 tonight"), keeping the card to Maulik's three actions; the crowd view
fades the player's lantern instead of hiding it; the Journeys routes refuse any word not in
JOURNEY_MAP.md and refuse a completed end from the client. Kept below for reference.

What exists already, so do not rebuild it: `src/server/core/game.ts` (start, lock-in, ranking,
player state, sky), `core/store.ts` (the `Store` type, `redisStore`, every key in `KEYS`),
`core/post.ts` (idempotent daily post with a stickied results comment whose id is stored at
`KEYS.stickyOfPost(postId)`), `src/shared/streak.ts`, the live sky (`skyfield.ts`), and tests in
`core/game.test.ts` that show how to test against the in-memory store. Follow that pattern: put
logic in `core/` behind `Store`, keep Reddit calls in `routes/`.

Data a ranked solve writes (all in `lockIn`): `lb:{day}` sorted set, member = username, score =
pieces x 10,000,000 + timeMs, lower is better; `lb:alltime` sorted set, member = username, score =
Lamplighter medals; `heat:{day}` hash, field = tile index (`y * width + x`), value = count;
`stats:{day}` hash with `plays`, `solves`, `parHits`; `sub:{day}:{userId}` JSON
`{ placements, result }`; `user:{userId}` hash with `streak`, `lastDay`, `graceWeek`, `best`,
`style`, `username`, `tutorialDone`; `sky:{day}` sorted set of `{u,s,a}` JSON by time.

Do briefs 6 to 8 before brief 2 (Archipelago) and brief 3 (trailer): they are what judges see on
the result card. Brief 9 can be done at any time.

## Brief 6 · Leaderboard with snoovatars

**Goal.** From the result card, "Tonight's board": today's top 10 by fewest pieces then fastest
time, plus the player's own row, each with a snoovatar; a second tab for all-time Lamplighters.

**Server.** In `core/game.ts`, `readLeaderboard(store, day, username | null)` →
`{ top: Row[], me: Row | null, total: number }` with
`Row = { rank, username, pieces, timeMs, snoovatar }`. `top` = `zRange(KEYS.leaderboard(day), 0,
9)`; decode `pieces = Math.floor(score / SCORING.leaderboardPieceWeight)`, `timeMs = score %
weight`. `me` from `zRank` (rank + 1) when the caller is not in the top 10. Snoovatars: `lockIn`
must also save the cleaned address: add `avatar` to the `user:{userId}` hash AND a hash
`avatars` (field = username, value = address) so a board needs one `hGetAll`-free read: use
`redis.hMGet`-style reads if available, else store the address inside the leaderboard member is
NOT allowed (member must stay the bare username). Add `hGet`/`hMGet` to `Store` and both
implementations. All-time: `readAllTime(store)` = top 10 of `KEYS.allTime` with `reverse: true`,
`Row = { rank, username, medals, snoovatar }`. Hide the rank (show "—") when `timeMs <
SCORING.minPlausibleMs`. Route `GET /api/leaderboard?day=N&scope=day|alltime` in `routes/api.ts`,
types in `shared/api.ts`. Works logged out (`me: null`).

**Client.** `src/client/game/board.ts`: a paper panel opened from a new quiet button on the result
card (`COPY.board = "Tonight's board"`), closing back to the card. It takes the result card's
place at the foot of the view and reports its height through `hud.insets()` so the island
reframes (see how `resultShown` is handled in `hud.ts`). Rows: rank, a 28 px round snoovatar
(`<img crossorigin="anonymous" loading="lazy">`, only if `cleanSnoovatar()` accepts it; else a
round seal with the first letter, same idea as `glyphTexture` in `release.ts`), `u/name`, pieces
as small lantern-count text, time via `formatTime`. The player's row is marked with the amber
colour. Two tabs: "Tonight" and "All time". Empty: "No lanterns yet tonight." Max height 60% of
the view with inner scroll.

**Tests.** Ordering by pieces then time; own row outside the top 10; logged out; implausible times
have no rank; all-time order; decoding of scores.

**Done when.** Two accounts solve the same day and each sees both rows in the right order.

## Brief 7 · Crowd heatmap

**Goal.** After Lock in: "See how everyone solved it". The player's own solution stays; tiles
tint by how often others placed a piece there; a line says "18% hit par tonight". Never before
the player has locked in. The par solution is shown only once the day is over.

**Server.** `readHeat(store, day, player)` in `core/game.ts` → `{ ok: false, reason: 'locked' }`
unless the caller has a ranked submission for that day (`KEYS.submission`) OR the day is before
`currentDay` (archive: open to all). Otherwise `{ ok: true, tiles: number[] (length width x
height, counts), solves, parHits, parSolution: Placement[] | null }` where `parSolution` is
`island.solution` only when `day < currentDay(now, lastDay())`. Route `GET /api/heatmap?day=N`,
HTTP 403 when locked. Types in `shared/api.ts`.

**Client.** A second quiet button on the result card (`COPY.crowd = 'See how everyone solved it'`).
On tap: `view.dawn()` is NOT called; instead add `view.showHeat(tiles: number[] | null)` to
`scene.ts`: tint each tile's instance colour toward `LOOK.lanternWarm` by
`count / maxCount` (keep the originals to restore; `tiles.setColorAt` then
`instanceColor.needsUpdate = true`; the tiles `InstancedMesh` is created in `ground.ts`, so
expose a `tint(values | null)` function from `createGround`). In non-calm mode the camera is up
in the sky at that point: add `view.returnToIsland()` that eases `releaseAt` back (set a
`descendAt` time and run the rise backwards over 1.5 s) while the night stays. The result card
shrinks to one line: "18% hit par tonight" (`COPY.crowdPar`, from `parHits / solves`; when
`solves < 5` say "You are among the first tonight.") with a Back button. If `parSolution` is
present, a toggle "Show par" lays those pieces on the island with `view.sync` of a state built by
`startPlay` + `tapTile` replay (see `trailerSteps` idea in brief 3).

**Tests.** Locked before submitting (403 path); open after; archive open to all; par solution
hidden today and present for past days; counts are per tile index.

**Done when.** The button does nothing spoilery before Lock in (it does not exist then), and after
it the island shows where the crowd built.

## Brief 8 · Share to comments (opt-in)

**Goal.** One clearly labelled button on the result card posts the two-line result as a comment
from the player's account, as a reply under the post's stickied results comment. Devvit's
user-action rules apply in full (CLAUDE.md rule 10): explicit tap, never automatic, never needed
to continue, never merged with another action.

**Config.** `devvit.json` → `"reddit": { "enable": true, "asUser": ["SUBMIT_COMMENT"] }`.

**Server.** `POST /api/share` in `routes/api.ts`: needs a logged-in caller with a ranked
submission for the post's own day (read `KEYS.submission(day, userId)`; refuse otherwise with
`reason: 'nothing-to-share'`). One share per player per day: `store.count('shared:{day}:{userId}')`
must be 1, else `reason: 'already-shared'`. Parent = `KEYS.stickyOfPost(context.postId)`; if it is
missing (older post), create and sticky one now exactly as `core/post.ts` does. Then
`reddit.submitComment({ id: stickyId, text, runAs: 'USER' })`. Text, built by a pure, tested
function `shareText(result, lanternCount)` in `src/shared/share.ts`:

    Lumen #12  🏮🏮🏮🏮  5 pieces (par 4)  ⏱ 1:42

    Glow · 🔥 7-day streak

(one 🏮 per lantern on the island; blank line between the two lines so Reddit keeps them apart;
no streak part when the streak is 1). Emoji is allowed here: it is a Reddit comment, not game UI.
On any error return `{ ok: false, reason: 'failed' }` and log it; never throw.
PLATFORM.md: this call failed once on desktop web with "refresh token does not exist" and worked
on iOS; and until the app is approved, non-owners post as the app account.

**Client.** Button `COPY.share = 'Share to comments'` on the result card, quiet style, below
"Play again". States: idle → "Posting…" (disabled) → "Shared" (disabled, stays) or
`COPY.shareFailed` as a notice with the button enabled again. Hidden for unranked results and
logged-out players. Add a separate quiet button `COPY.join = 'Join r/{subreddit}'` only if
Maulik asks; it must be its own action (`reddit.subscribeToCurrentSubreddit()`, permission
`SUBSCRIBE_TO_SUBREDDIT`).

**Tests.** `shareText` for par, over par, streak 1, one lantern; route refuses logged out,
unranked, second share; creates the sticky when missing.

**Done when.** Tapping Share once puts one reply under the stickied comment, from the player.

## Brief 9 · Journeys wiring

**Goal.** Send the events in `JOURNEY_MAP.md` exactly as written there. Nothing else, and no
personal data in any field.

**Config.** `devvit.json` → `"permissions": { ..., "journeys": true }`. Install
`@devvit/analytics@0.15.2` (same version as the other Devvit packages).

**Client** (`src/client/game/journey.ts`, called from `main.ts`): the client helper
`telemetry` from `@devvit/analytics/client/reddit` posts to routes the package expects. Its
ready-made router is Express-only and this server is Hono (PLATFORM.md), so write five small Hono
routes in `src/server/routes/journey.ts`, mounted at the base path the client helper uses (read
`TELEMETRY_JOURNEY_ENDPOINTS` and the default base path in
`node_modules/@devvit/analytics/shared/reddit/index.js` and `client/reddit/telemetry.js`): each
reads the JSON body and calls the matching method on the server `telemetry` client
(`startJourney`, `journeyProgress`, `journeyInteraction`, `endJourney`, `appReady`) and returns its
result as JSON. `journeyInteraction` needs `actionDetails` (a string) even when empty.
Wrap every client call in `.catch(() => undefined)`: telemetry must never break play.

Where each fires, in `main.ts`:
- `appReady()` once, after the first `layout()` of today's island (not the tutorial).
- `startJourney()` on the first `placed` event of an attempt (reset on Play again).
- `progress({ progress: lit / total, action: 'lantern_lit' })` on each `lit-more` event;
  `progress({ progress: 1, action: 'all_lit' })` on `all-lit`.
- `interaction({ action })` for `undo`, `reset`, `rotate` (in the HUD action handlers, which run
  on click, i.e. tap release), `keep_refining`, and `tutorial_skip` (from `tutorial.ts`'s Skip).
  `actionDetails` = `ranked` | `replay` | `archive`.
- Completed end: send from the SERVER inside `/api/lock-in` after a successful `lockIn`, with
  `complete: true, game: { win: true, score: result.pieces }`; the client passes the journey id
  in the header `x-devvit-journey-id` (`telemetry.getActiveJourneyId()`), then calls
  `telemetry.clearJourneyId()`.
- Abandoned end: `endJourney({ complete: false })` on `visibilitychange` → hidden, only if a
  journey is active and the player has not locked in.

**Check.** In playtest every receipt reads `JOURNEY_RECEIPT_DENIED_PLAYTEST`; that is expected
(PLATFORM.md). Log receipts with `console.log` behind `?perf=1` only. After publishing, expect
`DENIED_NOT_ALLOWLISTED` until Reddit approves `JOURNEY_MAP.md`, then `VALID`.

**Tests.** A pure mapper `journeyEventsFor(playEvents, lit, total)` → list of calls, tested for
the "typical journey" table in `JOURNEY_MAP.md`; the Hono routes with a stubbed telemetry client.

**Done when.** A playtest run logs one receipt per event in the table, in order.

---

## Small things left open by Fable (pick up when convenient)

- The player's own sky lantern (`release.ts`) does not yet show its earned style; pass
  `me.style` / `result.style` and tint or shape it like the points in `skyfield.ts`.
- `tutorialDone` is saved to Redis and read back, but hints (`HINTS_KEY`) are still only in
  localStorage, so they return after an app update. Store a `hintsDone` flag the same way.
- The feed card and the result card do not show "1,284 lanterns tonight" yet; `skyCount` is in
  `/api/island` and in every lock-in result.
- Not verified on Reddit yet: realtime between two real accounts, flair after a real ranked
  solve, the cron firing at 00:00 UTC, and the stickied comment on a new daily post.

---

## Added Nov 15 (after Maulik's two-account test)

- **Result card:** `LockInResult.rank` (1 = first tonight, 0 = not ranked) now comes from the
  server and shows as "1:42 · #3 tonight". After a replay the card shows the player's real result
  for today plus `COPY.replayNote`; a replay sends up a faint practice lantern
  (`view.release(true)`) and writes nothing.
- **Sky:** a snoovatar is always printed on a paper lantern (atlas cell drawn in `skyfield.ts`,
  the player's own in `release.ts`). The player's lantern is larger and brighter and carries a
  "You" label (`view.youAt()` → `hud.you()`); tapping any lantern shows its name for
  `SKY.nameMs` (`view.skyAt()` → `hud.nameTag()`).
- **How to play:** "?" in the top bar reloads into the tutorial; the feed card's "How to play"
  opens the `howto` entry point (`howto.html` = `game.html` with `data-tutorial="1"`: keep the
  two files identical apart from that attribute).
- **Dev reset:** mod menu → "Reset my Lumen progress (dev)", works only in `DEV.resetSubreddit`.
  For a signed-in player the server's `tutorialDone` now decides whether the tutorial runs.
- **Brief 1 (feed card), add from the four example games Reddit names** (Hot and Cold, Color
  Puzzle, Syllo, Pocket Grids): the card must say the goal in one line (now `COPY.previewGoal`),
  show proof that others are playing ("1,284 lanterns lit tonight" from `skyCount`, fetched after
  first paint), show the player's streak, and say "Resume" or show their medal on a return visit.
- **Open question for Maulik (not built):** on desktop the game opens in Reddit's expanded
  dialog. Playing inside the post would mean loading Three.js in the feed card, against rule 11.
