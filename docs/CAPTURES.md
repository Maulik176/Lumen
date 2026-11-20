# Captures: real phone shots for the submission

Claude's iPhone test runs leave a trail of captures: the game inside the real Reddit app, on a
real phone. That is what BridgeDit's gallery and video were built from (see `SUBMISSION.md`,
lessons 7 and 8), and judges may never play the game themselves, so these shots are part of the
submission's raw material. Keep every run's captures here, then pick from them when the gallery,
GIFs and video are made.

**Where the files are:** `captures/` at the repo root, one folder per run. The folder is in
`.gitignore` on purpose: the repo is public, and some shots show Maulik's own Reddit menu or
other players' names. Back it up with the rest of the submission material, never push it.

**What they are good for, and what not:** they are storyboard and proof, not final art. Each is
a crop of iPhone Mirroring on a Mac screen, so the phone is about 300 to 600 px tall. For the
gallery and the video, re-record the same moments with the iPhone's own screen recording (full
resolution), using the list below as the shot list. Small stills and zooms can go into the
write-up as they are.

---

## Run 1: Thu Nov 19, 2026, iPhone 15 Plus, v0.0.1.76, r/lumen_game_dev

Folder: `captures/2026-11-19-iphone/` (114 files, numbered in the order they were taken).
The run covered the Island Builder test cases A1–H6 (`docs/TESTS-TO-RUN.md` section 1c) plus a
full daily play-through.

### Best shots for the submission

