# Lumen — repo conventions

Lumen is a daily 3D light-routing puzzle on Reddit's Devvit Web platform (SDK 0.15, Three.js, Hono,
Vite). It is an entry for Reddit's Game of the Day hackathon; submission closes Dec 8, 2026, 6 pm PT.

## Where things stand (update at the end of every milestone)

**Start here: Sat Nov 21, 2026 (Opus). Phase 3 (the Sunday pick) is built and pushed, not
uploaded: report and phone checks in `PHASE3_PLAN.md` ("P3 report") and `docs/TESTS-TO-RUN.md`
1f (D1, the pins, must pass before launch).** The "everyone accounted for" fix is live
(v0.0.1.92): R1 and R2 passed on Maulik's phone, R3 and R4 run on the Nov 21 daily post (1e).
Timeline (Maulik, Nov 19): launch Tue Nov 24, first Sunday pick Sat Nov 28 20:00 UTC, P4 polish
Nov 26–27, atmosphere pass and trailer ending after launch (Nov 24–26). Each phase starts with
a plan for Maulik's OK, one commit per numbered item, push after the phase; **upload only when
Maulik says.** Read "Quality rules" below before any change.
- **Phase 3 in one breath:** `server/core/sunday.ts` (pick, freeze in `sun:{day}`, withdrawal,
  effects), `sunday-store.ts` (reading a pick; `islandOfDay` serves it to every route),
  `shelf.ts` (the map's Community view, scores in `cm:votes:{sunday}`), `pins.ts`,
  `pick-reddit.ts` (the real Reddit calls). Locally: `npm run sunday-pass` sets up a week on
  the stand-in and checks every Sunday screen from four seats; `/api/dev/island`, `/dev/score`,
  `/dev/pick`, `/dev/log` drive it by hand. A video storyboard and shot list is in
  `docs/VIDEO.md` (another session wrote it Nov 21).
- **Nov 20 evening, the missing stranger:** on Blossom Island #3 Maulik (first on the board)
  could not see u/VisibleSalamander536, who placed his exact board. Phase 2's grouping of
  identical boards collided with the list's "don't show me twice" filter; daily posts too. Now
  the viewer's board group folds into their own row ("same as u/name and N others"), the list
  shows only other boards, every count is read fresh, kept lists moved to `others:v2:{day}`.
  The new suite also found: a dev reset kept the par hit (fixed), and the card's rank was the
  rank at Lock in (now the board's). List logic lives in `src/shared/others.ts`.
- **Last uploaded:** v0.0.1.92 (Nov 20), commit f40fa04, tag `release-v0.0.1.92`, through
  `npm run release` (checks passed: 448 tests, four seats). Since then on `main`, not uploaded:
  all of Phase 3 (488 tests); `npm run checks` now also runs the Sunday pass.
- **Phase 2 (built Nov 20):** publish flow, community island posts, Your islands, the switch, dev
  tools. Plan, report, judge pass: `PHASE2_PLAN.md` (brief: `docs/PHASE2_BRIEF.md`). Community
  islands use numbers from `COMMUNITY.numberBase` (`shared/community.ts`), `lookUpIsland` in every
  route, `cm:*` keys, `groups:{n}` for identical boards, triggers `onPostDelete`/`onModAction`.
  Local: publish in `builder.html`, then `game.html?day=1000001` and `preview.html?day=1000001`
  (`&user=name` as another player; editing `config.ts` restarts the stand-in and forgets local
  islands). Headless renders: `scripts/shoot.mjs` `withPage` (the preview pane is often hidden,
  which throttles animations).
- **Maulik's Nov 20 phone run** (his recordings in ~/Downloads: `c1 to c12 test.mp4`,
  `lamp visibility.mp4`; transcribe locally with faster-whisper in the scratchpad venv): C1–C3,
  C5, C7–C10 passed; C4/C6 wait for a friend; C11 skipped (Builder stays on). Fixed after it:
  taps inside rocks/water no longer snap (`RULES.tapSnapInside`), ghost hand only in the tutorial,
  Builder lines show par and label, a real publish celebration (`BUILDER_VIEW.celebrate*`), the
  player listed once in See others' islands, the "You" label no longer slides when scrolled,
  pointer cursor on buttons, and quiet skies (`SKY.quietUpTo`/`busyFrom`/`quiet*`: other players'
  lanterns hover in clear view, twice as large). **Waiting on his phone:** re-checks C13–C20 in
  `docs/TESTS-TO-RUN.md` 1d, plus C4/C6 with a friend, and older 1c rows.
- **Phase 4 queue (end of `BUILDER_PLAN.md`):** (1) real pictures for community cards, approved
  after Phase 3: 3D snapshot at Publish, uploaded with `media.upload` (tested Nov 20: data URL
  works, 960 ms, 21 KB JPEG on i.redd.it, PLATFORM.md); card shows stock art first and swaps in;
  remove "Dev: test picture upload" when it lands. (2) Daily cards: pre-render all 90 islands
  unsolved.
- **Phone tests by Claude:** iPhone Mirroring through computer use (needs full-screen control;
  `open_application("iPhone Mirroring")` brings it to the front before clicking). Type one
  character at a time: fast typing through the mirror garbles letters. Server logs:
  `npx devvit logs lumen_game_dev lumen-game` (`Builder check:`, `Builder publish:`).
- **Captures are submission material:** copy captures into `captures/<date>-…/` (gitignored: the
  repo is public) and index them in `docs/CAPTURES.md`, which maps them to `docs/SUBMISSION.md`.
  Maulik's own phone recordings are the best video source.
- **Upload:** only `npm run release -- --yes` (after Maulik says), before launch and after
  (`docs/LAUNCH.md` section 3). It refuses uncommitted work, runs `npm run checks` (tests with
  the everyone-accounted-for suite, types, lint, build, the four-seat pass), uploads once, stops
  the watcher and tags the commit. Never `devvit publish`. Push to GitHub after every phase
  without asking.
- **Nov 19, never publish (official page):** r/lumen_game_dev is the judging subreddit. Launch day
  steps, release routine, phone check: `docs/LAUNCH.md`. `LAUNCH.launched` in config is flipped on
  launch day. Journeys start route answers a refused start quietly; client stops sending.

**As of Mon Nov 16, 2026 (M9 done, feature freeze in force). Resume from `HANDOFF.md`.**
All nine milestones are built except the cut Island Builder. Fable's work is finished; Opus 5.5
maintains Lumen until submission (Devpost by Dec 7). Start every session by reading, in order:
`HANDOFF.md` (state, tools, tuning guide, demo subreddit checklist, ranked Opus briefs),
`REVIEW.md` (the M8 judge review and why each brief matters), then the rules below.

- **Freeze:** numbers in `config.ts`, bug fixes that start with a failing test, copy, submission
  tasks. Any brief in HANDOFF.md marked "ask" needs Maulik's explicit yes first.
- **Last uploaded:** see the newest "Version:" line in the final M9 report; v0.0.1.50 is the
  last version Maulik tested on Reddit.
- **Known gaps:** never run on Android; live sky never tested with two phones; phone fps unknown;
  sound-after-lock fix and sky-grain fix unconfirmed on the iPhone (HANDOFF brief O-2).
- **Server time:** server code uses `nowMs()` from `src/server/core/clock.ts`, never
  `Date.now()` (the playtest subreddit can move "today").
- Finished briefs and old notes: `docs/HANDOFF-ARCHIVE.md`.
- **Nov 16 (Opus):** Android sky bug fixed (lanterns were placed outside a portrait phone's view;
  placement is now `shared/skyspot.ts`, tested), iPhone sky speckle fixed (canvas gradient
  textures replaced by computed ones), negative counts fixed (`skyCount` is the board's size),
  hero renderer fixed, own lantern sharper; README; briefs O-3, O-4, O-5 and "post opens"
  built; O-14 Island Builder brief written in full (not built); `docs/LAUNCH.md` for the public
  subreddit.
- **Nov 16, approved by Maulik:** live arrivals while playing. A `sky_{day}` message shows
  "u/name just lit <island>" for 3 s in the reserved hint row (never shifts the board), and a
  faint lantern rises through the empty sky above the island (`shared/arrival.ts`, skipped when
  there is no room, and with reduced motion). Local hook `window.lumenArrive(name)` with `?perf=1`.

- **Nov 16, approved by Maulik:** Saturdays 26, 47 and 89 regenerated under a lower solver limit
  (`GENERATOR.maxSolveNodes` 150,000 → 66,000; must stay ≥ 65,648, day 46's cost, unless day 46
  is regenerated too). All other 87 days unchanged. The 2-second check stays time-based and now
  runs alone after every other test (`vitest.config.ts` projects, `groupOrder`), so the suite no
  longer starves it; it passes on battery. `npm run gen -- --only N,M` replaces single days.

- **Nov 16, approved by Maulik (exceptions to the freeze), start after Wed Nov 18** once the app
  review form is in: O-16 logo, O-15 top boards as pictures, O-14 Island Builder (recommended:
  the app posts community islands and credits the maker, so no new permission). Briefs in
  `HANDOFF.md`; why in `docs/SUBMISSION.md` (lessons from BridgeDit, the last winner). O-2 phone
  checks still come first.
- **Nov 17: no app review during the event** (organizers prefer upload and playtest; a demo post
  must be accessible). v0.0.1.64 uploaded. See HANDOFF section 5.
- **Nov 17 (Opus), at Maulik's request:** O-15 built as "See others' islands" (replaces the
  crowd pools: your island plus the top 10 with pictures, tap to see one lit, read-only; list
  kept at Lock in in `others:{day}`, pieces in `boards:{day}`). 341 tests. Not seen on Reddit.
  Logo built (option C, Maulik's pick: the light's path is the L): `content/brand/`, rebuilt by
  `node content/brand/build.mjs`; app listing icon set in `devvit.json` `marketingAssets`.

- **Nov 17, outside review refinements:** light readable on pale ground (`shared/glare.ts`,
  `GLARE`), "Your turn" mistake recovery (`soloLine`, "Start again"), "Practice · Name" and
  "Back to islands" on map islands, brighter feed card picture, Devpost thumbnail with the real
  island. 349 tests. Human checks from the review are in `docs/TESTS-TO-RUN.md` section 1b.

- **Nov 19: Island Builder phase 1 built** (Maulik: the Builder is Lumen's most important
  feature; `BUILDER_PLAN.md` is the plan and the phase reports). Never published (playtest build);
  `runAs: 'USER'` with `SUBMIT_POST` in P2, maker credited everywhere. Flat editor (3D tiles
  measured under 44 px), 3D for testing. `COMMUNITY` in config, `shared/builder.ts`,
  `server/core/check.ts` + `community.ts`, `routes/builder.ts`, `client/builder/`. 385 tests.

- **Nov 19 (Opus): P1 phone run and fixes.** Claude ran Builder cases A1–H6 on Maulik's iPhone
  through iPhone Mirroring; results and fixes at the end of `BUILDER_PLAN.md`. Phone captures
  are kept locally in `captures/` (gitignored), indexed in `docs/CAPTURES.md`: raw material for
  the Devpost gallery and video. Server check speed: 400k nodes in 1.12 s. 395 tests.

**History** (what each session built; kept for context, oldest first, M8 last):
- **Island Builder is cut.** Sunday uses a generated island. Brief kept in `docs/HANDOFF-ARCHIVE.md`.
- Onboarding (Nov 14): first visit runs three tutorial islands (`src/shared/tutorial.ts`,
  `src/client/game/tutorial.ts`): sun pulses, light visibly travels and stops short, unlit
  lantern breathes, a ghost hand (`hand.ts`) taps the one tile that matters; hints "Bend the light
  into the lantern" → "Tap it again to turn it" → prism. Skippable. Then today's island, which
  keeps the hint line and the ghost hand for "turn" until the first Lock in. Light now travels
  on every change (`ONBOARD` in config). `?tutorial=1` forces it, `?tutorial=0` skips it.
  Done flag is in localStorage for now; M5 moves it to Redis (`tutorialDone`).
- **M5 core (Nov 14):** `src/server/core/game.ts` decides every result (re-trace, server time
  from `/api/start`, first Lock in of the day only, midnight grace), writes leaderboard,
  all-time medals, heatmap, stats, streak (`src/shared/streak.ts`), sky; `routes/api.ts` adds
  flair and the realtime broadcast as fallible effects. `core/post.ts` makes one post per day no
  matter how often it is asked (cron 00:00 UTC, catch-up twice an hour, mod menu, install and
  upgrade triggers). Client: `/api/start` once today's island is on screen, ranked Lock in with
  the player's snoovatar, streak on the result card, `skyfield.ts` drawing up to 300 lanterns in
  one draw call (plus a snoovatar atlas for the newest 8) fed by `/api/sky` and the `sky_{day}`
  channel. **Not yet verified on Reddit:** two-account realtime, flair, cron, stickied comment.
- **Nov 14 late (Opus): Briefs 6–9 built.** Tonight's board (tap "1:23 · #3 tonight" on the
  result card; `/api/leaderboard`, `board.ts`), crowd view ("See how everyone solved it",
  `/api/heatmap`, `crowd.ts`, tiles warm via `ground.tint`), Share to comments (`/api/share`,
  `shared/share.ts`, permission `asUser: SUBMIT_COMMENT`), Journeys (`shared/journey.ts` mapper,
  Hono routes in `routes/journey.ts` at /api/telemetry, completed end sent in /api/lock-in,
  permission `journeys`). **Design change (Maulik):** a ranked Lock in finishes today's island:
  no replay; result card = See how everyone solved it, Share, Explore past islands (`past.ts`,
  `/api/past`, practice there), "Come back at nightfall tomorrow". Reopening a solved post
  shows night, the lantern and the card (`view.settle()`). "?" and past islands open on a layer
  over tonight's island (`openLayer` in `main.ts`), which pauses and returns unchanged. Ghost
  hand only in the tutorial or after a skipped one. Own sky entry never drawn twice. 309 tests.
  Local checks run in headless Chrome when the browser pane is hidden (script in the session
  scratchpad; not kept).
