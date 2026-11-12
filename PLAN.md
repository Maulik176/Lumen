# Lumen — plan

Nine milestones, Nov 12–16 (IST), matching SPEC.md "Build schedule". Amendments from PROMPT.md
section 4 are folded in and marked †. Each milestone ends with: tests green, the phone demo below,
a judge pass (anti-slop checklist, top three issues fixed), and a commit.

**Cut line (proposed in PROMPT W4, not yet approved by Maulik; bottom is cut first):** Island Builder + Sunday pick → Archipelago 3D map
(fallback: flat list of past days) → all-time leaderboard tab → realtime (fallback: poll
`/api/sky`) → biomes beyond Moss + two.

**Insurance:** a rough phone-recorded demo exists by the end of M5 (Sat night) and a Devpost draft
exists this week.

| # | When (IST) | Milestone | Runs |
| --- | --- | --- | --- |
| 1 | Thu Nov 12 evening | Platform spike and engine | with Maulik |
| 2 | Fri Nov 13 morning | Generator, content, tuning tools | autonomous |
| 3 | Fri Nov 13 evening | 3D vertical slice | with Maulik |
| 4 | Sat Nov 14 morning | Final art and the signature moment | with Maulik |
| 5 | Sat Nov 14 afternoon–evening | Server and Reddit layer | with Maulik, two phones |
| 6 | Sun Nov 15 morning | Archipelago and Island Builder | autonomous |
| 7 | Sun Nov 15 evening | First-time experience and finish | with Maulik |
| 8 | Mon Nov 16 morning | Harsh judge review | autonomous |
| 9 | Mon Nov 16 evening | Final pass, freeze, handoff | with Maulik |

---

## Milestone 1 · Platform spike and engine

**Goal:** know what Devvit really allows, and have a correct, tested rules engine.

**Tasks — (a) spike, branch `spike/platform`, results in `PLATFORM.md`**
1. Snoovatar in the webview: try direct `<img>` from the Reddit URL, then `/api/avatar` data URL,
   then `media.upload()`. Record which works, whether it is usable as a WebGL texture (CORS), and
   the `permissions.http` domain if any. Build the username-glyph fallback.
2. Realtime: server `realtime.send('sky-test', …)` reaches two open clients; measure latency.
3. `setUserFlair` works for the app account in the test subreddit (text with emoji).
4. `submitComment` with `runAs: 'USER'` from a button; app posts and stickies one "results"
   comment and the user comment lands as a reply to it†. Record the owner-only limit in playtest.
5. A cron task fires (temporary `*/1 * * * *`), and the handler is idempotent.
6. Journeys: fire each event once, log the receipts, check whether a journey started in the inline
   preview carries into the expanded entry†. Draft the journey map and send it for allowlisting.
7. Also record: `context.userId` when logged out, `postData` round trip, `requestExpandedMode`
   between entries, WebGL context and `devicePixelRatio` in the Reddit Android and iOS webviews.

**Tasks — (b) engine in `src/shared`**
1. Add Vitest (and `@devvit/test`); replace the template's `test:unit` script; `npm test` runs all.
2. `config.ts` (all numbers), `types.ts`, `rng.ts` (mulberry32 + string seed), `trace.ts`,
   `solve.ts`, `validate.ts`.
3. Ten hand-made fixtures with known par in `content/fixtures/*.json`.
4. Decide the solver ceiling with measured numbers (PROMPT W5).

**Status Nov 12:** part (b) done and committed (157 tests; fixtures all at hand-worked par;
`npm run bench` for speed). Part (a) not started.

**Files:** `PLATFORM.md`, `src/shared/{config,types,rng,trace,solve,validate}.ts` + `*.test.ts`,
`content/fixtures/`, `package.json`, `vitest.config.ts`, spike-only code under `src/server/spike/`
and `src/client/spike.*` (branch only, not merged).

**Tests:** one test per row of the Core rules tables (each tile, each piece, each lantern colour
rule, mixed lanterns, both mirror orientations from all four directions, prism from all four
directions†, loop guard, step cap, beams crossing); solver finds the known par on all ten fixtures;
solver counts minimum solutions (cap 50); `validate` rejects illegal tiles, over-inventory, pieces
on water or rock, and claims of lit lanterns that the trace does not produce; trace is byte-identical
across two runs.

**Exit criteria:** `PLATFORM.md` answers all six questions with a chosen approach or a fallback;
`npm test` green; solver ≤ 2 s on every fixture in Node; journey map sent.

**Phone demo:** the spike post in r/LumenGame shows your snoovatar, a "ping" button that lights up
on a second device, your flair changed, and a comment from your account under the stickied one.