| File | What it shows | Use it for (SUBMISSION.md) |
|---|---|---|
| 002, 003 | Lumen #9 and #10 feed cards inside the Reddit app: picture, "Light the lanterns", "Tonight's island", the results comment below | Gallery 8 "Plays right in the post"; lesson 12 (feed card) |
| 004 | First-visit tutorial: "Bend the light into the lantern", ghost hand on the tile | Video: tap to place |
| 005 | "Warm up on an easier island first?" for a newcomer on a hard day | Write-up: Delightful UX |
| 006–008 | Rule cards: stone mirror, water, coloured lantern | Gallery 5 (Polish) |
| 010 | Mid-solve hint "Tap it again to turn it" | Video: tap to turn |
| 011 | All lit · 4 pieces (par 4): red and green light, the prism split, Lock in | Gallery 4; video "all lit" |
| 012 | Own lantern "You" rising; "First lantern tonight. The faint ones are last night's." | Gallery 1 and 9 (re-record with a full sky after launch) |
| 013, 106 | Lamplighter result card: See others' islands, Share, Explore past islands, Build an island | Gallery 6 and 7 |
| 014 | Island Builder on first open: "Pick a world for your island" | New Builder heading |
| 017–024 | Builder tutorial, step by step: place a sun, turn it, place a lantern, colour it, block the easy way, spare mirrors, Check, "Now light it yourself" | Video: "build your own island" beat (about 10 s) |
| 025, 026, 027, 028 | Test your island in 3D, all lit with 2 pieces, nightfall, "You lit it with 2 pieces (par 2)" and "Lit by you" | Gallery: Builder (like BridgeDit's "Test Level") |
| 034–040 | One lantern cycling through every colour, with its shapes | Gallery 5 (colour is never the only clue) |
| 042–045 | Stone mirror turning the light; rock stops it, water lets it pass; a pine stops it | Builder heading: tools |
| 055–059 | The same island in all five worlds (moss, blossom, dune, autumn, snow) | Gallery 3 (split picture, lesson 6) |
| 084, 087, 090 | The server's verdict: "Par 2 · players get 3 mirrors · Gentle", "4 mirrors", "3 mirrors and 1 prism" | Write-up feat: every island proven by the solver |
| 078–083, 097 | Refusals in plain words: no sun, no lantern, lit already, one piece lights it, six pieces cannot light it, too complex | Write-up: safety by structure (the checker refuses to guess) |
| 092 | The 8x8 "Monster": three suns, five coloured lanterns | Gallery: Builder variety |
| 103, 104 | Test solved with 3 pieces (par 2): "All lit · 3 pieces (par 2)" | Builder heading |
| 108 | Archipelago map of past islands | Gallery 11 |

**Do not use:** 001 (Maulik's Reddit menu and subreddits), 068 and 069 (name garbled by
iPhone Mirroring's typing, not by Lumen).

### Shots that prove a bug (fixed after this run, keep for the record)

| File | Bug |
|---|---|
| 021, 081 | Two hint lines wrap onto a second row on the phone |
| 053 | The Island panel is see-through; a lantern behind it looks like a sixth world |
| 071–074 | "Hi <3" turns the name's underline brown only after the next board tap |
| 105, 107 | A tree placed just before closing the Builder is gone after reopening |
| 089, 106→016 | After reopening, a checked and solved island asks to be checked again |
| 111, 112 | "Build an island" on the map sits behind the last island, almost invisible |

### Numbers from the run

- The 8x8 Monster check on Reddit's server: too complex, 400,001 solver nodes in 1.12 s (the same
  check takes 3.5 s on Maulik's laptop).
- Every one of 23 taps on the 8x8 board landed on the intended tile (with a mouse through
  iPhone Mirroring; a thumb test is still Maulik's, H1).

---

## Run 2: Nov 19–20, 2026, local browser, Phase 2 build (not Reddit)

Folder: `captures/2026-11-20-local-phase2/` (21 files). Maulik's own recordings of Nov 19
(`maulik playing the game.mov`) and Nov 20 (`c1 to c12 test.mp4`, with his spoken notes) are in
his Downloads folder: real Reddit, real phone, the best source for the video. Taken in the app's browser pane against
the local stand-in server (`npm run debug`), at 430x701, 360x460 and 1100x700, while building and
judging Phase 2. **No Reddit chrome and no real players** (names like `test_1` and "u/you" are
the stand-in's), and the pictures are half scale. Use them to plan shots; re-record on Reddit
after the phone test (C1–C12) with real accounts.

| File | What it shows | Use it for |
|---|---|---|
| 07, 08 | "Ready to publish", then the confirm panel: the island on a night tile, name, "Par 2 · 3 mirrors · Gentle", "Posts to r/lumen_game_dev as an island by u/maulik" | Gallery: Builder (BridgeDit's "Post Level" moment) |
| 10 | "Your island is up." as the board glows | Video: the publish beat |
| 11 | A community island's feed card: "Island by u/you", outline, "Par 2 · Gentle · 1 lantern", "3 players lit it" | Gallery: community islands; lesson 12 (feed card credit) |
| 12 | Playing it: the top bar and the live line "u/maker_friend just lit Ember Bend" | Gallery: the shared sky on a player's island |
| 13, 14 | Lantern rising, then "Lamplighter · #3 on this island" with See others' islands, Tonight's Lumen, Build an island | Video: a player's island end to end |
| 15, 18 | See others' islands with "Creator's board" pinned first (desktop) | Gallery item 7, community version |
| 16, 17 | Your islands, with plays and par hits; the empty state | Builder heading |
| 06 | "Checking your island…" with light sweeping the board | Video: the check beat |
| 19 | The new publish celebration (Nov 20): night over the board, the lantern blooming, motes rising, a small lantern lifting (headless Chrome, full size) | Video: the publish beat; gallery Builder item |
| 01–05 | Nov 19 fixes: solid Island panel, one-row tutorial line, map's paper Build button | Polish proof |

Bug shots (fixed before commit, kept for the record): `bug-01` the confirm panel's picture
drawn outside the panel; `bug-02` a community card with no outline. Older top-bar order in 12
("by u/you" above the name) was fixed after it was taken.

---

## Run 3: Nov 20, 2026, local four-seat pass, real game code (not Reddit)

Folder: `captures/2026-11-20-four-seats/` (24 files), from `npm run seats` after the "everyone
accounted for" fix. The stand-in ran the real game code with a crowd of made-up players
(`p0`…`p7`, most with the par answer), so these lists are what a real post holds. Each seat has
`others` (See others' islands) and `board` at 430x701, 360x460 and 1100x700.

| Files | What it shows | Use it for |
|---|---|---|
| `1-first-others-430x701` | The player first on the board: "Your island · 3 pieces · 0:22 · same as u/p7 and 5 others", then the one different board | Proof shot for the fix; write-up "everyone accounted for" |
| `3-other-board-others-*` | A player with a different board sees the big group as one row, "7 players" | Gallery: See others' islands |
| `4-maker-others-*` | A community island's maker who also played it: Creator's board, Your island, the rest | Builder heading |
| `*-board-1100x700` | Desktop: the sky with everyone's lanterns beside tonight's board | Gallery: desktop layout |

Seen while looking (not fixed, to check on a phone): on desktop one lantern sits partly behind
the player's own; the "You" label sits a little right of the lantern in headless shots (Maulik's
own phone shot shows it centred).

---

## Run 4: Nov 21, 2026, local video clips, real game code (not Reddit)

Folder: `captures/2026-11-21-video-local/` (six H.264 clips at 30 fps, 42 MB). Made for the
one-minute video (`docs/VIDEO.md`) with `tools/record.mjs` in that folder: headless Chrome on
the stand-in (port 5299, run from a frozen copy of the committed code so other sessions' edits
cannot restart it mid-take), the page's clock moved exactly 1/30 s per frame, so motion is
smooth whatever the software renderer's speed. Island: **Lumen #2, Willow Prism** (Wed Nov 25,
moss, a prism and three coloured lanterns) with a made-up crowd of 140 players (letter seals,
no snoovatars). No Reddit around the game, no sound, no perf overlay.

| File | Size | What it shows (timecodes in the clip) | Beat (VIDEO.md) |
|---|---|---|---|
| `trailer-phone.mp4` | 644x1398, 30 s | Trailer mode, no interface: 0:00 the start card (trim), 0:01 the camera turns, 0:03–0:09 the answer placed piece by piece, the prism splitting the light, 0:10 nightfall and blooms, 0:13–0:24 the lantern rises into 140 lanterns, 0:25 "Lumen / A new island every night." | 1 (hook), 5, 10 |
| `trailer-desktop.mp4` | 1600x900, 30 s | The same trailer on a desktop-shaped screen, wide framing | 10 (desktop half) |
| `taps-phone-hires.mp4` | 1074x2330, 5.3 s | Close-up at 2.5x: the coloured-lantern rule card, then a mirror placed, turned ("Tap it again to turn it") and the light travelling | 3 |
| `play-phone.mp4` | 644x1398, 44.4 s | The whole player path with the interface: 0:04–0:10 taps (mirror, prism, two mirrors), 0:10 "All lit · 4 pieces (par 4)", 0:11 Lock in, nightfall, blooms, "Your lantern joins everyone who lit tonight's island.", the rise, 0:28 the result card (Lamplighter, #4 tonight), 0:39 tonight's board. **Do not use 0:28–0:38**: that See others' islands shows the busy-night bug (VIDEO.md) | 3, 4, 5, 6 (board) |
| `others-phone.mp4` | 644x1398, 17 s | See others' islands done right: 0:01 "13% hit par tonight", "Your island · 4 pieces · 0:11 · same as u/ember3 and 16 others", three other boards with "39 players", "50 players", "34 players"; 0:05 one tapped and shown lit on the island; 0:11 tonight's board | 6 |
| `builder-phone.mp4` | 644x1398, 45 s | The Island Builder with its first-island lessons: 0:01 a world, 0:03 the name "Petal Detour" typed, 0:05 a sun turned to shine down, a lantern out of the light, 0:10 a rock blocks the easy way, spare mirrors, trees, 0:16 "Checking your island…" then "Par 2 · Gentle. Light it yourself", 0:20 the test in 3D, two mirrors, "All lit · 2 pieces (par 2)", Lock in, nightfall, 0:30 back to "Lit with 2 (par 2) · Gentle. Ready to publish.", 0:39 the confirm panel (picture, "Posts to r/lumen_game_dev as an island by u/islandmaker"), 0:42 the celebration: dusk over the board, the lantern blooms, motes rise, "Your island is up." | 7 |

**Re-recording:** start the stand-in (`npx vite --config vite.debug.config.ts --no-open --port
5299 --strictPort`), then `node captures/2026-11-21-video-local/tools/record.mjs seed play-phone`
(clips: `trailer-phone`, `trailer-desktop`, `trailer-phone-calm`, `play-phone`, `play-desktop`,
`others-phone`, `others-desktop`, `builder-phone`; the Builder clip needs a freshly started
stand-in) and `bash captures/2026-11-21-video-local/tools/make-mp4.sh <clip>`. About 3 s of work
per second of clip at 1.5x.

**Found while recording:** See others' islands is empty, with "Everyone so far lit it just as you
did.", on a night with more than 40 players at par (VIDEO.md, "Bug found while recording").
`play-phone` was recorded with 42 at par and shows it; `others-phone` uses a crowd with 10% at
par.