- **Nov 15 (Fable): the seven-item plan before the freeze, all built.** (1) Feed card
  (`preview.*`, `outline.ts`, `card-cache.ts`, `/api/card`): hero picture per biome rendered from
  the real scene by `npm run hero` (needs `npm run debug` running, Chrome, cwebp; uses the
  hand-made `content/hero.json`, never a daily island; **re-run it after any change to the look**),
  today's outline, solved state with "See tonight's sky" and a countdown. (2) Result card rows
  never half empty. (3) Stickied results comment counts players, refreshed at most once a minute
  and by the half-hourly task. (4) Landscape layout above 760 px wide (`VIEW.wide*`); desktop
  Reddit's modal measured 375 px, so see PLATFORM.md. (5) Art pass, all numbers in `ART`.
  (6) Archipelago map (`archipelago.ts`) replaces the past-islands list. (7) Trailer mode
  (`trailer.ts`, `shared/trailer.ts`; mod menu arms it, `?trailer=1` locally) and a performance
  pass (table in PLAN.md Milestone 7; **phone fps still unmeasured**). `scripts/shoot.mjs` is the
  headless-Chrome driver for local screenshots and scripted clicks. 313 tests;
  `tests/content.test.ts` has a 2-second timing check that can fail when the machine is busy.
- **Nov 15, later (Fable): reviewer batch A–E, all built.** (A) Hint room is always reserved
  (`VIEW.hintRoomPx`), so the island never shifts; `snapTile` in `play.ts` sends near-miss taps
  to the nearest usable tile (`RULES.tapSnapTiles`). (B) Unfinished boards are saved
  (`/api/progress`, `prog:{day}:{userId}`, plus localStorage) and restored with `resumeWith`.
  (C) Tutorial has a fourth island "Your turn" (`TUTORIAL_SOLO`); one-time rule cards
  (`shared/rules.ts`, `cards.ts`, user hash fields `rule:*`, `/api/rule-seen`); newcomers on
  Thu–Sat are offered a warm-up island (`warmUpDay` in `calendar.ts`), and tonight's clock starts
  only after it. (D) First-release line (`COPY.skyJoin`), crowd button renamed, last night's
  lanterns shown faintly when fewer than `SKY.quietBelow` tonight. (E) The 2-second timing test
  re-times a slow reading instead of failing on machine load. 323 tests. **Left for Monday:
  M8 judge review and M9 handoff. Nothing in A–E is verified on Reddit yet.**
