# Lumen — Game Spec & Fable Build Plan

Nov 12, 2026 · @Maulik Ranadive

## How to use this with Fable

Export this doc as Markdown, save it as `SPEC.md` in the repo root, and start every Fable session by pointing it at the section for that day. Fable builds; you playtest on your phone and make the taste calls.

1. Scaffold the repo yourself first (Day 0 below): the Devvit **Three.js** template, a private test subreddit, `devvit playtest` working.
2. Paste the kickoff prompt below into Fable once. It writes `PLAN.md` and `CLAUDE.md`, then stops for your review.
3. Each session after that: paste that day's prompt from the schedule, let it work, check the exit criteria on a real phone, commit.
4. Use Fable for the hard parts only: the engine, solver, generator, art direction and the Reddit layer. Boilerplate, copy edits and small fixes can wait for Opus after Nov 16.

**Kickoff prompt (paste once):**

```
You are the lead engineer, game designer and art director for Lumen, a daily 3D light-routing puzzle on Reddit's Devvit Web platform. We are entering Reddit's Game of the Day hackathon to win Best Daily Game ($15,000). Deadline: Dec 8, 6pm PT.

Hard constraint: you (Fable 5.2) are only available until the end of Nov 16. After that, a less capable model maintains the project. So every feature that needs taste, novel algorithms or cross-system design must be finished and final by Nov 16 (see "The Fable rule" in SPEC.md). Never leave anything half-designed.

Read SPEC.md fully. Then, before writing any code:
1. Rewrite my intent into your own detailed build prompt for this project and save it as PROMPT.md. Flag anything in SPEC.md that is ambiguous, contradictory, weak for winning, or risky on Devvit (inline-mode rules, CSP, mobile webviews, Redis limits). Propose improvements that would make judges call this the clear winner.
2. Write PLAN.md: milestones matching the schedule in SPEC.md, each with tasks, files touched, tests, and a demo I can check on my phone.
3. Write CLAUDE.md: repo conventions (TypeScript strict, shared pure engine in src/shared with Vitest tests, all tunable numbers in src/shared/config.ts, no external network calls from the client, commit after each milestone).

Stop after these three files and wait for my review. Quality bar: this must look and feel like a hand-crafted indie game that beats every other entry, not an AI demo. Judges score Delightful UX, Polish, Reddit-y community fit and Daily Content equally, and give bonus credit for Devvit Journeys, flair, comments, snoovatars and streaks.
```

## The Fable rule: everything hard ships by Nov 16

Fable 5.2 builds every feature so it is complete, final and tuned by Monday Nov 16, 11:59 pm IST. From Nov 17, Opus 5.5 only changes numbers, fixes bugs with a clear repro, writes copy and helps with the submission. **No new features after Nov 16.**

| Fable 5.2 only (by Nov 16) | Safe for Opus 5.5 (from Nov 17) |
| --- | --- |
| Engine, solver, generator and difficulty model | Changing weights and bands in `config.ts` after playtests |
| Final art direction: shaders, sky, beams, nightfall, sky-lantern release, biomes | Swapping a colour or timing value already exposed in config |
| Realtime shared sky, Archipelago, Island Builder | Bug fixes with a known repro and a failing test |
| Server, anti-cheat, streaks, flair, snoovatars, Journeys | Copy edits, README, Devpost write-up |
| Tutorial, preview card, result card, sound design | Subreddit setup, publishing the app, community posts |
| Trailer mode for recording the demo video | Editing the demo video from trailer-mode captures |
| Tuning tools: debug viewer, difficulty report, perf overlay | Running those tools and pasting results back |

**Rules that make the handoff safe:**

- Every tunable number lives in `src/shared/config.ts` (difficulty weights, par bands, animation timings, colours, streak rules), so post-Fable tuning never touches logic.
- Any feature not finished by Monday is either cut entirely, or Fable writes a complete implementation brief for it in `HANDOFF.md` (exact files, functions, edge cases, tests). Nothing is left half-designed.
- Use your daytime too: start a long autonomous Fable task before work (Fri to Mon mornings) and review it in the evening. Commit before each run so you can roll back.

## Vision and pillars

**Pitch:** Every day a tiny floating island waits in the dusk. Place mirrors and prisms to bend light into every paper lantern before night falls, using as few pieces as you can. Then see how the whole subreddit solved it.

The feeling we want is the moment the last lantern catches and the island blooms at night: calm, clever and beautiful in under four minutes.

**Pillars (every decision gets checked against these):**

1. **Readable at a glance.** A first-time player understands the board in three seconds on a phone. Light only travels in four straight directions, and every piece has one obvious job.
2. **Easy to finish, hard to master.** Beams are live while you build, so anyone can light every lantern. Skill shows in hitting par (the fewest pieces possible).
3. **A beautiful payoff.** Solving triggers nightfall, lanterns bloom and the island glows. That moment is the demo video.
4. **Better with the crowd.** After you submit, you see where everyone else placed their pieces and how many hit par. Streaks, flair and player-made islands keep people coming back.
5. **Runs everywhere.** 60fps on a mid-range Android phone inside the Reddit app. The inline post loads in under 1 second.

