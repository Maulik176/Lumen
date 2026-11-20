# The one-minute video: storyboard, shot status and shot list

Written Nov 21, 2026. The video judges watch first. It follows what won last time (BridgeDit,
`docs/SUBMISSION.md` lesson 14): about 60 seconds, no voice, one caption card per beat in
Lumen's own style (warm paper panel, Young Serif, a capitalised headline and one short line),
real Reddit around the game, and an ending with phone and desktop side by side. Judges score
Delightful UX, Polish, Reddit-y and Daily Content equally; every beat below names the one it
serves. A longer full walkthrough can be linked from the write-up.

**Rules for every frame:** no `?perf=1` overlay, no webcam bubble, no browser bookmarks bar or
personal subreddits, no notifications. Real names and snoovatars only with that player's
permission (blur otherwise). Game sound on (clicks, chimes and the night pad are part of the
delight); no music over it unless it is quiet. Captions never cover the island.

**Where the raw material is:** `docs/CAPTURES.md` (runs 1 to 4). Run 4 is the local clips made
for this video (`captures/2026-11-21-video-local/`, 30 fps H.264). Local clips run the real game
code with made-up players: good as close-ups and as a fallback cut, but the real Reddit app on
Maulik's phone is the main source (lesson 7: the game must be seen inside Reddit).

---

## Storyboard (60 s)

| # | Time | Beat (what is on screen) | Caption | Criterion | Best source | Status |
|---|---|---|---|---|---|---|
| 1 | 0:00–0:04 | **Hook.** Your lantern rises into a sky full of other players' lanterns, the island glowing far below | ONE SKY / everyone who lit tonight's island | Reddit-y | Phone (P11), a busy real night | **Partial:** local `trailer-phone` (release into 140 lanterns, 0:13–0:24) is ready as a fallback; the real one needs a full sky after launch |
| 2 | 0:04–0:09 | **In the feed.** The Reddit app, today's Lumen card (picture, outline, "Light the lanterns"), a thumb taps, the island opens | PLAYS RIGHT IN THE POST / a new island every night | Daily Content | Phone (P1) | **Missing** (run 1 stills 002 and 003 show it, too small for video) |
| 3 | 0:09–0:20 | **Bend the light.** Tap a tile: a mirror; tap again: it turns and the light travels on; a prism splits white light into red, green and blue lanterns, each with its shape | TAP TO PLACE, TAP TO TURN, then A PRISM SPLITS THE LIGHT / colour is never the only clue | Delightful UX, Polish | Phone (P2); local close-ups | **Have (local):** `taps-phone-hires` (2.5x, rule card, first taps) and `play-phone` (the whole answer). Phone version still wanted |
| 4 | 0:20–0:24 | **All lit.** "All lit · 4 pieces (par 4)", then Lock in | ONE ANSWER A NIGHT / fewest pieces, then fastest | Polish | Phone (P2, same take) | **Have (local):** `play-phone` |
| 5 | 0:24–0:31 | **Night falls.** The island darkens, lanterns bloom one by one with chimes, your lantern lifts off and the camera follows it into the shared sky; another player's lantern arrives live ("u/name just lit Willow Prism") | NIGHT FALLS / your lantern joins everyone's | Delightful UX, Reddit-y | Phone (P3); the live arrival needs two phones (P4) | **Partial:** nightfall and release in `play-phone` and `trailer-phone`; the live arrival is missing |
| 6 | 0:31–0:37 | **Everyone else.** Tonight's board with snoovatars; See others' islands: "Your island · same as u/name and 5 others", the other answers with pictures, one tapped and shown lit | HOW DID THEY LIGHT IT? / see every other answer | Reddit-y | Phone (P5), real players and snoovatars | **Partial:** `others-phone` (the list, "same as u/ember3 and 16 others", one island tapped lit, the board) with made-up players (letter seals, no snoovatars). **Blocked on Reddit by a bug found Nov 21** (below): on a night with more than 40 players at par the list shows no other islands |
| 7 | 0:37–0:47 | **Build an island.** The Builder: place a sun, turn it, a lantern, a rock; Check (light sweeps the board) gives "Par 3 · Tricky"; light it yourself in 3D; Publish: night over the board, lanterns bloom, a small lantern lifts away; the new post, "Island by u/name" | BUILD YOUR OWN ISLAND / the solver proves it, you light it first, then PUBLISH / it becomes a post with your name | Reddit-y, Delightful UX | Phone (P7) | **Have (local):** `builder-phone` (45 s: lessons, Check "Par 2 · Gentle", the 3D test, the confirm panel, the celebration). A phone take (P7) is still better: the Reddit app around it and the new post opening |
| 8 | 0:47–0:52 | **The community's Sunday.** The week's most upvoted island becomes everyone's Sunday: the feed card "Lumen #6 · Island by u/name", the top bar "Name · by u/name", the result card "Island by u/name, chosen by the community", the maker's flair "Islandwright" | THE BEST ISLAND OF THE WEEK / becomes everyone's Sunday | Reddit-y, Daily Content | Phone (P8), Sun Nov 29 | **Missing:** real only after the first pick (Sat Nov 28 20:00 UTC). A local fallback can be recorded once Phase 3's dev pick exists |
| 9 | 0:52–0:56 | **Every night on one map.** The Archipelago scrolls past islands glowing by how many lit them, your medals on them; the Community tab | EVERY PAST ISLAND, ONE MAP | Daily Content | Phone (P9), after a week of islands | **Missing** (run 1 still 108 only) |
| 10 | 0:56–1:00 | **Any device.** Phone and desktop side by side, the same night sky; title "Lumen" and "A new island every night · r/lumen_game_dev" | A NEW ISLAND EVERY NIGHT / on any device | Polish | Desktop (P10) beside a phone take | **Partial:** local `trailer-desktop` (1600x900) ends on the trailer's own title card; a real desktop Reddit take is missing |

