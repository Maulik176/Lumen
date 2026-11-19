# Launching Lumen on r/lumen_game_dev

**r/lumen_game_dev is Lumen's playtest subreddit and its judging subreddit** (public, approved).
There is no second subreddit. From the official hackathon page: "PLEASE DO NOT SUBMIT YOUR APP
FOR PUBLISHING. Your app does not need to be published to qualify ... you should be uploading
and playtesting your app, not publishing it."

## Rules to respect

- **Never `devvit publish`** before the hackathon ends, and no app review. There is no
  `npm run launch` any more. Builds reach the subreddit through `devvit playtest`, which uploads
  a version and installs it on r/lumen_game_dev; that version stays installed after the watcher
  stops.
- **After launch every upload is live** for players and judges. Use only `npm run release`
  (section 3). A playtest watcher left running would upload every saved file.
- **Judges need an accessible demo post:** keep the subreddit public, and test the post signed
  out and from an account that is not a moderator.
- **Content:** Lumen is a game post; the community is Gaming, not NSFW.
- **What a playtest build does differently** (posting as the player, Journeys): section 8, and
  the note for judges in `docs/SUBMISSION.md`.

## 1. The subreddit (done)

r/lumen_game_dev already has the icon (`content/brand/png/subreddit-icon-512.png`) and banners
(`subreddit-banner-desktop-2144x256.png`, `subreddit-banner-mobile-2160x256.png`).
`node content/brand/build.mjs` renders other sizes if Reddit asks. Before launch, paste the
description, rules, sidebar and the two pinned posts below (sections 4 to 7), if not done yet.

**Community description** (under 500 characters):

```
A new island every night. Place mirrors, bend the light into every lantern, and send your own lantern up into a sky shared with everyone who lit tonight's island. One daily light puzzle, a new post at 00:00 UTC, Monday gentle to Saturday hard. Tap "Light the lanterns" on today's post to play: no install, works signed out.
```

## 2. Launch day (Lumen #1 is Tue Nov 24, 2026)

Do these in order, in one sitting, after the last tested build is committed. **Launch happens at
step 5:** before Nov 24 "today" counts as day 1, so the upload's own install step posts Lumen #1
at once and it is rankable straight away. It stays tonight's island until 00:00 UTC on Nov 25.

1. **Final clean-up** (mod menu on r/lumen_game_dev): "Dev: clean up this subreddit". It deletes
   every post the app made there and resets every day's board, sky, counts and stored pieces, and
   your own progress. Other testers' streaks and medals are not reset (the menu can reset only
   the moderator who taps it), so a tester's numbers may look odd at first. Cannot be undone.