**How Lumen scores on each judging criterion (equal weight):**

| Criterion | What judges want | What Lumen does |
| --- | --- | --- |
| Delightful UX | Easy and fun to discover | Tap-only controls, live beams, a 3-island tutorial with no wall of text, nightfall payoff |
| Polish | Close to launch quality, Devvit-compliant | Real-phone performance budget, Lighthouse above 80 on the inline post, no layout breaks, sound with mute |
| Reddit-y | Community-minded, its own identity | Crowd heatmap after submit, opt-in result comment, streak flair, Sunday island designed by a player |
| Daily Content | Fresh, calibrated challenges | Seeded generator plus solver: every puzzle provably solvable, par computed, difficulty ramps Monday to Saturday |

**Not in scope for v1:** multiplayer, accounts outside Reddit, monetization, more than one puzzle per day (beyond the tutorial and archive).

## Signature features

A good puzzle gets an honorable mention; a moment the whole subreddit shares wins Best Daily Game. These three features are what judges should remember, and all three are Fable work.

1. **The Shared Night Sky (live).** When you solve, your lantern lifts off the island carrying your snoovatar and drifts up into tonight's sky, joining everyone who solved today. While you play, lanterns from other players rise in real time (Devvit realtime) with a quiet line: "u/name lit Moss Steps". The feed card shows the count: "1,284 lanterns tonight". Streaks unlock lantern styles at 3, 7, 14 and 30 days (paper, star, koi, comet), so long-time players are visible in everyone's sky. Render with instanced sprites; draw at most 300 and show the rest as a soft glow band.
2. **The Archipelago.** A night map where every past island floats. Each one glows by how many people lit it; yours show your medal; Sunday islands carry the creator's snoovatar. Tap one to play it unranked. Over weeks the subreddit's history becomes a world you can explore, which is daily content and retention in one screen.
3. **Trailer mode.** A dev-only entry point that plays a scripted camera sequence: dusk, a solve, nightfall, the lantern rising, a pull back to a sky full of lanterns, then the Archipelago. You record the demo video in one take, without Fable.

**Every Reddit feature the judges named, used for a reason:**

| Feature judges named | How Lumen uses it |
| --- | --- |
| Devvit Journeys | Start, progress per lantern, interactions and end with win and score |
| Flair | Medal plus streak flair ("Lamplighter 🔥12"); Sunday island creators earn "Islandwright" |
| Comments | Opt-in result card comment from the player's account |
| Snoovatars | Your snoovatar rides your sky lantern, appears on your result card and leaderboard row, and credits Sunday creators |
| Streaks | Daily streak with a one-day grace, unlocking lantern styles everyone can see |
| Also used | Realtime, scheduler daily posts, user-made island posts, subscribe prompt |

**The judges' "stand out" list, item by item:**

| Judges' item | Lumen's answer |
| --- | --- |
| Intuitive onboarding | Three 10-second micro islands with one contextual hint each |
| Visual craft | Hand-made dusk diorama, one visual identity, see "3D art direction" |
| Calibrated daily content | Generator plus solver, par on every puzzle, Monday-to-Saturday ramp |
| Focused gameplay | Start screen shows name, description, date, attribution and stats; play shows only the island and two thin bars |
| Clear end states and re-engagement | One result card: medal, stats, streak, comment, subscribe, then the sky |
| Journey event instrumentation | Full journey map, requested for approval in week one |

**Snoovatar caveat:** the client cannot load images from other domains, so Session 1's platform spike must prove how snoovatars reach the webview (for example, the server fetches the image and returns it as a data URL). Fallback: a generated glyph from the username, so the feature never breaks.

## Core rules

The board is a square grid of 6x6 to 9x9 tiles on top of a floating island. Light moves one tile per step in four directions only (north, east, south, west). The whole rule set has to fit on one tutorial card.

**Tiles and pieces:**

| Element | Placed by | Behaviour |
| --- | --- | --- |
| Sun crystal (source) | Puzzle | Emits one beam in a fixed direction. White, or a fixed colour (red, green, blue) |
| Lantern (target) | Puzzle | Lit when a beam of an accepted colour reaches it. White lanterns accept any colour. Coloured lanterns need that exact colour. Mixed lanterns (magenta, cyan, yellow) need both component colours. Lanterns absorb beams |
| Mirror | Player | Two orientations, / and . Reflects 90 degrees. Both faces reflect |
| Prism | Player | A white beam splits into red (turns left), green (straight on) and blue (turns right), relative to its direction of travel. A coloured beam passes straight through unchanged |
| Rock or tree | Puzzle | Blocks light. Cannot hold a piece |
| Water | Puzzle | Light passes over it. Cannot hold a piece |
| Fixed mirror | Puzzle | A mirror the player cannot move. Introduced later in the week |
| Empty grass | Puzzle | Light passes. The player may place one piece here |

