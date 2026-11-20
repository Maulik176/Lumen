# HANDOFF.md — Lumen after the feature freeze

Written Mon Nov 16, 2026 (M9), the last Fable session. From here Opus 5.5 maintains Lumen until
submission (Devpost by Dec 7; deadline Dec 8, 6 pm PT). Read this file first, then `CLAUDE.md`
(rules and history), then `REVIEW.md` (the judge review that ranks what is left).

Finished briefs 1 to 9 are kept in `docs/HANDOFF-ARCHIVE.md`. The Island Builder brief there is
superseded by O-14 below.

---

## 1. Where things stand

- **Uploaded:** v0.0.1.50 is the last version Maulik tested on Reddit. The commit after it
  (`1c17ee8`, art pass) and this handoff are uploaded as the version named in the final report.
- **Tests:** 325 Vitest tests, `tsc --build`, ESLint and the build check all pass.
- **Built and passed on Reddit (Maulik, Nov 15):** hero feed card, four-island tutorial, rule
  cards, resume, "?" overlay, board stability, flair, leaderboard, ranked Day 1 flow (rank,
  streak, "You" lantern, another player named), desktop wide layout, Share on iPhone.
- **Built, not yet seen on Reddit:** non-tonight posts saying "Practice" (P0-1 of M8), dev time
  travel and clean-up, sound after lock/unlock, the slow phone ending, other players as paper
  lanterns, tile seams, medal emblems, crowd pools, the sky noise fix, the live results comment,
  trailer mode, warm-up offer, Archipelago map, day rollover by cron.
- **Never run:** Android; two phones at once (live sky); frame rate on any real device.
- **Everything still untested, with how to test it: `docs/TESTS-TO-RUN.md`** (Nov 17).
- **Nov 19: Island Builder phase 1** (approved exception; plan and report in `BUILDER_PLAN.md`):
  flat editor with live light, Island panel (world, size 6/7/8, spare mirrors), first-island
  tutorial, server check (par, inventory, difficulty label, exact-copy refusal), the maker's
  test in 3D with a server-timed proof, drafts saved per player. Opens from the result card and
  the map. `COMMUNITY.enabled` switches the whole community side off. Publishing is phase 2.
- **Nov 18 (Maulik's two-player test):** on a quiet night (under `SKY.quietBelow` lanterns) last
  night's lanterns show faintly, and the first player of the night read them as tonight's. Now,
  while the lantern rises, one line says "First lantern tonight. The faint ones are last
  night's." or "N lanterns tonight…" (`shared/skynote.ts`, tested). For a newcomer the first-ever
  sky line shows for 2 s (`SKY.joinLineQueuedMs`), closes, and this one follows by itself after
  `SKY.noteGapMs`; no tap.
- **Nov 17, after an outside review** (`docs/TESTS-TO-RUN.md` 1b lists its human checks):
  light on pale ground (`shared/glare.ts`: beams get a shaded lining and suns glare less as the
  ground gets lighter, so snow reads and moss is unchanged; sun rays 3.1 to 2.4 tiles);
  "Your turn" shows mirrors left, explains the way back once both are down, and offers "Start
  again" (`soloLine` in `shared/tutorial.ts`, tested); islands from the map say "Practice ·
  Name" and their way back is "Back to islands"; the feed card's scrim starts lower (title
  contrast measured 6.2:1, tagline 12.2:1); a Devpost thumbnail with the real hero island
  (`content/brand/island.mjs`, then `build.mjs`). Feed pictures re-rendered.
- **Cut, now approved to build after Wed Nov 18:** Island Builder and the Sunday community island
  (O-14). Until it ships, Sunday uses a generated island.

## 2. The freeze

From Mon Nov 16, 11:59 pm IST: **no new features, no redesigns, no refactors.** Allowed:
numbers in `src/shared/config.ts`, bug fixes that start with a failing test, copy edits,
submission tasks. Several briefs below are small features that REVIEW.md ranks as needed to
win. **Each one needs Maulik's explicit yes before it is built** (he decides; say what the brief
costs and what it changes). Briefs marked *fix* are bug fixes and need only a failing test.

