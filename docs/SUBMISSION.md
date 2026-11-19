# Submission: what the winners did, and Lumen's plan

This file collects what we learn from past winners of Reddit's Daily Games hackathon (Jan–Feb
2026, same four judging criteria as ours) and turns it into Lumen's Devpost page, gallery and
video. **Only patterns seen in a winning entry go in "What the winners did".** Lumen's plan
below follows from those patterns; nothing in it is a guess about what judges like.

Sources: the hackathon page (redditdailygames2026.devpost.com, rules and project gallery), each
winner's Devpost page, gallery images and video. Reddit links can't be opened by Claude's
browsers; Maulik pastes anything from reddit.com.

Judging criteria (equally weighted, ours too): **Delightful UX, Polish, Reddity, Recurring
Content.** Sub-prizes last time: Best Use of GameMaker, Best Mobile Game Play, Best Use of User
Contributions.

---

## What the winners did

### BridgeDit! Cosy Bridge-Building (Best Daily Game) — studied Nov 16

**The judges' words:** "3D cozy bridge building puzzle game! Build your own levels to challenge
others and compete to be the best bridge engineer of the day. We were blown away by the
thoughtful user experience, original take on daily gameplay, ease AND intricacy, and the
potential to build community through bridges."

**The game:** drag to build a bridge between a start point, a checkpoint and a goal; five
materials with different strength and cost; a running cost; press play and cars drive across,
some days with an earthquake. Leaderboard by lowest cost or time, each entry a picture of that
player's bridge. A level editor posts every player-made level as its own post; the author's
daily levels come from the same editor. Built in two weeks.

**Lessons, each with what we saw:**

1. **The judges repeat your tagline.** His Devpost tagline: "Build your own levels to challenge
   others! Compete to get the lowest cost and best time!" The judges' blurb: "Build your own
   levels to challenge others and compete to be the best bridge engineer of the day." Write the
   one sentence we want quoted, and put it first everywhere.
2. **One gallery picture per feature heading.** His "What it does" has seven headings (build,
   compete, level builder, daily, play anywhere, earthquakes, themes); the gallery has a picture
   for each. A judge who only flicks through the gallery still gets the whole pitch.
3. **The cover moves.** The first gallery item is a small GIF of play, so the thumbnail reads as
   a game.
4. **A real logo is its own gallery item.** A wordmark with a bridge drawn into the letters,
   transparent background.