**Beam rules (the engine must be deterministic and identical on client and server):**

- Trace from each source in a fixed order. A beam stops when it hits a lantern, a rock, the board edge, or a tile it has already crossed in the same direction and colour (loop guard).
- Beams of different colours can cross the same tile without interacting.
- Cap total trace steps at 4 x tiles x 4 directions x 4 colours to rule out infinite loops.

**Controls (tap only, because inline Reddit posts allow taps only):**

- Tap an empty grass tile: place a mirror (/).
- Tap the same tile again: flip to . Again: swap to a prism (when the day allows prisms). Again: clear the tile.
- Long-press is not used. An Undo button and a Reset button sit in the bottom bar.
- The beams update instantly after every tap.

**Inventory:** each day lists how many mirrors and prisms you can use (for example 6 mirrors, 1 prism). The counter is always visible.

**Winning and scoring:**

- The puzzle is solved the moment every lantern is lit. Nightfall plays immediately.
- Your score is the number of pieces placed. Fewer is better. The day's par is the solver's minimum.
- Medals: hitting par earns *Lamplighter*, par+1 earns *Glow*, anything more earns *Spark*. No failure state, ever.
- Time from Play to solve is recorded and only breaks ties on the leaderboard.
- Your **first** solve of the day counts for the leaderboard and streak. After that you can keep playing in free mode to chase par, but it is marked as unranked.

**Dusk:** the sky slowly drifts from late afternoon to dusk over about three minutes while you play. It is atmosphere only, never a timer you can lose to. Solving snaps it to full night.

**Weekly ramp:**

| Day | New idea | Typical par |
| --- | --- | --- |
| Monday | Mirrors only, one source | 2 to 3 |
| Tuesday | Two sources or a fixed mirror | 3 to 4 |
| Wednesday | Prisms and coloured lanterns | 3 to 4 |
| Thursday | Water and decoy lanterns | 4 to 5 |
| Friday | Mixed-colour lanterns | 4 to 5 |
| Saturday | Everything, the hardest of the week | 5 to 7 |
| Sunday | Community island (falls back to a medium generated puzzle) | Set by the solver |

## Daily loop and screens

One post per day, one island, two to four minutes. The flow below is the whole game; anything not on it is cut.

1. **Inline preview (in the feed, no Three.js).** A light HTML card showing "Lumen #12 · Moss Steps · Thursday", a one-line description, attribution ("Island by u/name" on Sundays), an isometric SVG silhouette of today's island drawn from the puzzle data, lantern count, par, a strip of tiny glowing dots for tonight's sky ("1,284 lanterns tonight") and your streak. One big **Light the lanterns** button opens expanded mode. Must load in under 1 second.
2. **First-time tutorial (expanded, first visit only).** Three micro islands, about 10 seconds each: place a mirror, flip a mirror, use a prism. Each shows one short hint line near the tile, never a text wall. Skippable.
3. **Play (expanded).** The island fills the screen with a slow 3D float. Top bar: puzzle number, inventory counters, a par marker. Bottom bar: Undo, Reset, rotate camera 90 degrees, mute. Other players' lanterns rise faintly in the distant sky in real time. Nothing else on screen.
4. **Nightfall and release.** When the last lantern lights, the sky goes to night over about 1.5 seconds, lanterns bloom one by one with a soft chime, then your own sky lantern (with your snoovatar) lifts off and the camera follows it up into the shared sky. No popups during this moment.
5. **Result card.** Exactly one end screen over the night sky: your snoovatar, medal, pieces versus par, time, streak flame, percentile ("fewer pieces than 72% of players"). Actions: **See how everyone solved it**, **Share to comments** (opt-in), **Explore the Archipelago**. A quiet "Join r/LumenGame" subscribe button sits at the bottom.
6. **Crowd reveal.** Your solution stays visible while a heatmap fades in on the tiles where other players placed pieces. A line reads "18% hit par today". The actual par solution is shown only after the day ends, to avoid spoilers.
7. **Return visit the same day.** The preview shows your result, your lantern in tonight's sky, and a countdown to the next island.

**Copy and tone:** calm, warm and short. Examples: "4 lanterns wait in the dusk." / "Lit with 5. Par is 4." / "Come back at nightfall tomorrow." No exclamation marks except on hitting par.

**Result card text (for comments, plain text, about 2 lines):**

```
Lumen #12  🏮🏮🏮🏮  5 pieces (par 4)  ⏱ 1:42
Glow · 🔥 7-day streak
```

## Puzzle generator, solver and difficulty

Every published puzzle must be provably solvable, have a known par, and land in its weekday's difficulty band. This is where Fable's time pays off most: competitors hand-make or randomly generate levels; we ship a calibrated daily stream.

**Shared engine (`src/shared`, pure TypeScript, no Three.js, no DOM):**