2. **Real time:** "Dev: set today to day N" → **0**. The form then says "Today is day 1".
3. **Flip the switch:** in `src/shared/config.ts` set `LAUNCH.launched` to `true`, then commit
   ("Launch: dev tools off"). From the next upload on, the dev tools that wipe data, post test
   islands or move the clock refuse on r/lumen_game_dev ("Dev tools are off: Lumen has
   launched."), the clock ignores any stored shift, and `npm run dev` refuses to start a
   playtest watcher. Still there: "Post today's Lumen", "Play the Lumen trailer (once)" and
   "Dev: preview lantern styles" (it changes only your own view).
4. **No watcher running:** `pgrep -fl "devvit playtest|dev-build"` prints nothing (if it does,
   `pkill -f "devvit playtest"; pkill -f dev-build`). Then `npx devvit login` if it has been a
   few hours (a 401 means the login expired).
5. **Upload the final build:** `npm run release` (section 3). It checks everything, asks you to
   type `upload`, uploads once, stops the watcher, and tags the commit `release-v0.0.1.N`.
6. **Lumen #1 appears** within a minute (if not, mod menu "Post today's Lumen"). Pin "How to
   play Lumen" and "Feedback, bugs and ideas" (sections 6 and 7). The results comment pins itself.
7. **Phone check** (section 9), then share the subreddit link.

## 3. Release routine (after launch: every upload is live)

1. **Test locally:** the change has a test (a bug fix starts with a failing one); `npm run debug`
   and look at it at 430x701 and 360x460; `npm test`, `npm run test:types`, `npm run lint`,
   `npm run build` (the release runs these again).
2. **Commit** (the release refuses uncommitted work, so what is live is always a commit).
3. **Deliberate upload:** `npm run release`. It refuses if a playtest watcher is running, runs
   every check, asks you to type `upload`, uploads once through `devvit playtest`, stops the
   watcher, and tags the commit `release-<version>` (`git tag -l "release-*"` lists what has
   been live). Claude runs it only after you say to release, as `npm run release -- --yes`.
4. **Quick phone check** (two minutes, section 9). Something wrong: release the previous tag
   (`git checkout release-<previous>`, `npm run release`, then back to `main`).

Avoid changes to `GENERATOR`, `DIFFICULTY` or `CALENDAR` after launch: they change islands
players may already have seen.

## 4. Rules (Mod Tools → Rules; paste each title and description)

1. **Be kind.** — Talk about islands, not people. No insults, no harassment.
2. **No spoilers outside the results thread.** — Each post has a pinned results comment. Share
   your result there with the Share button; don't post today's answer anywhere else before the
   next island arrives.
3. **One account each.** — Boards and streaks are for people, not alt accounts or scripts.
4. **Feedback is welcome.** — Bugs, ideas and "this was too hard" go in the pinned feedback
   thread.
5. **No self-promotion or spam.** — Posts and comments unrelated to Lumen will be removed.

## 5. Sidebar text (Mod Tools → Community appearance or the "About" widget)

```
How to play
• Tap grass to place a mirror; tap it again to turn it; a third tap makes a prism.
• Light every lantern, using as few pieces as you can. Par is the fewest possible.
• Coloured lanterns need their own colour; two-colour lanterns need both.
• Lock in when you're happy: one result per night.

Lamplighter = par · Glow = one over · Spark = more
A new island every night at 00:00 UTC.
```

## 6. Pinned post: "How to play Lumen" (text post, then Pin it)

**Title:** How to play Lumen

```
Every night at 00:00 UTC a new island appears here. Your job: get light from the suns into every paper lantern.

**Playing**
- Tap "Light the lanterns" on today's post.
- Tap a grass tile to place a mirror. Tap it again to turn it. A third tap makes a prism, which splits white light into red, green and blue (it can turn light too).
- Coloured lanterns need light of their colour; a two-colour lantern needs both at once. Each colour also has a shape (triangle, circle, square), so you never need to tell colours apart.
- Stone mirrors are fixed. Light crosses water, but nothing stands on it.

**Locking in**
When every lantern is lit you can Lock in, or keep refining to use fewer pieces. Par is the fewest pieces that can do it. You get one result per night:
- Lamplighter: at par
- Glow: one over
- Spark: more

**After you lock in**
Night falls and your lantern rises into a sky shared with everyone who lit the same island. Tap a lantern to see whose it is. Then see tonight's board, look at how the top players lit their islands, or share your result in the pinned results comment.

**Streaks**
Play on consecutive nights to build a streak (you get one day's grace). Streaks unlock lantern styles at 3, 7, 14 and 30 nights, and a flair with your medal.

**Past islands**
"Explore past islands" opens a night map of every earlier island. Play any of them for practice.

The week runs from a gentle Monday to a demanding Saturday. New here on a hard day? The game will offer an easier island to warm up on.
```

## 7. Feedback thread (text post, then Pin it as the second pin)

**Title:** Feedback, bugs and ideas

```
Thanks for playing Lumen. This thread is the place for anything that would make it better.

Helpful to include:
- Which island (the number in the post title, e.g. Lumen #5)
- Your device (iPhone, Android, desktop) and whether you use the Reddit app or a browser
- What you expected and what happened (a screenshot helps a lot)

Too hard or too easy? Say which weekday. Something looked broken? Tell us what was on screen.

Please keep answers to today's island out of this thread until the next one arrives.
```

## 8. What a playtest build does differently

Lumen is uploaded, never published, so two platform features behave as in any playtest build.
Both are handled; nothing is shown to players.

- **Posting as the player** (`runAs: 'USER'`): for anyone but the app's owner, Reddit posts from
  the app account (`lumen-game`). Every line Lumen writes therefore names the player itself:
  shared results start "u/{name} · Lumen #N", and community islands (Builder phase 2) will be
  titled "Island by u/{name} · {island}" and credit the maker in the game.
- **Journeys:** Reddit records no journeys for a playtest build. The first answer says so
  (`JOURNEY_RECEIPT_DENIED_PLAYTEST`); the game then stops sending for that page, without an
  error or a console message. The code and `JOURNEY_MAP.md` stay for a publish after the event.

## 9. Phone check (after every release, two minutes)

- Today's post in the Reddit app: the feed card paints at once, "Light the lanterns" opens the
  island, a tap places a mirror and the light moves.
- The change you released works.
- Once a week, and before sharing with judges: signed out, and with a second account that is not
  a moderator: card, tutorial, play, Lock in, See others' islands, Share; the pinned results
  comment updates within a minute.
- The app listing link for the submission: https://developers.reddit.com/apps/lumen-game
