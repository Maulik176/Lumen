# Proposed Journeys events for the Island Builder (a note only)

`JOURNEY_MAP.md` is not changed: the Builder and community islands send **no** Journeys events
today (the 3D test and community posts use `quietJourney()`). Reddit records no journeys for a
playtest build anyway. If Lumen is published after the hackathon, these could be added to the
journey map and sent for approval:

| Event | When | Fields (no personal data) |
| --- | --- | --- |
| `builder_open` | The Builder opens | where from: `result_card`, `map`, `page` |
| `builder_check` | A check answers | outcome: `ok` or the refusal code; board size |
| `builder_test_lit` | The maker lights their island in the test | pieces, par |
| `builder_publish` | A publish succeeds | par, difficulty label |
| Play journey kind `community` | Playing a community island's post | as the daily `ranked` journey: start, `lantern_lit`, `all_lit`, end |