- `types.ts`: Tile, Piece, Colour, Puzzle, Placement, TraceResult.
- `trace.ts`: deterministic beam tracer returning beam segments (for rendering) plus the set of lit lanterns.
- `solve.ts`: minimum-piece solver.
- `generate.ts`: seeded generator (a seeded PRNG such as mulberry32 keyed by `lumen-{dayNumber}`).
- `difficulty.ts`: scoring and band checks.
- `validate.ts`: used by the server to re-check every submission.
- Vitest tests for all of the above, including hand-made fixtures with known answers.

**Solver:** iterative deepening on piece count (k = 0, 1, 2 … up to the inventory limit). Key pruning: a piece only matters on a tile some beam currently crosses, so at each depth branch only over empty tiles on the current beam paths, times the allowed piece types and orientations. Memoize visited placement sets. Target: solve any 9x9 puzzle with par up to 7 in under 2 seconds in Node. Also count the number of distinct minimum solutions (capped at 50) for the difficulty score.

**Generator (construct backwards, then verify):**

1. Pick the weekday's template: board size, source count, allowed pieces, colour rules.
2. Place sources on the edges. Random-walk each beam, choosing turn tiles where a mirror or prism will go. Put lanterns at the ends of the walks and on some branches.
3. Add rocks, trees and water that respect the intended path, plus 1 to 3 decoy features (a tempting lantern-adjacent tile, a near-miss line).
4. Remove all player pieces. Run the solver to get the true par (it may be lower than the constructed path; that is fine).
5. Reject and retry if: no solution, par outside the weekday band, more than 20 minimum solutions (too loose), or the trivial straight-line check passes with 0 pieces.

**Difficulty score:** a weighted mix of par, branching factor at depth 1, number of minimum solutions (fewer is harder), required prism or mixed-colour use, and number of decoys. Log every component so I can tune weights after playtests.

**Content pipeline:** a script (`npm run gen -- --from 1 --to 90`) generates 90 days of puzzles into `content/puzzles.json` with their par, difficulty and a one-line name ("Moss Steps", "Two Suns"). Commit it. The server seeds Redis from this file and the scheduler serves the next day. I review the first 14 days by hand in the archive viewer before launch.

**Day numbering:** day 1 is the launch date. The daily rollover is 00:00 UTC (5:30 am IST, 4 pm PT), matching when the scheduler posts.

## 3D art direction and performance

The look is a hand-made paper-lantern diorama at dusk: a mossy floating rock with soft, rounded low-poly shapes, warm amber lanterns and cool indigo sky. Think a Monument Valley calm, not a tech demo. Beauty comes from lighting, colour and motion, not polygon count.

**Scene:**

- Isometric-feeling perspective camera (about 35 degree pitch), fixed framing that fits the whole board on a portrait phone. Tap buttons rotate it in 90 degree steps with a 400 ms ease.
- The island: chunky stylised tiles with slight height variation, a rocky underside tapering into mist, a few hand-placed props (grass tufts, small stones, a fence post) that never sit on playable tiles.
- All geometry is procedural or built from a few primitives. No external model files are required; any textures are tiny and bundled.
- Sky: a vertical gradient dome driven by one `dusk` uniform (0 = afternoon gold, 1 = indigo night with stars). Distant floating rocks and slow drifting clouds for depth.

**Light beams (the hero visual):**

- Each beam segment is an unlit additive ribbon (or a thin box) with a soft core and a wider faint halo, plus a gentle travelling shimmer in the shader.
- Prism splits fan into red, green and blue with a small sparkle at the split point.
- Glow uses cheap additive sprites and halo geometry, not full-screen bloom. Optional half-resolution selective bloom only on high-end devices.
- A lit lantern pops (scale 1.0 to 1.15 to 1.0), its paper glows from inside, and a small point of warm light spills onto nearby tiles via vertex colour or a fake light decal, not a real-time light.

**Biomes for daily variety:** palette and props rotate weekly: Moss (default), Snow, Cherry blossom, Desert dune, Autumn. Same geometry, different palette and props, so each week feels fresh at almost no cost.

**Accessibility:** coloured beams and lanterns also carry a shape glyph (red triangle, green circle, blue square, mixed = both glyphs) so colour-blind players can play every puzzle. Text contrast meets WCAG AA. All tap targets are at least 44 px.

**UI style:** custom, not stock components. One self-hosted display font with character for titles (bundled; the client cannot fetch from external domains) plus a clean system font for numbers. Hand-drawn style icons for undo, reset, rotate and mute. Translucent warm-paper panels. Nothing generic: no default Tailwind cards, no purple gradients, no emoji inside the game UI.

**Sound:** soft chime per lantern (pitch rises with each), a gentle wooden click when placing, a low pad at nightfall. Audio starts only after a tap, has a mute button, and mutes on `visibilitychange`.

**Performance budget (fail the build review if any is missed):**