---

## Milestone 2 · Generator, content and tuning tools

**Goal:** 90 days of puzzles, each proven, each in its weekday's band.

**Tasks**
1. `generate.ts`: weekday templates keyed to the real UTC weekday of each day number†; backward
   construction (sources on edges, beam walks, lanterns at ends and branches), obstacles and
   misleading paths†, strip pieces, solve, reject and retry per SPEC rules.
2. `difficulty.ts`: weighted score, every component logged, bands and weights in `config.ts`.
3. `names.ts`: seeded two-word names ("Moss Steps") from curated word lists per biome; no repeats in 90 days.
4. Biome assignment by week.
5. `scripts/gen.ts` → `npm run gen -- --from 1 --to 90` writes `content/puzzles.json`.
6. `scripts/report.ts` → `npm run report` prints par, difficulty and rejection counts per weekday.
7. `src/client/debug.html` (dev only): any day's board in 2D, par solution, difficulty breakdown, prev/next.

**Files:** `src/shared/{generate,difficulty,names}.ts` + tests, `scripts/{gen,report}.ts`,
`content/puzzles.json`, `src/client/debug.{html,ts,css}`, `package.json`.

**Tests:** same seed → same puzzle; all 90 days solvable and stored par equals solver par; every
weekday inside its band; no day solvable with zero pieces; ≤ 20 minimum solutions; no duplicate names;
generation of 90 days finishes in a bounded time (logged).

**Exit criteria:** `content/puzzles.json` committed with 90 days; report shows every weekday in band;
a short written report of rejection rates and any band that was hard to hit.

**Phone demo:** open the debug page (desktop is fine here) and step through days 1–14; note any that
feel wrong for their weekday.

---

## Milestone 3 · 3D vertical slice

**Goal:** day 1 playable start to finish on a phone, placeholder art, right feel.

**Decisions needed first:** A1 (Release button vs auto-submit), A9 (tap cycle vs tray), W1.

**Tasks**
1. Scene bootstrap: renderer, capped pixel ratio with the adaptive drop, resize, context-loss handling, teardown.
2. Island from puzzle data: instanced tiles, rocks, trees, water, sources, lanterns.
3. Input: tap → tile via raycast against a ground plane; 44 px effective targets on a 9x9 at 360 px wide.
4. Tap cycle with Undo, Reset, inventory counter; beams re-traced on every change from the shared tracer.
5. Beam rendering (simple ribbons for now), lantern lit state, "ready" state and Release†.
6. Camera: fixed framing that fits any board on 360x640 and 430x932; 90° rotate with a 400 ms ease.
7. Placeholder nightfall on release.
8. A local puzzle source (day 1 from `content/puzzles.json`) so M3 does not depend on M5.

**Files:** `src/client/game.html`, `src/client/game/{main,scene,island,beams,input,camera,state,hud}.ts`,
`src/client/game.css`, remove template globe assets from `public/`.

**Tests:** `state.ts` (pure reducer: place, cycle, undo, reset, inventory limits, ready/released);
tile-picking maths; camera fit maths for 6x6 to 9x9 on both phone sizes.

**Exit criteria:** you play day 1 start to finish in the Reddit app; 60 fps on your phone; no
allocations in the render loop (checked with the perf overlay stub).

**Phone demo:** open the post, tap the button, solve day 1, watch the placeholder nightfall.

---

## Milestone 4 · Final art direction and the signature moment

**Goal:** the final look. Not a draft.

**Tasks**
1. Sky dome shader on one `dusk` uniform; stars; distant rocks; slow clouds.
2. Island: chunky tiles with height variation, tapered underside into mist, props off playable
   tiles, baked AO in vertex colours.
3. Beam shader: core + halo + travelling shimmer; prism fan with a sparkle; additive glow sprites.
4. Lantern: pop, inner glow, warm spill decal on neighbours.
5. Nightfall sequence, then the sky-lantern release with the snoovatar (approach from
   `PLATFORM.md`) and the camera following it up into the sky.
6. Five biomes as palette + prop sets (Moss, Snow, Cherry blossom, Desert dune, Autumn).
7. UI kit: paper panels, bundled OFL display font, hand-drawn icons (undo, reset, rotate, mute, release).
8. Colour-blind glyphs on beams and lanterns; reduced-motion variants.
9. Perf overlay (dev): fps, frame time, draw calls, triangles.
10. Judge pass against the anti-slop checklist.

**Files:** `src/client/game/{sky,island,props,beams,lantern,nightfall,release,biomes,glyphs,perf}.ts`,
`src/client/game/shaders/*`, `src/client/ui/*`, `src/client/assets/fonts/*` (+ licence), `config.ts`.

