# Launching Lumen in its public subreddit

Replace `LumenGame` below with the name you got (LumenGame, LumenDaily or PlayLumen).

## Rules to respect

- **Hackathon:** the demo post must be in a **public** subreddit with **fewer than 200 members**
  (or one with the `dr-admin-approve` app installed). Keep it small until judging is over: don't
  advertise it widely yet.
- **Devvit:** until Reddit approves the app, it can only be installed by you on subreddits you
  moderate, and it runs as a test version there. (As far as I know, unapproved apps are also
  limited to small subreddits, which matches the rule above. Check what `devvit install` says.)
- **Content:** Lumen is a game post; mark the community as Gaming, not NSFW.

## 1. Create the community (you, in the Reddit app)

Create a community → name it → **Public** → topic **Gaming**. Then on the web
(new.reddit.com or reddit.com → Mod Tools):

**Icon and banner** (Mod Tools → Community appearance): upload
`content/brand/png/subreddit-icon-512.png` as the icon and
`content/brand/png/subreddit-banner-1920x384.png` as the banner. If Reddit asks for other sizes,
`node content/brand/build.mjs` can render them (edit the sizes at the bottom of that file).

**Community description** (paste, under 500 characters):

```
A new island every night. Place mirrors, bend the light into every lantern, and send your own lantern up into a sky shared with everyone who lit tonight's island. One daily light puzzle, a new post at 00:00 UTC, Monday gentle to Saturday hard. Tap "Light the lanterns" on today's post to play: no install, works signed out.
```

## 2. Install the app (in the terminal, in the project folder)

```bash
npx devvit login
```

```bash
npm run deploy
```

```bash
npx devvit install r/LumenGame lumen-game
```

Installing runs the app's install step, which **creates today's island post by itself**. If no
post appears within a minute, use the subreddit's mod menu → "Post today's Lumen".

The four "Dev:"/testing items will show in this subreddit's mod menu too, but they refuse to
run anywhere except r/lumen_game_dev. Don't use them here.

## 3. Rules (Mod Tools → Rules; paste each title and description)

1. **Be kind.** — Talk about islands, not people. No insults, no harassment.
2. **No spoilers outside the results thread.** — Each post has a pinned results comment. Share
   your result there with the Share button; don't post today's answer anywhere else before the
   next island arrives.
3. **One account each.** — Boards and streaks are for people, not alt accounts or scripts.
4. **Feedback is welcome.** — Bugs, ideas and "this was too hard" go in the pinned feedback
   thread.
5. **No self-promotion or spam.** — Posts and comments unrelated to Lumen will be removed.

## 4. Sidebar text (Mod Tools → Community appearance or the "About" widget)

```
How to play
• Tap grass to place a mirror; tap it again to turn it; a third tap makes a prism.
• Light every lantern, using as few pieces as you can. Par is the fewest possible.
• Coloured lanterns need their own colour; two-colour lanterns need both.
• Lock in when you're happy: one result per night.

Lamplighter = par · Glow = one over · Spark = more
A new island every night at 00:00 UTC.
```

## 5. Pinned post: "How to play Lumen" (text post, then Pin it)

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

## 6. Feedback thread (text post, then Pin it as the second pin)

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

## 7. Before you share the link with judges

- Open today's post signed out, and with a second account: card, tutorial, play, Lock in.
- Check the pinned results comment updates after a solve (within a minute).
- Note the subreddit's member count stays under 200 until judging is done.
- The app listing link for the submission: https://developers.reddit.com/apps/lumen-game
