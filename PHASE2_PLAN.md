# Island Builder, phase 2: publishing and community island posts (plan)

Written Nov 19 from `docs/PHASE2_BRIEF.md`, on top of `BUILDER_PLAN.md` (sections 0 to 7, which
stay in force unless this file says otherwise) and the Phase 1 code. **Approved Nov 19: all six
recommendations in section 0.** Timeline (Maulik): Phase 2 by Nov 21, Phase 3 by Nov 23 (first
Sunday pick Sat Nov 28), Phase 4 polish Nov 26–27, the atmosphere pass and trailer ending after
launch (Nov 24–26). Push after the phase; upload only when Maulik says. Lumen is never published during the hackathon: everything below runs in a playtest build
on r/lumen_game_dev, uploaded with `npm run release` after launch.

---

## 0. Decisions for Maulik (each has a recommendation)

| # | Question | Recommendation |
|---|---|---|
| D1 | **Post data.** The brief says postData holds only the island id. CLAUDE.md rule 11 says the feed card paints from postData without waiting on the network, under 1 s. With only an id, the card has no name, outline or maker until a request returns. | **Id plus a small card snapshot** (name, biome, rows, par, label, lantern count, maker name and snoovatar): about 400 bytes of the 2 KB limit. The island itself lives in Redis and the server never reads rules from postData. Daily posts already do exactly this. |
| D2 | **"Grouped distinct solutions."** The daily "See others' islands" does not group today: it lists the top 10 and your own. | **Group identical boards in both views** with one shared, tested function: a row "4 pieces · 6 players" with the first player's snoovatar, tap shows that board. One code path, and a judge sees the same behaviour on both kinds of post. (Alternative: community only, daily untouched.) |
| D3 | **Confirm screen wording.** The brief's "This posts to r/<sub> as u/<name>" is not true for anyone but you: a playtest build posts from u/lumen-game (PLATFORM.md section 4). | **"Posts to r/lumen_game_dev as an island by u/{name}"**: true in every case, and the post title and the game always credit the maker. |
| D4 | **When posting as the player fails** (the desktop "refresh token does not exist" seen once). | **Post as the app once, with the same credit**, then the calm failure line if that fails too. For everyone but you this is what a playtest build does anyway, so nothing visible changes. |
| D5 | **Lantern style on community islands** ("no streak or flair effects"). | The player's **current** lantern style shows (it is how others know them), but nothing advances: no streak, no flair, no medal, no all-time board. |
| D6 | **Launch.** `COMMUNITY.enabled` is on today. | Keep the daily game safe: launch on Nov 24 with the switch **on only if P2 passed your phone test by Nov 23**, otherwise off (one config change and a release turns it on later). |

---

## 1. User flows

**A. Publish (maker).**
1. Build, Check, Test your island (Phase 1). After a passing test the main button reads
   **Publish** (instead of "Lit by you").
2. Tap Publish: a confirm panel slides over the board: the island's picture (its outline in the
   island's world colours), the name (or the fallback, shown greyed, e.g. "Moss Island #7"),
   "Par 3 · 4 mirrors · Tricky", the line from D3, and two buttons: **Publish** and **Not yet**.
3. Tap Publish (the only tap that posts). The button reads "Publishing…" and is disabled; a
   second tap does nothing.