**Tests:** biome palettes pass AA contrast for UI text (computed in a test); every colour and timing
used by the scene is read from `config.ts` (lint rule or grep test for stray literals in shaders);
glyph mapping covers all seven colours.

**Exit criteria:** draw calls < 120, triangles < 80k, 60 fps on the test phone, JS < 450 KB gzipped;
a 15-second phone recording of nightfall and release that two friends react to.

**Phone demo:** solve day 1, watch the full nightfall and release; rotate through biomes with the
debug switch.

---

## Milestone 5 · Server and Reddit layer

**Goal:** the game is a Reddit game: validated, social, daily.

**Tasks**
1. Server skeleton: Hono routes, typed request/response shapes in `src/shared/api.ts`, a small
   Redis layer with the SPEC key table (sky as a sorted set†, grouped reads†).
2. `/api/today`, `/api/start`, `/api/submit` with full server-side re-trace and anti-cheat.
3. Streaks with the weekly grace rule†, lantern-style unlocks, flair (silent on failure).
4. Leaderboard (daily top 10 + own row with snoovatars; all-time by Lamplighter medals), percentile.
5. Heatmap: per-tile counters, locked until submit; par solution locked until the day ends.
6. Share: stickied results comment per daily post, `/api/share` replies under it†, explicit tap only.
7. Shared Night Sky: append + `realtime.send('sky-{day}')`, `/api/sky` for late joiners, client
   renders with instancing (300 cap, glow band beyond), "older nights" at the horizon†, poll fallback.
8. Scheduler `daily-post` (idempotent†, `postData` carries the preview payload†) and the mod menu
   action "Post today's Lumen". Mod action "Reset test data"† (removed in M9).
9. Logged-out path: unranked play, anonymous lantern, login prompt at the right moments†.
10. Journeys events per SPEC, receipts logged in dev.
11. Subscribe button (separate action, never gating).
12. Record the insurance demo video from the phone.

**Files:** `src/server/{index,routes/*,core/{puzzle,submit,streak,flair,leaderboard,heatmap,sky,share,post,avatar,redis}}.ts`,
`src/shared/api.ts`, `src/client/game/{net,sky-lanterns,result,heatmap,journeys}.ts`, `devvit.json`.

**Tests (Vitest + `@devvit/test`):** submit rejects extra pieces, illegal tiles, wrong day, replayed
submits, and never trusts client score or time; simulated 10-day streak run including a grace day, a
second miss in the same week, and a week boundary; leaderboard ordering and clamp; heatmap 403 before
submit; par solution hidden until day end; daily-post handler run twice creates one post; rollover
grace window; logged-out submit writes nothing ranked.

**Exit criteria:** two accounts play the same island and leaderboard, heatmap and percentile reflect
both; a lantern released on one phone appears on the other within 2 seconds; a temporary 5-minute
cron creates a correct daily post; rough demo video saved.

**Phone demo:** two phones side by side on the same post; solve on one, watch the lantern rise on
the other; open the result card; tap Share and find your comment under the stickied one.

---

## Milestone 6 · Archipelago and Island Builder

**Goal:** the subreddit's history as a place; players make Sunday.

**Tasks**
1. `/api/archipelago` and the `archipelago` entry: night map of every past day (glow by solve count,
   your medal, creator snoovatar), tap to play unranked. Flat-list fallback behind a config flag.
2. Archive play: any past day loads in the game entry, clearly unranked, heatmap after solve.
3. `builder` entry: place sources, lanterns, rocks, water on a grid; live solver check; name field
   with a length limit; publish only when solvable, par from the solver, server re-validates with a time cap.
4. `/api/islands`: `submitCustomPost` with `runAs: 'USER'` and `userGeneratedContent`; per-user weekly cap.
5. `sunday-pick` job: highest-scored island of the week inside the difficulty band becomes Sunday's
   puzzle; "Island by u/name"; Islandwright flair; generated fallback when none qualifies.

**Files:** `src/client/archipelago.{html,ts,css}`, `src/client/archipelago/*`,
`src/client/builder.{html,ts,css}`, `src/client/builder/*`, `src/server/core/{archipelago,islands,sunday}.ts`,
`src/server/routes/*`, `devvit.json`.

**Tests:** builder rejects unsolvable, over-size and trivially solved boards; server re-validation
matches client; solver time cap returns a clean refusal; Sunday pick chooses correctly among
fixtures, respects the band and falls back; archive submits never touch ranked keys.

