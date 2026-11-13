# Lumen — repo conventions

Lumen is a daily 3D light-routing puzzle on Reddit's Devvit Web platform (SDK 0.15, Three.js, Hono,
Vite). It is an entry for Reddit's Game of the Day hackathon; submission closes Dec 8, 2026, 6 pm PT.

## Where things stand (update at the end of every milestone)

**As of Fri Nov 13, 2026, early morning IST.** Milestones 1 and 2 done. Next: Milestone 3 (3D
vertical slice).

- App: `lumen-game` (the name `lumen` was taken). Listing: developers.reddit.com/apps/lumen-game.
  Owner account u/Dry_Promotion2506. Playtest subreddit `r/lumen_game_dev`. Launch subreddit
  `r/LumenGame` still to be created by Maulik (needed by Nov 24).
- `npx devvit login` expires within hours; a 401 from playtest means log in again. Claude cannot
  open reddit.com in its browser tools: Maulik does anything that needs the Reddit site.
- Branch `spike/platform` holds the throwaway spike. Never merge it.
- M1: engine in `src/shared` (tracer, exact solver, validator, RNG, text format), ten fixtures,
  `npm run bench`, `PLATFORM.md`.
- M2: generator, difficulty model, names, calendar, `content/puzzles.json` (90 days from day one
  = Tue Nov 24, 2026), `npm run gen`, `npm run report`, `npm run debug` (2D viewer). 197 tests.
  Every day is in its par and difficulty band and solves in under 0.3 s (bar was 2 s). Generated
  days are capped at `GENERATOR.maxSolveNodes`; the Island Builder check uses
  `SOLVER.builderNodeLimit` (about 2 s on a laptop, to be confirmed on the server in M6).
- Changing `CALENDAR.dayOne` or anything in `GENERATOR`/`DIFFICULTY` means `npm run gen` again and
  committing `content/puzzles.json`; `tests/content.test.ts` fails until you do.
- Open design note for Maulik: Monday islands have one lantern (one sun, mirrors only can light
  only one). Option: Monday with two suns and two lanterns at par 2–3.

**Decisions that override SPEC (full list: PROMPT.md section 7):**

- **Lock in (A1).** Lighting every lantern locks nothing. A soft glow and "All lit · N pieces
  (par P)" appear with two buttons, **Lock in** and **Keep refining**. Lock in is the single ranked
  submission and triggers nightfall and the lantern release. The timer runs until Lock in. Copy
  lives in `config.ts`.
- **Cut order if Monday runs out:** (1) Island Builder, Sunday falls back to a generated island;
  (2) biomes 5 → 3. Never cut the Shared Night Sky. Archipelago becomes a 2D map before it is ever
  cut. Trailer mode stays.
- **Saturday par is at most 6.** The Builder refuses to publish on solver timeout:
  "Too complex to verify. Try removing a piece."
- **Share:** the app posts one stickied "Lumen #N results" comment at post creation; shares are
  replies under it.
- **App review submitted Nov 17–18**, with `JOURNEY_MAP.md`.
- **Snoovatars:** texture from `i.redd.it` with `crossOrigin` (proven). Client sends its own
  `context.snoovatar` at Lock in; server validates the host. Glyph when an account has none.
- **Prisms** can turn light as well as split it. Generator treats them as scarce;
  `difficulty.ts` counts "prism used as a turn" as its own factor.
- **Decoys** are misleading paths, never lanterns that must stay dark.
- **Reduced motion** is a first-class path: the calm nightfall and release must be as beautiful
  as the full version. Maulik's own phone has Reduce Motion on.
- **Testing devices:** iPhone now; Android arrives before Milestone 4. Until then also test in
  desktop Chrome with 4x CPU slowdown.

## Read first

- `SPEC.md` — intent. Read only the section for the task in hand.
- `PROMPT.md` — the brief mapped to features, and amendments to SPEC (section 4). Accepted
  amendments override SPEC.
- `PLAN.md` — the nine milestones, their tests and exit criteria, and the fixed cut line.
- `PLATFORM.md` (after M1) — what Devvit really allows. Trust it over memory and over SPEC.
- `JOURNEY_MAP.md` — the Journeys events, triggers and fields sent to Reddit for approval.
- `HANDOFF.md` (after M9) — tuning guide and known issues.
- `AGENTS.md` came with the template. Its Devvit limitations list is right; its mentions of React
  and tRPC are not (this repo uses neither).

## The freeze rule

Feature work ends Mon Nov 16, 2026, 11:59 pm IST. After that: change numbers in
`src/shared/config.ts`, fix bugs that have a repro and a failing test, edit copy, do submission
tasks. **No new features, no redesigns, no refactors.** If something seems to need one, write it up
in `HANDOFF.md` and ask Maulik.

## Layout

```
src/shared/   pure engine: config, types, rng, board, trace, solve, validate, calendar, generate,
              difficulty, names, daily (stored island format), puzzle-text, api types
src/client/   preview (inline, no Three.js), game/ (Three.js), archipelago, builder, trailer, debug
src/server/   Hono app: /api/* for the client, /internal/* for scheduler, menu, triggers
content/      puzzles.json (90 generated days), fixtures/ (hand-made, par worked out by hand), tutorial.json
tests/        fixture tests, bench/ (speed reports)
scripts/      gen, report (run with tsx)
```

