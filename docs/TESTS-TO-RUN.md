# Tests still to run on Reddit

Everything built but never seen working on Reddit, as of Nov 17 (v0.0.1.66 on r/lumen_game_dev).
Tick a line when it passes; write anything odd into `PLATFORM.md` and tell Claude, who fixes it
test-first. "Second account" means a friend's account that is **not** a moderator: that is how a
judge sees Lumen.

**Already seen working** (so not listed below): feed card, tutorial, rule cards, resume, "?" How to
play, flair, tonight's board, ranked Lock in with rank, streak and "You" lantern, desktop wide
layout, Share by Maulik on iPhone and on desktop, "Shared · View comment", other players'
lanterns in the sky (three accounts on Lumen #8), "Dev: set today".

## 1. Before judging, or the demo can break

| # | Test | How | Who |
| --- | --- | --- | --- |
| 1 | **Share as a judge** | A second account taps Share. Whose name is on the reply: theirs or `lumen-game`? If `lumen-game`, the share line needs the player's name | Friend |
| 2 | **The game as a stranger** | Signed out, then a second account, on a fresh day: feed card, tutorial, play, Lock in, See others' islands | Maulik + friend |
| 3 | **See others' islands, full** | All three lock in on a day none of you has played ("Dev: set today"): names, pictures, tap one to see it lit, "All islands", "Back" | Maulik + friends |
| 4 | **Live sky between two phones** | Same post open on two phones; one locks in: their lantern appears in the other's sky within a couple of seconds, and the "u/name just lit…" line shows while playing | Two phones |
| 5 | **Day rollover by itself** | Leave the subreddit alone over 00:00 UTC (5:30 am IST): exactly one new post, yesterday's says "Practice" and leads to tonight's | Maulik, next morning |
| 6 | **Install on r/LumenGame** | Create it (public, Gaming), `npx devvit install r/LumenGame lumen-game`: does an unreviewed app install? Today's post appears? | Maulik |
| 7 | **The link judges will get** | Open it signed out on a phone and a laptop as if you knew nothing: does the first screen make sense? | Maulik |
| 8 | **Android** | Play one island start to finish in the Reddit app: smooth? sky lanterns visible (the Nov 16 fix)? | Android owner |
| 9 | **App listing page** | Open developers.reddit.com/apps/lumen-game signed out: does it load, with the new icon? | Maulik |

## 1b. Strangers playing (the strongest evidence; Nov 17 review)

Watch, don't coach. Note the first independent move, any request for help, whether they finish,
and whether they can say what the night sky is. Then ask them to come back another day and see
whether they do (saying they will is not the same).

| # | Test | Who |
| --- | --- | --- |
| S1 | A friend who has never seen Lumen, on their own phone, from a direct post link: tutorial, "Your turn", tonight's island, Lock in, See others' islands, Share | Friend |
| S2 | On "Your turn", ask them to put both mirrors somewhere wrong first: do they find "Start again" or tap a mirror to lift it, without help? | Friend |
| S3 | A newcomer on a Saturday: four rule cards in a row. Once playing, ask what the stone mirror and the water do. Do they remember? (A question to answer, not a reason to redesign) | Friend |
| S4 | Finger accuracy on the densest Saturday board on a small phone: can they hit the tile they mean, first time? | Friend |
| S5 | Does anyone come back the next day without being reminded? | Maulik |

## 2. Fixed in code, never confirmed on a phone

| # | Test | How |
| --- | --- | --- |
| 10 | Sound after the phone locks | Lock the iPhone mid-island, unlock, tap: a click must sound |
| 11 | Daytime sky speckle gone, clouds and mist back | Look at the sky before Lock in on iPhone |
| 12 | Sky lanterns smooth and sharp | Your own lantern rising, others' lanterns, no jagged edges |
| 13 | Slow ending on a phone | The 7-second rise and hover after Lock in, with Reduce Motion on and off |
| 14 | Frame rate | Does anything stutter on iPhone or Android? (No number available on Reddit: judge by eye) |
| 14b | Light readable on snow (Nov 17 fix) | A snow day: beams have a soft shaded edge, two suns side by side stay two suns, on a real phone in daylight |
| 14c | "Practice · Name" and "Back to islands" (Nov 17 fix) | Explore past islands, open one: the top bar says Practice, the arrow and the result card's button go back to the map |

## 3. Built, never opened on Reddit

| # | Test | How |
| --- | --- | --- |
| 15 | Explore past islands (the night map) | Result card → Explore past islands: map draws, tap an island, play it for practice, back to tonight |
| 16 | Warm-up offer | A new account opening a Thursday, Friday or Saturday island is offered an easier one first |
| 17 | Trailer mode | Mod menu → trailer, then open a post: "Tap to start trailer", it plays through to the title |
| 18 | Pinned results comment | The count updates within about a minute after each Lock in |
| 19 | Streak styles | "Dev: preview lantern styles": five styles in your sky; and a real 3-night streak changes your lantern |
| 20 | Flair for a friend | After a friend's ranked Lock in, their flair shows medal and streak |
| 21 | Snow and the other biomes on a phone | "Dev: set today" to a snow day: colours, sky, readable pieces |
| 22 | Logged-out Share and board | Signed out: no Share button, board and See others' islands behave |
| 23 | Short phone screen | A small phone (or the smallest window): nothing covers the island, lists scroll |
| 24 | Desktop small dialog | If Reddit opens the 375 px dialog instead of the wide one, the game still fits |

## 4. Can't be tested before a publish (not during the event)

- Journeys receipts: they stay "denied" for an unpublished app. Nothing for players to notice.

## 5. Not built yet

- Island Builder (O-14), approved, to build after Nov 18. It gets its own tests when built.
