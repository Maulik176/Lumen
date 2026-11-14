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