## Hard rules

1. **TypeScript strict.** No `any`, no type casts, no `@ts-ignore`. Type aliases over interfaces,
   named exports only.
2. **`src/shared` is pure.** No DOM, no Three.js, no Node APIs, no Devvit imports, no `Date.now()`
   or `Math.random()` (time and randomness are passed in). It must run identically on client and server.
3. **Every tunable number lives in `src/shared/config.ts` with a comment**: difficulty weights, par
   bands, timings, colours, sizes, streak rules, caps, feature flags. A literal in gameplay or
   rendering code is a bug.
4. **The engine is tested with Vitest.** Every rule in SPEC "Core rules" has a test. A bug fix starts
   with a failing test.
5. **The client never scores itself.** The server re-traces every submission with the shared engine
   and measures time from its own start record. The day comes from the post's `postData`, never the
   device clock.
6. **No external network calls from the client.** Only same-origin `/api/*`. Fonts, icons and any
   textures are bundled; all sound is synthesised with WebAudio. No CDNs, no analytics scripts.
7. **Server endpoints** start with `/api/` (client) or `/internal/` (platform), finish well inside
   30 s, never stream, and treat every Redis write as fallible.
8. **Redis on Devvit** has strings, hashes, sorted sets, bitfields and transactions only. No lists,
   no plain sets, no pipelining. Keep keys small, group reads, set TTLs as in SPEC.
8a. **Realtime channel names** use only letters, digits and underscores (`sky_12`). Wrap
    `connectRealtime` in try/catch: it throws synchronously on a bad name.
8b. **Nothing passes between the preview and the game through `sessionStorage`** (it does not
    carry on iOS). The viewport is measured at run time: expanded mode is not full screen.
9. **Reddit API calls that are decoration** (flair, sticky comment, avatar) fail silently and never
   block play.
10. **User actions** (comment, post, subscribe) happen only on an explicit, separately labelled tap;
    never automatic, never bundled with another action, never required to continue. Score comments
    reply under the post's single stickied results comment.
11. **Inline preview:** no Three.js, taps only, no scroll capture, paints from `postData` without
    waiting on the network, under 1 s, Lighthouse mobile above 80.
    `requestExpandedMode` is called synchronously inside the click handler.
12. **Render loop:** no allocations per frame, no real-time shadows, instanced geometry, pixel ratio
    capped per config, everything disposed on teardown.
13. **Logged-out players can play.** Check for a missing `context.userId` on every endpoint.
14. **No personal data** in Journeys fields, logs or Redis beyond Reddit user id and username.

## Voice and look

- Copy is calm, warm and short. One line at most. No exclamation marks except on hitting par.
  Words: light, lantern, dusk, island, night. Never: laser, level, beam puzzle.
- No emoji inside the game UI (flair and the comment result card are the only exceptions).
- One palette, one corner radius, one display font, one icon style. No stock components.
- Nothing about Reddit, Snoo or karma in the fiction.

## Commands

| Command | Does |
| --- | --- |
| `npm run dev` | `devvit playtest` against the subreddit in `devvit.json` (`dev.subreddit`) |
| `npm test` | Vitest: unit tests beside the code in `src/`, fixture tests in `tests/` |
| `npm run bench` | Solver speed report by par on open islands (not part of `npm test`) |
| `npm run test:types` | `tsc --build` |
| `npm run lint` | ESLint |
| `npm run build` | Vite build of client and server |
| `npm run gen -- --from 1 --to 90` | regenerate `content/puzzles.json` |
| `npm run report` | par and difficulty per weekday; `-- --show 12` prints a day; `-- --verify` re-solves and times all |
| `npm run debug` | local 2D viewer for every day: par solution, difficulty factors, click to place pieces |

Node 22.12 or newer. The Reddit app on a real phone is the only test that counts for feel and
performance; a desktop browser is for layout.

## Working rhythm

- One milestone per session. Start from its PLAN.md entry.
- Before saying a milestone is done: `npm test`, `npm run test:types`, `npm run lint` and
  `npm run build` all pass, and each exit criterion is reported as met or not met with the number.
- **Judge pass at the end of every milestone:** screenshot the game at 360x640 and 430x932, critique
  it as a harsh hackathon judge against PROMPT section 3 and SPEC's anti-AI-slop checklist, fix the
  top three issues, list the rest.
- **Commit after each milestone** (and before any long autonomous run). Message says what a player
  can now do. Never commit `dist/`, `.env*` or tokens.
- When asked "what's pending?", walk PROMPT section 3 and PLAN.md top to bottom, not just the latest
  to-do list, and name anything that was dropped.
- If something is cut, cut it whole in the order of PLAN.md's cut line and write its brief in
  `HANDOFF.md`. Never leave a feature half-built or a button that does nothing.
- If a request would crowd out a brief requirement, say so before doing it.