Spare b-roll: `trailer-phone-calm` (Reduce Motion: the calm nightfall and release, for one
"just as beautiful with Reduce Motion" cut), the rule cards in `taps-phone-hires`, the five
worlds (run 1 stills 055–059).

**Status in one line:** a complete fallback cut of beats 1 and 3–7 and 10 exists today from
local clips (six clips, run 4); what proves "inside Reddit" (2, the live arrival in 5, real
snoovatars in 6, the post opening in 7), the Sunday pick (8) and the map with a week of nights
(9) need Maulik's phone, and 1, 8 and 9 can only be real after launch. Beat 8 also has stills
from the Phase 3 Sunday pass (`scripts/sunday-pass.mjs`, `captures/before-upload-sunday/`) for
planning.

---

## Shot list for Maulik's iPhone

**Set-up, once:** Focus / Do Not Disturb on; Control Center → Screen Recording (long-press: Microphone
**off**); sound on and not silent (the chimes matter); Reduce Motion **off** for every take except
P3b; the Reddit app signed in, r/lumen_game_dev joined; full brightness. Record each shot as its
own take of 10–30 s, two or three times; a calm, slow thumb reads best. AirDrop the files to the
Mac and put them in `captures/<date>-phone-video/` (gitignored), then tell Claude the folder.

