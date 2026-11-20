# Island Builder, phase 3: the Sunday pick and community presence (plan)

Written Nov 20 from Maulik's Phase 3 brief, on top of `BUILDER_PLAN.md` (sections 0 to 8 stay in
force unless this file says otherwise), `PHASE2_PLAN.md` and the Phase 2 code. Sources read:
CLAUDE.md, PHASE2_PLAN.md and its report, BUILDER_PLAN.md, HANDOFF.md O-14, PLATFORM.md,
docs/LAUNCH.md, SPEC.md "Reddit and community layer" item 7, the server code (`post.ts`,
`content.ts`, `community.ts`, `game.ts`, `routes/*`), `devvit.json`, and the installed SDK
typings (0.15.2) for `Post.sticky`, `Post.score`, `Post.removed`, `PostDelete`.

**Status: approved Nov 20 (Maulik): section 0 as recommended, with E5 changed (below). Build
starts only after the "everyone accounted for" fix passes Maulik's phone check (R1–R4 in
`docs/TESTS-TO-RUN.md`). One commit per item, push after, no upload until Maulik says; phone
checks D1–D12, with D1 (pins) before Nov 24.** The quality rules in CLAUDE.md apply: every new
list and count (the Community section, the Sunday credit, flair) gets its invariant in
`accounted.test.ts`, and the judge pass is the four-seat pass with real data. Timeline (Maulik, Nov 19): Phase 3
by Nov 23, launch Tue Nov 24, first pick Sat Nov 28 20:00 UTC (Sun Nov 29, 01:30 IST) for
Sunday Nov 29 = day 6. Lumen is never published: everything runs in a playtest build on
r/lumen_game_dev. Push after the phase; upload only when Maulik says.

