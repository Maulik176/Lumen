# Scale audit: every fixed limit, at 500 and 5,000 players (Nov 21)

Done after the busy-night bug (see below): every top-N, slice, page size and cap in the code,
what it does at 500 and 5,000 players on one island, and whether anyone or anything silently
disappears. Tests named here run in `npm run test:scale`, which `npm run checks` runs by name, so
`npm run release` refuses to upload without them.

| # | Limit (config) | At 500 players | At 5,000 players | Anyone or anything disappears? | Test | Status |
|---|---|---|---|---|---|---|
| 1 | **See others' islands**: the best 10 other boards (`OTHERS.top`), your own row with everyone on your board | Exact | Exact; about 40 Redis reads per open whatever the crowd | **Was the P0:** only the top 40 board rows were scanned, so more than 40 players on the par answer hid every other board. Now boards are grouped at each Lock in. Boards beyond the best 10 are not rows, by design, and your own board is always shown with its true count | `accounted-scale.test.ts` (10, 150, 500 players; few and many boards; every seat) | **Fixed** |
| 2 | **Tonight's board**: top 10 and your own row (`LEADERBOARD.top`) | Correct | Correct | No: a top 10 by design, you are always on it, the total is exact | accounted suites (board size, the viewer once, ranks) | OK |
| 3 | **All-time board**: top 10 and your row | Correct | Correct | No (by design) | existing game tests | OK |
| 4 | **Shared sky**: the newest 300 lanterns (`SKY.maxLanterns`, one draw call) | 200 oldest not drawn for others | 4,700 not drawn | **Yes, by design**: older players' lanterns leave the shared sky. The count ("N lanterns tonight") stays true and your own lantern is always drawn | `accounted-scale.test.ts` (sky = newest min(N, 300), each once, count true) | Kept, by design |
| 5 | **Snoovatars on lanterns**: 60 pictures loaded (`SKY.snoovatarLoads`) | Rest show initials | Same | No (initial seals instead of pictures) | none needed | OK |
| 6 | **Counts**: feed card, results comment, map glow, Your islands plays, "% hit par" | Exact | Exact | No: board sizes and counters, never lists | accounted suites (every count agrees) | OK |
| 7 | **Results comment refresh**: at most once a minute (`COMMENT.minGapSeconds`) plus the half-hourly task | Up to a minute behind | Same | No | existing tests | OK |
| 8 | **Sunday pick candidates**: was the newest 200 islands (`SUNDAY.scanMax`) | Fine for ~100 islands a week | A busy week's older islands silently out of the running | **Was yes.** Now every island in the week is read page by page (`SUNDAY.pageSize` 200, guard `readMax` 5,000, any overflow counted in the log) and scores come in bulk from the subreddit's newest posts, 100 a call | `sunday.test.ts` "a busy week" (pages of 2, the oldest island wins, one bulk read) | **Fixed** |
| 9 | **Pick scores beyond Reddit's listing**: newest 1,000 posts (`listingMax`), then up to 50 single reads (`postReadMax`) | All read | With more than about 1,000 posts in a week, islands past the listing's reach may go unscored | **Possible at 5,000:** an unscored island is left out and the server log says "N of M scores could not be read" | none (Reddit's own limit) | Logged; see below |
| 10 | **Re-check**: the top 3 leaders (`SUNDAY.recheckMax`) | Same | Same | Only if all three fail the re-check (the engine changed): Sunday stays generated, logged | `sunday.test.ts` | OK (logged) |
| 11 | **Community view, This week**: the best 10 (`SUNDAY.weekShown`) | Week's 11th+ islands vanished | Same | **Was yes.** The rest of the week now flows into "More islands, newest first" | `shelf.test.ts` "a busy week" (every island once) | **Fixed** |
| 12 | **Community view, older islands**: 20 a page, "More islands" (`SUNDAY.olderPage`) | All reachable | All reachable | No | `shelf.test.ts` (every page, every island once) | OK |
| 13 | **Community view, the pick card**: looks back 14 Sundays (`SUNDAY.lookBackSundays`) | Same | Same | Only a pick older than 14 weeks loses its card (it is still under its own post) | none | OK |
| 14 | **Your islands**: the newest 60 per maker (`COMMUNITY.yoursShown`) | Same | Same | **Yes, for one maker** with more than 60 islands (20+ days at 3 a day): the oldest leave the list (their posts stay). Not about crowd size | none | Left; page it in Phase 4 if anyone gets close |
| 15 | **Archipelago**: was 30 past nights (`PAST.max`) | Same | Same | **Was yes**, after a month. Now all 90 nights | none (config) | **Fixed** |
| 16 | **Publish limit**: 3 islands a player a day (`COMMUNITY.publishPerDay`) | Same | Same | No (a rule, said to the player) | community tests | OK |
| 17 | **Dev clean-up**: 500 islands (`cleanUpMax`), the 200 newest posts | n/a | n/a | Dev only, refused after launch; on a busy test subreddit run it twice | none | OK |
| 19 | **Card picture at Publish** (Nov 26): at most 200,000 characters of data URL (`COMMUNITY.pictureMaxChars`; real pictures measured 27-45 K), and the device waits at most 4 s for it (`pictureWaitMs`) | Same | Same | No: an island whose picture is too large, too slow or refused is published all the same, with its world's stock picture | `community.test.ts` "the card picture taken at Publish" | OK |
| 18 | **Board groups for boards played before v0.0.1.96**: grouped once from the whole board on first open (`GROUPS.readChunk`) | One slower open | One very slow open (may pass 30 s) | No loss, but a long request. Only boards from before this version; launch-day clean-up removes them all, and every new board is grouped as it fills | game tests ("worked out once") | Note |

**What is still possible at 5,000 (row 9):** Reddit's newest-posts listing stops at about
1,000 posts. If one week brings more than ~1,000 posts (islands plus daily posts), the oldest
islands of that week may go unscored and out of the running; the log says how many. Remedy if it
ever happens: refresh scores during the week (the half-hourly task already does) and keep them,
so the pick needs live reads only for the leaders.

**The busy-night bug (P0, fixed in cbcd349):** found by the video session. On a night with more
than 40 players on the par answer, "See others' islands" showed only the viewer's own row and
"Everyone so far lit it just as you did." while 55 players on other boards existed (141 players,
86 at par). Live since Phase 2. The old 40-player "busy night" test had about 24 at par, under
the scan depth, which is why the suite missed it; the scale nights are now 10, 150 and 500.
