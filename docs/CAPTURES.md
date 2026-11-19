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