**Why it matters for judging.** Two Sunday picks land before the Dec 8 deadline (day 6 on
Nov 29, day 13 on Dec 6). The pick is the moment the community loop closes: a player builds,
others upvote, and everyone's ranked puzzle carries the maker's name. It scores on Reddit-y
(votes decide, credit and flair on Reddit), Daily Content (a fresh Sunday from the community)
and Delightful UX (the maker sees their island become the day's island).

---

## 0. Decisions for Maulik (each has a recommendation)

| # | Question | Recommendation |
|---|---|---|
| E1 | **The week window.** Which islands are in the running for a Sunday? | **The 7 days before the pick:** published from the previous Saturday 20:00 UTC up to this Saturday 20:00 UTC. An island published after a pick goes into next week's. The Nov 24 launch-day clean-up deletes islands published before launch, so **the first real candidates are islands published Nov 24–28** (LAUNCH.md says so). |
| E2 | **Minimum score.** Below it, the generated Sunday stays. | **2**: the author's own vote plus at least one other person's. Higher (5) is safer against a lone island winning, but the subreddit is small during judging and the first pick is the demo moment. Plan for it: ask friends to publish and upvote between Nov 24 and 28. |
| E3 | **Which islands fit Sunday.** The brief says the Sunday par band; SPEC adds a difficulty band (generated Sundays score 60–82). | **Par 3 to 5** (Sunday's band) **and a difficulty score of at least 55** (no upper bound beyond par 5). The exact 60–82 band would turn away most player islands; the floor keeps a straight-line par-3 island from becoming everyone's Sunday. Both numbers in config. |
| E4 | **Sunday's world.** The week's biome changes on Mondays; a picked island has the maker's own world. | **The maker's world.** A different world on Sunday is a visible signal that this one was built by a player. Day number, date and weekday stay Sunday's. |
| E5 | **The maker playing their own Sunday.** They know the answer. | **Decided by Maulik (changed): not ranked.** Their test solve is pinned first as "Maker's board" in See others' islands. If they play and Lock in, it does not appear on the leaderboard and earns no medal that day, but it **does continue their streak** (building a winning island must never break a streak). (Recommended was ranked with a "Maker" tag; not chosen.) |
| E6 | **The winning post goes away after the pick.** The brief: Sunday still runs if it is deleted. | **Once Sunday's post exists, nothing changes Sunday.** Before that: if a **moderator removes or excludes** the winner, the pick is withdrawn and runs again without it (next best, or the generated island), and the app deletes its announcement comment. A **deletion** (by the maker, or anyone) keeps the pick, as the brief asks. Credit after a deletion: the name and snoovatar frozen at the pick stay on Sunday's card, game and results comment; only the link to the original post is dropped. |
| E7 | **Islandwright flair format.** Today's flair is "{medal} 🔥{streak}" (e.g. "Lamplighter 🔥12"). | **"Lamplighter 🔥12 · Islandwright"**, and just **"Islandwright"** for a maker with no daily medal yet. Permanent: every later daily Lock in writes it with the title kept. Repeat wins are counted in Redis, not shown (short flair). Flair stays fallible. |
| E8 | **Pins.** Reddit's API gives subreddit posts **two** pin slots (`sticky(1 \| 2)`, SDK typings); LAUNCH.md planned to pin How to play *and* the Feedback thread. | **Today's daily post in slot 1, How to play in slot 2.** The Feedback thread is no longer pinned; How to play links to it (LAUNCH.md section 6 updated). The app unpins only its own previous daily post, by id, so it never touches How to play. A config switch turns pinning off if the phone check (D1) shows Reddit shuffling the pins. |
| E9 | **Where the community section lives in the Archipelago.** | **A switch at the top of the map: "Nights" and "Community".** Nights is today's map, unchanged except for maker badges on picked Sundays. Community is a list (paper rows, like See others' islands): this week's pick on a larger card, then the week's top 10 by score, then older islands. A list reads better than floating islands for names, makers and plays, and each view stays short on a phone. |
| E10 | **BUILDER_PLAN's Phase 3 also listed a Workshop post and a "Create a Lumen island" subreddit menu.** This brief does not. | **Drop both.** Build an island is already on every result card and on the map, and there is no free pin slot for a Workshop post (E8). |
| E11 | **The announcement comment on the winning post.** The post's pinned comment is its results comment, and a post has one pinned comment. | **A separate app comment, distinguished as a moderator comment, not pinned:** "Chosen as Sunday's island for r/lumen_game_dev ✨ Well built, u/{maker}." Naming the maker makes Reddit notify them (in a playtest build their island was posted by the app, so a plain reply would not reach them). When Sunday's post exists, the comment is edited once to add its link. Wording in config. |

---

## 1. User flows

**A. The week (players).** Players publish islands (Phase 2) and vote on them like any Reddit
post. Nothing new to learn. The Archipelago's Community view shows the week's islands ranked by
score, so a player can see what is in the running.

**B. Saturday 20:00 UTC (the pick, no one watching).**
1. The scheduler task `sunday-pick` fires. It works out next Sunday's day number from the
   server clock, takes the pick lock, and gathers this week's candidates (section 3).
2. Each candidate's post is fetched from Reddit: live score, removed, spam. Drop the ones that
   are gone, excluded, below the minimum score, or outside the Sunday band (stored par and size
   first; cheap).
3. Rank by score, then par hits, then plays, then earliest published. Re-check the leaders on
   the server with today's engine, in rank order, until one passes (at most
   `SUNDAY.recheckMax`, 3): it must solve within the node budget with the same par and
   inventory, and meet the difficulty floor.
