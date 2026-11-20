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
| 1 | **Share as a judge** | **Done Nov 17:** friends' replies came from `lumen-game` with no name. Fixed: the line now starts "u/name". Re-check after the next upload: a friend's share shows their name in the text | Friend |
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

## 1c. Island Builder, phase 1 (Nov 19)

| # | Test | How |
| --- | --- | --- |
| B1 | The tutorial makes a first island | Lock in today's island, tap **Build an island**: pick a world, place a sun, turn it, place a lantern, Next, a rock or tree, spare mirrors, Check, then light it yourself in 3D. Night falls and the Builder comes back saying you lit it |
| B2 | Taps on an 8x8 board | Island → Size 8: can you hit the tile you mean, every time, with a thumb? |
| B3 | Refusals read well | One mirror lights it ("too easy"), no lantern, a lantern already lit, too many suns |
| B4 | The draft comes back | Build half an island, close the Builder, reopen: it's all there |
| B5 | From the map | Explore past islands → **Build an island** opens it; closing returns |
| B6 | How long a hard check takes on Reddit | Build a big open 8x8 with 3 suns and 6 coloured lanterns, Check, then tell Claude; it reads the time from the server log |
| B7 | Nov 19 fixes: the last edit and the finished work survive | Place a piece and close the Builder at once, reopen: the piece is there. Check and test an island, close, reopen: still "Lit by you" |
| B8 | Nov 19 fixes: names and lines | Name it "Maulik's Hollow" (phone keyboard): accepted. Type `<`: brown underline and the rule line at once. Every hint line fits one row |
| B9 | Nov 19 fixes: panel and map | The Island panel is solid (no lanterns through it); the map's Build button is a clear paper button and the last island scrolls above it |

Claude ran the full A1–H6 list on the iPhone on Nov 19 (results at the end of `BUILDER_PLAN.md`,
captures in `docs/CAPTURES.md`). Still Maulik's: Skip on a fresh account, thumb taps on 8x8,
Reduce Motion highlights, sound, a second device, signed out, desktop, Android.

## 1d. Island Builder, phase 2: publishing and community islands (Nov 20)

| # | Test | How |
| --- | --- | --- |
| C1 | Publish your island | Check, test and light an island; tap Publish: the panel shows its picture, name, par, label and "Posts to r/lumen_game_dev as an island by u/you"; one tap; the lanterns ring, "Your island is up.", the new post opens |
| C2 | No double posts | Tap Publish twice quickly: one post |
| C3 | The daily limit | Publish a fourth island the same UTC day: "Three islands a day. Publish this one tomorrow." |
| C4 | A friend publishes | Their post comes from u/lumen-game (a playtest build), but the title says "Island by u/friend · Name" and the card and game name them |
| C5 | Feed card | Opens in under a second: world picture, outline, "Island by u/name" with their snoovatar (or initial), "Par 2 · Gentle · 1 lantern", then "N players lit it" |
| C6 | A friend plays your island | They Lock in; their lantern rises; if you have the post open you see "u/friend just lit {island}" |
| C7 | Boards | "This island's board" (no tabs); See others' islands: "Creator's board" first, then theirs; identical boards show "N players" |
| C8 | Share | On a community post, Share replies under its pinned "Results for {island} by u/name" comment, naming the island and maker |
| C9 | Your islands | Island panel → Your islands: each island with date, plays and par hits; tap opens its post |
| C10 | Taken down | Remove an island post as a mod: the card and game say "This island was taken down."; Your islands dims it. Approve it again: it is back |
| C11 | Switch off | `COMMUNITY.enabled` false, upload, reopen: no Build an island anywhere; island posts say "This island is resting." |
| C12 | Reduce Motion | The publish celebration is one soft glow, no rings |

**Nov 20 run (Maulik's C1–C12 video):** C1, C2, C3, C5, C7, C8, C9, C10 passed; C4 and C6 wait for a
friend; C11 skipped (the Builder stays on); C12 found the celebration too faint (fixed below).
C5 note: the card's big picture is still the world's stock art; the island's own picture is the
first Phase 4 item (`BUILDER_PLAN.md`, Phase 4 queue).

| # | Re-check after the Nov 20 fixes | How |
| --- | --- | --- |
| C13 | Ghost hand only in the tutorial | Dev reset, skip the tutorial: no hand on the real island |
| C14 | Taps on rocks and water | Tap the middle of a rock or water tile: nothing is placed (a tap right on the border of a usable tile still lands there) |
| C15 | Builder lines | After Check in the tutorial: "Par 4 · Gentle. Light it yourself"; after your test: "Lit with 4 (par 4) · Gentle. Ready to publish." |
| C16 | Publish celebration | Reduce Motion off: night falls on the board, lanterns bloom with chimes, light rises, a small lantern lifts away, then the post opens (about 3 s). On: night and blooms only |
| C17 | "You" label | After Lock in, scroll up and down over the sky: "You" stays just above your lantern |
| C18 | See others' islands | You appear once, as "Your island", not again as u/name |
| C19 | Desktop cursor | Buttons show the hand cursor |

## 2. Fixed in code, never confirmed on a phone

| # | Test | How |
| --- | --- | --- |
| 10 | Sound after the phone locks | Lock the iPhone mid-island, unlock, tap: a click must sound |
| 11 | Daytime sky speckle gone, clouds and mist back | Look at the sky before Lock in on iPhone |
| 12 | Sky lanterns smooth and sharp | Your own lantern rising, others' lanterns, no jagged edges |
| 13 | Slow ending on a phone | The 7-second rise and hover after Lock in, with Reduce Motion on and off |
| 14 | Frame rate | Does anything stutter on iPhone or Android? (No number available on Reddit: judge by eye) |
| 14b | Light readable on snow (Nov 17 fix) | A snow day: beams have a soft shaded edge, two suns side by side stay two suns, on a real phone in daylight |
| 14d | Quiet-night line (Nov 18) | On a night with under 10 lanterns, Lock in: while your lantern rises, "First lantern tonight. The faint ones are last night's." (or "N lanterns tonight…"). A brand-new account sees the sky line for 2 s first, then this one by itself |
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
