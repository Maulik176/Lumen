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
- **Cut:** Island Builder and the Sunday community island (Sunday uses a generated island).

## 2. The freeze

From Mon Nov 16, 11:59 pm IST: **no new features, no redesigns, no refactors.** Allowed:
numbers in `src/shared/config.ts`, bug fixes that start with a failing test, copy edits,
submission tasks. Several briefs below are small features that REVIEW.md ranks as needed to
win. **Each one needs Maulik's explicit yes before it is built** (he decides; say what the brief
costs and what it changes). Briefs marked *fix* are bug fixes and need only a failing test.

## 3. Tools

All need Node 22.12+ and `npm install` once.

| Tool | Command | What it is for |
| --- | --- | --- |
| Local game | `npm run debug`, then open `http://localhost:5199/game.html?day=7` | The real play screen with a stand-in server (`vite.debug.config.ts`). Query: `day=N`, `biome=snow`, `calm=1` (reduced motion), `perf=1` (fps, draw calls; also exposes `window.lumenTap(x, y)` and `window.lumenLockIn()`), `tutorial=1`/`0`, `trailer=1`, `user=name`, `avatar=url`. Day 6 is a quiet night (last night's lanterns show). `fetch('/api/forget')` clears the stand-in's solves and saved boards |
| Feed card locally | `http://localhost:5199/preview.html?day=6` (day 5 shows "solved" after a local Lock in; day 2 shows "past") | The inline card without Reddit |
| 2D island viewer | `http://localhost:5199/debug.html` | Every generated day, par, solution. A developer tool, not the game |
| Headless screenshots | `node scripts/shoot.mjs "<url>" out.png steps.json 430x701` | Chrome headless with scripted steps (`[{ "js": "...", "wait": ms }]`). Use when the browser pane is hidden or for exact sizes. Needs Google Chrome |
| Feed card pictures | `npm run debug` running, then `npm run hero` | Renders `src/client/assets/hero/<biome>.webp` from the hand-made island in `content/hero.json` (never a daily island). **Re-run after any change to the look.** Needs Chrome and `cwebp` (Homebrew `webp`) |
| Difficulty report | `npm run report`; `-- --show 12` prints a day; `-- --verify` re-solves and times all | Par and difficulty per weekday |
| Regenerate days | `npm run gen -- --from 1 --to 90` | Only after changing `CALENDAR`, `GENERATOR` or `DIFFICULTY`; commit `content/puzzles.json`; `tests/content.test.ts` fails until you do |
| Solver bench | `npm run bench` | Speed by par |
| Playtest upload | `npm run dev`, wait for "Playtest ready", then **stop it** (Ctrl-C) | Uploads to r/lumen_game_dev. A 401 means `npx devvit login` again. Never leave it running: edits stream to Reddit |
| Upload a version | `npm run deploy` | Types, lint, tests, then `devvit upload` |
| Publish for review | `npm run launch` | Deploy, then `devvit publish` (check `npx devvit publish --help` first: it asks questions) |

**Trailer on Reddit:** mod menu "Play the Lumen trailer (once)", then open the game within 10
minutes, tap once. It plays dusk, the answer, nightfall, the release and the title.

**Dev menu on r/lumen_game_dev only** (each refuses to run elsewhere):
- "Dev: set today to day N" moves the server clock (0 = real time). Then "Post today's Lumen".
- "Dev: clean up this subreddit" deletes every app post there and resets every day's data and
  the moderator's own progress. Cannot be undone.
- "Reset my Lumen progress (dev)" forgets the moderator's tutorial, rule cards and today's solve.
- "Post a Lumen island (testing)" posts any day.

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
| Crowd pools | `HEAT.poolMin`, `poolMax`, `glowMin`, `glowMax`, `fewSolves` | |
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

## 5. App review checklist (Nov 17–18)

Reddit reviews the app before it can run outside the playtest subreddit and before Journeys
record anything. Do this in order.

1. **Maulik creates r/LumenGame** (needed by Nov 24; also the demo subreddit for submission,
   which must stay under 200 members or have dr-admin-approve installed).
2. **Remove the dev items from public builds?** The four "Dev:"/testing items in `devvit.json`
   refuse to run outside r/lumen_game_dev, but they still show in every moderator's menu. Ask
   Maulik; the safe default is to keep them for judging and remove before any public listing.
3. `npm run deploy`, then install on r/LumenGame, then mod menu "Post today's Lumen".
4. Open the post signed out and with a second account: card, tutorial, play, Lock in, Share.
5. **Journeys:** `JOURNEY_MAP.md` is the document Reddit approves. It must match the code:
   events in `src/shared/journey.ts`, routes in `src/server/routes/journey.ts` (fixed words
   only), completed end inside `/api/lock-in`. Permission `"journeys": true` is in `devvit.json`.
   In playtest every receipt says `JOURNEY_RECEIPT_DENIED_PLAYTEST`: that is expected.
6. **Permissions to explain in the review form:** `redis`, `realtime`, `reddit` with
   `asUser: ["SUBMIT_COMMENT"]` (Share posts the player's own reply only on their tap, under the
   app's stickied results comment), `journeys`. Flair is set by the app after a ranked solve.
7. **Data:** only Reddit user id, username and snoovatar address are stored (`CLAUDE.md` rule 14).
   No personal data in Journeys fields.
8. `npm run launch` (or `npx devvit publish`) and answer its questions; attach `JOURNEY_MAP.md`.
9. After approval, receipts should read `DENIED_NOT_ALLOWLISTED` until the journey allowlist is
   granted, then `VALID`. `?perf=1` logs them in the console.

**Submission (from SPEC "Hackathon submission checklist"):** README.md (brief O-1), app listing
link developers.reddit.com/apps/lumen-game, demo post in r/LumenGame, written description, demo
video under 1 minute (record with the trailer), public repo link, developer feedback survey,
Devpost by Dec 7.

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

### O-14 · Island Builder and the Sunday community island (CUT — build only on Maulik's go) — L

Cut on Nov 14 and frozen since Nov 16. This brief replaces the shorter one in the archive. It is
written so it can be built in about two days without changing anything already shipped. Do
not start it until Maulik says go, after O-1 to O-13; it touches the server, a new entry point,
two new permissions and app review.

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
   "SUBMIT_POST"]`. Until the app version is approved, `runAs: 'USER'` posts as the app for
   everyone but the owner (PLATFORM.md): note this in the review form.
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

**7. Journeys.** Builder use is not in `JOURNEY_MAP.md`. Either add a "build" journey to the
map before review, or send nothing from the Builder. Do not send unlisted events.

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

### Not to do

- Island Builder unless Maulik says go (O-14). The README says it was cut.
- Anything that changes `content/puzzles.json` after launch.
- New entry points, new screens, new server routes beyond the briefs above without Maulik.