| Metric | Budget |
| --- | --- |
| Inline preview load | Under 1 s, Lighthouse mobile above 80, no Three.js |
| Expanded game JS | Under 450 KB gzipped, Three.js tree-shaken |
| Frame rate | 60 fps on a mid-range Android (for example a 3-year-old Samsung A-series), never below 45 |
| Draw calls | Under 120 (instanced tiles and props) |
| Triangles | Under 80k on screen |
| Pixel ratio | Capped at 2, drops to 1.25 if the frame time stays above 22 ms |
| Shadows | None real-time; baked ambient occlusion in vertex colours |
| Memory | No allocation in the render loop; dispose geometries on teardown |

## Reddit and community layer

The community features turn a nice puzzle into a Reddit game. All seven are Fable work and are built in this priority order; if time runs out, cut from the bottom, never leave one half-built.

1. **Crowd heatmap.** On submit the server increments a per-tile counter for every piece placed. After you submit, tiles tint by how often others used them, with a legend ("most-used tiles"). Also show "18% hit par" and your percentile. Locked until you submit, so it never spoils.
2. **Streaks, flair and lantern styles.** A streak counts consecutive days with a ranked solve, with one grace day allowed per week. On each solve the app updates user flair in the game subreddit, for example "Lamplighter 🔥12". Streak milestones (3, 7, 14, 30 days) unlock sky-lantern styles. Confirm the app account has the flair permission it needs; if flair fails, the game carries on silently.
3. **Leaderboard with snoovatars.** Per-day top 10 by pieces, then time, plus your own row, each with the player's snoovatar. An all-time tab ranks by total Lamplighter medals.
4. **Share to comments (opt-in).** A clearly labelled button posts the 2-line result card as a comment from the player's account (`submitComment` with `runAs: 'USER'`). Per Devvit's user-action rules: always explicit, never automatic, never required to keep playing, kept separate from other actions.
5. **The Shared Night Sky.** On a ranked solve the server appends a lantern (username, style, snoovatar reference) to `sky:{day}` and broadcasts it on the realtime channel `sky-{day}` (channel names cannot contain a colon). Clients in the post render new lanterns live; late joiners load the list from `/api/sky`.
6. **Daily post and the Archipelago.** The scheduler creates the new custom post at 00:00 UTC titled "Lumen #12 · Moss Steps · Thursday". Mods also get a menu action, "Post today's Lumen", as a manual fallback. The Archipelago map shows every past day (glow by solve count, your medal, creator snoovatar) and plays any of them unranked.
7. **Island Builder and Sunday community island.** An editor in expanded mode to place sources, lanterns, rocks and water. Publishing is allowed only if the shared solver finds a solution, and the solver sets the par. It creates a custom post from the creator's account (`runAs: 'USER'`), flagged as user-generated content. On Saturday a scheduled job picks the highest-scored island of the week that meets the difficulty band; it becomes Sunday's puzzle, credited "Island by u/name", and the creator gets Islandwright flair.

**Game subreddit:** r/LumenGame (or the nearest free name). Before judging, the demo post goes in a public test subreddit with fewer than 200 members, per the hackathon rules. Pin a short "How to play" post and a feedback thread.

**Moderation basics:** builder island names go through a length limit and the Reddit content flow; no free-text fields appear anywhere else.

## Technical architecture

Start from Reddit's official Devvit Web **Three.js template** (`npm create devvit@latest`, pick Three.js, or [reddit/devvit-template-threejs](https://github.com/reddit/devvit-template-threejs)). The client and server both import the same pure engine, so the server can re-check every solve.

&#91;embedded content: Lumen architecture · client, Devvit server, Reddit platform, shared engine\]

The client never scores itself: the server re-traces every submission with the shared engine before it writes anything to Redis.

**Platform constraints that shape the design** (from the [Devvit Web docs](https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/devvit-web/devvit_web_overview.mdx)):

- The client can only call its own `/api/` endpoints; CSP blocks every other domain, so fonts, audio and textures must be bundled.
- Server endpoints are serverless: 30 s max per request, no websockets, no `fs`, server bundle compiled to CommonJS.
- `localStorage` is wiped on every app update, so anything that matters lives in Redis.
- Inline mode allows tap and click only, no scroll hijacking, user-initiated expansion, and needs an under-1-second load ([view modes](https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/server/launch_screen_and_entry_points/view_modes_entry_points.md)).
- Redis has a 5 MB request limit and lower storage on unpublished apps, so keep keys small and add TTLs.

**Repo layout:**

```
src/
  shared/   engine: types, trace, solve, generate, difficulty, validate (+ tests)
  client/
    preview.html + preview.ts   inline card, SVG island silhouette, no Three.js
    game.html + game/           Three.js scene, input, UI overlay, audio, tutorial
    builder.html                Island Builder (stretch)
  server/   Hono app: /api routes, /internal scheduler + menu handlers
content/puzzles.json   90 generated days
devvit.json
```