- **Nov 15, M8 (Fable): judge review in `REVIEW.md`** (scores, P0/P1/P2 with fixes and costs,
  Monday order). Five P0s fixed: posts that are not tonight's say so and lead to tonight's
  (`Night` in api, `nightOf` in routes/api.ts); dev time travel and subreddit clean-up from the
  mod menu (`core/clock.ts`: **server code must use `nowMs()`, never `Date.now()`**); sound after
  lock and unlock (context closed when hidden, rebuilt in the next tap); phone ending (7 s rise,
  hover, `RELEASE.hoverMs`/`lookBelow`); other players as paper lanterns painted into one sheet
  (`skyfield.ts`, `SKY.cellPx`). 325 tests. Left: REVIEW.md's P0 list (mostly phone checks) and
  P1 list, then M9.
- **Nov 16, M9 (Fable, finished by Opus):** art P1s built (soft tile seams `ART.seam*`, drawn
  medal emblems `emblem.ts`, crowd pools `HEAT.pool*`, sky noise without sin()). HANDOFF.md
  rewritten as the resume document; old briefs moved to `docs/HANDOFF-ARCHIVE.md`.
- **Nov 15 fixes after Maulik's test:** snoovatars sit on paper lanterns; own lantern has a "You"
  label; tapping a lantern shows its name; unranked solves send a faint practice lantern; rank
  on the card; "?" How to play
  in the top bar and on the feed card (`howto` entry point); mod menu "Reset my Lumen progress
  (dev)" on r/lumen_game_dev only. 293 tests. Details at the end of `HANDOFF.md`.
