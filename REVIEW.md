# Lumen — judge review (M8, Sun Nov 15, 2026)

Every open item below is now an Opus brief in `HANDOFF.md` section 6.

Written as the harshest judge on the panel would see it, comparing against past Devvit winners
(BridgeDit, Sketchy Solutions, Reddictionary). Based on Maulik's Reddit test of v0.0.1.48
(iPhone and desktop), local headless runs at 430x701, 360x460 and 1100x700, and the code.
Build reviewed: the commit after the five P0 fixes below (uploaded as v0.0.1.50).

**What I could not see for myself:** anything on Reddit (I cannot open reddit.com), any Android
device, two phones at once, frame rate on real hardware. Every score that depends on those is
marked "unverified" and scored as a judge would score an unknown: low.

## Fixed in this session (P0s from Maulik's test)

| # | Was | Now | Commit |
| --- | --- | --- | --- |
| 1 | A Day 2 test post said "Light the lanterns · Be the first tonight", then played as practice | Card says "Practice · this island's night has passed" (or "not open yet"), button "Play for practice", link "← Tonight's island"; in game the bar says "Practice island" and the result card leads to tonight | dca1fa7 |
| 2 | No way to test Saturdays, rollover, warm-up, past islands | Mod menu "Dev: set today to day N" and "Dev: clean up this subreddit", playtest subreddit only | 64edb99 |
| 3 | Sound died after locking the iPhone | Audio context is closed when the page hides and rebuilt inside the next tap; a context whose clock has stopped is replaced. 3 new tests. **Needs the real iPhone to confirm** | 77fd294 |
| 4 | Lantern shot off the top on a phone | 7 s rise, hover in the upper part of the view, small drift after; camera frames the lantern itself | 4aa4a9d |
| 5 | Other players were orange dots | Small paper lanterns with snoovatar (up to 60 a night) or a letter seal; nearer ones larger; last night's the same, fainter | 4aa4a9d |

## Scores

Criteria are equally weighted; ties break in this order.

| Criterion | Score | Why not higher |
| --- | --- | --- |
| Delightful UX | 7 | The tutorial and the ending are now good. The middle is plain: tiles are hard to tell apart, the medal is only a word, the crowd view is flat orange squares. On a 360 px phone an 8x8 island's tiles are about 36 px |
| Polish | 6 | Frame rate on a phone is unmeasured. Android has never been run. The daytime sky is grainy on iPhone. Lighthouse on the feed card is unmeasured. README is still the template's |
| Reddity | 7.5 | Shared sky, flair, share-to-comments, live results comment, leaderboard with snoovatars all exist. The live sky between two real accounts is still untested, and there is no "join the community" step |
| Daily Content | 8.5 | 90 solver-proven days, weekday ramp, five biomes, Archipelago. Strongest area. Sunday's community island was cut |

**Overall: 7.2.** A finalist on content and idea; not yet a winner on finish. The gap to
the winners is not features, it is the last 10% of craft on a real phone and proof it runs.

### SPEC "Signature features"

| Feature | Score | State |
| --- | --- | --- |
| 1. Shared Night Sky | 7 | Real lanterns with avatars or seals, live line "u/name lit …", styles as a colour band, count on the feed card. **Unverified:** two phones within 2 s; 300 lanterns at 60 fps. "The rest as a soft glow band" beyond 300 is not built (the count is shown instead) |
| 2. Archipelago | 6.5 | Night map, glow by solves, medals, tap to practise. Capped at the 30 newest islands, so "every past day" fails after a month. No Sunday creator credit (Builder cut) |
| 3. Trailer mode | 6 | Plays dusk, solve, night, release, title in one take. No pull back to the Archipelago at the end, and the opening is a plain "Tap to begin" |

| Reddit feature | Score | State |
| --- | --- | --- |
| Journeys | 7 | Wired exactly to JOURNEY_MAP.md, tested mapper. Cannot be seen recording until published and approved |
| Flair | 8 | Passed on Reddit |
| Comments | 7 | Share passed on iPhone. Desktop not re-tested after the one early failure |
| Snoovatars | 7 | On your lantern, others' lanterns, leaderboard. **Not on the result card**, which SPEC lists |
| Streaks | 7 | Grace day, flair, styles. The styles are only a thin band of colour: nobody will notice a 30-day comet |
| Subscribe prompt | 0 | Not built |
| User-made islands | 0 | Cut (Island Builder) |