**devvit.json essentials:** entrypoints `default` (preview.html, inline, height `regular`), plus `game`, `archipelago`, `builder` and a dev-only `trailer` (all expanded); permissions `redis`, `realtime`, `journeys: true`, `reddit` with `asUser: ["SUBMIT_COMMENT", "SUBMIT_POST", "SUBSCRIBE_TO_SUBREDDIT"]`, and `http` with only the Reddit image domain the platform spike shows snoovatars need; scheduler tasks `daily-post` (cron `0 0 * * *`) and `sunday-pick` (cron `0 20 * * 6`); a subreddit menu item for mods, "Post today's Lumen".

**API endpoints:**

| Method and path | Purpose |
| --- | --- |
| GET /api/today | Puzzle for this post's day, your state (solved, streak, medal, lantern style), day stats, sky count |
| POST /api/start | Records the server-side start time for this user and day |
| POST /api/submit | Body: placements. Server re-traces with the shared engine, scores, then writes the leaderboard, heatmap, stats, streak, flair and sky lantern, and broadcasts on `sky-{day}`. Returns the result card data and percentile |
| GET /api/leaderboard?day=N | Top 10 plus your row, with snoovatars; `scope=alltime` for medal totals |
| GET /api/heatmap?day=N | Per-tile counts; 403 until you have submitted for that day |
| GET /api/sky?day=N | Tonight's lanterns (latest 300 plus the total count) |
| GET /api/archipelago | Every past day: name, biome, solve count, your medal, creator |
| GET /api/avatar?u=name | Snoovatar image proxied and cached by the server (approach confirmed by the platform spike) |
| POST /api/share | Posts your result card as a comment with `runAs: 'USER'` |
| POST /api/islands | Builder: validate with the solver, then create the island post |
| POST /internal/scheduler/daily-post | Creates the day's custom post with `postData: { day }` |
| POST /internal/scheduler/sunday-pick | Picks Sunday's community island |

**Redis keys:**

| Key | Type | Contents |
| --- | --- | --- |
| `puzzle:{day}` | string | Puzzle JSON (seeded from content/puzzles.json) |
| `post:{postId}:day` | string | Day number for each daily post |
| `start:{day}:{userId}` | string | Start timestamp, TTL 2 days |
| `sub:{day}:{userId}` | string | First ranked submission: placements, pieces, timeMs, TTL 45 days |
| `lb:{day}` | sorted set | Score = pieces x 10,000,000 + timeMs, lower is better |
| `lb:alltime` | sorted set | Lamplighter medal count |
| `heat:{day}` | hash | Tile index to count |
| `stats:{day}` | hash | plays, solves, parHits |
| `sky:{day}` | list | Lanterns (username, style, time), trimmed to the latest 300; count in `stats:{day}` |
| `avatar:{username}` | string | Cached snoovatar image or URL, TTL 7 days |
| `user:{userId}` | hash | streak, lastDay, graceUsedWeek, bestStreak, medals, lanternStyle, tutorialDone |
| `islands:week:{n}` | sorted set | Builder islands by post score |

**Anti-cheat:** the client never reports its own score. The server recomputes pieces and lit lanterns from the placements, rejects placements on illegal tiles or beyond inventory, and measures time from its own start record.

**Journeys telemetry:** `App.Ready` when the island is interactive, `Journey.Start` on the Play tap, `Journey.Progress` as lanterns light (progress = lit / total), `Journey.Interaction` for undo, reset and rotate (on tap release, not press), and `Journey.End` with `complete` and `game { win, score }` on submit. Journey maps need Reddit's approval before events flow ([Journeys docs](https://github.com/reddit/devvit-docs/blob/main/docs/capabilities/analytics/devvit-journeys.md)), so request it early. No personal data in any field.

## Build schedule

Fable does nine focused sessions from Nov 12 to Nov 16, including autonomous runs during your workday; every feature is final by Monday night. Times assume weekday evenings and full weekend days (IST). Shift them to your hours, but keep the order: each session builds on the one before.

&#91;embedded content: Lumen timeline · Nov 12 to Dec 9, 2026\]

The Fable sprint carries all the risk; the three weeks after it are for tuning with real players and presenting the game well.

**Using Fable well (and not burning the limit):**

- One fresh session per milestone. Start in plan mode, approve the plan, then let it build.
- Run long autonomous tasks while you are at work (Fri to Mon mornings): commit first, give it the milestone prompt plus "keep going until the exit criteria pass, then write a short report", and review in the evening.
- End every milestone with a **judge pass**: ask Fable to screenshot the game on a phone-sized viewport, critique it as a harsh hackathon judge against SPEC.md, and fix its top three issues.
- Point it at spec sections, not the whole doc, and paste only the relevant error lines.
- Commit and `/compact` at every milestone. Keep about 20% of your weekly usage for Monday.
- If you hit the limit, give purely mechanical work (wiring, copy) to Opus and save Fable for the next hard milestone.
- Always test on your real phone in the Reddit app via `devvit playtest`.

