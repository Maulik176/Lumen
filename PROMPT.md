# Lumen — build prompt

Written Nov 12, 2026 by Fable 5.2 from SPEC.md, the official hackathon page and rules
(redditgameofday2026.devpost.com, read Nov 12), and the Devvit docs for SDK 0.15.
SPEC.md stays the source of intent. Where this file and SPEC.md disagree, this file wins
**only for the items listed in section 4 that Maulik has accepted**; until then they are proposals.

## 1. The one-line recap we are building toward

> Lumen is a daily 3D light-routing puzzle for Reddit where you bend sunlight into paper lanterns
> on a tiny floating island; what made it stand out was the shared night sky — every solver's
> lantern rises live into one sky the whole subreddit can watch fill up — on top of a
> solver-calibrated puzzle stream and a diorama that does not look like anything else on Devvit.

If a decision does not make that sentence more true, it is not a priority.

## 2. The job

Build and finish Lumen on Devvit Web (Three.js template, SDK 0.15.2) so that it wins
**Best Daily Game ($15,000)** in Reddit's Game of the Day hackathon.

- Submission closes **Dec 8, 2026, 6:00 pm PT** (Dec 9, 7:30 am IST). Judging Dec 9–16. Winners about Dec 17.
- Fable 5.2 is available until **Mon Nov 16, 11:59 pm IST**. Everything that needs taste, new
  algorithms or cross-system design is final by then. From Nov 17 Opus 5.5 changes numbers in
  `config.ts`, fixes bugs with a repro, writes copy and helps submit. No new features.
- Anything not finished by Monday is cut cleanly or gets a complete brief in `HANDOFF.md`.
  Nothing is left half-designed.

### Who it is for

A Redditor scrolling the feed on a phone who has two to four minutes. They should understand the
board in three seconds, light every lantern without reading instructions, feel the nightfall payoff,
and then see that other people were here too. A judge is the same person with less patience.

### What a judge will do

Open the demo post cold on a phone, with no instructions. Tap the one button. Play for a minute.
Look at the end screen. Maybe open one more post. They may judge from the video and description
alone ("Judges are not required to test the Project"), so the under-60-second video and the text
description carry as much weight as the game.

## 3. The brief, mapped (re-check this every morning)

Judging criteria are equally weighted. **Tie-break order is the order listed**: Delightful UX first,
then Polish, then Reddity, then Daily Content. When two tasks compete, the earlier criterion wins.

| Brief item (official wording, shortened) | Lumen's answer | Milestone |
| --- | --- | --- |
| Delightful UX: exciting layouts and themes, easy and fun to uncover | Tap-only play, live beams, 3-island tutorial, nightfall and lantern release | M3, M4, M7 |
| Polish: close to publishable, Devvit Rules compliant, understandable from example posts | Performance budget, inline rules met, logged-out path, zero-setup demo post | M4, M7, M8 |
| Reddity: own identity, community-minded, brings a community together | Shared night sky, crowd heatmap, results thread, flair, Archipelago, player islands | M5, M6 |
| Daily Content: recurring content, challenges, intrigue | Generator + solver, weekday ramp, 90 days committed, biomes rotate weekly | M2 |
| Bonus: Journeys, flair, comments, snoovatars, streaks | All five, each used for a reason (SPEC "Signature features") | M1 spike, M5 |
| Stand out: intuitive onboarding, contextual hints | Three 10-second micro islands, one hint line each | M7 |
| Stand out: visual craft, accessible contrast, no generic components | Dusk diorama, custom UI kit, colour-blind glyphs, AA contrast | M4 |
| Stand out: calibrated content, legible, fair, solvable | Every puzzle solver-proven with par; difficulty report | M2 |
| Stand out: focused start screen (name, description, date, attribution, stats) | Inline preview card carries exactly those five | M7 |
| Stand out: one clear result card with a next step | One card: medal, stats, streak, comment, subscribe | M5, M7 |
| Stand out: Journey instrumentation | Full journey map; allowlist requested in M1 | M1, M5 |
| Not wanted: AI slop | Anti-slop checklist run as a judge pass at every milestone | all |
| Not wanted: on-the-nose Reddit theming | No Snoo, karma or subreddit jokes in the fiction. Snoovatars appear only as the rider on your lantern | M4 |
| Not wanted: common ideas, clones | See risk W1 below | M1 |
| Must submit: app listing link, README.md, public demo sub (<200 members) + post, text description; video under 1 minute | Submission checklist in SPEC; README in M9 | M9, Opus |