4. Server: re-checks everything (section 4), posts, records, answers.
5. Success: a short celebration (each lantern on the board glows in turn, one chime each, about
   1.2 s; Reduce Motion: one soft glow), the line "Your island is up.", the draft clears, then
   the new post opens (`navigateTo` with the post's permalink).
6. Failure: one calm line ("Could not post. Your island is saved; try again in a moment.", or the
   specific refusal: daily limit, name, duplicate), the draft stays, Publish stays available.

**B. Playing a community island (anyone).**
1. Feed card: the world's hero picture, the island's outline, the name, "Island by u/name" with
   the maker's snoovatar (glyph if none), "Par 3 · Tricky", then "12 players lit it" once
   `/api/card` answers. One big "Light the lanterns".
2. In the game: the same island, rules, rule cards, resume, sound, Lock in, nightfall and lantern
   release as the daily game. The top bar reads the island's name and "by u/name". The tutorial
   runs first for someone who never played Lumen.
3. Lock in: the first one per player counts on this island's board (pieces, then time). The
   lantern rises into this island's own sky, with live "u/name just lit {island}" arrivals.
4. Result card: medal line and rank as on the daily ("#3 on this island"), then **See others'
   islands** (with "Creator's board" pinned first), **Share to comments** (under the island's
   own pinned results comment), **Build an island**, and **Tonight's Lumen** (the daily post).
   No streak line, no countdown, no "Come back at nightfall".
5. Opening the post again after Lock in shows the night, the lantern and the card, as on the
   daily.

**C. Your islands (maker).** In the Builder, a "Your islands" button (top bar, next to Island)
opens a list: outline, name, date, "18 lit it · 5 at par". Tap a row: its post opens. Empty
state: "Islands you publish will be here." Removed islands show "Taken down" and do not open.

**D. Moderation.** A mod removes or deletes an island post: the island is marked inactive. Its
post (if still visible to mods) says "This island was taken down." It never appears in lists,
Your islands shows it as taken down, and Phase 3 never picks it.

**E. Switch off.** `COMMUNITY.enabled` false: no Build button, no Your islands, community posts
that exist show "This island is resting." (no community wording on daily cards), every
`/api/builder/*` answers 404.

---

## 2. Data model (Redis: strings, hashes, sorted sets only; every write fallible)

Community islands get an **island number** in a reserved range, as `BUILDER_PLAN.md` section 3
decided: `COMMUNITY.numberBase` (1,000,000) + k, with k from a counter. Every day-keyed system
(board, sky, stored pieces, others' list, submissions, start records, progress, shares, results
comment) is reused with that number, and one function, `isCommunity(number)`, guards everything
that must differ (calendar, streak, flair, medals, all-time, TTLs).

| Key | Type | Holds | Expiry |
|---|---|---|---|
| `cm:next` | counter | the next k | none |
| `cm:{k}` | hash | rows, inventory, par, difficulty, label, name, biome, hash, maker name, maker id, maker snoovatar, postId, created, active, postedAs (`user` or `app`), creator board (pieces JSON, count, ms) | none |
| `cm:post` | hash | postId → k | none |
| `cm:hash` | hash | island fingerprint → k (duplicates) | none |
| `cm:all` | sorted set | k by creation time | none |
| `cm:mine:{userId}` | sorted set | k by creation time (Your islands) | none |
| `cm:pub:{date}:{userId}` | counter | islands published that UTC day | 2 days |
| `cm:token:{userId}:{token}` | string | the result of one publish attempt (idempotency) | 1 day |
| `cm:lock:{hash}` | counter | one publish of a fingerprint at a time | 60 s |
| `lb:`, `sky:`, `boards:`, `others:`, `stats:`, `sub:`, `sublock:`, `start:`, `prog:`, `shared:`, `sharelock:` with the island number | existing | as on daily posts | `COMMUNITY.keepSeconds` (90 days) instead of the daily expiries |
| `post:{postId}:sticky` | existing | the results comment | as daily |

Phase 1 keys stay: `draft:{userId}`, `cm:check:{userId}`, `cm:turn:{userId}`, user hash field
`builderTutorial`.

**Post data** (D1): `{ kind: 'community', island: k, name, biome, rows, par, label, lanterns,
maker, makerAvatar }`. `readPostData` keeps reading old daily posts (tested); the server reads
only `island` from it and loads the rest from `cm:{k}`.

**Realtime:** `skyChannel(number)` gives `sky_{day}` for daily islands and `sky_isl_{k}` for
community ones. Tested to match `/^[A-Za-z0-9_]+$/`.

---

## 3. Devvit rules this touches

| Rule | Where it bites | How the plan meets it |
|---|---|---|
| **User actions** (post or comment on a user's behalf only on an explicit, separately labelled tap; never automatic, bundled or required) | Publish; Share | Publish posts only from the confirm panel's Publish button. Nothing else posts. Share unchanged |
| **`runAs: 'USER'` needs `userGeneratedContent`** for a custom post | Publish | `userGeneratedContent: { text: "{name}: a Lumen island by u/{maker}. Par {par}." }` plus `textFallback` |
| **`asUser` permission** | Publish | `devvit.json` `reddit.asUser: ["SUBMIT_COMMENT", "SUBMIT_POST"]` |
| **Playtest build posts as the app for non-owners** | Every publish but yours | Store the true maker first; record `postedAs` from `post.authorName`; credit "Island by u/{maker}" in the title, card, game and results comment |
| **postData limit 2 KB** | Community post data | About 400 bytes; a test fails if an 8x8 island with a long name and avatar URL exceeds 1 KB |
| **Realtime channel names: letters, digits, underscores** | `sky_isl_{k}` | `skyChannel` tested; `connectRealtime` stays in try/catch |
| **`navigateTo` without `t3_` in a `/comments/` URL** | Opening the new post; Your islands; Tonight's Lumen | Use the post's own `permalink` from the server (as `openPost` does); fallback address strips `t3_`; tested |
| **`requestExpandedMode` synchronously in the click handler** | Community feed card | Same handler as the daily card |
| **Requests well under 30 s** | Publish (check about 2.3 s at worst on Reddit, plus post, comment, sticky) | Publish re-check once; comment and sticky after the post are fallible and short |
| **Redis: no lists or plain sets, no pipelining** | All lists | Sorted sets and hashes as in section 2 |
| **Triggers** | Deleted or removed posts | `onPostDelete` and `onModAction` (`removelink`, `spamlink`) mark the island inactive; a lazy check on read covers a missed trigger |
| **Logged-out players** | Community posts | Play unranked with the practice lantern, as on daily posts; no Publish |
| **Journeys** | Community play | Not in `JOURNEY_MAP.md`: send nothing (`quietJourney`). Proposed events go in `docs/JOURNEYS-BUILDER.md`, a note only |

---

## 4. Endpoints

**New:**
- `POST /api/builder/publish { draft, token }`. In order, refusing with one reason each:
  1. signed in; switch on; `token` is 8 to 64 letters and digits;
  2. idempotency: `cm:token:{user}:{token}` holds a result → return it unchanged;
  3. the draft is well formed; `draftProblem` is null;
  4. the name: trimmed, `nameProblem` null, word filter passes; empty → the fallback name
     "{World} Island #{k}";
  5. the stored test solve exists for exactly `checkKey(draft)` (Phase 1 proof);
  6. a fresh `checkIsland` of the board on the server (never the client's numbers): ok, and the
     same par and inventory as the tested check;
  7. not a duplicate: fingerprint not in the daily islands or `cm:hash`;
  8. under the daily limit (`COMMUNITY.publishPerDay`, 3): counter taken only now;
  9. `cm:lock:{hash}` taken (another tap in flight → "Publishing…" answer);
  10. `submitCustomPost` as the user (D4 fallback), then `cm:{k}` and the lists, the creator's
      board, the pinned results comment ("Results for {name} by u/{maker}", app account), the
      token's result; clear the draft and the check. Answer `{ ok, postId, permalink, url }`.
- `GET /api/builder/mine`: Your islands (name, created, plays, par hits, active, permalink).

**Changed, so they serve community posts too** (one async lookup, `islandOfPost()`, returns the
daily or community island with its number; the island shape stays `DailyIsland`, so the engine
and the client do not change): `/api/island`, `/api/start`, `/api/lock-in`, `/api/sky`,
`/api/leaderboard`, `/api/others` (Creator's board first), `/api/share`, `/api/card`,
`/api/progress`, `/api/rule-seen`. Community solves skip streak, flair, medals and all-time;
`rankedOpen` is always open for them; `nightOf` returns `tonight`-like "open" with no countdown.

**Triggers:** `/internal/triggers/on-post-delete`, `/internal/triggers/on-mod-action`.

**Menus:** none new in Phase 2 (the "Create a Lumen island" menu item is Phase 3).

---

## 5. devvit.json

- `permissions.reddit.asUser`: add `SUBMIT_POST`.
- `triggers`: add `onPostDelete` and `onModAction`.
- Entry points: unchanged. A community post uses the same `default` (preview) and `game`
  entries; the page reads `kind` from postData. `builder` exists from Phase 1.
- No new scheduler task in Phase 2.

---

## 6. Screens

**Feed card (inline, no Three.js, paints from postData, under 1 s):** the daily card's layout
with a community header. Kicker "ISLAND BY U/NAME" with a 28 px snoovatar disc (glyph of the
initial if none), title = island name, the outline over the world's hero picture, "Par 3 ·
Tricky · 4 lanterns", then after `/api/card`: "12 players lit it" (or "Be the first to light it").
Solved state: "You lit it with 4 · #3" and "See the sky". Taken down: "This island was taken
down." and no button. Checked at 430x701, 360x460 and desktop; Lighthouse mobile above 80.

**Game top bar:** island name (Young Serif) over "by u/name" in the small line where the daily
shows the weekday. Pieces and par as today.

**Result card:** section 1B, step 4. Rank line reads "#3 on this island".

**See others' islands:** "Creator's board" first (maker's snoovatar, their test pieces, "Creator ·
4 pieces"), then "Your island", then the grouped list (D2).

**Builder:** Publish button and confirm panel (solid paper, like the Island panel); the
celebration; "Your islands" list as a panel with rows like the others' list.

---

## 7. Edge cases

- Double tap, retry after a timeout, two devices: same token returns the same post; a new token
  for the same board finds the fingerprint (duplicate) or the lock (in flight).
- The post succeeds but writing `cm:{k}` fails: the token result is written last; a retry finds
  the post through `cm:hash` repaired from the lock holder's write. Tested with a store that
  fails on one write.
- `submitCustomPost` throws: no counter or lists change, draft kept (the counter is taken before
  posting, so it is given back on failure).
- Maker edits the island after testing: Publish is gone (the check key no longer matches).
- Check expired (1 day) between test and publish: "Check your island again, then test it."
- Name blank, or only spaces: the fallback name. Filtered: "Pick another name." (no word quoted).
- Publishing an exact copy of a daily island or of another community island: refused.
- The maker plays their own island: they lock in like anyone; their test stays the Creator's
  board, unranked.
- Signed out on a community post: plays, practice lantern, Share hidden.
- A community number reaching any calendar code (Archipelago, past islands, `currentDay`):
  guarded by `isCommunity`; tested.
- Post removed then approved again by a mod: `onModAction` `approvelink` sets it active again.
- Switch turned off with community posts live: they say "This island is resting." and serve no
  data; turning it back on restores them.
- The app account posted for a non-owner: the title still says "Island by u/{maker}"; Your
  islands still lists it for the maker (stored by user id, not post author).

---

## 8. Tests (Vitest, memory store)

- **Publish validation:** signed out, no test proof, proof for another board, malformed draft,
  `draftProblem`, filtered name, blank name gets the fallback.
- **Server re-check:** a tampered par or inventory in the request is ignored; a board the
  server's solver now refuses is refused.
- **Idempotency:** the same token twice gives one post and the same answer; two tokens, one
  board: one post.
- **Rate limit:** the fourth island in a UTC day is refused; a failed post gives the slot back.
- **Duplicates:** a daily island's fingerprint; another community island's.
- **Word filter:** whole words, case, simple letter swaps (0→o, 1→i, 3→e, 4→a, 5→s, $→s,
  @→a), spaces and hyphens between letters; ordinary names that contain a filtered string pass.
- **Creator credit when posted as the app:** author `lumen-game` → `postedAs: 'app'`, maker
  unchanged everywhere (title, post data, `cm:{k}`, results comment text).
- **Per-island board:** first Lock in counts, pieces then time, no streak, flair, medal or
  all-time change, Creator's board present and unranked.
- **Sky channel naming:** `skyChannel` for daily and community numbers matches the rule.
- **Deleted and removed posts:** trigger marks inactive; inactive islands are not served, not
  listed, not picked.
- **Switch off:** builder endpoints 404, community posts serve the resting state, the result card
  has no Build button (client logic as a pure function).
- **Post data:** old daily posts, community posts, size under 1 KB.
- **Grouping (D2):** identical boards group, order by pieces then first time, your own row kept.

---

## 9. Commits (one per numbered item of the brief)

1. Publish flow (server, confirm panel, celebration, open the post).
2. Community island posts (lookup, card, game, board, sky, others, results comment, triggers).
3. Your islands.
4. Everything behind `COMMUNITY.enabled` (resting state, no wording when off).
5. Dev tools: "Dev: clean up this subreddit" also removes community posts (the app's own are
   deleted, players' are removed as a moderator) and clears every `cm:` key, island keys and
   skies; "Reset my Lumen progress (dev)" also clears the moderator's draft, check, publish
   counter and Lock ins on community islands. Both still refuse once `LAUNCH.launched`.

Then lint, types, tests, build; local judge pass (section 11); push; `bash .tmp/upload.sh`
(before launch); report; wait for your phone test.

---

## 10. Phone checks to add to docs/TESTS-TO-RUN.md (C1–C12, after the build)

C1 Publish your tested island: confirm panel shows picture, name, par, label and the credit line;
one tap posts; the post opens. C2 Double-tap Publish: one post. C3 Fourth island in a day:
refused calmly. C4 A friend publishes: the post comes from u/lumen-game but the title, card and
game say "Island by u/friend". C5 Feed card under a second, with the maker's snoovatar. C6 A
friend plays your island: Lock in, their lantern rises, you see "u/friend just lit {island}" live.
C7 Board and See others' islands: Creator's board first, grouped rows. C8 Share on a community
post replies under its pinned results comment. C9 Your islands: plays and par hits update. C10 A
mod removes an island post: it disappears from Your islands' active list and shows "taken down".
C11 Switch off, release, reopen: no Build button, island posts rest. C12 Reduce Motion on: the
celebration is a soft glow.

---

## 11. Judge pass (before the report)

Locally with the stand-in server (`vite.debug.config.ts` gains publish, mine and community posts;
`?user=name` plays as a second account) at 430x701, 360x460 and desktop: build → test → publish
→ open the post → second account plays → boards → sky. Top 5 issues a harsh judge would notice,
cheap ones fixed, the rest listed.

---

## 12. Risks

1. **The daily game changes under launch.** Every route learns `islandOfPost()` five days before
   Nov 24. Mitigation: the daily path keeps its existing tests green untouched; the community
   path is behind the switch; D6.
2. **Posting as the user can fail** on desktop (seen once). Mitigation: D4 fallback, calm line.
3. **Reddit may filter a community post** (new account, spam filter) and the app cannot see it
   at once. Mitigation: the post opens for the maker; `onModAction` and the lazy check mark it
   when a mod acts.
4. **Moderation load on the judging subreddit.** Friends' islands appear beside the daily posts.
   Mitigation: name filter, 3 a day each, mods remove as usual; Phase 3's "Exclude" comes later.
5. **Schedule.** Phase 2 is the largest phase: about two days. It lands Nov 21 if your phone test
   is quick, which leaves Nov 22–23 for Phase 3 (Sunday pick, before the first pick on Nov 28)
   and Nov 24–25 for Phase 4. Nov 25 for P4 is tight but possible; Phase 3 can slip to Nov 27
   without missing the first pick.
6. **Card speed.** The snoovatar `<img>` loads after paint; the card paints from postData first.
   Measured with Lighthouse at the end.

Proposed Journeys events (not sent; `docs/JOURNEYS-BUILDER.md`): `builder_open`,
`builder_check`, `builder_test_lit`, `builder_publish`, and a play journey kind `community` for
island posts, mirroring the daily journey.