### Thu Nov 12 · evening

**Setup (you, about 45 minutes, no Fable):** install Node 22, run `npm create devvit@latest` and pick the Three.js template, `devvit login`, create a private test subreddit (for example r/LumenGame\_dev), run `npm run dev` and open the test post in the Reddit app on your phone. Export this doc to Markdown as `SPEC.md`, `git init`, push to GitHub.

**Session 1 · Plan, platform spike and engine.** Paste the kickoff prompt, review PROMPT.md, PLAN.md and CLAUDE.md for 15 minutes, then:

```
Milestone 1.
(a) Platform spike on a throwaway branch, results in PLATFORM.md. Prove in my test subreddit that: (1) a user's snoovatar can be displayed in the webview, and find the approach that works under the CSP; (2) a server realtime broadcast reaches two open clients; (3) setUserFlair works for the app in the test subreddit; (4) submitComment with runAs USER works from a button tap; (5) a cron task fires; (6) Journeys events are accepted or report their approval status. For anything that fails, propose the fallback.
(b) Build src/shared per SPEC.md "Core rules" and "Puzzle generator, solver and difficulty": config.ts, types, trace, solve, validate. Write 10 hand-made fixture puzzles with known par in content/fixtures. Vitest tests for every rule in the Core rules tables.
```

Exit: PLATFORM.md answers all six questions, `npm test` is green, and the solver finds par on every fixture in under 2 seconds.

### Fri Nov 13

**Session 2 (morning, runs while you work) · Generator, content and tuning tools.**

```
Milestone 2. Build generate.ts and difficulty.ts per SPEC.md and the weekly ramp table, with every weight and band in config.ts. Add `npm run gen -- --from 1 --to 90` writing content/puzzles.json with names and biomes, and `npm run report` printing par and difficulty per weekday. Add a dev-only 2D debug page (src/client/debug.html) showing any day's puzzle, par solution and difficulty breakdown. Keep going until every weekday sits inside its par band, then write a short report.
```

Exit (check in the evening): 90 days generated, every weekday in band, and days 1 to 14 look good in the debug page.

**Session 3 (evening) · 3D vertical slice.**

```
Milestone 3. Using the Devvit Three.js template, build the expanded-mode game per SPEC.md "Daily loop" steps 3-4: island from puzzle data, tap to place and cycle pieces, live beams from the shared tracer, lanterns lighting, undo/reset/rotate, nightfall on solve. Placeholder art is fine. Hit 60fps on a mid-range phone.
```

Exit: you can play day 1 start to finish on your phone in the Reddit app.

### Sat Nov 14

**Session 4 (morning) · Final art direction and the signature moment.**

```
Milestone 4. Final art per SPEC.md "3D art direction and performance" and "Signature features" 1: sky dome with the dusk uniform, beam shader with halo and shimmer, prism split, lantern bloom, nightfall, then the sky-lantern release carrying the player's snoovatar (approach from PLATFORM.md) and the camera following it up. All five biomes, the custom UI kit, bundled font and icons. Then a judge pass against the anti-AI-slop checklist and fix the top issues. This is the final look, not a draft.
```

Exit: a 15-second phone recording of nightfall and the lantern release that makes two friends say "whoa". Note anything that confuses them.

**Session 5 (afternoon and evening) · Server and Reddit layer.**

```
Milestone 5. Build the server per SPEC.md "Technical architecture" and "Reddit and community layer" items 1-5: all /api endpoints, Redis keys, server-side validation, scheduler daily post, streaks with grace day and lantern-style unlocks, flair, leaderboards with snoovatars, opt-in share comment, heatmap reveal, the Shared Night Sky over realtime, Journeys events. Test with two Reddit accounts on two phones.
```

Exit: two accounts play the same island; leaderboard, heatmap and percentile reflect both; a lantern released on one phone appears on the other within 2 seconds; a temporary 5-minute cron creates a correct daily post.

### Sun Nov 15

**Session 6 (morning, runs while you rest) · Archipelago and Island Builder.**

```
Milestone 6. Build "Reddit and community layer" items 6-7 and "Signature features" 2: the Archipelago map, archive play, the Island Builder with solver-gated publishing (runAs USER posts flagged as user-generated content), Saturday selection job, Islandwright flair. Same visual identity as the game. Keep going until the exit criteria pass, then report.
```

Exit: the Archipelago shows every generated past day; a builder island publishes, plays and can be picked for Sunday.

**Session 7 (evening) · First-time experience and finish.**

```
Milestone 7. Build the 3-island tutorial, the inline preview card (no Three.js, SVG silhouette, sky strip, attribution, stats), the final result card, full sound design, and trailer mode per "Signature features" 3. Then meet every row of the performance budget on a real mid-range phone and report the numbers.
```

Exit: Lighthouse mobile above 80 on the inline post, 60 fps in play, and trailer mode records the full sequence in one take.

### Mon Nov 16 (last Fable day)