- Snow biome has its own cooler daylight (`sunDay`/`sunDusk` per biome in `BIOME_LOOK`).
- M4 phone test results were never filled in (the form came back blank). Still unknown on a real
  phone: snoovatar on the sky lantern, smoothness of the rise, clipping.

- App: `lumen-game` (the name `lumen` was taken). Listing: developers.reddit.com/apps/lumen-game.
  Owner account u/Dry_Promotion2506. **r/lumen_game_dev** (public, approved) is both the
  playtest subreddit and the one players and judges use; there is no r/LumenGame.
- `npx devvit login` expires within hours; a 401 from playtest means log in again. Claude cannot
  open reddit.com in its browser tools: Maulik does anything that needs the Reddit site.
- Public repo: https://github.com/Maulik176/Lumen (`origin`, `main` only). Branch
  `spike/platform` holds the throwaway spike: never merge it, never push it.
- M1: engine in `src/shared` (tracer, exact solver, validator, RNG, text format), ten fixtures,
  `npm run bench`, `PLATFORM.md`.
- M2: generator, difficulty model, names, calendar, `content/puzzles.json` (90 days from day one
  = Tue Nov 24, 2026), `npm run gen`, `npm run report`, `npm run debug` (2D viewer). 197 tests.
  Every day is in its par and difficulty band and solves in under 0.3 s (bar was 2 s). Generated
  days are capped at `GENERATOR.maxSolveNodes`; the Island Builder check uses
  `SOLVER.builderNodeLimit` (about 2 s on a laptop, to be confirmed on the server in M6).
