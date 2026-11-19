# BUILDER_PLAN.md — the Island Builder and the Sunday community island

Written Nov 19 from Maulik's master prompt (approved exception to the freeze). Base design:
HANDOFF.md brief O-14. Sources read: CLAUDE.md, HANDOFF.md O-14, SPEC.md "Reddit and community
layer" item 7, PLATFORM.md, JOURNEY_MAP.md, the shared engine, `devvit.json`, and the installed
Devvit SDK (0.15.2) typings for `submitCustomPost` and menu items.

**Status: approved Nov 19 with the decisions below. P1 built Nov 19 (see "P1 report" at the
end); waiting for Maulik's phone test before P2.**

## 0. Decided (Maulik, Nov 19)

- **Never published** before the hackathon ends (the official page forbids it, Nov 19); target
  P4 by Nov 25 (1.1). Everything runs in a playtest build on r/lumen_game_dev.
- **`runAs: 'USER'` with `SUBMIT_POST`, plus the three safeguards** (1.2). The maker gets the
  credit everywhere, even when Reddit posts from the app account: title, feed card, game, results
  comment, and above all every Sunday pick says who built it.
- **Editor: top-down, with live light; 3D for testing** (1.3). Measured Nov 19 in the real game
  (headless Chrome, day 5, an 8x8 island): 3D tiles are **31–36 px across and 23–30 px deep at
  360x460 and 360x640**, and 38–43 / 29–35 at 430x701, all under the 44 px rule. A flat board
  using the full width (4 px gutters) gives 8x8 tiles of 44 px at 360 px wide.
- **A short hands-on tutorial for the first island** (section 2a, new).
- **"Setting up the inventory"** (from the tutorial request) is read as: the creator chooses how
  many **spare mirrors** players get (0, 1 or 2; `COMMUNITY.spareMirrors`). Par and the prisms
  stay set by the solver, so par is always proven. Prisms come in through the creator's own
  design: a coloured lantern fed by a white sun needs one, and the creator places it while
  testing. (The engine has no fixed prisms, so a prism cannot be part of the terrain.)
- The Builder is **Lumen's most important feature**: rich without being hard to learn.

---

## 1. Decisions and conflicts to settle before coding

Each has my recommendation. The ones marked **must answer** change what gets built.

### 1.1 No publish, no app review (settled Nov 19)

The official hackathon page: "PLEASE DO NOT SUBMIT YOUR APP FOR PUBLISHING ... you should be
uploading and playtesting your app, not publishing it." So no `devvit publish` and no review at
any point before the hackathon ends. Builds reach r/lumen_game_dev, the playtest and judging
subreddit, through `npm run release` (`docs/LAUNCH.md`). P4 by Nov 25 still matters, because
the first Sunday pick runs Saturday Nov 28. Nothing in this plan needs a publish to work.

### 1.2 Posting "as the user" — **must answer**

The prompt asks for `submitCustomPost({ runAs: 'USER', userGeneratedContent })`.
- That needs a new permission: `asUser: ["SUBMIT_COMMENT", "SUBMIT_POST"]` in `devvit.json`.
- The SDK requires `userGeneratedContent` whenever `runAs: 'USER'` creates a custom post. It is
  in the typings, so we'd set it.
- **In a playtest build Reddit posts it from the app account for everyone except the app
  owner.** We saw exactly this with Share on Nov 17 (PLATFORM.md section 4). Lumen stays a
  playtest build through judging, so every player and every judge gets an app-account post.
  Only Maulik's own islands show his name as author; the title and the game name every maker.