**Session 8 (morning, runs while you work) · Harsh judge review.**

```
Milestone 8. Act as the harshest judge of this hackathon, comparing against past Reddit winners (BridgeDit, Sketchy Solutions, Reddictionary). Score the game on the four judging criteria and every item in SPEC.md "Signature features" and "Quality bar". Write REVIEW.md with prioritised issues, then fix every P0 and P1. Test edge cases: day rollover at 00:00 UTC, logged-out viewers, archive posts, slow network, reduced motion, small and tall phones, 300+ lanterns in the sky.
```

**Session 9 (evening) · Final pass, freeze and handoff.**

```
Milestone 9. Fix what remains from REVIEW.md. Confirm every tunable value is in config.ts with a comment. Write README.md (how to play, features, tech) and HANDOFF.md: known issues with repro steps, a tuning guide for config.ts, how to run the debug, report and trailer tools, and a complete implementation brief for anything cut. After this, the project is feature-frozen.
```

Exit: feature freeze. Everything left is on the "Safe for Opus" list.

### Nov 17 to Dec 8 · Opus 5.5, no new features

| Dates | Focus |
| --- | --- |
| Nov 17–23 | Playtest with 10–20 people (friends, plus a feedback post on r/Devvit). Tune only `config.ts` from real solve data. Fix bugs with a repro and a failing test. Request Journeys approval. Fill in the Devpost feedback survey (5 x $200 Feedback awards) |
| Nov 24–30 | Publish the app for review early (reviews take about 1–2 business days). Create the public demo subreddit (under 200 members) and start real daily posts, so the sky and the Archipelago have genuine history when judges look |
| Dec 1–5 | Record the demo with trailer mode (under 60 seconds, nightfall in the first 10), screenshots, Devpost write-up |
| Dec 6–7 | Submit by Dec 7. Leave buffer before the deadline: Dec 9, 7:30 am IST (Dec 8, 6 pm PT) |
| Throughout | Answer questions on r/Devvit and Discord (6 x $500 Devvit Helper awards) |

## Quality bar

The hackathon explicitly penalises games that obviously look AI-made, so every session ends with this check. If a judge opens the post cold on a phone, nothing here should fail.

**Anti-AI-slop checklist:**

- [ ] Everything fits the viewport on a 360 x 640 phone and a tall 430 x 932 phone, with no scrolling inside the game.
- [ ] One coherent visual identity: the same palette, corner radius, font and icon style everywhere. No default components, no purple gradients, no emoji in the game UI.
- [ ] All copy is short and in Lumen's voice. No "Welcome to Lumen! 🎉", no instructions longer than one line.
- [ ] Every animation has a reason (feedback, payoff or depth) and nothing loops distractingly during play.
- [ ] The first five seconds are clear without reading anything.
- [ ] Colour-blind glyphs work; contrast passes AA; tap targets are at least 44 px.

**Acceptance tests before Monday's handoff:**

- [ ] Every generated day 1 to 90 is solvable and its par matches the solver.
- [ ] The server rejects tampered submissions (extra pieces, illegal tiles, fake lit lanterns).
- [ ] Streak, grace day and flair are correct across a simulated 10-day run.
- [ ] The heatmap stays locked until you submit; the par solution stays hidden until the day ends.
- [ ] Share to comments only ever happens after a tap and never blocks play.
- [ ] The inline preview loads in under 1 second with Lighthouse mobile above 80, and gameplay holds 60 fps on a mid-range Android.
- [ ] Audio starts only after a tap, mutes on tab switch, and the mute button works.
- [ ] Day rollover at 00:00 UTC produces exactly one new post; archive posts stay playable unranked.

**Signature features and freeze, checked on Monday night:**

- [ ] A lantern released on one phone appears in the other phone's sky within 2 seconds; 300+ lanterns still hold 60 fps.
- [ ] Snoovatars show on the lantern, result card, leaderboard and Sunday credit, with the glyph fallback when unavailable.
- [ ] The Archipelago lists every past day and plays any of them unranked.
- [ ] A builder island can only publish when solvable, and the Sunday pick credits its creator.
- [ ] Trailer mode records the full sequence in one take.
- [ ] Every tunable value is in `config.ts`; HANDOFF.md exists; nothing is half-built.

**Hackathon submission checklist** (from the official rules):

- [ ] Built on Devvit Web and compliant with the Devvit Rules.
- [ ] App listing link: developers.reddit.com/apps/{app-name}.
- [ ] README.md in the repo root describing the game and how to play.
- [ ] Demo post in a public test subreddit with fewer than 200 members (or the dr-admin-approve app installed).
- [ ] Text description of features and functionality, written by you.
- [ ] Demo video under 1 minute on YouTube or Vimeo (optional, but do it).
- [ ] Public repo link (optional).
- [ ] Developer feedback survey (for the Feedback award).
- [ ] Submitted on Devpost by Dec 7, ahead of the Dec 9, 7:30 am IST deadline.