- M3: `src/shared/play.ts` (rules of a play session), `src/client/game/` (Three.js island, HUD,
  sound), `src/client/preview.*` (feed card), `/api/island`, `/api/lock-in`. Placeholder art.
  Full loop works locally at 60 fps: hint, place, live light, "All lit" prompt, Lock in, nightfall,
  lanterns bloom with chimes, result card. Test locally with `npm run debug`, then open
  `http://localhost:5199/game.html?day=7`. 238 tests. Game bundle 145 KB gzipped (budget 450).
  Not yet checked: real phone in the Reddit app, Android, 4x CPU slowdown.
  Known rough edges for M4: mirrors are grey slabs, sky is a flat colour, no colour-blind glyphs,
  prompt and result card cover the island's front row on short screens, lock-in time is the
  client's own clock until M5.
- M4: final look. `sky.ts` gradient dome, stars, far islets, clouds; `ground.ts` tiles on an earth
  rim over a hanging rock, per-biome trees (pine, round, cactus), rim props, mist; `pieces.ts`
  wooden-framed mirror, brass-capped prism, stone fixed mirror, sun crystal; `beams.ts` ribbon
  shader (core laid over the scene, halo added, shimmer, one shape per colour per tile, sparkle
  on a splitting prism); `lanterns.ts` paper globes with glow, light spill, colour band and shape
  badge; `release.ts` sky lantern with snoovatar texture or a username seal; `hud.ts` paper UI,
  Young Serif (OFL, bundled), hand-drawn icons; the island reframes so the prompt and result card
  never cover it. Calm mode: no camera travel, slow fades, lantern rises in view and melts into
  the stars. Measured locally: 57 draw calls, 6.7k triangles, game JS 153 KB gzipped. 251 tests.
  Not yet checked on a phone; the preview pane throttles, so local fps numbers are not reliable.
  Left for later milestones: the feed card still has M3 styling (M7); the sky shows only the
  player's own lantern until the shared sky exists (M5); no sound changes since M3 (M7).
- Test posts: mod menu → "Post a Lumen island (testing)" asks for a day number.
- **Uploads are guarded (Nov 13).** v0.0.1.14 shipped without preview.html: Vite empties its
  output folder at every rebuild and playtest uploads the instant dist/ changes. Now
  `devvit.json` `scripts.dev` runs `scripts/dev-build.ts`: Vite writes to `.build-staging/`, and
  only a build that passes `scripts/build-check.ts` is copied into dist/ (atomic renames, pages
  last, nothing deleted). `scripts.build` (used by `devvit upload`) runs the same check and aborts
  the upload on failure. Still: stop playtest when not uploading, so edits don't stream to Reddit.
- **Audio on iOS (Nov 13):** sound wakes on finger-up/click (iOS ignores finger-down), sounds
  asked for while waking are queued, the next tap after a lock screen resumes it, and a context
  iOS has broken is replaced. Covered by `src/client/game/audio.test.ts`; needs a real iPhone check.
- Changing `CALENDAR.dayOne` or anything in `GENERATOR`/`DIFFICULTY` means `npm run gen` again and
  committing `content/puzzles.json`; `tests/content.test.ts` fails until you do.