**Exit criteria:** the Archipelago shows every generated past day; a builder island publishes, plays
and can be picked for Sunday (run the job by hand).

**Phone demo:** open the Archipelago, tap an old island, play it; build a four-tile island, publish
it, open the new post.

---

## Milestone 7 · First-time experience and finish

**Goal:** the first minute and the last screen are as good as the middle.

**Tasks**
1. Tutorial: three micro islands (place, flip, prism), one hint line each, skippable, `tutorialDone` in Redis.
2. Inline preview card from `postData`†: title line, description, attribution, SVG isometric
   silhouette, lantern count, par, sky strip, streak, one button. Return-visit state with countdown.
3. Final result card (one screen) with the heatmap thumbnail on it†.
4. Sound: WebAudio synthesis only† — rising chimes, wooden click, nightfall pad; starts after a tap,
   mute button, mutes on `visibilitychange`.
5. Trailer mode: dev-only entry (owner/mod gated) playing the scripted camera sequence end to end.
6. Performance pass against every row of the budget; report the numbers.

**Files:** `src/client/preview.{html,ts,css}` (replaces `splash.*`), `src/client/game/{tutorial,result,audio,trailer}.ts`,
`src/client/trailer.html`, `content/tutorial.json`, `devvit.json`.

**Tests:** preview renders from `postData` alone with fetch stubbed to fail; SVG silhouette snapshot
for three days; tutorial islands are solvable with exactly the taught move; audio module never
creates a context before a user gesture; result text matches the SPEC two-line format.

**Exit criteria:** Lighthouse mobile > 80 on the inline post and first paint < 1 s; 60 fps in play;
trailer mode records the full sequence in one take; every budget row reported with a number.

**Phone demo:** from a fresh account: feed card → tutorial → today's island → nightfall → result card.

---

## Milestone 8 · Harsh judge review

**Goal:** find what a judge would find, first.

**Tasks**
1. Score the game on the four criteria (in tie-break order) and every item in PROMPT section 3;
   compare against the daily games the brief names (r/hotandcold, r/colorpuzzlegame, r/syllo,
   r/pocketgrids) and past winners.
2. Stranger test: fresh logged-out browser profile, only the post link, no instructions.
3. Edge cases: rollover at 00:00 UTC, logged-out viewers, archive posts, slow network (throttled),
   reduced motion, 360x640 and 430x932, 300+ lanterns, WebGL context loss, app update mid-session.
4. Write `REVIEW.md` with P0/P1/P2; fix every P0 and P1.
5. Walk SPEC and PROMPT top to bottom and list anything dropped.

**Files:** `REVIEW.md`, fixes wherever they land.

**Tests:** a failing test first for each bug that has a repro; a 300-lantern render benchmark.

**Exit criteria:** no open P0 or P1; all SPEC acceptance tests ticked or explicitly listed as cut.

**Phone demo:** you repeat the stranger test on a friend's phone and watch without helping.

---

## Milestone 9 · Final pass, freeze and handoff

**Goal:** Opus 5.5 can carry this to submission without a design question.

**Tasks**
1. Fix what remains from `REVIEW.md`.
2. Audit: every tunable in `config.ts` with a comment; every risky design choice has a flag.
3. `README.md`: what Lumen is, how to play, features, tech, how it uses each Reddit capability.
4. `HANDOFF.md`: known issues with repro steps; tuning guide for `config.ts`; how to run the debug
   page, report and trailer; how to reset test data and launch in the public subreddit; a complete
   brief for anything cut; the submission checklist with owners and dates.
5. Remove dev-only actions that must not ship; confirm trailer and debug entries are gated.
6. Tag `v1.0-freeze`. Prepare the app for review submission (PROMPT D3).

**Files:** `README.md`, `HANDOFF.md`, `config.ts`, `devvit.json`.

**Tests:** full suite green; a test that fails if a numeric literal outside an allow-list appears in
gameplay modules; build size check in CI.

**Exit criteria:** feature freeze; everything left is on SPEC's "Safe for Opus" list; signature
feature checks from SPEC "Quality bar" ticked on two phones.

**Phone demo:** the full loop on the frozen build, then trailer mode once through.

---

## After the freeze (Opus 5.5, from HANDOFF.md)

- Nov 17–18: submit the app for review; request anything still pending on Journeys.
- Nov 17–23: playtest with 10–20 people; tune `config.ts` only; bugs need a repro and a failing test.
- Nov 24–30: clean r/LumenGame, make it public, start real daily posts.
- Dec 1–5: record with trailer mode (under 60 s, nightfall inside the first 10), screenshots, write-up.
- Dec 6–7: submit; then open the public project page and check every link shows.
