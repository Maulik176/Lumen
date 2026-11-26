# Phase 4 and everything left to build (Nov 26)

Maulik, Nov 26, after launch: "complete all the pending items to build here itself, the must
build list, the should fix (small) and Atmosphere pass and the trailer ending … we should be only
left with real user testing and submission details and videos shots." Lumen is live, so every
upload reaches players at once: one `npm run release`, after Maulik says.

## What was built

| # | Item | What a player sees | Where |
|---|---|---|---|
| 1 | **Daily card pictures** (Phase 4 queue 2) | Each daily post's feed card shows its own island, unsolved (pieces not placed, lanterns unlit, the suns' first light), instead of one stock picture per world. About 7 KB each; a card downloads only its own; a missing one falls back to the stock picture | `scripts/day-cards.mjs` (`npm run day-cards`), `src/client/assets/days/`, `preview.ts` `dayPicture` |
| 2 | **Community card pictures** (Phase 4 queue 1) | The Builder draws the island in 3D off screen while the maker reads the Publish panel (measured locally: 3.3 s, a 1080x480 JPEG of 20-35 KB, framed like the daily pictures so a phone card's narrow crop keeps the whole island); Publish sends it, the server uploads it to Reddit's image host (`media.upload`) before posting, and the post's card shows it. A picked Sunday carries it too. Anything wrong (slow device, upload fails, wrong host): published without one, stock picture shown | `main.ts` `snapshotIsland`, `scene.ts` `capture`, `builder.ts`, `community.ts` `pictureData`/`publishIsland`, `routes/builder.ts`, `COMMUNITY.picture*` |
| 3 | **Past posts never say "tonight"** | "#1 that night" (done in v0.0.1.98), "That night's board", "No lanterns that night.", "No other islands yet.", and the results comment reads "Results: N players lit …" (it stays on the post long after its night) | `board.ts`, `config.ts` COPY |
| 4 | **Share after a Reddit sign-out** (Nov 23 P2) | Share first asks Reddit whether the player lets Lumen post as them (`canRunAsUser`, experimental, 6 s limit); the failure line now says "Close and reopen the Reddit app, then share again." (what worked on Nov 23) | `main.ts` `share`, `hud.ts` |
| 5 | **O-7: avatar on the result card** | The player's snoovatar beside their medal | `hud.ts`, `.result-avatar` |
| 6 | **O-9: larger tap targets** | Camera tilt 52° → 58°, margin 0.08 → 0.06. Measured tile spacing (across × deep, CSS px) before → after: 9x9 at 430x701 34×26 → 36×29; 8x8 at 430x701 38×29 → 40×33; 7x7 at 430x701 43×32 → 45×37. 44 px is not reachable on a 9x9 island at phone width (360/9 = 40 px with no margin at all); near-miss taps already snap to the nearest tile (`RULES.tapSnapTiles`) | `config.ts` CAMERA |
| 7 | **Rule card covering the island on short screens** (found in the O-9 pass, older bug) | At 360x460 a rule card left the island under 110 px and the HUD told it the top bar was not there, so the island slid under the bar. Now the island keeps clear of the bar and hint line while a card shows, and the card drops its drawing on screens under 560 px tall | `hud.ts` `insets`, `game.css` |
| 8 | **O-12: Lighthouse and contrast** | Lighthouse mobile on the built feed card: Performance 100 (first paint 1.4 s, largest paint 1.5 s, blocking 0 ms, layout shift 0), Accessibility 90, Best Practices 96. The two flags are local-only: the main button is empty until the post's data fills it (on purpose, so "Light the lanterns" never flashes), and console errors from having no server. Contrast: every text pair passes WCAG AA (lowest: Lamplighter orange on paper 4.75; ink on paper 13.5; light on the veil over the brightest sky 5.47) | (measurement) |
| 8b | **Builder judge pass** (P4 polish) | At 360x460, 430x701 and 1100x700: nothing overflows; the "Island" button's tap area is now 44 px tall (it was 36) without making the top bar taller; the board's 4 px gutter stays (it keeps 8x8 tiles at 44 px on a 360 px phone). Publish retries once without the picture if Reddit refuses the larger request | `game.css`, `builder.ts` |
| 9 | **Atmosphere pass** | Life in the air over each world, one draw call: fireflies that wake at dusk (moss), falling petals (blossom), light snow (snow), drifting warm motes (dune), falling leaves (autumn); the large stars breathe at night; a soft synthesised breath of wind now and then while an island is played (only once sound is on; never queued). Reduce Motion: nothing travels, the motes only glow and fade, the stars hold still | `ambient.ts`, `sky.ts`, `audio.ts` `breeze`, `config.ts` AMBIENT, SOUND.breeze* |
| 10 | **Trailer ending** (REVIEW P1-7) | After the title, the map of every night fades in over the sky, glides down through the islands, and the title comes back over it | `trailer.ts`, `main.ts`, `game.css`, TRAILER.titleHoldMs/map* |

## Not built, and why

- **O-6 Subscribe button.** In a playtest build Reddit runs user actions as the app for everyone
  but the owner, so for judges and players the button would subscribe the app, not them: it
  would look broken. The Reddit "Join" button beside the subreddit name does the job.

## Why the old HANDOFF briefs waited until now

They were written Nov 16 under the feature freeze (bug fixes and copy only). O-6 and O-7 were
marked "ask first" and were never brought back to Maulik once the Island Builder (O-14) took
priority from Nov 18; O-9 was "tune after a phone measurement" that never happened; O-12 was
parked as a submission-week task. They should have been put in front of Maulik before launch.

## Checks

Tests for the picture at Publish (`community.test.ts`: uploaded before the post, carried by the
post, the record and the Sunday credit; a failed upload, a picture from elsewhere, a non-image or
an oversized one, or none: published all the same, without one). Every new number is in
`config.ts`. Then `npm run checks` (scale nights, all tests, types, lint, build, four seats, the
Sunday pass) before the one upload.
