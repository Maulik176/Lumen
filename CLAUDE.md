# Lumen — repo conventions

Lumen is a daily 3D light-routing puzzle on Reddit's Devvit Web platform (SDK 0.15, Three.js, Hono,
Vite). It is an entry for Reddit's Game of the Day hackathon; submission closes Dec 8, 2026, 6 pm PT.

## Read first

- `SPEC.md` — intent. Read only the section for the task in hand.
- `PROMPT.md` — the brief mapped to features, and amendments to SPEC (section 4). Accepted
  amendments override SPEC.
- `PLAN.md` — the nine milestones, their tests and exit criteria, and the fixed cut line.
- `PLATFORM.md` (after M1) — what Devvit really allows. Trust it over memory and over SPEC.
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
src/shared/   pure engine: config, types, rng, board, trace, solve, generate, difficulty, validate, api types
src/client/   preview (inline, no Three.js), game/ (Three.js), archipelago, builder, trailer, debug
src/server/   Hono app: /api/* for the client, /internal/* for scheduler, menu, triggers
content/      puzzles.json (90 generated days), fixtures/ (hand-made, par worked out by hand), tutorial.json
tests/        fixture tests, bench/ (speed reports)
scripts/      gen, report
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
| `npm run gen -- --from 1 --to 90` | regenerate `content/puzzles.json` (M2) |
| `npm run report` | par and difficulty per weekday (M2) |

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
