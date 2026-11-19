# Island Builder, phase 2: the brief (Maulik, Nov 19, verbatim)

Saved word for word so it survives a compacted session. Start with STEP 0 (write
`PHASE2_PLAN.md`) and stop for Maulik's OK before any code.

**Correction (Maulik, Nov 19, from the official hackathon page): never publish.** No
`devvit publish` and no app review before the hackathon ends; r/lumen_game_dev (public,
approved) is the playtest and judging subreddit, and uploads go through `npm run release`
(`docs/LAUNCH.md`). So "Before app approval" in item 1 below means "throughout the event":
`runAs: 'USER'` posts as the app account for everyone but the owner, and crediting the true
creator in the title and the game is the normal case, not a fallback. The plan must not include
any publish or review step.

---

ISLAND BUILDER, PHASE 2: PUBLISHING AND COMMUNITY ISLAND POSTS

You are the lead engineer and designer of Lumen. Fable built most of this game; you are now responsible for matching that quality bar. Think deeply before coding. Judges score Delightful UX, Polish, Reddit-y and Daily Content equally, and penalise anything that looks like an AI demo. This phase is where Lumen becomes truly community-made, so it must feel as finished as the daily game.

READ FIRST: CLAUDE.md, BUILDER_PLAN.md, HANDOFF.md (brief O-14), PLATFORM.md (trust it over everything else), SPEC.md "Reddit and community layer", and the Phase 1 code and tests. Phase 1 is approved and phone-tested.

STEP 0: PLAN (no code yet)
Write PHASE2_PLAN.md with: user flows, data model and Redis keys, endpoints, entry points in devvit.json, the feed card and in-game screens for an island post, edge cases, test list, phone checks, and risks. Explicitly list every Devvit rule this touches (user actions, userGeneratedContent, postData 2 KB limit, realtime channel naming, navigateTo without the t3_ prefix). Stop and wait for my OK.

SCOPE OF PHASE 2
1. PUBLISH FLOW
   - Publish unlocks only after a successful "Test your island" solve and a fresh server check of the exact board (never trust client state; re-run validation and the solver on the server).
   - Confirm screen: island preview, name, par, difficulty label, "This posts to r/<sub> as u/<name>". One explicit tap. Never automatic, never required to keep playing.
   - submitCustomPost with runAs 'USER', userGeneratedContent set, title "Island by u/<name> · <island name>". postData holds only the island id; the island lives in Redis.
   - Idempotent: a double tap or retry never creates two posts (publish token). On failure show a calm line and keep the draft.
   - After success: celebrate briefly in the UI kit style, clear the draft, and open the new post directly.
   - Rate limit: 3 islands per user per day (config). Duplicate check by board hash against all daily islands and community islands.
   - Name: max 24 chars, trimmed, basic word filter; fallback name from the biome ("Moss Island #7").
   - Before app approval, runAs USER may post as the app account for non-owners (PLATFORM.md). Detect it, still store the true creator, and always credit "Island by u/<creator>" in-game.

2. COMMUNITY ISLAND POSTS
   - Feed card: the biome hero art, the island silhouette, island name, "Island by u/name" with the creator's snoovatar (glyph fallback), par and difficulty label, and "N players lit it". Same under-1-second rule, no Three.js. Solved state like the daily card.
   - In-game: identical play to the daily island (tutorial rules, rule cards, resume, sound, Lock in, nightfall, lantern release), but the top bar says the island name and "by u/name", and there are no streak or flair effects.
   - Each island post has its own sky: realtime channel sky_isl_<id> (letters, digits, underscores only), its own sky list, live "u/name just lit" arrivals, and other players' lanterns, exactly like the daily sky.
   - Per-island leaderboard (pieces, then time), first Lock in per user counts. "See others' boards" works the same way as on the daily island, including grouped distinct solutions.
   - Creator: their test solve is shown as "Creator's board" in the boards view, not ranked on the leaderboard. The creator can still play and lock in like anyone else.
   - The app posts a stickied "Results for <island name> by u/name" comment at publish time; shares go under it, as on daily posts.
   - If the post is deleted or removed, the island is marked inactive and never shown or picked.

3. "YOUR ISLANDS" IN THE BUILDER
   - A list of the creator's published islands: name, date, plays, par hits. Tap opens the post.

4. EVERYTHING BEHIND COMMUNITY.enabled
   With the flag off, no entry point, menu item or card text mentions community islands.

5. DEV TOOLS (r/lumen_game_dev only)
   "Dev: clean up this subreddit" and "Dev: reset my progress" also cover community islands, drafts, rate limits and their skies.

OUT OF SCOPE (Phase 3): Sunday pick, Islandwright flair, Archipelago community section, mod "Exclude from Sunday". Don't change JOURNEY_MAP.md; list proposed builder events in a note only.

ENGINEERING RULES
- Reuse the shared engine; don't change daily rules or solver results.
- All new numbers and copy in config.ts. Same UI kit, fonts, icons and art.
- Tests for: publish validation, server re-check, idempotency, rate limit, duplicates, word filter, creator credit when posted as app, per-island leaderboard, sky channel naming, deleted posts, flag off.
- Performance budget unchanged. The feed card for island posts stays under 1 second.
- One commit per numbered item; lint, types, tests and build green; push to GitHub after the phase.

JUDGE PASS (before reporting)
Play the full loop as a first-time player at 430x701, 360x460 and desktop: build → test → publish → open the post → a second account plays → boards → sky. Write the top 5 issues a harsh judge would notice and fix the cheap ones.

REPORT FORMAT
Short: what was built, what was tested and how, what's untested on a real phone, any risk to the Nov 25 target, and phone checks C1-Cn added to docs/TESTS-TO-RUN.md. Then stop and wait for my phone test.