## 4. Problems found in SPEC.md, with proposed fixes

Each item is tagged **[decide]** (needs Maulik's call before the milestone named) or
**[will do]** (a correction I will apply unless told otherwise).

### 4.1 Contradictions and ambiguities

**A1. Auto-submit contradicts "easy to finish, hard to master". [decide before M3]**
SPEC says the puzzle is solved "the moment every lantern is lit", the first solve is the ranked one,
and beams are live so players are encouraged to experiment. Together these punish experimenting:
the first exploratory layout that happens to light everything is locked in as your score, usually
above par. A careful player learns to stop touching the board and think instead, which kills the
live-beam pleasure.
*Proposal:* when every lantern is lit the island goes into a "ready" state (lanterns glow, a single
**Release** button rises from the bottom bar). The player may keep removing or moving pieces.
Tapping Release commits the ranked score and starts nightfall. Nothing else changes.
Cost: one extra tap before the payoff. Benefit: skill is visible, nobody is ambushed, and the
payoff becomes a deliberate act. A `config.ts` flag (`autoReleaseOnSolve`) keeps the SPEC behaviour
available so Opus can flip it after playtests without touching logic.

**A2. "Decoy lanterns" (Thursday) cannot coexist with "solved when every lantern is lit". [will do]**
A lantern that must not be lit is a new rule and breaks "one tutorial card". I will treat decoys as
board features only (a tempting tile next to a lantern, a near-miss line), which is what the
generator section already describes, and rename Thursday's idea to "Water and misleading paths".

**A3. Streak grace is described two ways** ("a one-day grace" and "one grace day allowed per week").
[will do] Rule: a streak survives one missed day per ISO week (Mon–Sun, UTC). The missed day does not
add to the count. Stored as `graceUsedWeek` exactly as the Redis table says.

**A4. Ranked vs unranked at day rollover is undefined. [will do]**
A solve is ranked if the server recorded `/api/start` for that day before 00:00 UTC of the next day
and the submit arrives within a grace window (`config.rolloverGraceMs`, default 10 minutes).
The day always comes from the post's `postData.day`, never from the device clock.

**A5. Time starts at "Play", but the tutorial runs after Play on first visit. [will do]**
`/api/start` fires when the day's island becomes interactive, after any tutorial.

**A6. Leaderboard score can overflow its own encoding. [will do]**
`pieces x 10,000,000 + timeMs` breaks past 2 h 46 min. Clamp `timeMs` to 9,999,999.

**A7. Sunday on day 1.** Day 1 is launch day, so weekday templates must key off the real UTC
weekday of each day number, not `day % 7`. [will do]

**A8. Prism wording.** "Turns left / right relative to travel" is unambiguous in the engine but easy
to get mirrored in the renderer when the camera rotates. One fixture per incoming direction pins it. [will do]

**A9. Tap cycle length.** With prisms allowed the cycle is / → \ → prism → clear, so removing a
mistaken mirror costs three taps and makes the beams flash through two wrong states.
[decide before M3] *Proposal:* keep the cycle (it needs no extra UI and suits tap-only), but Undo is
always one tap, and the cycle animates fast enough (config) that passing through states does not
play lantern chimes. If playtests still show friction, a two-item piece tray is the fallback; I will
design it in M3 so it is a config switch, not a new feature.

### 4.2 Things SPEC assumes that Devvit does not allow or does differently

**D1. Redis has no lists and no plain sets. [will do]**
Devvit Redis supports strings, hashes, sorted sets, numbers, bitfields and transactions only.
`sky:{day}` becomes a sorted set scored by timestamp (trim with `zRemRangeByRank`). No pipelining
either, so `/api/today` reads are grouped into hashes and `mGet` to stay at a handful of round trips.

**D2. Score comments have a required pattern. [will do]**
Devvit's user-action rules require score comments to be posted (a) after an explicit tap, (b) from
the user's account, and (c) **as a reply to a single stickied comment**. So each daily post gets one
stickied app comment ("Tonight's results"), and Share replies under it. A free top-level comment is
only allowed when the player adds their own message; v1 does not offer that.

**D3. `runAs: 'USER'` only works for the app owner until the app version is approved. [decide by Nov 16]**
In playtest, a second account's Share comment and Builder post will come from the app account.
The M5 two-phone test cannot fully prove this, and judges will see app-account comments unless an
approved version is live. *Proposal:* submit the app for review right after the freeze (Nov 17–18),
not Nov 24–30. Reviews take 1–2 business days and may bounce.

**D4. Journeys need allowlisting, and receipts tell us the state. [will do]**
Every Journey call returns a receipt (`JOURNEY_RECEIPT_DENIED_NOT_ALLOWLISTED` until approved).
The journey map goes to Reddit in M1, not week two. M1's spike logs the receipt. The journey ID
lives in `sessionStorage`, and the inline preview and the expanded game may be different browsing
contexts, so the spike also checks where `Journey.Start` has to fire.

**D5. Snoovatars and CSP. [M1 spike]**
The client can only load from its own webview origin, and the docs say apps can only display media
hosted on Reddit. Candidates, in order: (1) `<img>` straight from the Reddit-hosted snoovatar URL;
(2) server fetch → data URL via `/api/avatar`, which needs the image domain allow-listed under
`permissions.http`; (3) server `media.upload()` to get a Reddit-hosted asset. Fallback is the
generated glyph. For WebGL the image must also be CORS-clean to be used as a texture; if it is
not, the lantern carries the snoovatar as an HTML overlay sprite projected from the 3D position.

**D6. Logged-out players. [will do]**
A large share of traffic, and possibly a judge, is logged out (`context.userId` absent). They get
the full puzzle and nightfall, unranked, with an anonymous lantern. `showLoginPrompt()` is offered
only at moments where login unlocks something they just reached for (streak, sky lantern with their
snoovatar, share). No login wall.

**D7. Inline preview must not wait on the network. [will do]**
The 1-second, Lighthouse > 80 bar is an approval requirement. The daily post's `postData`
(2 KB limit) will carry the day number, name, par, lantern count and a compact silhouette, so the
card paints from data already in the page. Personal state and the sky count arrive after and fade in.
No Three.js, no web font blocking first paint (font swaps in), all CSS inlined.

**D8. Expanded mode needs a synchronous trusted click.** `requestExpandedMode(event, 'game')` must
be called directly in the click handler, never after an `await`. Same for moving between entries
(game → archipelago → builder). [will do]

**D9. Unpublished apps get 100 MB of Redis, not 5 GB.** Fine for us (90 puzzles ≈ 150 KB), but
TTLs stay as specified and the builder caps islands per user per week. [will do]

**D10. Scheduler: 10 recurring jobs per installation; cron jobs in `devvit.json` are re-registered
on install and upgrade.** The daily-post handler must be idempotent (`post:day:{n}` set with NX
before submitting) so an upgrade at 23:59 cannot double-post. [will do]

**D11. Push notifications are a gated beta** aimed at established games. Not in scope; SPEC does not
ask for them. Mentioned so nobody adds them later.

**D12. Template differences from SPEC.** The template ships Node's built-in test runner, expects
Node 24 and has no Vitest. Verified: build, typecheck and lint pass on Node 22.18. M1 adds Vitest
(and `@devvit/test` for server routes) and the template's `splash.html` becomes `preview.html`.

### 4.3 Weak for winning

**W1. "Mirrors and lasers" is a known genre, and the judges say common ideas score lower. [decide before M3]**
The rules penalise "clone apps of popular games" and anything "seen many times before".
Light-routing puzzles are decades old. Lumen's defence is that nothing about it reads as a laser
game: paper lanterns, dusk, no lasers, no sci-fi, and the payoff is a shared sky. That defence only
holds if the first five seconds show lanterns and an island, not a grid with beams. So:
- The preview card and the first frame of the video lead with the island and the sky, never the grid.
- Vocabulary everywhere is light, lanterns, dusk. Never "laser", "beam puzzle", "level".
- The text description opens with the shared sky, not the mechanic.

**W2. The signature moment needs other people, and judges may arrive at an empty sky. [will do]**
A sky with three lanterns reads as a dead game. Real history comes from the Nov 24+ daily posts, but
it will be thin. The sky therefore always shows *something true*: lanterns from earlier days drift at
the horizon as dimmer "older nights", clearly labelled, so the sky has depth on a quiet day without
faking today's count. No invented players, ever.

**W3. The result card buries the best Reddit-y feature.** "See how everyone solved it" is one of
three buttons. *Proposal:* the heatmap line ("18% hit par · most-used tile shown") is on the result
card itself as a small live thumbnail, and the button expands it. [will do in M5/M7]

**W4. Nine sessions in five days with seven community features is the main risk to everything.**
From the retrospectives: Budget Treaty was not submitted because polish and evidence came before a
recorded core demo. So:
- **Cut line (as decided Nov 12, see section 7):** first the Island Builder, with Sunday falling
  back to a generated puzzle; then biomes 5 → 3. The Shared Night Sky is never cut, the
  Archipelago becomes a 2D map before it is ever cut, and trailer mode stays.
- **A rough recorded demo exists by Saturday night (end of M5)**, captured from the phone, kept as
  the insurance submission. Trailer mode improves it later; it does not gate it.
- **A Devpost draft is created this week** with the description stub, so submission is never a
  from-scratch task in December.
- The M8 "stranger test": a fresh, logged-out browser profile with only the demo post link.

**W5. The solver target may not hold.** Par 7 on a 9x9 with prisms is a large search even with
beam-path pruning. If the 2-second target fails, the generator keeps Saturday at par ≤ 6 with a
tighter board rather than shipping a slow solver; the Island Builder runs the solver on the server
with a time cap and refuses to publish on timeout. Decided in M1 with measured numbers.

**W6. Everyone eventually finds par, so the leaderboard becomes a speed race.** Accepted for v1, but
the *displayed* headline stays the medal and the crowd stat, not rank. Time under a plausibility
floor (`config.minPlausibleMs`) is recorded but shown without a rank, to blunt solver-assisted runs.

**W7. Sound and font licensing.** The rules require rights to every asset. All sound is synthesised
with WebAudio (no samples, zero bytes of audio). The display font must be OFL-licensed and its
licence file committed next to it.

### 4.4 Dev subreddit

Maulik chose `r/LumenGame` for playtesting rather than a `_dev` subreddit. Consequence: playtest
builds, template posts and test data land in the subreddit judges will see. Before the Nov 24
public launch: delete test posts, flush test Redis keys (a mod menu action "Reset test data",
built in M5, removed in M9), and confirm the installed version is the approved one.

## 5. What "done" looks like

- A stranger on a phone, logged out, with only the post link, lights the lanterns and sees nightfall
  inside 90 seconds without reading anything.
- Every SPEC acceptance test passes, with the amendments in section 4.
- Every number that could want tuning is in `src/shared/config.ts` with a comment, and every risky
  design choice has a config flag.
- `HANDOFF.md` lets Opus 5.5 run the tools, tune, and submit without asking what something means.

## 6. How I work on this

- Read the SPEC section for the milestone and the matching PLAN.md entry. Nothing else.
- Engine first, pure and tested; renderer and server import it, never the other way round.
- Each milestone ends with: tests green, a phone demo Maulik can check, a judge pass against the
  anti-slop checklist with the top three issues fixed, a commit.
- Report honestly. If an exit criterion is not met, say which and why.
- Push back when a request crowds out something in section 3.

## 7. Decisions

**Nov 12, Maulik (first pass):** section 4 approved, except anything that cuts, delays or downgrades
the signature features, snoovatars, streak lantern styles, flair, Journeys, the opt-in share
comment, the Fable rule, the 3D art direction or the performance budget. Those need an explicit OK.

**Nov 12, Maulik (second pass), all now decided:**

| # | Decision |
| --- | --- |
| W4 | Cut order if Monday runs out: (1) Island Builder, with Sunday falling back to a generated puzzle; (2) biomes 5 → 3. **Never cut the Shared Night Sky.** The Archipelago is simplified to a 2D map before it is ever cut. Trailer mode stays. |
| W5 | Saturday par is at most 6. The Island Builder refuses to publish when the solver check times out, with a friendly message: "Too complex to verify. Try removing a piece." |
| D2 | The app posts one stickied "Lumen #N results" comment when the daily post is created. Shares are replies under it. |
| D3 | Submit the app for review Nov 17–18. |
| D5 | Fallback only. Result card and leaderboard may use an HTML overlay for the snoovatar. In the 3D sky a texture is preferred; if that is impossible, other players' lanterns carry glyphs and only the player's own lantern gets an overlay. |
| A1 | **Final (Nov 12, third pass).** When every lantern is lit nothing locks. A soft glow and "All lit · N pieces (par P)" appear with two buttons: **Lock in** and **Keep refining**. Lock in is the single ranked submission and triggers nightfall and the lantern release. The timer runs until Lock in. Players may keep removing pieces and re-lighting before they lock. Copy lives in `config.ts` (`COPY`); `RULES.autoLockInOnSolve` keeps SPEC's original behaviour available. |

**Also decided Nov 12 (third pass):**

- `JOURNEY_MAP.md` is drafted now and goes in with the app review on Nov 17–18.
- An Android phone arrives before Milestone 4. Until then, also test in desktop Chrome with
  4x CPU slowdown.
- Reduced motion is a first-class path: the calm nightfall and release must be as beautiful as
  the full version.

**Nov 13, Maulik:** Monday changes to two suns and two lanterns at par 2–3 (one sun with mirrors
only can light a single lantern, which makes a thin nightfall on the most-played day). Tuesday's
new idea becomes the fixed mirror. Launch date stays Nov 24, 2026.

**Solver (Maulik, Nov 12):** do not optimise now. In Milestone 2 measure on real generator output.
Bar for the end of M2: every generated day solves in under 2 s, and the Island Builder's server
check runs on a budget under 10 s.

**Prisms (Maulik, Nov 12):** a prism can turn light as well as split it (its red and blue parts
leave sideways, and a white lantern accepts them). The rule stays. The generator treats prisms as
scarce, and `difficulty.ts` counts "prism used as a turn" as its own factor.

**Solver numbers (Nov 12, `npm run bench`, 240 random open islands, the hard case):**
par 1–3: under 10 ms. Par 4: median 23 ms, worst 0.16 s. Par 5: median 0.27 s, worst 1.3 s.
Par 6: 2 islands, one took 9 s. Par 7 did not occur in the sample.

## Sources

- Official page and rules: redditgameofday2026.devpost.com and /rules (read Nov 12, 2026).
- Devvit docs (developers.reddit.com/docs): view modes and entry points, launch screen
  customization, realtime, user actions, Redis, scheduler, Journeys and Journeys receipts,
  logged-out players, adding streaks, media uploads, Devvit Web overview and configuration.