- The debug page is a developer tool, not the game. Maulik's playtest of it (Nov 13): Monday right
  for a first-timer, Saturday hard but fair, order of difficulty correct, nothing below par.
  His main worry is onboarding and payoff, which do not exist yet: treat every phone demo from M3
  on as a stranger test.

## Milestone 4 brief (Maulik, Nov 13) — this is the final look, not a draft

Must include, from the M3 judge pass:
- Mirrors as real crafted pieces, not grey slabs. Sky dome with the dusk gradient and stars.
- Colour-blind shapes on beams and lanterns (red triangle, green circle, blue square; mixed = both).
- The "All lit" prompt and the result card must **never cover the island** on short screens
  (360x460): the island reframes into the space left above or below.

Then: beam shader with halo and shimmer; prism split with a sparkle; lantern bloom; nightfall; the
lantern release with the player's snoovatar as a texture (glyph from the username when there is
none); all 5 biomes (moss, snow, blossom, dune, autumn: same geometry, different palette and
props); custom UI kit with a bundled OFL display font and hand-drawn icons, warm-paper panels.
Reduced motion must be just as beautiful (slow fades and glow instead of camera travel and pops).

Finish with a judge pass using screenshots at 430x701 and 360x460, fix the top issues, short report.

How the work is laid out (so a fresh session can continue):
- Per-biome colours and prop choices live in `config.ts` (`BIOME_LOOK`), UI colours in `UI`.
- `src/client/game/` is split by subject: `sky.ts` (dome shader), `ground.ts` (tiles, rim,
  underside, props), `pieces.ts` (mirror, prism, fixed mirror models), `beams.ts` (ribbon shader,
  shapes, sparkle), `lanterns.ts` (island lanterns, shape badges, light spill), `release.ts` (the
  sky lantern, snoovatar or glyph, camera rise), `scene.ts` (ties them together; same `IslandView`
  interface as M3 plus `release()`), `hud.ts`, `audio.ts`, `main.ts`, `fit.ts`.
- Sequence after Lock in: night falls → island lanterns bloom one by one with chimes → the
  player's sky lantern lifts off and the camera follows it up → result card. All automatic.
- Local check: `npm run debug`, then `http://localhost:5199/game.html?day=7` (`&biome=snow` and
  `&calm=1` force a biome or the reduced-motion path; `&perf=1` shows fps and draw calls).
- Budgets: draw calls under 120, triangles under 80k, 60 fps, game JS under 450 KB gzipped.

**Decisions that override SPEC (full list: PROMPT.md section 7):**

- **Lock in (A1).** Lighting every lantern locks nothing. A soft glow and "All lit · N pieces
  (par P)" appear with two buttons, **Lock in** and **Keep refining**. Lock in is the single ranked
  submission and triggers nightfall and the lantern release. The timer runs until Lock in. Copy
  lives in `config.ts`.
- **Cut order if Monday runs out:** (1) Island Builder, Sunday falls back to a generated island;
  (2) biomes 5 → 3. Never cut the Shared Night Sky. Archipelago becomes a 2D map before it is ever
  cut. Trailer mode stays.
- **Monday has two suns and two lanterns** (par 2–3), not one of each. Tuesday's new idea is the
  fixed mirror. Launch date stays Nov 24, 2026.
- **Saturday par is at most 6.** The Builder refuses to publish on solver timeout:
  "Too complex to verify. Try removing a piece."
- **Share:** the app posts one stickied "Lumen #N results" comment at post creation; shares are
  replies under it.
- **Never publish before the hackathon ends (official page, Nov 19):** no `devvit publish`, no
  app review. Upload and playtest only, on r/lumen_game_dev. Launch day and the release routine:
  `docs/LAUNCH.md`. After launch every upload is live, so only `npm run release` uploads, and
  `LAUNCH.launched` (config) turns off destructive dev tools, the clock shift and `npm run dev`.
  In a playtest build `runAs: 'USER'` posts as the app for everyone but the owner (so every line
  names the player) and Journeys are refused (the client stops quietly). HANDOFF section 5.
- **Snoovatars:** texture from `i.redd.it` with `crossOrigin` (proven). Client sends its own
  `context.snoovatar` at Lock in; server validates the host. Glyph when an account has none.
- **Prisms** can turn light as well as split it. Generator treats them as scarce;
  `difficulty.ts` counts "prism used as a turn" as its own factor.
- **Decoys** are misleading paths, never lanterns that must stay dark.
- **Reduced motion** is a first-class path: the calm nightfall and release must be as beautiful
  as the full version. Maulik's own phone has Reduce Motion on.
- **Testing devices:** iPhone now; Android arrives before Milestone 4. Until then also test in
  desktop Chrome with 4x CPU slowdown.

