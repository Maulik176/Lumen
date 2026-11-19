<picture>
  <source media="(prefers-color-scheme: dark)" srcset="content/brand/png/wordmark-on-dark-1600.png">
  <img alt="Lumen" src="content/brand/png/wordmark-on-light-1600.png" width="360">
</picture>

# Lumen

A new island every night. Bend the light into every lantern, then send your own lantern up
into a sky shared with everyone who lit the island that night.

Lumen is a daily 3D light puzzle that lives inside a Reddit post. It was made for Reddit's Game
of the Day hackathon on Devvit Web.

- **Play it:** a daily post in [r/lumen_game_dev](https://www.reddit.com/r/lumen_game_dev/)
  (the app listing is
  [developers.reddit.com/apps/lumen-game](https://developers.reddit.com/apps/lumen-game)). As
  the hackathon asks, Lumen is uploaded and playtested there, not published.
- **No setup:** tap "Light the lanterns" on the post. Signed out works too.

## How to play

Each night's island has suns, which send out light, and paper lanterns, which want it.

- **Tap grass to place a mirror.** It turns the light by a quarter.
- **Tap it again to turn it** the other way. A third tap makes it a **prism**, which splits
  white light into red, green and blue (and can turn light too).
- **Colours matter.** A red lantern needs red light; a two-colour lantern needs both its colours
  at once. Each colour has its own shape on the light and the lantern (triangle, circle, square),
  so colour is never the only clue.
- **Stone mirrors are fixed**, and light crosses water, but nothing stands on it.
- When every lantern is lit you may **Lock in**, or **keep refining** to use fewer pieces.
  Par is the fewest pieces that can do it. Lock in once: that is your result for the night.

Lit at par earns **Lamplighter**, one over earns **Glow**, more earns **Spark**.

The first visit opens with four ten-second islands that show how the light behaves before any
words, the last of them with no help at all. The week runs from a gentle Monday to a demanding
Saturday; newcomers who arrive late in the week are offered an easier island to warm up on.

## What happens after you lock in

Night falls, the island's lanterns bloom one by one, and your own lantern lifts off, carrying
your snoovatar (or your initial), and rises into the night. Everyone who lit tonight's island is
up there with you as a small paper lantern, live, as they solve. Tap one to see who it is.

Then:

- **Tonight's board:** fewest pieces, then fastest, with snoovatars; and an all-time board of
  nights at par. Times are measured by the server, from when your island appeared.
- **See others' islands:** your own island and the night's top ten, each with a small picture of
  where that player put their pieces. Tap one to see it lit on the real island.
- **Share to comments** posts your result as your own reply under the post's results comment.
  Only ever on your tap.
- **The Archipelago:** a night map of every earlier island, glowing by how many lit it, with
  your medals. Tap one to play it for practice.
- **Streaks** with a one-day grace earn lantern styles at 3, 7, 14 and 30 nights, and a flair
  with your medal and streak.

## How it uses Reddit

| Feature | How Lumen uses it |
| --- | --- |
| Realtime | Other players' lanterns rise in your sky as they solve |
| Scheduler | One post every night at 00:00 UTC, with a catch-up task so a missed tick never skips a day |
| Comments | One stickied results comment per post, kept up to date; players' shares reply under it |
| Flair | Medal and streak, set after a ranked solve |
| Snoovatars | On your sky lantern, other players' lanterns and the board |
| Redis | Results, boards, streaks, unfinished boards (so you can come back to one), the sky |
| Journeys | Start, progress per lantern, interactions and a server-verified end; see `JOURNEY_MAP.md` |

The server re-checks every answer with the same engine the game uses, and keeps its own clock.
The client never scores itself.

## Daily content

Ninety islands are generated ahead of time and checked by an exact solver: every one is
solvable, its par is proven minimal, and it sits in its weekday's difficulty band. Five biomes
(moss, snow, blossom, dune, autumn) rotate weekly. `npm run report` prints the ramp.

**Cut:** the Island Builder and the Sunday community island. Sunday is a generated island like
the rest.

## Running it

Node 22.12 or newer.

```bash
npm install
npm run debug        # local play screen with a stand-in server
```

Then open `http://localhost:5199/game.html?day=7` (`&calm=1` for reduced motion,
`&biome=snow` for another biome, `&perf=1` for frame rate and draw calls).

| Command | Does |
| --- | --- |
| `npm test` | All tests (engine, server rules, client logic) |
| `npm run test:types` / `npm run lint` | Type check and lint |
| `npm run dev` | Playtest on r/lumen_game_dev before launch (stop it when done; it uploads every save) |
| `npm run release` | After launch: check everything, confirm, upload once, stop the watcher (`docs/LAUNCH.md`) |
| `npm run report` | Par and difficulty per weekday |
| `npm run hero` | Re-render the feed card pictures (needs `npm run debug` running) |

`HANDOFF.md` has the full tool list, a tuning guide for `src/shared/config.ts`, and what is
left. `PLATFORM.md` records what Devvit really allows, as tested.

## Built with

Devvit Web, Three.js, Hono, Vite, TypeScript and Vitest. Every sound is synthesised with
WebAudio; every model is built from primitives in code. The display font is
[Young Serif](https://github.com/noirblancrouge/YoungSerif) (The Young Serif Project Authors),
under the SIL Open Font License (`src/client/assets/fonts/young-serif-LICENSE.txt`).

## Licence

BSD-3-Clause (see `LICENSE`).