5. **One caption style on every captioned picture:** a big capitalised headline and one short
   benefit line ("VARIED LANDSCAPES / Each level is its own puzzle!", "CHOOSE YOUR OWN THEME /
   Make your bridge your own").
6. **Split pictures show variety in one frame:** two levels top and bottom; the same bridge in
   two themes with a wipe between them.
7. **Real Reddit around the game.** Screenshots keep the post title ("[HARD] Spirals Galore
   (Daily Challenge #4)"), the Join button and the close button; one phone GIF is the Reddit
   feed itself. It proves the game lives in Reddit, not in a mock-up.
8. **Phone captures in portrait, separate from desktop ones:** the feed card and a play
   session, recorded on an Android phone. The video ends on phone and desktop side by side:
   "Daily puzzles, on any device!" (There is a Best Mobile Game Play sub-prize.)
9. **Proof the community feature is real.** The level editor screenshot shows "Test Level" and
   "Post Level"; the leaderboard shows other players' actual bridges.
10. **GIFs small, stills large.** GIFs at 320×240 and 360×640; stills around 2000 px wide, 16:9.
11. **Difficulty in the post title**, so the feed says how hard it is before anyone opens it:
    "[HARD] Cantilevering", "[MEDIUM] suspension or not?".
12. **Feed card social proof:** level name, difficulty chip, "3 plays · 0% cleared · 0 hearts",
    one huge button ("LET'S BUILD!"), "Browse levels", and the creator's snoovatar and name.
13. **A short write-up in Devpost's standard headings,** about 350 words. Every feature is a
    heading and one sentence. "Inspired by classics like Poly Bridge" gives judges a picture
    in four words. It has a story ("Embrace user-generated content": the editor he needed for
    daily levels became the community feature) and a feat ("in just 2 weeks").
14. **Video: 59 seconds, a tutorial,** no voice, a caption box per step (press and drag, select
    materials, move the camera, start/checkpoint/goal, unlock the camera, post to the
    leaderboard, daily puzzles on any device).
15. **Player-made content was at the centre of the win.** The judges' blurb opens and closes on
    it. Lumen cut the Island Builder; this is our biggest gap against him (brief O-14 in
    `HANDOFF.md`, needs Maulik's yes).

**What he got away with, that we should not copy:** an FPS counter in every picture and the
video; "Anonymous User" on every leaderboard entry; plain black caption bars that don't match
his game.

---

## Lumen's plan

### Tagline (lesson 1)

Draft: "Bend the light into every lantern, then send your own lantern up into a sky shared with
everyone who lit tonight's island."

### Gallery (lessons 2–10)

Captions use Lumen's warm paper panel and Young Serif instead of a plain bar, one style for all.
No `?perf=1` overlay in any picture. Real snoovatars and names (with permission) where players
appear.

| # | Picture | Caption | Criterion | How | When |
|---|---|---|---|---|---|
| 1 | **Cover GIF:** your lantern rises into a sky full of lanterns | ONE SKY / everyone who lit tonight's island | Reddity | Trailer mode, screen recording | After launch (needs a full sky) |
| 2 | Lumen logo | — | Identity | **Made:** `content/brand/png/wordmark-on-dark-1600.png` (Devpost thumbnail: `devpost-thumbnail-game-1500x1000.png`, the real island; the sky-only `devpost-thumbnail-1500x1000.png` is the spare) | Done |
| 3 | Five biomes side by side | A NEW ISLAND EVERY NIGHT / gentle Monday, demanding Saturday | Recurring content | `npm run hero` renders | Any time |
| 4 | Light travelling, a mirror turning, a prism splitting | BEND THE LIGHT / tap to place, tap to turn | Delightful UX | `scripts/shoot.mjs` at exact size | Any time |
| 5 | Colour shapes close up | COLOUR IS NEVER THE ONLY CLUE / triangle, circle, square | Polish | Local screenshot | Any time |
| 6 | Tonight's board with snoovatars | TONIGHT'S BOARD / fewest pieces, then fastest | Reddity | Reddit | After launch |
| 7 | See others' islands: the list with pictures, and one player's island lit | HOW DID THEY LIGHT IT? | Reddity | Local screenshot, then Reddit with real players | Any time / after launch |
| 8 | **Phone GIF:** feed card, tap, play, inside the Reddit app | PLAYS RIGHT IN THE POST | Mobile | Maulik, iPhone screen recording | After launch |
| 9 | **Phone GIF:** Lock in, nightfall, lanterns bloom, with Reduce Motion on | LOCK IN, AND NIGHT FALLS | Delightful UX | Maulik, iPhone | After launch |
| 10 | Results comment thread with shared replies | SHARE IN THE RESULTS THREAD | Reddity | Maulik, phone screenshot | After launch |
| 11 | Archipelago map | EVERY PAST ISLAND, ONE MAP | Recurring content | Local screenshot | After a week of islands |
| 12 | Weekday difficulty ramp and "90 islands, every par proven minimal" | EVERY ISLAND IS PROVEN SOLVABLE | Polish | From `npm run report` | Any time |

Sizes: GIFs at phone width (about 360×640) or 320×240; stills 16:9 around 2000 px wide.
Check Devpost's current limits on the upload form before exporting.

**Raw material:** `docs/CAPTURES.md` lists every phone capture from the test runs (real Reddit
app, real iPhone) and which gallery item or video beat each one serves. Use it as the shot list,
then re-record those moments at full resolution.

**Showcase islands for the Builder pictures** (outside review, Nov 19): the checker proves an
island can be solved, not that it is fun. Before the Builder pictures and the first community
posts, build two or three islands by hand, each with one clear discovery: a rock that forces an
unexpected detour, a prism whose two colours need two routes, a stone mirror that has to be
used. Play-test them on friends before they appear in the gallery.

### Write-up (lesson 13)

Devpost's standard headings, about 350 words. Under "What it does", one heading and one
sentence per gallery picture above, in the same order. Inspiration names the light-and-mirror
puzzle family in a few words. Story: one night, one island, one shared sky. Feat: every island
is checked by an exact solver, so par is proven, not guessed.

### Video (lesson 14)

About 60 seconds, captions in Lumen's style, no voice needed. Order: tap to place, tap to turn,
prism, all lit, Lock in, nightfall, the shared sky, tonight's board. End on phone and desktop
side by side. Record with the trailer (`HANDOFF.md`, submission checklist). A longer full
walkthrough can be linked from the write-up.

### A note for judges: Lumen is a playtest build (put in the write-up)

The hackathon asks entries to be uploaded and playtested, never published, so Lumen runs as a
playtest build on r/lumen_game_dev. Two things therefore look slightly different, and both are
designed for:

> **Who posted it.** In a playtest build Reddit posts "as the player" from the app's own
> account (u/lumen-game) for everyone except the developer. So every line Lumen writes names the
> player itself: shared results start "u/name · Lumen #N", and community islands are titled
> "Island by u/name" and credit their maker in the game.
>
> **Journeys.** Lumen is instrumented with Devvit Journeys (`JOURNEY_MAP.md`), but Reddit
> records no journeys for playtest builds. The game notices the refusal and stops sending,
> silently; nothing a player sees depends on it.

### Post title and feed card (lessons 11–12)

- Post title today: `Lumen #{day} · {name} · {weekday}` (`COPY.postTitle`). Adding a difficulty
  word (for example "· hard" on Saturday) is a copy change, allowed under the freeze. Ask
  Maulik before changing it.
- Feed card already shows how many lit it tonight. A clear rate or "at par" share would be a
  new feature: ask first.

### Approved by Maulik (Nov 16), to build after Wed Nov 18

Briefs in `HANDOFF.md` section 6.

- **O-16 logo** (lesson 4). **Built Nov 17**: the light's path is the L. Gallery item 2, Devpost
  thumbnail, subreddit icon and banner, app listing icon, trailer title card (`content/brand/`).
- **O-15 See others' islands** (lesson 9). **Built Nov 17**, replacing the crowd pools: the top
  10 and your own island, each with a picture of its pieces; tap to see it lit. Gallery item 7.
- **O-14 Island Builder** (lessons 9, 12 and 15), posted by the app with the maker credited on
  the card, as BridgeDit did. Once it ships, add gallery pictures for the Builder (with its
  "Check" and "Publish" buttons visible, like BridgeDit's "Test Level" and "Post Level") and a
  community island's feed card ("An island by u/name"), and a "Build your own island" heading
  to the write-up. The tagline may then name it too.