## Quality rules (Maulik, Nov 20, after a stranger went missing from a list)

A player was invisible in "See others' islands" because two features, each tested alone with
made-up data, disagreed about what a row meant, and the local server served a hand-made list.
These five rules exist so that class of bug cannot reach Maulik's phone again.

1. **Everyone accounted for.** Every player-facing list and count (See others' islands, the
   boards, the sky, the counts on the card, results comment, map and Your islands) is covered by
   `src/server/core/accounted.test.ts`: seeded random nights, every seat (each player, a
   practice player, signed out, the maker), server output run through the same shared code the
   phone uses (`src/shared/others.ts`). A new list or count gets its invariant there first.
2. **Realistic data.** Tests and local checks use `src/server/core/crowd.ts`: most players
   place the par answer (identical boards are the common case), spare-mirror boards, practice
   solves, a too-fast time, dev resets and replays, the maker playing their own island. The
   local stand-in (`npm run debug`) runs the real game code on an in-memory store and takes the
   player from the page's `?user=`; `fetch('/api/dev/crowd?day=1&players=8')` seeds a crowd,
   `fetch('/api/dev/island?day=2&maker=p0')` makes a community island. Never judge a screen
   fed by made-up rows.
3. **When data changes meaning, list every reader.** A plan or commit that changes what a
   field, row or key means names every place that reads it (grep), and each gets a test with
   the new meaning. Stored data from the old meaning is migrated or versioned (`others:v2`).
4. **Every bug: root cause, then the class.** Failing test first; then find the same
   assumption elsewhere and add an invariant (not one example); then prove the test fails
   without the fix.
5. **Four-seat judge pass.** `npm run seats` (stand-in running) opens the game as the player
   first on the board, a later player with the same board, a player with a different board,
   and a community island's maker who also played it, at 430x701, 360x460 and 1100x700, and
   checks the lists from the screen; screenshots go to `captures/`. Look at them.

**Before every upload `npm run checks` must pass**: `npm run release` runs it and refuses to
upload otherwise (tests, types, lint, build, and the four-seat pass at 430x701).

## Read first

- `SPEC.md` — intent. Read only the section for the task in hand.
- `PROMPT.md` — the brief mapped to features, and amendments to SPEC (section 4). Accepted
  amendments override SPEC.
- `PLAN.md` — the nine milestones, their tests and exit criteria, and the fixed cut line.
- `PLATFORM.md` (after M1) — what Devvit really allows. Trust it over memory and over SPEC.
- `JOURNEY_MAP.md` — the Journeys events, triggers and fields sent to Reddit for approval.
- `HANDOFF.md` — start here: state, tools, tuning guide, demo subreddit checklist, Opus briefs.
- `REVIEW.md` — the M8 judge review: scores and every remaining issue ranked.
- `AGENTS.md` came with the template. Its Devvit limitations list is right; its mentions of React
  and tRPC are not (this repo uses neither).

## The freeze rule

Feature work ends Mon Nov 16, 2026, 11:59 pm IST. After that: change numbers in
`src/shared/config.ts`, fix bugs that have a repro and a failing test, edit copy, do submission
tasks. **No new features, no redesigns, no refactors.** If something seems to need one, write it up
in `HANDOFF.md` and ask Maulik.

## Layout

```
src/shared/   pure engine: config, types, rng, board, trace, solve, validate, calendar, generate,
              difficulty, names, daily (stored island format), puzzle-text, api types
src/client/   preview (inline, no Three.js), game/ (Three.js), archipelago, builder, trailer, debug
src/server/   Hono app: /api/* for the client, /internal/* for scheduler, menu, triggers
content/      puzzles.json (90 generated days), fixtures/ (hand-made, par worked out by hand), tutorial.json
tests/        fixture tests, bench/ (speed reports)
scripts/      gen, report (run with tsx)
```

## Hard rules

1. **TypeScript strict.** No `any`, no type casts, no `@ts-ignore`. Type aliases over interfaces,
   named exports only.
2. **`src/shared` is pure.** No DOM, no Three.js, no Node APIs, no Devvit imports, no `Date.now()`
   or `Math.random()` (time and randomness are passed in). It must run identically on client and server.
3. **Every tunable number lives in `src/shared/config.ts` with a comment**: difficulty weights, par
   bands, timings, colours, sizes, streak rules, caps, feature flags. A literal in gameplay or
   rendering code is a bug.
4. **The engine is tested with Vitest.** Every rule in SPEC "Core rules" has a test. A bug fix starts
   with a failing test.
5. **The client never scores itself.** The server re-traces every submission with the shared engine
   and measures time from its own start record. The day comes from the post's `postData`, never the
   device clock.