**Approved exceptions (Maulik, Mon Nov 16):** O-14 Island Builder, O-15 top boards as pictures,
O-16 logo. **Start after Wed Nov 18** (no app review and no publishing during the event; see section 5). Order: O-16 (small),
O-15 (small to medium), O-14 (large, about two days). **O-15 was built on Nov 17 at Maulik's
request** (redesigned as "See others' islands"); O-16 logo built the same day (option C). The phone checks in O-2 still come first
on any day they compete. Why: every one of them comes from what BridgeDit, the last Best Daily
Game winner, did (`docs/SUBMISSION.md` lessons 4, 9 and 15).

## 3. Tools

All need Node 22.12+ and `npm install` once.

| Tool | Command | What it is for |
| --- | --- | --- |
| Local game | `npm run debug`, then open `http://localhost:5199/game.html?day=7` | The real play screen with a stand-in server (`vite.debug.config.ts`). Since Nov 20 it runs the real game code on an in-memory store: `user=name` is who is playing, `fetch('/api/dev/crowd?day=7&players=8')` adds a realistic crowd, `fetch('/api/dev/island?day=2&maker=p0')` a community island; `npm run seats` is the four-seat pass (CLAUDE.md "Quality rules"). Query: `day=N`, `biome=snow`, `calm=1` (reduced motion), `perf=1` (fps, draw calls; also exposes `window.lumenTap(x, y)` and `window.lumenLockIn()`), `tutorial=1`/`0`, `trailer=1`, `user=name`, `avatar=url`. Day 6 is a quiet night (last night's lanterns show). `fetch('/api/forget')` clears the stand-in's solves and saved boards |
| Feed card locally | `http://localhost:5199/preview.html?day=6` (day 5 shows "solved" after a local Lock in; day 2 shows "past") | The inline card without Reddit |
| 2D island viewer | `http://localhost:5199/debug.html` | Every generated day, par, solution. A developer tool, not the game |
| Headless screenshots | `node scripts/shoot.mjs "<url>" out.png steps.json 430x701` | Chrome headless with scripted steps (`[{ "js": "...", "wait": ms }]`). Use when the browser pane is hidden or for exact sizes. Needs Google Chrome |
| Feed card pictures | `npm run debug` running, then `npm run hero` | Renders `src/client/assets/hero/<biome>.webp` from the hand-made island in `content/hero.json` (never a daily island). **Re-run after any change to the look.** Needs Chrome and `cwebp` (Homebrew `webp`) |
| Difficulty report | `npm run report`; `-- --show 12` prints a day; `-- --verify` re-solves and times all | Par and difficulty per weekday |
| Regenerate a few days | `npm run gen -- --only 26,47,89` | Replaces only those days, keeps every other day exactly as stored |
| Regenerate days | `npm run gen -- --from 1 --to 90` | Only after changing `CALENDAR`, `GENERATOR` or `DIFFICULTY`; commit `content/puzzles.json`; `tests/content.test.ts` fails until you do |
| Solver bench | `npm run bench` | Speed by par |
| Playtest upload (before launch) | `npm run dev`, wait for "Playtest ready", then **stop it** (Ctrl-C) | Uploads to r/lumen_game_dev. A 401 means `npx devvit login` again. Never leave it running: edits stream to Reddit. Refuses to start once `LAUNCH.launched` is true |
| Release (after launch) | `npm run release` | The only way to upload once launched: refuses uncommitted work and a running watcher, runs every check, asks, uploads once, stops the watcher, tags `release-<version>`. `docs/LAUNCH.md` section 3 |
| Publish | none | **Never before the hackathon ends** (the official page forbids it). `npm run launch` and `npm run deploy` are gone |

**Trailer on Reddit:** mod menu "Play the Lumen trailer (once)", then open the game within 10
minutes, tap once. It plays dusk, the answer, nightfall, the release and the title.

**Dev menu on r/lumen_game_dev only, and only until launch** (each refuses elsewhere; with
`LAUNCH.launched` true they refuse there too, except the lantern-style preview):
- "Dev: set today to day N" moves the server clock (0 = real time). Then "Post today's Lumen".
- "Dev: clean up this subreddit" deletes every app post there and resets every day's data and
  the moderator's own progress. Cannot be undone.
- "Reset my Lumen progress (dev)" forgets the moderator's tutorial, rule cards and today's solve.
- "Post a Lumen island (testing)" posts any day.
- "Dev: preview lantern styles" shows one lantern of each streak style (plain, paper, star, koi,
  comet), labelled "(preview)", in the moderator's own sky for 30 minutes; tap again to turn
  off. Locally: `?styles=1`.

## 4. Tuning guide (`src/shared/config.ts`)

Every number lives here with a comment. Change one, run `npm test`, look at it locally, upload.

| If… | Change | Notes |
| --- | --- | --- |
| Phone is under 45 fps | `VIEW.maxPixelRatio` 2 → 1.5, then `ART.wisps` → 0, then `SKY.cellPx` 72 → 48 | In that order; check `?perf=1` after each |
| Tiles too hard / too easy to tell apart | `ART.seam` (0.8; lower is darker), `ART.seamWidth` (0.1), `ART.chequer` (0.22) | Re-run `npm run hero` |
| Near-miss taps go to the wrong tile | `RULES.tapSnapTiles` (0.45 tiles) | Lower is stricter |
| Island too small on phones | `CAMERA.margin` (0.08), `VIEW.hintRoomPx` (36) | Check 360x460 |
| The ending feels slow / fast | `RELEASE.riseMs` (7000), `RELEASE.hoverMs` (2600), `RELEASE.lookBelow`, `RELEASE.driftSpeed`, `RELEASE.driftHeight` | Calm path: `calmRiseMs`, `calmHoldRise` |
| Other lanterns too big / small / many | `SKY.pointSize` (42), `SKY.fullSizeAt`, `SKY.maxLanterns` (300), `SKY.snoovatarLoads` (60) | One draw call whatever the count |
| Quiet-night threshold | `SKY.quietBelow` (10), `SKY.lastNightOpacity` | Last night's lanterns are real players only |
| Light on pale ground | `GLARE.paleFrom`, `paleTo`, `edgeMax` (beam lining), `sunMin` (sun glare) | `shared/glare.ts`, tested; then `npm run hero` |
| See others' islands | `OTHERS.top`, `previewWidth`, `previewHeight`, `previewMirror`, `previewPrism`, `previewGlow`, `fewSolves` | |
| Medal colours | `UI.emblemGold`, `emblemSilver`, `emblemBronze`; name colours `UI.medal*` | |
| Medal thresholds | `SCORING.lamplighterOverPar`, `glowOverPar` | |
| Streak styles and flair | `STREAK` | Changing days changes everyone's style |
| Results comment refresh rate | `COMMENT.minGapSeconds` (60) | Each refresh is one Reddit edit |
| Feed card button wait | `CARD.holdMs` (450) | Longer hides the button longer on a slow network |
| Hard days for the warm-up offer | `warmUpDay` in `calendar.ts` | Code, not config: a change needs a test |
| Copy | `COPY` | One line, calm; no "!" except at par; no emoji in the game |
| Biome colours | `BIOME_LOOK` | Re-run `npm run hero` |
| Daily post time | `devvit.json` scheduler (`0 0 * * *`, catch-up `7,37 * * * *`) | |
| Difficulty, par bands | `GENERATOR`, `DIFFICULTY` | Needs `npm run gen` and a commit of `content/puzzles.json`. Avoid after launch: it changes days players may have seen |

## 5. The judging subreddit: r/lumen_game_dev (never published)

**Changed Nov 19 (official hackathon page):** "PLEASE DO NOT SUBMIT YOUR APP FOR PUBLISHING ...
you should be uploading and playtesting your app, not publishing it." So: no app review and no
`devvit publish` at any point before the hackathon ends. **r/lumen_game_dev** (public, approved)
is the playtest subreddit and the one players and judges use; there is no r/LumenGame. Launch
day and the release routine are in `docs/LAUNCH.md` (sections 2 and 3). What this means:

- **Launch day:** final clean-up, "Dev: set today" to 0, flip `LAUNCH.launched` (destructive dev
  tools off, real time only, `npm run dev` refuses), then `npm run release`, which also stops
  the playtest watcher. The upload posts Lumen #1 at once (before Nov 24 "today" is day 1).
- **After launch every upload is live:** test locally, commit, `npm run release` (it asks), then a
  two-minute phone check (`docs/LAUNCH.md` section 9).
- **Posting as the player:** in a playtest build `runAs: 'USER'` posts from the app account
  for anyone but the owner (two friends' shares on Lumen #8 came from `lumen-game` with no name,
  Nov 17). Every line Lumen writes names the player itself: the share line starts "u/{name}"
  (`COPY.shareLine`, tested), and community islands will carry "Island by u/{name}". Reddit may
  also send the player a mention notification (not checked).
- **Journeys** are never recorded for a playtest build (`JOURNEY_RECEIPT_DENIED_PLAYTEST`). The
  start route passes that answer on as a normal "no journey" (it used to be a 500, which the
  SDK logged as a failure), and the client stops sending for the page after the first refusal
  (`journeyRefused`, tested). Code and `JOURNEY_MAP.md` stay for a publish after the event.
- **App listing page and icon:** check whether developers.reddit.com/apps/lumen-game is visible
  to someone signed out before linking it on Devpost; `marketingAssets.icon` may show only for
  published apps.
- **Unchanged:** scheduler, realtime, flair, Redis and the sticky results comment all run in a
  playtest build (the scheduler fired within a minute, PLATFORM.md section 5).
- **The demo post for judges:** judging runs Dec 9–16, after the night the link was made, so a
  linked daily post opens as "Practice" with a way to tonight's island. Decide with Maulik what
  to link (the subreddit, today's post, or both) and test that path as a stranger.
- **Data:** only Reddit user id, username and snoovatar address are stored (`CLAUDE.md` rule 14).

**Submission (from SPEC "Hackathon submission checklist"):** README.md (brief O-1), app listing
link developers.reddit.com/apps/lumen-game, demo post in r/lumen_game_dev, written description, demo
video under 1 minute (record with the trailer), public repo link (**done:**
https://github.com/Maulik176/Lumen, public, `main` pushed Nov 17), developer feedback survey,
Devpost by Dec 7. **`docs/SUBMISSION.md`** has what past winners did (BridgeDit so far) and
Lumen's gallery shot list, write-up and video plan built from it.

---

## 6. Briefs for Opus

Ranked as in `REVIEW.md`. "Phone" means Maulik must do it on his device. Every brief ends with
`npm test`, `npm run test:types`, `npm run lint`, `npm run build`, a local look at 430x701 and
360x460, one commit, and an upload.

### O-1 · README.md (submission task) — S

`README.md` is still the Devvit starter's. Replace it: what Lumen is (one paragraph), how to play
(mirrors, turning, prisms, colours, Lock in, par and medals), the Shared Night Sky, Archipelago,
streaks and flair, how it uses Reddit (realtime, scheduler, comments, flair, snoovatars,
Journeys), how to run it (`npm install`, `npm run debug`, `npm run dev`), the cut Island Builder
said plainly, credits (Young Serif, OFL). No emoji, Lumen's voice. **Test:** a stranger can play
from it.

### O-2 · Phone checks (Phone) — Maulik, Opus records results

Run on v0.0.1.50 or later and write the results into `PLATFORM.md`:
1. Lock the iPhone mid-game, unlock, tap: a click must sound (fix in `audio.ts`, tests in
   `audio.test.ts`; if it fails, add a test that reproduces what the phone did).
2. Two accounts, two phones, same post: a Lock in on one appears in the other's sky within 2 s.
3. Android: play one island with `?perf=1` unavailable on Reddit, so judge by eye; if it
   stutters, apply the tuning order in section 4.
4. "Dev: set today" one day ahead: within 30 minutes exactly one new post; yesterday's post says
   "Practice · this island's night has passed".
5. Daytime sky on iPhone: is the speckle gone (fixed in `1c17ee8`)?

### O-3 · Share: "View comment", and dev reset deletes it (fix + small feature, ask) — M

Files: `src/server/routes/api.ts` (`/api/share`), `src/server/core/store.ts`,
`src/server/core/game.ts` (`claimShare`, `resetPlayer`), `src/shared/api.ts` (`ShareResponse`,
`PlayerState`), `src/client/game/hud.ts` (`setShare`), `main.ts`.
1. Store the reply id at `KEYS.shared(day, userId)` instead of "1" (the counter lock can stay a
   separate key, e.g. `sharelock:`).
2. Return `{ ok: true, commentId }`; `PlayerState.sharedComment: string | null`.
3. Done state: "Shared · View comment" (`COPY`), a tap calls `navigateTo` with the comment's
   permalink (`reddit.getCommentById(id)` on the server returns `permalink`).
4. `resetPlayer` and "Dev: clean up" delete the stored reply (`comment.delete()`), fallibly.
**Tests:** claim, store id, reset removes it (memory store in `game.test.ts`).

### O-4 · Feed card streak from day 1 (copy-level fix) — S

`src/client/preview.ts` shows the flame only when `solved.streak > 1`. Show it at 1 too.
**Test:** local card for day 5 after a Lock in shows the flame.

### O-5 · Trailer start screen (small, ask) — S

`src/client/game/trailer.ts`: replace the plain "Tap to begin" with a full-screen dusk panel,
"Lumen" in Young Serif and "Tap to start trailer" (`COPY`). Optional: end on the Archipelago
(`openArchipelago` with the past list) after the title. **Test:** `?trailer=1` locally plays
through.

### O-6 · Subscribe button (feature, ask) — S

SPEC and the brief's result card both list it. `devvit.json` permissions: add
`"SUBSCRIBE_TO_SUBREDDIT"` to `asUser`. Server: `POST /api/subscribe` calls
`reddit.subscribeToCurrentSubreddit()`, fallible. Client: a quiet button "Join r/{name}"
(`COPY`) on the result card after a ranked solve, its own tap, hidden once done or signed out.
CLAUDE.md rule 10 applies in full. **Test:** route refuses signed-out; button absent when
unranked.

### O-7 · Snoovatar on the result card (small, ask) — S

`hud.ts` `showResult`: a 36 px round snoovatar (`<img crossorigin="anonymous">`, only if
`cleanSnoovatar` accepts it) or the letter seal (`board.ts` has `portrait()`, reuse it) beside
the emblem. **Test:** local card with `&avatar=` and without.

### O-8 · Streak styles you can see (art, ask) — M

`skyfield.ts` `paint()` shows a style only as a colour band. Draw each one: paper (plain band),
star (a small star above the crown), koi (an orange fin on one side), comet (a pale trail below).
Same cell, same draw call. **Test:** local sky shows all five (the stand-in rotates styles).

### O-9 · Tap targets on 8x8 and 9x9 (tune first) — M

Tiles are about 36 px on a 360 px phone. First try `CAMERA.margin` 0.08 → 0.04 and measure at
360x460 with `scripts/shoot.mjs`. If still under 44 px, ask Maulik before anything larger.

### O-10 · Feed card on a past post with no memory (fix) — S

A device that never opened a past post shows "Light the lanterns" for up to `CARD.holdMs`
before the server answers. Fix: add `date` (UTC `YYYY-MM-DD`) to `PostData` in `toPostData`
(`src/shared/api.ts`; new posts only) and treat it as past in `preview.ts` when the device's
remembered "today" (store the server's last answer) is later. **Test:** `readPostData` keeps the
date; card logic as a pure function with a test.

### O-11 · Archipelago beyond 30 islands (feature, ask) — M

`/api/past` returns the newest `PAST.max`. Add `?before=` paging and load the next page when
the map scrolls near its end (`archipelago.ts`). **Test:** server returns pages in order.

### O-12 · Measure Lighthouse and contrast (submission task) — S

Lighthouse mobile on `preview.html` (needs > 80) and contrast of ink on paper, light on veil,
amber button text (AA). Record numbers in `PLAN.md`; adjust `UI` colours only if needed.

### O-13 · Tidy (fix-level) — S each

- Disconnect realtime on page hide (`main.ts` `joinSky`).
- Size the lantern sheet to the night's count (`skyfield.ts`).
- Delete unused `SKY.portraits*`, `RELEASE.portraitSize` if unused.
- Signed-out result: one line inviting sign-in (`COPY`).
- Feed card attribution "A daily island by r/{sub}" (brief: start screen item).

### O-14 · Island Builder and the Sunday community island (APPROVED Nov 16 — start after Wed Nov 18) — L

Cut on Nov 14, frozen on Nov 16, **approved by Maulik on Nov 16** after studying BridgeDit,
whose judges opened and closed their praise on its level builder. This brief replaces the
shorter one in the archive. It is written so it can be built in about two days without
changing anything already shipped. It touches the server, a new entry point, and possibly
permissions (see "Who posts" below).

**Who posts (decide at the start, recommended: the app).** BridgeDit's player levels are posted
by the app's own account, and the feed card says "CREATED BY" with the maker's snoovatar and
name. Doing the same here (`submitCustomPost` without `runAs: 'USER'`, the maker credited in
`postData`, the title and the feed card) needs **no new permission**, and in a playtest build
(Lumen is never published during the event) it is what happens anyway. Posting from the player's
account (step 3 below, decided Nov 19 with `SUBMIT_POST`) posts as the app for everyone but the
owner until a publish, which will not happen before the hackathon ends. If the
app posts, the island name is no longer filtered as the user's own post: keep the 24-character
letters-digits-spaces rule and also refuse names that Reddit's own filters would hold (test by
posting; if unsure, title the post "An island by u/{user}" and show the name only inside the
card).

**Goal.** A player builds a small island on their phone with taps only; the server proves it
solvable and sets its par; it is posted from the player's own account; each Saturday the best
island of the week becomes Sunday's ranked island, credited to its maker, who earns the
"Islandwright" flair.

**What already exists to build on.**
- `src/shared/validate.ts` `validatePuzzle(input)`: checks structure (size within
  `BOARD.minSize`–`maxSize`, at most `BOARD.maxSources` suns and `BOARD.maxLanterns` lanterns,
  pieces on grass, no overlaps) and returns a clean `Puzzle`. Untrusted input goes here first.
- `src/shared/solve.ts` `solve(puzzle, { nodeLimit })`: exact par, `solutionCount`, or
  `status: 'limit'` when the budget runs out (the engine cannot read a clock; the budget is in
  nodes). `SOLVER.builderNodeLimit` is 400,000 (about 2 s on a laptop).
- `src/shared/difficulty.ts` `rateDifficulty(puzzle, solved, decoys)`; Sunday's band is
  `GENERATOR.templates.sunday.par` [3, 5] and `.difficulty` [60, 82].
- `src/shared/puzzle-text.ts`: the rows format (`. # T ~ / \ ^ > v < W R G B M C Y`) is the
  storage and transport format; `puzzleFromText` / `puzzleToRows`.
- `src/client/outline.ts` draws any island from its rows (feed card, Archipelago).
- `COPY.builderTooComplex` ("Too complex to verify. Try removing a piece.") already exists.

**1. Editor (client), tap-only, phone first.** New entry point `builder` (`builder.html`,
expanded) and `src/client/builder/`. No Three.js: canvas 2D, top-down, the same tile colours
as the moss biome, so it loads in under a second.
- Size: 5x5, 6x6 or 7x7 chips (7 is Sunday's size; 8–9 are too hard to fill on a phone).
- A tool bar of seven drawn icons, each 44 px: sun, lantern, rock, tree, water, stone mirror,
  eraser. **Tap a tile to apply the tool; tap again with the same tool to cycle it**: a sun turns
  to the next direction; a lantern cycles white, red, green, blue, magenta, cyan, yellow (shape
  badge shown); a stone mirror flips "/" and "\". No drag, no long-press, no pinch.
- Steppers for mirrors (1–6) and prisms (0–2), 44 px each.
- Undo (last 50 steps) and Clear. A name field: 24 characters, letters, digits and spaces,
  checked again on the server; no profanity list is needed because the post goes through
  Reddit's own filters as the user's post.
- "Try it" plays the island right there with the real play rules (`play.ts`) in the 2D view,
  so the maker knows it works before checking.
- "Check" sends the island to the server; the line under it says "Solvable in 4 · Medium" or one
  refusal line. "Publish" is enabled only after a passing check **of the exact current board**
  (keep the checked rows; any edit disables it again).
- Draft saved to localStorage on every change, restored on open.
- Calm, one-line copy in `COPY`; no emoji; UI kit panels; works at 360x460.

**2. Check (server).** `POST /api/builder/check { rows, inventory }` in a new
`src/server/routes/builder.ts`, logic in `src/server/core/builder.ts`:
1. `puzzleFromText` inside try/catch, then `validatePuzzle`. Refuse with the problem as a line
   of copy (`COPY.builderProblem.*`), never a code.
2. Extra rules for community islands: at least 2 lanterns, at most 6 mirrors and 2 prisms, no
   lantern lit before any piece is placed (trace with no pieces: `litCount` must be 0).
3. `solve(puzzle, { nodeLimit: SOLVER.builderNodeLimit })`. `limit` → `COPY.builderTooComplex`.
   `unsolvable` → "No way to light every lantern yet." Par 0 → refuse (already lit).
   `solutionCount > GENERATOR.maxMinimumSolutions` → "Too many easy answers. Add a rock or
   a decoy." (keeps islands interesting).
4. Return `{ ok, par, difficulty: rateDifficulty(puzzle, solved, 0).score, label }` where
   label is Gentle / Medium / Tough by the weekday bands.
5. **Time budget:** measure the check on Devvit's server with the slowest legal 7x7 (write it as
   a fixture). Requests must finish well inside 30 s; if 400,000 nodes takes over 8 s there,
   lower `SOLVER.builderNodeLimit` until it does not. Rate-limit checks to 1 per 3 s per user
   (`builder:check:{userId}` counter with a 3 s expiry).

**3. Publish (server).** `POST /api/builder/publish { rows, inventory, name }`:
1. Signed in only. Re-run the whole check (never trust the client's result).
2. Weekly cap: 3 islands per user per week (`islands:count:{week}:{userId}`, counter as lock,
   expiry 8 days).
3. `reddit.submitCustomPost({ runAs: 'USER', title: "{name} · an island by u/{user}",
   entry: 'default', subredditName, postData: { kind: 'community', rows, inventory, par, name,
   creator }, userGeneratedContent: { text: "{name} — a Lumen island. Par {par}." },
   textFallback: { text: ... } })`. **Needs** `devvit.json` `asUser: ["SUBMIT_COMMENT",
   "SUBMIT_POST"]`. In a playtest build `runAs: 'USER'` posts as the app for everyone but the
   owner (PLATFORM.md), so the title and the game always name the maker.
4. Store `community:{postId}` (hash: rows, inventory, par, difficulty, name, creator, userId,
   week) and add to `islands:week:{week}` (sorted set, score = post time).
5. Return the post; the client opens it with `navigateTo` (see `openPost` in `routes/menu.ts`).

**4. Playing a community post.** `PostData` gains an optional `kind: 'community'` (keep
`readPostData` backward compatible; add a test). The feed card shows "An island by u/name",
the outline and par; no hero picture swap needed (biome moss). `/api/island` serves
`community:{postId}` for such posts, **unranked** (no board, no streak, no sky lantern; the
practice lantern), with its own small results comment. Everything else (tutorial, rule cards,
HUD) works unchanged because it is just a `PublicIsland`.

**5. Sunday pick.** Scheduler task `sunday-pick` at `0 20 * * 6` (Saturday 20:00 UTC) in
`devvit.json` and `routes/triggers.ts`, idempotent (`sunday:pick:{day}` lock):
1. For each post in this week's `islands:week:{week}`, read its score
   (`reddit.getPostById(id).score`), skip removed or deleted posts.
2. Keep those whose par and difficulty are inside the Sunday bands.
3. Pick the highest score; ties go to the earlier post. None → do nothing (the generated Sunday
   stays).
4. Write `override:{sundayDay}` = the island (rows, inventory, par, name, creator). `islandForDay`
   in `core/content.ts` must check the override first, **for the server only**; the stored
   solution comes from re-solving it at pick time (`solve` with the full `SOLVER.nodeLimit`).
5. Set the creator's flair to "Islandwright" (`STREAK` flair rules: keep the medal and streak,
   add the title), fallibly.
6. The Sunday daily post (`core/post.ts`) uses the override's name and credits "by u/name" in
   the title and on the feed card. The Archipelago shows the creator's snoovatar on that island
   (SPEC "Signature features" 2).

**6. Entry points to the Builder.** A quiet "Build an island" button on the Archipelago map's
top bar and on the result card's last row (only after a ranked solve, so newcomers are not
distracted), plus a mod-menu item "Post the Island Builder" that makes a pinned builder post.

**7. Journeys.** Builder use is not in `JOURNEY_MAP.md`, so **send nothing from the Builder.** Do not send unlisted events. Playing a
community post is an ordinary play journey only if `JOURNEY_MAP.md` already covers it word for
word; otherwise send nothing there either.

**8. Tests** (Vitest, memory store as in `game.test.ts`):
- Check refuses: malformed rows, too large, no lanterns, a lantern lit with no pieces,
  unsolvable, over budget (a fixture that needs more than the node limit), too many minimum
  answers; accepts a known fixture with the right par.
- Publish re-validates (a tampered `par` in the request is ignored), refuses signed-out, and
  enforces the weekly cap.
- Sunday pick: picks the top score inside the bands, ignores out-of-band and removed posts,
  breaks ties by time, does nothing when none qualifies, and running it twice changes nothing.
- `islandForDay` returns the override for that Sunday only.
- `readPostData` reads old posts and community posts.
- Editor logic as pure functions (`src/shared/builder.ts`): tool cycling, undo, rows encoding,
  so it is tested without a DOM.

**9. Done when.** A second account builds a 6x6 island on a phone in under two minutes, it posts
from their account, plays unranked, and with "Dev: set today" to a Saturday and the pick task
run by hand, Sunday's post is that island with "by u/name" and the maker has "Islandwright".

### O-15 · See others' islands (BUILT Nov 17, replaces the crowd pools) — done

**Why.** BridgeDit's leaderboard shows each player's actual bridge ("Compare solutions and be
inspired!", `docs/SUBMISSION.md` lesson 9). Maulik: the old warm-tile pools would mean nothing
with 500 players.

**What a player sees.** After a ranked Lock in, the result card's main button is "See others'
islands". The list: "Your island" first (always, to compare), then on an earlier night the par
answer, then the top 10 in the board's order. Each row has rank, snoovatar, name, "{pieces}
pieces · {time}" and a small night picture of the island with that player's pieces. Tapping a
row lays those pieces on the real 3D island, lit, read-only (the board is locked); "All
islands" goes back, "Back" returns to the result card with the player's own island.

**Spoiler rule.** Tonight's list opens only after the player's ranked Lock in (403 otherwise);
an earlier night is open to everyone. The server decides.

**How it stays fast.** At a ranked Lock in the pieces go into `boards:{day}` (hash, username
to placements). If the Lock in reaches the top 10, the list is rebuilt once and kept as
`others:{day}`; opening the list is then one read (tested: opening writes nothing). A missing
list, or one shorter than the board, is rebuilt on read. A player whose pieces were never stored
(solves before v0.0.1.64) is still named, with an empty picture, and cannot be opened (fix after
Maulik's Nov 17 test, where three solves from before the upload left the list empty). "Dev: reset" and clean-up drop the kept list. Code:
`readOthers` / `rebuildOthers` in `src/server/core/game.ts`, `/api/others`,
`src/client/game/others.ts`, pieces drawn by `drawIslandOutline` (`pieces` option). Numbers in
`OTHERS` in `config.ts`.

**Removed:** the crowd pools (`HEAT`, `shared/heat.ts`, the ground's pool mesh, `/api/heatmap`,
`heat:{day}` writes). **Journeys:** none existed for this view and none were added: the
journey ends at Lock in and the list opens only after it, so `JOURNEY_MAP.md` is unchanged.

**Not yet seen on Reddit.**

### O-16 · Lumen logo (BUILT Nov 17, option C chosen by Maulik) — done

**The mark.** The light's path is the L of Lumen: light leaves a sun (the small diamond), runs
left along the foot, turns up at a wooden mirror in the corner and climbs the stem into a paper
lantern. "umen" is Young Serif turned into outlines, so no file needs the font. Game palette
only; drawn in code, no generated images. Reads at 32 px; at 16 px it is a glowing L.

**Files** (`content/brand/`, rebuilt by `node content/brand/build.mjs`, needs Chrome):
- SVG: `lumen-icon.svg` (square, on night), `lumen-mark-on-dark.svg`,
  `lumen-wordmark-on-dark.svg`, `lumen-wordmark-on-light.svg`.
- PNG (`png/`): `app-icon-1024.png` (Devvit listing: 1024 square, under 500 KB, set as
  `marketingAssets.icon` in `devvit.json`), `subreddit-icon-512.png` and `-256.png` (the mark
  sits inside the circle Reddit crops icons to), `subreddit-banner-desktop-2144x256.png` and
  `subreddit-banner-mobile-2160x256.png` (Reddit's banner editor asks for at least 1072 x 128
  and 1080 x 128), `devpost-thumbnail-game-1500x1000.png`
  (the real hero island with light turning into lit lanterns, wordmark in a night corner; made
  from `island-render.png` by `island.mjs`, needs `npm run debug`), `devpost-thumbnail-1500x1000.png`
  (3:2), `trailer-title-1920x1080.png` (for the video edit), transparent wordmarks
  `wordmark-on-dark-1600.png` and `wordmark-on-light-1600.png`.
- `drafts/`: the three options shown to Maulik and `check-small-sizes.png` (32 and 16 px test).

**Maulik uploads** the subreddit icon and banner (Mod Tools → Community appearance; check the
sizes it asks for there, guides disagree). **Not done (ask first):** the logo inside the game
or on the feed card. **Not yet checked:** that `devvit upload` accepts the icon path (the
schema in the installed SDK says a project-relative PNG path).

### Not to do
- Anything that changes `content/puzzles.json` after launch.
- New entry points, new screens, new server routes beyond the briefs above without Maulik.
