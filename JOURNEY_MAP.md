# Lumen — Journey map

For Reddit's review of Devvit Journeys instrumentation. App: `lumen-game`. Draft of Nov 12, 2026;
the final version goes in with the app review on Nov 17–18.

## The game in two lines

Lumen is a daily puzzle. Each day's post holds one small island: the player places mirrors and
prisms so that light reaches every paper lantern, using as few pieces as possible, then locks in
their answer. One ranked attempt per player per day; once locked in, today's island is finished.
Past islands can be played for practice, unranked.

## What one journey is

**One journey = one attempt at one island**, from the moment the player starts playing that island
to the moment they lock in their answer or leave.

| | |
| --- | --- |
| Start condition | The island is on screen and interactive, after the player tapped the play button in the post (and after the first-visit tutorial, if shown) |
| End: completed | The player taps **Lock in** with every lantern lit. The server has re-checked the solution |
| End: abandoned | The player closes the expanded view or the page is hidden before locking in |
| Typical length | 2 to 4 minutes |
| Per player per day | One ranked journey. Past islands (and signed-out play) are separate, unranked journeys |

There is no failure state in Lumen. A journey is either completed or abandoned.

## Events

| Event | Fires when | Fields sent |
| --- | --- | --- |
| `App.Ready` | The expanded game view has loaded and the island accepts taps. Once per load | none |
| `Journey.Start` | The player's first tap on the island for this attempt. Not on app load, not in the feed preview | none |
| `Journey.Progress` | The number of lit lanterns reaches a new high for this attempt | `progress` = lit lanterns ÷ total lanterns (0.0–1.0); `action` = `lantern_lit` |
| `Journey.Progress` | Every lantern is lit for the first time in this attempt (the "all lit" prompt appears) | `progress` = 1.0; `action` = `all_lit` |
| `Journey.Interaction` | The player releases a tap on Undo | `action` = `undo` |
| `Journey.Interaction` | The player releases a tap on Reset | `action` = `reset` |
| `Journey.Interaction` | The player releases a tap on Rotate camera | `action` = `rotate` |
| `Journey.Interaction` | The player chooses Keep refining at the "all lit" prompt | `action` = `keep_refining` |
| `Journey.Interaction` | The player skips the tutorial | `action` = `tutorial_skip` |
| `Journey.End` (completed) | The server accepts a Lock in | `complete` = true; `game.win` = true; `game.score` = pieces used (lower is better) |
| `Journey.End` (abandoned) | The view is closed or hidden before Lock in | `complete` = false |

Notes on the fields:

- `progress` only ever rises within a journey. Removing a piece does not send a lower value.
- `actionDetails` is used for one thing: the kind of attempt, as one of three fixed words,
  `ranked`, `replay` or `archive`. It is never free text.
- `game.score` is the count of pieces the player placed, an integer from 0 to about 10. Par for
  the day is not sent; it is the same for every player and is in the post itself.
- Interactions fire on tap release, never on press, and never repeat while a finger is held.

## A typical journey

| Step | Player does | Event |
| --- | --- | --- |
| 1 | Taps "Light the lanterns" in the feed post; the island loads | `App.Ready` |
| 2 | Taps a tile to place the first mirror | `Journey.Start` |
| 3 | First lantern lights | `Journey.Progress` 0.25, `lantern_lit` |
| 4 | Taps Undo once | `Journey.Interaction` `undo` |
| 5 | Third lantern lights (two at once) | `Journey.Progress` 0.75, `lantern_lit` |
| 6 | Last lantern lights; "All lit · 5 pieces (par 4)" appears | `Journey.Progress` 1.0, `all_lit` |
| 7 | Taps Keep refining, removes a piece, relights | `Journey.Interaction` `keep_refining` |
| 8 | Taps Lock in; server verifies; night falls | `Journey.End` complete, win, score 4 |

An abandoned journey is steps 1 to 4 followed by the player closing the view:
`Journey.End` with `complete` = false.

## How it is implemented

- Client events use the telemetry client from `@devvit/analytics/client/reddit`. Its requests go
  to five small server routes (`src/server/routes/journey.ts`) that pass them to
  `@devvit/analytics/server/reddit` and refuse any `action` or `actionDetails` that is not one of
  the fixed words in this document.
- The completed `Journey.End` is sent from the server inside the same request that verifies the
  solution (`/api/lock-in`), so a client cannot report a win the server did not check. The
  client's own end route accepts only an abandoned end.
- The mapping from play to events is a pure function (`src/shared/journey.ts`) tested against
  the "typical journey" table above.
- The journey ID is created by `startJourney()` and managed by the SDK. It is not stored in our
  database and not joined to anything.
- All events fire in the expanded game view. The inline feed preview sends nothing.
- `devvit.json` declares `"permissions": { "journeys": true }`.

## Privacy

- No personal data in any field. No usernames, user IDs, avatars, free text, device details,
  locations or timestamps are sent by the app; Reddit adds its own standard context server-side.
- `action` and `actionDetails` only ever hold the fixed words listed in this document.
- The only number about the player is `game.score`, a piece count.
- Logged-out players generate the same events with the same fields.

## What we will read from it

- Start rate: `App.Ready` → `Journey.Start`. Does the first screen invite a tap?
- Completion rate: `Journey.Start` → `Journey.End` complete, by weekday. Is the difficulty ramp fair?
- Where people stop: the highest `progress` reached in abandoned journeys.
- Friction: `undo` and `reset` counts per journey; how often players choose Keep refining.