- PLATFORM.md also records one `runAs: 'USER'` failure on desktop ("refresh token does not
  exist").

**Recommendation:** build it as the prompt says (`runAs: 'USER'` with
`userGeneratedContent`), with three safeguards:
1. The confirm screen never claims more than is true. It says *"Posts to r/{sub} as an island by
   u/{name}"*, not "as u/{name}".
2. Every post credits the maker in its title ("Island by u/name · Name"), on the feed card (name
   and snoovatar) and in the game. That makes it work whoever Reddit lists as the author.
3. If `runAs: 'USER'` throws, the server posts it once from the app account with the same
   credit, so Publish never fails silently. After posting, the server reads `post.authorName`
   and records which way it went (shown to the maker as "Posted for you by Lumen" when it was
   the app).

The alternative is to post from the app account only, as O-14 recommended and as BridgeDit did.
That needs no new permission and gives every player and judge the same result as above, with
less code. If you prefer it, say so; everything else in this plan is the same.

### 1.3 How the editor looks: a flat painted board, not the 3D island — **must answer**

The prompt wants the editor to feel as polished as the game, with live beams. Two ways:
- **A. Flat, top-down editor (recommended).** A canvas board painted in the biome's colours,
  with the game's icons, beam colours and colour-blind shapes. It redraws only when something
  changes, so 60 fps is easy. Square tiles are the easiest thing to tap accurately. "Test your
  island" then opens the real 3D game on the creator's island, so the 3D look is still part of
  the flow.
- **B. Edit on the 3D island.** It looks richest, but the scene builds its ground once per
  island, so every tap means rebuilding it. Tilted 3D tiles on an 8x8 board at 360 px are about
  30 px wide, below our 44 px tap rule.

### 1.4 Board sizes 6, 7, 8 (O-14 said 5, 6, 7)

At 360 px wide an 8x8 flat board gives tiles of about 42 px, just under the 44 px rule.
Near-miss taps already snap to the nearest usable tile (`snapTile`). 8x8 also costs the solver
the most (see 1.6). **Recommendation:** offer 6, 7 and 8 as asked. Use the full width for the
board on small phones, and measure tap accuracy in the P4 phone test. The sizes are a config
list, so dropping 8 later is a one-line change.

### 1.5 Inventory comes from par, not from the creator (O-14 had steppers)

The prompt says inventory = par + slack, so creators don't set pieces. The server solves with
a generous search inventory (`COMMUNITY.searchMirrors`, `searchPrisms`) to find par and how many
prisms the best answer needs. The island then gets **mirrors = par's mirrors + slack**
(`COMMUNITY.mirrorSlack`, same idea as `GENERATOR.mirrorSlack`) and **prisms = exactly what the
best answer used**. It is solved once more with that inventory to confirm par did not change.
This matches how the daily islands are made.

### 1.6 Solver time on the server

The prompt allows under 10 s. Laptop measurements: 5 microseconds per node on mains, 13 to 20
on battery for 8x8 boards (`GENERATOR.maxSolveNodes` note). Devvit's server speed has never been
measured. **Plan:** P1 logs every check's node count and milliseconds, and a hand-made worst-case
8x8 fixture is checked on r/lumen_game_dev. `COMMUNITY.solveNodes` is then set so the slowest
case stays under `COMMUNITY.solveBudgetMs` (8 s). It starts at 400,000 (`SOLVER.builderNodeLimit`).
Over budget: *"This island is too complex to verify. Try removing a piece."*

### 1.7 How players open the Builder

- **From inside a game post** (result card "Build an island", Archipelago "Build an island"):
  the Builder opens as a layer over the game, like How to play and past islands do. No leaving
  the post, no extra taps. It is a separately loaded chunk, so the game's download size stays
  inside budget.
- **From the subreddit menu** ("Create a Lumen island", for every user): it opens the
  **Workshop post**. That is one app post whose expanded entry is the Builder (`builder.html`,
  its own entry point as asked), and its feed card has a "Build an island" button. A mod menu
  item creates or refreshes the Workshop post. It does not have to be pinned: the launch plan
  already pins How to play and Feedback.

### 1.8 Things the prompt asks for that have limits

- **Duplicate check** catches exact copies only (same tiles, suns, lanterns, stone mirrors and
  size), compared with all 90 daily islands and every community island. A rotated or mirrored
  copy is not caught.
- **Word filter** is a short list of obvious words in config, plus letters, digits and spaces
  only, 24 characters. It catches only the obvious ones. Island posts are normal posts, so mods
  remove the rest, and removed posts are never picked for Sunday.
- **"No streak or flair effect"** on community islands: a solve there counts for that island's
  own board and sky only. Medals, streaks and the all-time board are untouched.

### 1.9 Journeys and permissions in a playtest build

- **JOURNEY_MAP.md is not changed.** The Builder and community islands send no Journeys events.
  Proposed events for after judging go in `docs/JOURNEYS-BUILDER.md` (a note only). Reddit
  records no journeys for a playtest build anyway; the game stops sending after the first
  refusal, quietly (HANDOFF section 5).
- **New permission:** `SUBMIT_POST` (only if 1.2 stays `runAs: 'USER'`). A playtest build uses
  it as the app account for everyone but the owner; nothing waits on a review.
- **New entry point and menu items** (`builder`, "Create a Lumen island" for users, "Exclude
  from Sunday pick" for mods, mod "Post the Lumen Workshop") work in a playtest build.

### 1.10 Launch-day risk, and a switch

P2 changes the server's core lookups (every endpoint finds "the island for this post") a few
days before launch on Nov 24. **Mitigation:** everything community-related sits behind
`COMMUNITY.enabled` in config. If P2 or P3 isn't phone-tested by Nov 23, we launch with it off,
and the daily game is exactly as tested. Turning it on later is one config change and an upload.

### 1.11 It costs you phone time

Each phase stops for your phone test. The open checks in `docs/TESTS-TO-RUN.md` (two phones,
Android, rollover, strangers) still matter more for judging than any single Builder feature. I'd
run them alongside: the Builder tests can share the same sessions with your brother and friends.

---

## 2. What players get

1. **Open the Builder** from the result card after Lock in, from the Archipelago, from the
   Workshop post, or from the subreddit menu.
2. **Build:** pick a size (6, 7, 8) and a biome (5). A tool bar along the bottom: Sun, Lantern,
   Rock, Tree, Water, Stone mirror, Eraser, with the selected one highlighted.
   - Tap a tile to place the tool.
   - Tap the same tile again with the same tool to cycle it: sun direction; lantern colour
     (white, red, green, blue, and the mixes, shown with their shapes); stone mirror `/` or `\`.
   - The light is drawn live as you build, with the shared tracer: suns shine and stop at rocks,
     stone mirrors turn it. Undo, Redo, Clear. The name field takes up to 24 characters.
   - The draft is saved to the server per user, and restored when you come back.
3. **Check:** the server checks the island. You get par, the pieces you'll have, and a
   difficulty label (Gentle, Tricky or Fiendish), or one plain line saying what's wrong.
4. **Test your island:** the real 3D game opens on your island with those pieces. You must
   light every lantern yourself. Publish unlocks only after that, and only for exactly this
   island: any edit locks it again.
5. **Publish:** a confirm screen, *"Posts to r/{sub} as an island by u/{name}"*, with Publish and
   Not yet. Never automatic, never needed to keep playing. Up to 3 islands per person per day.
   The post opens when it's done.
6. **Playing a community island:** the same game. The feed card says "Island by u/name" with
   their snoovatar. It has its own board (fewest pieces, then fastest), "See others' islands",
   and its own sky. The maker's test solve is the first board, marked "Maker". No streak, flair
   or medal effect.
7. **Sunday:** every Saturday at 20:00 UTC the best community island of the week becomes
   Sunday's ranked daily, credited "Island by u/name" on the card, in the game and in the results
   comment. Best means highest post score, among islands that still pass the checks, are in
   Sunday's par band (3 to 5), and weren't removed or excluded by a mod. The maker gets
   "Islandwright" added to their flair. If no island qualifies, the generated Sunday island stays.
8. **Archipelago:** a "Community islands" section: this week's top 10, then older ones. Tapping
   one opens its post, so the solve counts on that island's own board.
9. **Moderation:** island posts are ordinary posts that mods can remove. A post menu item
   "Exclude from Sunday pick" (mods only) keeps an island out of the pick. "Dev: set today" and
   "Dev: clean up" cover community islands on r/lumen_game_dev.

---

## 2a. The first-island tutorial (hands-on, about a minute, skippable)

The first time someone opens the Builder, it walks them through making their own first island:
the island they finish is theirs to publish, not a practice board. One line at a time in the
hint row, the tool to use pulses, and each step moves on when they do it. No ghost hand on the
board: they choose where.

1. *Pick a world for your island* (the five biomes: moss, snow, blossom, dune, autumn).
2. *Place a sun* (Sun tool picked for them).
3. *Tap the sun again to turn its light.*
4. *Place a lantern where the light can't reach yet.*
5. *Tap the lantern to give it a colour* (optional: "Next" moves on; a coloured lantern needs a
   prism, which they'll place when testing).
6. *Add a rock or a tree to block the easy way.*
7. *Choose spare mirrors: more makes it gentler. Par stays the same.*
8. *Check your island* (par and difficulty appear).
9. *Now light it yourself* (Test your island opens in 3D; they place mirrors and any prism).

The steps are a pure state machine in `src/shared/builder.ts` (tested): each step names the action
that completes it. Reopening shows the tutorial only until it was finished or skipped (stored per
user, like the game's rule cards).

## 3. Data model

Community islands reuse every day-keyed system (board, sky, stored pieces, others' islands,
submissions, progress, start records) by giving each one an **island number** in a reserved
range: `COMMUNITY.numberBase` (1,000,000) + n. Daily days are 1 to 90 and the hero island is
900 to 904, so the ranges never meet. One function, `isCommunity(number)`, guards everything
that must differ.

| Key | Type | Holds |
| --- | --- | --- |
| `cm:next` | counter | the next n |
| `cm:{n}` | hash | rows, inventory, par, difficulty, label, name, biome, maker (username, id, snoovatar), postId, created, week, hash, solution, author ("user" or "app") |
| `cm:post` | hash | postId → n |
| `cm:hash` | hash | island hash → n (duplicate check) |
| `cm:week:{week}` | sorted set | n by post score, refreshed by the half-hourly task (this week's top 10) |
| `cm:all` | sorted set | n by creation time (the "older" list) |
| `cm:excluded` | hash | n → mod's username |
| `cm:pub:{date}:{userId}` | counter, 2-day expiry | islands published today |
| `draft:{userId}` | string, 30-day expiry | the Builder draft |
| `cm:test:{userId}` | string, 1-day expiry | the checked island's hash, its test start, and the passing test solve |
| `sun:pick:{day}` | counter lock | the Saturday pick ran for this Sunday |
| `sun:{day}` | string | the picked island for that Sunday |
| `user:{userId}` field `title` | | "islandwright" for the flair |

Every community island's board, sky and so on use the existing `lb:`, `sky:`, `boards:`,
`others:`, `sub:`, `start:` and `prog:` keys with its island number. Redis rules hold: strings,
hashes and sorted sets only, every write fallible, TTLs as listed.

**Post data** gains an optional `kind: 'community'` with island number, name, biome, rows, par,
lanterns, maker name and snoovatar. `readPostData` keeps reading old posts (tested).

---

## 4. Endpoints

| Phase | Endpoint | Does |
| --- | --- | --- |
| P1 | `GET /api/builder/draft`, `PUT /api/builder/draft` | load and save the draft (signed out: browser storage only) |
| P1 | `POST /api/builder/check` | structure, community limits, solver within budget, par 2–6, inventory, difficulty label, duplicate; rate limited to one per 3 s per user |
| P1 | `POST /api/builder/test-start`, `POST /api/builder/test-solve` | the server's clock for the test, then re-trace the creator's solve against the checked island |
| P2 | `POST /api/builder/publish` | re-check everything, require the matching test solve, word filter, daily limit, duplicate, then post |
| P2 | existing `/api/island`, `/api/lock-in`, `/api/leaderboard`, `/api/others`, `/api/sky`, `/api/card`, `/api/progress`, `/api/start` | accept community island numbers; community solves skip streak, flair, medals |
| P3 | `/internal/scheduler/sunday-pick` (cron `0 20 * * 6`) | pick, write `sun:{day}`, Islandwright flair; idempotent |
| P3 | the existing half-hourly catch-up | also runs a missed pick, and refreshes this week's scores |
| P3 | `/internal/menu/create-island` (users), `/internal/menu/workshop` (mods), `/internal/menu/exclude-island` (mods, on a post), `/internal/menu/dev-pick` (playtest only) | menus |
| P3 | `GET /api/community` | the Archipelago's community section |

---

## 5. Files

**New:**
- `src/shared/builder.ts` (+ test): editor state as pure functions (tools, cycling, undo and
  redo, rows encoding, limits, island hash, difficulty label, name rules).
- `src/client/builder/`: `editor.ts` (canvas board, live light), `panel.ts` (tool bar, size,
  biome, name, Check, Test, Publish), `main.ts` (both hosts: its own page and a layer).
- `src/client/builder.html`, `src/client/builder.css`.
- `src/server/core/community.ts` (+ test): check, publish, pick, lists.
- `src/server/routes/builder.ts`.
- `content/fixtures/builder-worst-8x8.json` (the server timing fixture).
- `docs/JOURNEYS-BUILDER.md` (the note for later).

**Changed:**
- `src/shared/config.ts`: `COMMUNITY` block, copy.
- `src/shared/api.ts`: post data kind, new response types.
- `src/server/core/content.ts`: island lookup by number, with community and Sunday override.
- `src/server/core/game.ts`: community solves skip streak, flair, medals.
- `src/server/core/post.ts`: community posts, credited Sunday titles.
- `src/server/routes/api.ts`, `menu.ts`, `triggers.ts`, `scheduler.ts`.
- `src/client/preview.ts` (community and Workshop cards), `game/hud.ts` ("Build an island"),
  `game/main.ts` (Builder layer, maker row), `game/archipelago.ts` (community section),
  `game/others.ts` ("Maker" label).
- `devvit.json` (entry point, menus, cron, maybe permission), `vite.config.ts`,
  `vite.debug.config.ts` (local stand-ins), `scripts/build-check.ts` (the new page).
- README, HANDOFF, LAUNCH, SUBMISSION, TESTS-TO-RUN.

The daily puzzle rules, the solver and its results, and `content/puzzles.json` are not touched.

---

## 6. Tests (Vitest, the memory store from `game.test.ts`)

- **Editor:** each tool places; tapping again cycles each option in order; eraser; undo and redo
  across edits; clear; rows round-trip; limits enforced (1–3 suns, 1–6 lanterns, sizes 6–8).
- **Check:** malformed rows; too big or small; no suns or lanterns; a lantern lit with no pieces;
  unsolvable; over the node budget (fixture) gives the "too complex" line; par below 2 or above 6;
  inventory equals par's mirrors plus slack and the best answer's prisms; par unchanged with the
  final inventory; difficulty label bands; exact duplicate of a daily island; duplicate of a
  community island.
- **Test your island:** a solve that doesn't light everything is refused; a solve for an older
  version of the island is refused; any edit clears the proof.
- **Publish:** refused signed out, without a passing test, over 3 a day, with a filtered name, or
  for a duplicate; re-checks everything (a tampered par is ignored); the post title, credit and
  post data are right; `runAs: 'USER'` failing falls back to the app once; the author is recorded.
- **Playing:** a community island number is never "tonight", "past" or "future" for the calendar;
  its board, sky, stored pieces and others' list work; streak, flair, medals and all-time are
  untouched; the maker's test solve is the first board.
- **Sunday pick:** highest score in the band wins; ties go to the earlier post; removed, spam,
  excluded and out-of-band islands are skipped; nothing eligible keeps the generated Sunday;
  running it twice changes nothing; the catch-up runs a missed pick; the override is served only
  for that Sunday; the flair gets "Islandwright" and keeps the medal and streak.
- **Lists:** this week's top 10 by score, then older; excluded and removed islands are hidden.
- **Switch:** with `COMMUNITY.enabled` off, no Builder button, menu item or endpoint answers.
- **Post data:** old daily posts, new community posts and the Workshop post all read correctly.

---

## 7. Phases (each ends with tests, types, lint, build, a local look at 360x460, 430x701 and desktop, one commit, a push to GitHub (Maulik, Nov 19), an upload to r/lumen_game_dev, a short report, and your phone test)

| Phase | Builds | Target |
| --- | --- | --- |
| **P1** | Editor, live light, draft save, Check (with server timing logs), Test your island. No publishing. Opens from the result card and the Archipelago as a layer | Nov 20 |
| **P2** | Publish, community island posts and cards, their boards, sky and others' islands, the maker's first board, the switch | Nov 22 |
| **P3** | Sunday pick, Islandwright flair, Archipelago section, Workshop post, menus, mod exclude, dev tools | Nov 23 |
| Launch | Nov 24: daily game on r/lumen_game_dev (`docs/LAUNCH.md` section 2), with the switch on only if P2 and P3 passed your phone test | Nov 24 |
| **P4** | Polish at all three sizes, edge cases, README, HANDOFF, LAUNCH, SUBMISSION rows (Builder gallery pictures with Check and Publish visible, as BridgeDit did) | Nov 25 |
| First pick | Saturday Nov 28, 20:00 UTC; first community Sunday is Nov 29 | Nov 28 |

---

## 8. Risks

1. **The core lookup change in P2** (section 1.10). Mitigation: the switch, and tests for every
   endpoint with both kinds of island.
2. **Solver time on Devvit's servers is unknown** (1.6). Mitigation: measured in P1 before
   publishing exists.
3. **Posts come from the app account for everyone but you** during the event (1.2). Mitigation:
   credit everywhere, and honest wording.
4. **8x8 on small phones** (1.4). Mitigation: snapping, full-width board, a phone test, and the
   size list in config.
5. **Bundle size.** The Builder is a separate chunk, loaded only when opened. The game stays
   under the 450 KB budget; checked every phase.
6. **Spam or offensive island names.** Mitigation: short list, character rule, 3 a day, mods
   remove, removed posts are never picked.
7. **Schedule:** five days with launch in the middle, each phase waiting on a phone test. If P3
   slips past Nov 23, the switch stays off at launch, and P3 plus P4 only have to land before the
   first pick on Nov 28.

---

## P1 report (Nov 19)

**Built:** `src/shared/builder.ts` (tools, cycling, limits, undo and redo, draft format, island
fingerprint, labels, the tutorial's steps), `src/server/core/check.ts` (the check),
`src/server/core/community.ts` (drafts, check turn, the maker's test proof),
`src/server/routes/builder.ts` (`/api/builder/draft`, `check`, `test-start`, `test-solve`,
`tutorial-done`), `src/client/builder/` (the flat board with live light, the Builder screen,
the Island panel for world, size and spare mirrors, the first-island tutorial),
`builder.html` (entry point `builder`), "Build an island" on the result card and the map, and a
test mode in the game: the maker lights their island in 3D, the server confirms it, night falls,
and the Builder returns. 385 tests.

**Measured:**
- 3D tiles on an 8x8 island are 31–36 px across and 23–30 px deep at 360 px wide, so the editor
  is flat. The flat 8x8 board gives **44 px** tiles at 360x640. At the 360x460 floor (icons only,
  slimmer bars) 8x8 tiles are 29.5 px and 6x6 tiles 39 px.
- The check now solves once (par cannot change with the final inventory), so the worst case is
  one node budget: 400,000 nodes, about **3.5 s on a laptop on mains** (6–9 microseconds per node
  on hard 8x8 islands). Devvit's speed is still unknown: every check logs
  `Builder check: 8x8, par 6, 400001 nodes, 2405 ms`; read them with `npx devvit logs`.
- Game JS 168 KB gzipped; the Builder is its own 6 KB chunk, loaded only when opened.

**Not yet:** publishing (P2). After a passing test the line says "Publishing comes next" and the
button reads "Lit by you". Suns are white only (coloured suns could come later).

### P1 on a real phone (Nov 19, v0.0.1.76, iPhone 15 Plus through iPhone Mirroring)

Claude ran test cases A1–H6 (`docs/TESTS-TO-RUN.md` 1c) on the phone. Passed: A1–A3, A5,
B1–B10, C1–C11, D1–D6, E1–E12, F1–F6. Captures and what each is good for: `docs/CAPTURES.md`.

- **Server speed:** the 8x8 Monster hits the 400,000-node limit in **1.12 s** on Reddit's server
  (3.5 s on the laptop). There is room to raise `COMMUNITY.solveNodes` about four times and still
  answer within about 5 s, so bigger islands pass. Maulik's call.
- **Fixed after the run** (each with a test, or measured in the browser where it is layout):
  1. An edit made under a second before closing was lost (closing saved only to the device,
     and a signed-in player's draft comes from the server). Closing, hiding the app and leaving
     the page now save at once (`client/builder/saver.ts`, `keepalive`), and reopening waits for
     that save.
  2. Reopening asked for a check and a test already done. `/api/builder/draft` now returns the
     server's check and the maker's solve for that exact island (`islandStatus`), and undoing
     back to a checked island keeps it checked.
  3. Names: apostrophes (straight and the phone's curly one), hyphens and letters in any script
     are allowed; anything else shows "Names use letters, numbers, spaces, ' and -." as you type.
  4. A test that the server refuses to start no longer opens: "Check your island again, then
     test it." (check expired or replaced) or "The test could not start. Try again." (no network).
  5. The Island panel is solid paper (lanterns showed through it); Skip on the first step closes it.
  6. "Build an island" on the map is a paper button and the map scrolls the last island clear
     of it (it was dark on dark, behind the last island).
  7. Seven hint lines wrapped at 360 px. All are shorter now, and a test holds every line to the
     row's measured width (`BUILDER_VIEW.lineChars`, `lessonChars`, `lessonNextChars`).
- **Left for Maulik:** B11 (Skip on a fresh account), H1 (thumb on 8x8), H4 (Reduce Motion),
  H5 (sound), G2 (second device), G3 (signed out), H2–H3 (desktop), H6 (Android).
- **From the outside review, for later:** the creator-to-player loop (publish, someone plays it,
  the maker is credited) is P2 and matters more than more editor tools. The checker proves an
  island solvable, not fun: build two or three showcase islands by hand before the gallery
  (`docs/SUBMISSION.md`).