| # | Shot | Exact steps | When |
|---|---|---|---|
| P1 | Feed to game | Open r/lumen_game_dev in the Reddit app, scroll so today's Lumen card comes into view and settles, pause 1 s, tap "Light the lanterns", let the island appear and hold 2 s | Launch day or after (Lumen #1 or #2), before you play it |
| P2 | Bend the light | On **Lumen #2, Willow Prism (Wed Nov 25)**, the colourful island with a prism: play it for real, slowly. Place a mirror, tap it to turn and let the light travel, place the prism and hold while the light splits into the coloured lanterns. Do not stop recording: P3 follows in the same take | Wed Nov 25 (its own night, ranked) |
| P3 | All lit, Lock in, night falls | Same take: when "All lit" shows, hold 1 s, tap Lock in, and keep recording through nightfall, the lanterns blooming and your lantern rising until the result card has been on screen 2 s | Wed Nov 25, same take as P2 |
| P3b | Calm version | Settings → Accessibility → Motion → Reduce Motion **on**; on a past island from the map (practice), Lock in and record the calm nightfall and rise. Turn it off again after | Any time |
| P4 | Live arrival | Two phones on the same post. You are mid-island; your friend locks in. Record your screen: "u/friend just lit {island}" in the hint row and their faint lantern rising | Any day with a friend (also test 4 and C6) |
| P5 | Board and others | **Only after the busy-night fix below has been uploaded.** After Lock in on a night with real players: tap the time line on the result card (tonight's board, snoovatars), Back, then See others' islands, tap one other island to see it lit, All islands | Evening of Nov 25–27, once 5+ people have played |
| P6 | Results thread | Tap Share on the result card, then "View comment": the results comment with shared replies under it. A screen recording scrolling the thread, 6 s | Nov 25–27 |
| P7 | Build and publish | Result card → Build an island. Make a **showcase island** (SUBMISSION.md: one clear discovery, e.g. a rock forcing a detour): place a sun, tap it to turn, place a lantern, a rock; Check and hold on the light sweeping the board and "Par N · label"; Test, light it in 3D; Publish, confirm, and keep recording through the celebration until the new post is open | Nov 24–26, so the island stays up and can be picked for Sunday Nov 29 |
| P8 | Sunday pick | Morning of Sun Nov 29 (from 05:30 IST): the feed with "Lumen #6 · Island by u/name", open it, play it, Lock in, the result card's "chosen by the community" line; then the winning island's post with the announcement comment; then a comment by the maker showing "Islandwright" in their flair | Sun Nov 29 (the first pick runs Sat Nov 28 20:00 UTC) |
| P9 | The map | Result card → Explore past islands: scroll slowly from tonight down past the first week, pause on an island with your medal; then the Community tab | Nov 30 or later |
| P10 | Desktop | On the Mac: Chrome with a clean profile (no bookmarks bar, no extensions), window full screen 1920x1080, **no webcam**. Open today's post, expand to "Fullscreen", play to Lock in and the sky. macOS screen recording (Cmd-Shift-5), sound on | After launch, a busy night |
| P11 | The hook | The sky on the busiest night you can find: open a post you locked in on, so the night, your lantern and everyone's lanterns show; record 8 s of the sky (and, best, the release itself in P3 on a busy night) | Nov 26–28, after many players |

**Ask before using a friend's name or snoovatar** in a shot; otherwise blur it in the edit.

---

## Bug found while recording (Nov 21): See others' islands on a busy night

Recording the local clips with a realistic crowd of 140 (60% at par) showed "Your island · same
as u/nova5 and 84 others" and "Everyone so far lit it just as you did." while 55 players had
placed other boards. The list only looks at the top 40 rows of the board for different boards;
on a busy night those 40 are all the par answer, so every other board is missed. Any night with
more than 40 players at par shows an empty list with a false line, which is likely in launch week.
Not fixed here (this session does not touch `src/`); written up for the Phase 3 session with the
repro and a fix direction. The local clips use a crowd with only a quarter at par, so they do not
show the bug. Shot P5 on Reddit waits for the fix.

## Local clips (Claude, run 4)

Recorded with `captures/2026-11-21-video-local/tools/record.mjs` against the stand-in
(`npx vite --config vite.debug.config.ts --no-open --port 5299 --strictPort`), which runs the
real game code on a made-up crowd (140 players on day 2). The page's clock is driven frame by
frame, so motion is smooth at 30 fps whatever the renderer's speed. Re-record any clip with
`node captures/2026-11-21-video-local/tools/record.mjs seed <clip>` then
`bash captures/2026-11-21-video-local/tools/make-mp4.sh <clip>`. The list with timings is in
`docs/CAPTURES.md`, run 4.

Clips: `trailer-phone`, `trailer-desktop`, `taps-phone-hires`, `play-phone` (not its See others'
part), `others-phone`, `builder-phone`. What local clips cannot show: the Reddit app around the
game, real snoovatars and names, the live arrival between two devices, the Sunday pick, the map
after a week, sound.

---

## Edit notes

- Cut order and timings as in the storyboard; each caption card fades in for the beat and out
  before the next. The caption style is Lumen's: paper panel (`UI` colours in `config.ts`), Young
  Serif headline in capitals, one short line under it. One style for every card.
- Phone footage sits in a phone-shaped frame on the dusk gradient, never stretched; desktop
  footage full frame. The ending puts both side by side.
- First frame matters: the thumbnail is the hook (beat 1).
- Export 1920x1080, 30 fps, H.264; also a 1080x1920 cut for social if wanted.
- Recordings that went missing: `maulik playing the game.mov` and `c1 to c12 test.mp4` (Nov 19–20,
  real phone, real Reddit) are no longer in Downloads and Spotlight does not find them. If they
  are elsewhere, put them in `captures/` and tell Claude: they hold real-Reddit takes of P1, P2,
  P3 and P7. `lamp visibility.mp4` is still there but shows a webcam bubble and the bookmarks
  bar, so it is reference only.