| Judges' "stand out" item | Score | Note |
| --- | --- | --- |
| Intuitive onboarding | 8.5 | Four islands, rule cards, warm-up offer. Best part of the game |
| Visual craft | 7 | Strong sky and ending; the play board is the weakest picture |
| Calibrated daily content | 8.5 | |
| Focused start screen | 8 | Name, goal, date, par, crowd. No attribution line |
| Clear end state, re-engagement | 7 | One card, countdown on the feed card. No subscribe, no medal emblem |
| Journey instrumentation | 7 | See above |

### SPEC "Quality bar"

| Item | Verdict |
| --- | --- |
| Fits 360x640 and 430x932, no scrolling | Pass locally at 360x460 and 430x701 |
| One identity; no default components; no emoji in UI | Pass. (The night map's violet is the game's own night, not a stock gradient) |
| Copy short, in voice | Pass |
| Animation with a reason; nothing loops distractingly | Pass |
| First five seconds clear without reading | Pass (tutorial) |
| Colour-blind glyphs; AA contrast; 44 px targets | Glyphs pass. **Contrast never measured. Tiles are under 44 px on small phones** |
| Days 1–90 solvable, par matches | Pass (test) |
| Server rejects tampering | Pass (tests) |
| Streak, grace, flair over 10 days | Unit tests pass; a 10-day run on Reddit is now possible with "Dev: set today" and has not been done |
| Heatmap locked until submit; par hidden until day ends | Pass (tests) |
| Share only after a tap | Pass |
| Preview under 1 s, Lighthouse above 80; 60 fps mid-range Android | **Not measured** |
| Audio after a tap, mutes on tab switch, mute button | Pass in tests; lock and unlock needs the phone |
| Rollover makes exactly one post; archive posts playable | Logic and lock exist; **never observed on Reddit** |
| Lantern on the other phone within 2 s; 300 at 60 fps | **Not tested** |
| Snoovatars on lantern, result card, leaderboard, Sunday credit | Lantern and leaderboard only |
| Archipelago lists every past day | Newest 30 only |
| Builder publishes only when solvable | Cut |
| Trailer records in one take | Pass locally |
| Every tunable in config.ts; HANDOFF exists | Mostly: some sizes and colours live in CSS and shaders |
| Submission checklist | README is the template's; r/LumenGame not created; video, description, Devpost not started |

## Issues, ranked

Cost: S = under 1 hour, M = 1 to 3 hours, L = half a day or more. "Phone" = needs Maulik's device.

### P0 — would lose the prize or fail submission

| # | Issue | Fix | Cost |
| --- | --- | --- | --- |
| P0-1 | **Never run on Android; phone frame rate unknown.** The new sky shader and the lantern sheet both add cost | Play one island on the Android phone with the perf line (needs a way to turn it on in Reddit: add a mod-menu toggle stored per user). If under 45 fps: `VIEW.maxPixelRatio` 1.5, then `ART.wisps` 0, then `SKY.cellPx` 48 | M + Phone |
| P0-2 | **Live sky between two accounts untested.** It is the headline feature | Maulik's two-account test; fix what it shows | Phone |
| P0-3 | **README.md is the starter template's.** A required submission item | Write it: what Lumen is, how to play, how it uses Reddit, how to run | S |
| P0-4 | **r/LumenGame does not exist**, and app review (with JOURNEY_MAP.md) is due Nov 17–18 | Maulik creates it; install; "Post today's Lumen"; submit for review | Maulik |
| P0-5 | **Day rollover never observed.** If cron double-posts or skips on launch day, judges open a broken subreddit | With "Dev: set today": move a day forward, check exactly one new post appears within 30 minutes, old post turns to practice | S + Phone |
| P0-6 | Sound after lock and unlock: fixed in code, **unconfirmed on the iPhone** | Lock mid-game, unlock, tap: a click must sound | Phone |

### P1 — a harsh judge marks these down