4. Freeze the winner: write a full copy of the island into `sun:{day}` (rows, inventory, par,
   solution, sun colours, name, maker, snoovatar, the maker's test solve), with the score and
   why it won. From now on Sunday reads only this copy.
5. Effects, each fallible and done once: the announcement comment (E11), Islandwright for the
   maker (E7), a log line. None qualifies: `sun:{day}` records "generated" and why, and the log
   says so ("Sunday pick for day 6: generated island; 4 candidates: 2 below score 2, 1 par 6,
   1 removed").

**C. Sunday 00:00 UTC (everyone).**
1. The daily post is made as on any day, from the frozen copy: title "Lumen #6 · Ember Bend ·
   Sunday · Island by u/name", the maker's world on the feed card with an "ISLAND BY U/NAME"
   kicker and their snoovatar (the community card's kicker), the outline, par.
2. In the game: the top bar reads "Lumen #6" and the island's name, with "by u/name" in the
   small line. Rules, tutorial, ranked Lock in, streak, medal, flair, sky and board are the daily
   game's, unchanged, except for the maker (E5): their Lock in is not ranked (no board row, no
   medal) but continues their streak. The result card gains one credit line, "Island by u/name,
   chosen by r/lumen_game_dev". See others' islands pins "Maker's board" first.
3. The results comment: "Lumen #6 · Ember Bend, an island by u/name, chosen by the community"
   with a link to the original post while it stands.
4. Today's post is pinned in slot 1 and yesterday's unpinned (every day, not just Sunday).

**D. The maker.** Gets a notification from the announcement comment ("Well built, u/name"),
sees "Islandwright" in their flair, and on Sunday sees their name on everyone's island. Their
original island post shows "Chosen for Sunday, Nov 29" on its card (one line from `/api/card`)
and keeps its own board.

**E. Archipelago.** Nights: picked Sundays carry a small maker badge (snoovatar disc and
"by u/name"). Community: the pick card ("Sunday's island · Nov 29", outline, name, maker,
plays), the week's top 10 (mini outline, name, maker, "12 lit it", score), then older islands
(newest first, 20 at a time). Tapping a row opens that island's post.

**F. Moderators.** On any post, two items: "Lumen: exclude from Sunday pick" and "Lumen: include
in Sunday pick again". On a community island they answer "Excluded from the Sunday pick." /
"In the running again."; on any other post "This is not a community island." Excluding the
current winner before Sunday starts re-runs the pick (E6).

**G. Dev tools (r/lumen_game_dev, refused once `LAUNCH.launched`).** "Dev: run Sunday pick now"
runs the pick for the next Sunday from the (shifted) dev clock, replacing an earlier dev pick
unless that Sunday's post exists. "Dev: who would win Sunday now" runs the same ranking without
writing anything and answers with a toast ("Ember Bend by u/name, score 7, par 4. 3 others in
the running."), the full reasoning in the server log.

---

## 2. Rules for the pick (all numbers in config, `SUNDAY` block)

- **Candidates:** community islands created inside the window (E1), `active`, not `excluded`,
  `COMMUNITY.enabled` on, live post not removed or spam, score at least `SUNDAY.minScore` (E2),
  par in `SUNDAY.par` [3, 5] and difficulty at least `SUNDAY.minDifficulty` (E3). Scanned from
  `cm:all`, newest first, at most `SUNDAY.scanMax` (200).
- **Order:** score (live, from Reddit) high to low; then par hits; then plays; then earliest
  published.
- **Re-check:** `checkIsland` on the stored island (the same check Publish ran), with
  `COMMUNITY.solveNodes`. Must be ok with the stored par and inventory. At most
  `SUNDAY.recheckMax` re-checks per run (about 2.3 s each at worst on Reddit), so the request
  stays well inside 30 s.
- **Idempotent:** `sun:lock:{day}` (counter, `SUNDAY.lockSeconds` 300) lets one run at a time;
  `sun:{day}` once written is final, except (a) the dev pick, (b) the withdrawal in E6, both
  only while Sunday's post does not exist.
- **Catch-up:** the half-hourly task (`daily-catch-up`, :07 and :37) runs the pick when it is
  Saturday after `SUNDAY.pickHourUtc` (20) and `sun:{day}` is missing: eight more chances before
  midnight. The last chance: making Sunday's daily post first runs the pick if it never ran. A
  pick that throws leaves the generated island and logs why; the daily post is never held up.
- **Frozen once posted:** when Sunday's post is made, `sun:{day}` gets `posted`. After that
  nothing changes the island: not exclusion, removal, deletion, the switch or a dev pick.
- **Switch off** (`COMMUNITY.enabled` false): no pick runs, and an unposted pick is ignored (the
  generated Sunday is served). A Sunday already posted with a pick keeps it.

---

## 3. Data model (Redis: strings, hashes, sorted sets only; every write fallible)

| Key | Type | Holds | Expiry |
|---|---|---|---|
| `sun:{day}` | hash | `state` (community / generated), `island` (JSON: the playable copy with solution), `credit` (JSON: maker, makerId, makerAvatar, label), `creator` (JSON: the maker's test solve), `k`, `sourcePost`, `score`, `parHits`, `plays`, `pickedAt`, `why` (generated: the reasons), `posted`, `comment` (announcement id), `flaired` | none (small; one per Sunday) |
| `sun:lock:{day}` | counter | one pick at a time | `SUNDAY.lockSeconds` |
| `cm:{k}` | existing hash | new fields `excluded` (mod name), `sunday` (the day it was picked for) | none |
| `cm:votes:{day}` | sorted set | k → last known score, for next Sunday's window; written by the pick and by the half-hourly refresh (this week's islands only, at most `SUNDAY.scanMax`) | 21 days |
| `user:{userId}` | existing hash | new fields `islandwright` (wins), `lastMedal` (written at each ranked daily Lock in, so the pick can write the full flair) | as today |
| `pin:{day}` | string | today's post pinned (so the catch-up retries only a failed pin) | 2 days |

No change to `post:day:{day}`, boards, sky or stats: Sunday keeps day 6's keys, so streaks,
medals, flair, the all-time board and the Archipelago treat it as any day.

**Where the frozen copy is read.** `lookUpIsland` (every API route) and the daily post's
creation both go through one async function, `islandOfDay(store, day)`: for a Sunday it reads
`sun:{day}` and returns the copy when the state is community and (the switch is on or it was
posted); otherwise the generated island from `content/puzzles.json`. `islandForDay` (sync)
stays for the generator, the duplicate check and tests. `/api/past` uses the async one for
Sundays only.

**Post data** for a picked Sunday: the daily shape plus `biome`, `maker`, `makerAvatar`
(about 120 bytes more; the size test covers it). `readPostData` keeps reading old posts.

---

## 4. Endpoints, tasks, menus

**Scheduler (`devvit.json`):** `sunday-pick` at `0 20 * * 6` → `/internal/scheduler/sunday-pick`.
`daily-catch-up` (existing, :07 and :37) also: runs a missed pick, retries unfinished pick
effects (comment, flair), refreshes `cm:votes`, retries a failed pin.

**API:**
- `GET /api/community`: `{ pick, week, older, more }`. `pick`: the upcoming Sunday's (after the
  pick) or the latest past one, with day, date, name, maker, avatar, rows, biome, plays,
  permalink (null when its post is gone). `week`: top 10 of `cm:votes` for the open window.
  `older`: the rest by creation time, `?after=` for the next 20. Each row: k, name, maker,
  avatar, rows, biome, par, plays, score, permalink. 404 when the switch is off.
- `/api/island`, `/api/card`, `/api/lock-in`, `/api/others`, `/api/share`, `/api/progress`:
  unchanged code paths; the island comes from `islandOfDay`. `PublicIsland` gains
  `madeBy?: CommunityCredit` (Sunday credit, kept apart from `community`, which switches on
  the community-island UI). `/api/others` pins the Creator's board on a picked Sunday.
- `/api/past`: Sundays carry `maker`, `makerAvatar`.
- `/api/card` on a community island: `sunday` (the date it was picked for), for the "Chosen for
  Sunday" line.
- The maker's own Sunday Lock in (E5): `lockIn` treats it as unranked for the board, medals,
  all-time and par counts, but advances the streak; the result card says why ("Your island:
  your streak goes on"). Every count stays consistent (accounted.test.ts gets a Sunday seat).

**Menus (`devvit.json`):**
- Post menu, moderators: "Lumen: exclude from Sunday pick" → `/internal/menu/exclude-island`;
  "Lumen: include in Sunday pick again" → `/internal/menu/include-island`. Stay after launch.
- Subreddit menu, moderators, playtest subreddit only, refused once launched:
  "Dev: run Sunday pick now" → `/internal/menu/dev-pick`; "Dev: who would win Sunday now" →
  `/internal/menu/dev-pick-preview`.

**Changed flows:** `ensureDailyPost` (Sunday: pick first if it never ran; title and post data
from the copy; mark `posted`; pin), `resultsNow` (Sunday credit line and link), the Lock in
effects (flair through one `flairFor(user)` that adds Islandwright), "Dev: clean up" (also
`sun:*`, `cm:votes:*`, `pin:*`, the user fields; **important: a dev pick for day 6 left from
testing would otherwise become the real Sunday**), "Reset my progress" (also `islandwright`,
`lastMedal`).

---

## 5. Daily post pinning (item 4)

After `ensureDailyPost` makes a post (scheduler, catch-up or mod menu; not "Post a Lumen island
(testing)"): unpin yesterday's daily post (`post:day:{day-1}`, if the app made it), then
`sticky(1)` today's, then write `pin:{day}`. Each step in try/catch with one log line; the
catch-up retries while `pin:{day}` is missing. The app never unpins a post it did not make, so
How to play stays in slot 2. `PINS.enabled` (config) switches it off. Reddit's behaviour when
both slots are taken and a post is pinned into slot 1 is not documented in the typings: that is
phone check D1, before launch.

---

## 6. Screens (same UI kit, fonts, icons and art)

- **Sunday feed card:** the daily card with the community kicker (snoovatar disc or initial,
  "ISLAND BY U/NAME") above "Lumen #6", the maker's world picture, the outline. Solved state as
  any day.
- **Sunday game:** top bar "Lumen #6" / island name / "Sunday · by u/name". Result card: credit
  line under the medal line. The maker's own Lock in: no board row, no medal, "your streak
  goes on" (E5).
- **Community island card (the winner's own post):** one quiet line "Chosen for Sunday, Nov 29".
- **Archipelago:** "Nights · Community" switch in the map bar (two paper tabs, 44 px). Community
  view: pick card (larger outline, a soft gold edge, "Sunday's island · Nov 29", name, maker,
  plays), section heading "This week", ten rows, heading "Earlier", rows, "More". Empty week:
  "No islands this week yet. Build one." with the Build button. Nights view: maker badge under a
  picked Sunday's name.
- Checked at 430x701, 360x460 and 1100x700, Reduce Motion on and off.

---

## 7. Edge cases

- Cron fires twice, or the catch-up overlaps the cron: the lock and the final `sun:{day}`.
- A run dies half way (timeout): the lock expires in 5 minutes; the next catch-up runs it.
- Every Saturday tick skipped: Sunday's post creation runs the pick first.
- A run after Sunday's post exists: refused (frozen), logged.
- Reddit's `getPostById` fails for one candidate: that candidate is skipped and logged; all of
  them fail: generated, "could not read scores".
- Scores tie (Reddit fuzzes small scores): par hits, plays, earliest.
- The leader fails the re-check (engine changed, or over budget): next in order, up to 3.
- An island published Saturday 20:01: next week's window.
- Excluded, then included before the pick: in the running. Included after the pick: no change.
- Winner removed or excluded before Sunday's post: pick withdrawn, re-run, old comment deleted
  (E6). After Sunday's post: nothing changes.
- Winner deleted after the pick: Sunday runs; credit from the copy; no link.
- The maker's flair: user flair off in the subreddit, or the call fails: logged, nothing else.
- The maker never played a daily: flair "Islandwright"; their next daily Lock in adds the medal.
- A dev pick for day 6 during testing: cleaned up on launch day (clean-up clears `sun:*`;
  LAUNCH.md gets a line to check `sun:6` is gone).
- "Post a Lumen island (testing)" for a Sunday before its pick: that test post's card shows the
  generated island while the game serves the pick. Dev only; noted.
- Switch off with a pick waiting: generated Sunday; on again before Sunday: the pick returns.
- Logged-out players on Sunday: play unranked as on any day; credit shows.

---

## 8. Tests (Vitest, memory store, Reddit faked through one `PickDeps` type)

- **Window:** islands at window start, just before, just after the pick time; the first-pick
  window for day 6.
- **Idempotency:** the same pick twice, the cron and the catch-up at once (one result, one
  comment, one flair); a second run after `sun:{day}` exists changes nothing.
- **Skipped tick and catch-up:** no pick at 20:00; the 20:07 catch-up picks; nothing before
  20:00 on Saturday; Sunday's post creation picks when nothing else did.
- **Ranking:** score, then par hits, then plays, then earliest; minimum score; band (par 2 and
  par 6 out, difficulty floor); re-check failure falls to the next; at most 3 re-checks.
- **Exclusion:** excluded out; included again in; excluding the winner before posting re-runs;
  after posting changes nothing.
- **Deleted and removed posts:** before the pick (trigger `active` false, and live `removed` /
  `spam` / fetch failure); after the pick (Sunday runs, credit kept, link dropped).
- **Frozen copy:** editing or deleting `cm:{k}` after the pick does not change Sunday's island,
  card or results comment; other days are untouched (all 90 days' islands compared before and
  after).
- **Fallback:** no candidates, all below score, switch off; `why` recorded.
- **Flair:** "Lamplighter 🔥12 · Islandwright", "Islandwright" with no medal, kept by the next
  daily Lock in, absent for everyone else.
- **The maker on their own Sunday (E5):** not on the board, no medal, no par count, streak
  continues; "Maker's board" pinned first; from every seat everyone else is still accounted for.
- **Pins:** today pinned, yesterday unpinned, a post the app did not make never unpinned, a
  failed pin retried once, `PINS.enabled` off does nothing.
- **Switches:** `COMMUNITY.enabled` off (no pick, `/api/community` 404, flair untouched);
  `LAUNCH.launched` on (dev pick and preview refused; exclude and include still work).
- **Post data and lists:** Sunday post data size; `/api/community` order, paging, removed and
  excluded hidden; `/api/past` maker badge only on picked Sundays.

---

## 9. Commits (one per numbered item of the brief)

1. Sunday pick: `SUNDAY` config, `server/core/sunday.ts` (window, candidates, ranking,
   re-check, freeze, withdrawal), `islandOfDay`, scheduler task, catch-up, Sunday post creation.
2. Credit everywhere: post title and data, feed card, top bar, result card, results comment,
   Maker's board and the maker's unranked Sunday (E5), "Chosen for Sunday" on the winner's card,
   announcement comment.
3. Islandwright flair: `flairFor`, `lastMedal`, the pick's flair.
4. Daily post pinning.
5. Archipelago community section and maker badges, `/api/community`, votes refresh.
6. Mod tools and dev tools (menus), clean-up and reset.
7. Behind the switches (both switches across everything above, with their tests).

Then lint, types, tests, build; the judge pass (section 11); push; report; wait for Maulik's
word to upload.

---

## 10. Phone checks D1–D12 (go into docs/TESTS-TO-RUN.md after the build)

| # | Check |
|---|---|
| D1 | **Before launch.** With How to play pinned: "Dev: set today" to the next day, "Post today's Lumen": the new post is pinned on top, the previous daily unpinned, How to play still pinned |
| D2 | Mod menu on an island post: Exclude, then Include, each with its toast; on a daily post: "This is not a community island." |
| D3 | Three islands from three accounts, different upvotes; "Dev: who would win Sunday now" names the one with most votes |
| D4 | "Dev: set today" to a Saturday, "Dev: run Sunday pick now": the announcement comment appears on the winning post and the maker is notified; their flair gains Islandwright |
| D5 | "Dev: set today" to that Sunday, "Post today's Lumen": title, feed card kicker with the maker's snoovatar, the maker's world |
| D6 | Play it ranked from a second account: top bar credit, result card credit line, streak and medal as usual, flair updates. The maker plays too: not on the board, no medal, streak continues, "Maker's board" first in See others' islands |
| D7 | Results comment names the island and maker, with a link to the original post |
| D8 | Archipelago: Community tab (pick card, this week, earlier), tap opens the post; Nights shows the maker badge on the Sunday |
| D9 | Remove the winner as a mod before Sunday's post: the pick re-runs (preview shows the next one); after Sunday's post: nothing changes |
| D10 | No island with 2 votes: the pick says generated; Sunday is the generated island |
| D11 | **Real run:** Sat Nov 28 20:00 UTC (Sun 01:30 IST): the pick happens by itself (server log `Sunday pick for day 6`) and the comment appears |
| D12 | **Real rollover:** Sun Nov 29 00:00 UTC (05:30 IST): Lumen #6 is the pick, pinned, credited |

---

## 11. Judge pass (before the report)

With the stand-in server (`vite.debug.config.ts` gains `/api/community`, a fake score per
island set with `fetch('/api/dev/score?k=1&score=5')`, the pick, and a flair log): three
players publish (`?user=`), scores differ, "run the pick", the clock moves to Sunday, a second
player plays Sunday ranked, flair text checked, the Archipelago's two views. Screenshots at
430x701, 360x460 and 1100x700, top issues fixed when cheap, the rest listed. Captures go to
`captures/2026-11-2x-local-phase3/` and `docs/CAPTURES.md`.

---

## 12. Risks

1. **Launch is Nov 24, the first pick Nov 28.** Pinning goes live with every daily post from
   launch day, so D1 must pass before launch, or `PINS.enabled` stays off. The pick itself
   touches only Sundays and sits behind `COMMUNITY.enabled`.
2. **A test pick left in Redis would become the real Sunday.** Launch-day clean-up clears it;
   LAUNCH.md gets the check.
3. **Cron is not exactly-once** (PLATFORM.md 5). Eight catch-ups plus the last chance at post
   creation; idempotent effects.
4. **Too few islands or votes for the first pick.** The generated Sunday is a fine fallback, but
   the demo needs a real pick: line up friends to publish and upvote Nov 24–28 (E2).
5. **Pins on Reddit are untested** (slot behaviour, How to play displaced). Unpin by id only,
   the switch, D1.
6. **Score freshness:** Reddit fuzzes small scores and a playtest app's view of votes is
   untested. The pick reads them live once; ties fall to par hits and plays.
7. **Schedule:** about a day and a half of building (Nov 21–22), judge pass and push Nov 23.
   If it slips, the pick must land before Nov 28 20:00 UTC; the Archipelago section can follow.
8. **Flair overwrites:** the app writes the whole flair text, so a player's own flair in
   r/lumen_game_dev is replaced at each Lock in, as today.

---

## P3 report (Nov 21)

**Built, one commit per item:** (1) the Sunday pick: the week before Saturday 20:00 UTC, live
islands with at least 2 votes and par 3 to 5, ranked by score then par hits, plays, the
earliest; the leaders re-checked with today's engine (at most 3, difficulty at least 55); the
winner frozen whole into `sun:{day}`; cron, half-hourly catch-up and Sunday's post creation as
the last chance; a moderator's removal before Sunday's post withdraws and re-runs the pick, a
deletion keeps it; the comment on the winning post; Sunday's post titled and carded with the
credit (c9586de). (2) Credit everywhere and the maker's own Sunday (E5: kept, not ranked,
streak continues; "Maker's board") (551e108). (3) Islandwright flair (c5ad653). (4) Today's
post pinned, yesterday's unpinned, How to play untouched (2c8a39e). (5) The Archipelago's
Community view and maker badges, `/api/community`, scores refreshed half-hourly (7c74485).
(6) Mod exclude and include, dev pick and preview, clean-up and reset (bd33bc7). (7) Both
switches (e1dff9d). Also: the local stand-in now runs the Builder, the pick and the Community
view on the real server code (38f8ec0), and the judge pass below (50558f4). 488 tests.

**Rule 3 (data that changes meaning), every reader found and changed:** the island behind a
daily number (now Sunday's pick for a picked Sunday: the lookup every route uses, the post's
title and data, the results comment, past islands, the feed card's world); "a maker's row
means a community island" (the crowd line and the row's name now go by the island's number);
a kept-but-unranked result (the maker's: reset no longer takes back counts it never added,
their own row counts them); deleted vs removed posts (`postActivity` says which).

**How it was tested:** Vitest: `sunday.test.ts` (window edges, ranking and tie-breaks,
minimum score, band, re-check and its limit, exclusion, removed and deleted posts, double
fire, skipped tick and catch-up, last chance, frozen copy over all 90 days, withdrawal and its
flair, fallback, dev pick and preview, clean-up, both switches), `shelf.test.ts` (every live
island listed exactly once over every page, never a removed or excluded one), `pins.test.ts`,
the maker's Sunday in `game.test.ts`, and a Sunday-with-maker night in the
everyone-accounted-for suite. Key tests were checked to fail with the lock, the freeze, the
week window, or the maker's path removed. Locally (`npm run sunday-pass`, now in `npm run
checks`): three makers publish, votes differ, the pick runs, a crowd plays Sunday with the
maker among them, and the feed card, result cards, See others' islands and both map views are
opened from four seats at 430x701, 360x460 and 1100x700 and checked from the screen
(captures: `captures/2026-11-21-phase3-judge/`).

**Judge pass, fixed:** the maker's card credited them to themselves ("Chosen by the community
for Sunday" now); "1 nights"; the picked island's own row on the map said "Be the first to
light it" ("Chosen for Sunday, Nov 29" now); a date broke between month and day at 360 px.
**Left:** the same island appears twice on the map's Community view (the pick card for Sunday,
and its own post under Earlier, each with its own count); on desktop another lantern can sit
partly behind your own, and "You" sat slightly right of the lantern in headless shots (to
check on the phone).

**Not tested on Reddit (all of it):** phone checks D1-D12 in `docs/TESTS-TO-RUN.md` 1f. The
unknowns that matter most: how Reddit's two pin slots behave (D1, before launch), whether a
playtest app reads live post scores (D3), the comment's username mention notifying the maker,
`onModAction` telling removal from deletion, and the real cron on Sat Nov 28.

**Risks before Nov 24 and Nov 28:**
1. Pinning runs on every daily post from launch day: D1 must pass first, or `PINS.enabled`
   goes false (one config change).
2. A test pick left in Redis would become the real Sunday: launch-day clean-up clears it
   (LAUNCH.md says to check day 6 afterwards).
3. The first pick needs islands published Nov 24-28 with at least 2 votes: line up friends.
4. Reddit fuzzes small scores; ties fall to par hits, plays and the earliest.
5. The Saturday pick reads every island's post (at most 200) and re-checks up to 3 (about 7 s
   at worst on Reddit's server), well inside 30 s.