6. **No external network calls from the client.** Only same-origin `/api/*`. Fonts, icons and any
   textures are bundled; all sound is synthesised with WebAudio. No CDNs, no analytics scripts.
7. **Server endpoints** start with `/api/` (client) or `/internal/` (platform), finish well inside
   30 s, never stream, and treat every Redis write as fallible.
8. **Redis on Devvit** has strings, hashes, sorted sets, bitfields and transactions only. No lists,
   no plain sets, no pipelining. Keep keys small, group reads, set TTLs as in SPEC.
8a. **Realtime channel names** use only letters, digits and underscores (`sky_12`). Wrap
    `connectRealtime` in try/catch: it throws synchronously on a bad name.
8b. **Nothing passes between the preview and the game through `sessionStorage`** (it does not
    carry on iOS). The viewport is measured at run time: expanded mode is not full screen.
9. **Reddit API calls that are decoration** (flair, sticky comment, avatar) fail silently and never
   block play.
10. **User actions** (comment, post, subscribe) happen only on an explicit, separately labelled tap;
    never automatic, never bundled with another action, never required to continue. Score comments
    reply under the post's single stickied results comment.
11. **Inline preview:** no Three.js, taps only, no scroll capture, paints from `postData` without
    waiting on the network, under 1 s, Lighthouse mobile above 80.
    `requestExpandedMode` is called synchronously inside the click handler.
12. **Render loop:** no allocations per frame, no real-time shadows, instanced geometry, pixel ratio
    capped per config, everything disposed on teardown.
13. **Logged-out players can play.** Check for a missing `context.userId` on every endpoint.
14. **No personal data** in Journeys fields, logs or Redis beyond Reddit user id and username.

## Voice and look

- Copy is calm, warm and short. One line at most. No exclamation marks except on hitting par.
  Words: light, lantern, dusk, island, night. Never: laser, level, beam puzzle.
- No emoji inside the game UI (flair and the comment result card are the only exceptions).
- One palette, one corner radius, one display font, one icon style. No stock components.
- Nothing about Reddit, Snoo or karma in the fiction.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | `devvit playtest` against r/lumen_game_dev (before launch only: it uploads every save; refuses once `LAUNCH.launched`) |
| `npm run release` | The only upload, before launch and after: `npm run checks`, asks (or `-- --yes`), uploads once, stops the watcher, tags `release-<version>` (`docs/LAUNCH.md`) |
| `npm run checks` | Everything an upload needs to pass: tests, types, lint, build, the four-seat pass (starts the stand-in if needed) |
| `npm run seats` | The four-seat judge pass on the running stand-in; `-- <outDir> 430x701 360x460 1100x700` |
| `npm test` | Vitest: unit tests beside the code in `src/`, fixture tests in `tests/` |
| `npm run bench` | Solver speed report by par on open islands (not part of `npm test`) |
| `npm run test:types` | `tsc --build` |
| `npm run lint` | ESLint |
| `npm run build` | Vite build of client and server, then the build check (fails if a page or file is missing) |
| `npm run check:build` | Check `dist/` alone: every entry page, the files it loads, the server bundle |
| `npm run gen -- --from 1 --to 90` | regenerate `content/puzzles.json` |
| `npm run report` | par and difficulty per weekday; `-- --show 12` prints a day; `-- --verify` re-solves and times all |
| `npm run debug` | local server: `/debug.html` 2D viewer for every day; `/game.html?day=N&user=name` the real play screen, with the real game code on an in-memory store (`/api/dev/crowd`, `/api/dev/island`, `/api/forget`) |

Node 22.12 or newer. The Reddit app on a real phone is the only test that counts for feel and
performance; a desktop browser is for layout.

## Working rhythm

- One milestone per session. Start from its PLAN.md entry.
- Before saying a milestone is done: `npm test`, `npm run test:types`, `npm run lint` and
  `npm run build` all pass, and each exit criterion is reported as met or not met with the number.
- **Judge pass at the end of every milestone:** screenshot the game at 360x640 and 430x932, critique
  it as a harsh hackathon judge against PROMPT section 3 and SPEC's anti-AI-slop checklist, fix the
  top three issues, list the rest.
- **Commit after each milestone** (and before any long autonomous run). Message says what a player
  can now do. Never commit `dist/`, `.env*` or tokens.
- When asked "what's pending?", walk PROMPT section 3 and PLAN.md top to bottom, not just the latest
  to-do list, and name anything that was dropped.
- If something is cut, cut it whole in the order of PLAN.md's cut line and write its brief in
  `HANDOFF.md`. Never leave a feature half-built or a button that does nothing.
- If a request would crowd out a brief requirement, say so before doing it.