| # | Issue | Fix | Cost |
| --- | --- | --- | --- |
| P1-1 | **Done in 1c17ee8 (soft seams).** Tiles are hard to tell apart; players cannot see the squares (Maulik) | Subtle seams: a darker bevel on each tile's edge in the tile shader or vertex colours, strength in `ART` | M |
| P1-2 | **Done in 1c17ee8 (drawn emblem on the result card).** The medal is only a word (Maulik) | A drawn emblem per medal (lantern, glow, spark) on the result card, feed card and map, same stroke style | M |
| P1-3 | **Done in 1c17ee8 (glowing pools).** Crowd view is flat orange squares (Maulik) | Soft glowing pools: additive discs like the lanterns' light spill, sized by share | M |
| P1-4 | Share: no way to see the comment; dev reset leaves the old reply (Maulik) | Return the comment id; "Shared · View comment" navigates to it; reset deletes it | M |
| P1-5 | Feed card shows no streak after solving on day 1 (Maulik) | Show the flame and count from streak 1 | S |
| P1-6 | **Fixed in code in 1c17ee8; confirm on the iPhone (HANDOFF O-2).** Grainy daytime sky on iPhone (Maulik) | Banding in the gradient plus noise at low precision: add `precision highp float`, dither with a per-pixel offset, or lower `ART.wisps` | S–M + Phone |
| P1-7 | Trailer opening (Maulik) | A proper "Tap to start trailer" screen; optionally end on the Archipelago | S–M |
| P1-8 | Tap targets under 44 px on 8x8 and 9x9 islands on small phones | Options: frame the island larger by trimming the reserved hint room when no hint shows on later days; or allow pinch-free "zoom to half" on tap-and-hold. Cheapest: reduce island margins (`CAMERA.margin`) and measure | M |
| P1-9 | No subscribe step, which both SPEC and the brief's result-card item list | One quiet, separate button "Join r/…" on the result card (`subscribeToCurrentSubreddit`, permission, explicit tap only) | S |
| P1-10 | Snoovatar is not on the result card | Small round snoovatar beside the medal | S |
| P1-11 | Streak styles are invisible in practice | Give each style a real shape on the sheet (star points, koi tail, comet trail) instead of a band | M |
| P1-12 | Feed card can flash "Light the lanterns" on a past post on a device that has never seen it, if the server takes over 450 ms | Put the island's UTC date in postData (it is fixed at post time) and let the card treat a date before the server's last known "today" as past; or raise `CARD.holdMs` | S |
| P1-13 | Lighthouse and paint time of the feed card unmeasured | Measure; the card is about 12 KB of script and a 15 KB picture, so it should pass | S |
| P1-14 | Archipelago stops at 30 islands | Load in pages as the map scrolls | M |
| P1-15 | Dev menu items show in every subreddit's mod menu (they refuse to run elsewhere) | Fine for judging; before any public install, drop the three "Dev:" items from `devvit.json` | S |
| P1-16 | Contrast never measured | Check ink on paper, light on veil, amber button text against AA; adjust `UI` | S |

### P2 — worth doing if time remains

| # | Issue | Fix | Cost |
| --- | --- | --- | --- |
| P2-1 | Some numbers live outside `config.ts` (CSS sizes, shader constants, lantern sheet drawing) | Move the ones a tuner would touch | M |
| P2-2 | Realtime connection is never closed | Keep the connection and disconnect on page hide | S |
| P2-3 | The lantern sheet is 1440x1080 for 300 cells whatever the night's size | Size it to the night's count | S |
| P2-4 | Signed-out players get only "Played for practice" | One line inviting them to sign in for a lantern | S |
| P2-5 | No attribution on the feed card (brief: name, description, date, attribution, stats) | "A daily island by r/LumenGame" in the kicker | S |
| P2-6 | Render-on-demand and a heap profile from the performance brief | As in HANDOFF Brief 4 | M |
| P2-7 | Unused sky settings (`SKY.portraits*`) and the old M3 debug copy | Delete | S |
| P2-8 | Sunday island is an ordinary generated one; "Islandwright" flair has no source | Leave cut; say so in the README | S |

## Suggested Monday order (feature freeze 11:59 pm IST)

1. Maulik: clean up the subreddit, set today, run the two-account sky test and the lock-screen sound test (P0-2, P0-5, P0-6).
2. P1-1 tile seams, P1-2 medal emblem, P1-3 crowd pools: the three that change how the board looks.
3. P1-4, P1-5, P1-7, P1-9, P1-10: small, visible, cheap.
4. P0-1 Android run and P1-6 sky grain, with the phone.
5. P0-3 README and M9 handoff.
