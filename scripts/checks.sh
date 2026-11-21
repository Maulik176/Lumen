#!/bin/bash
# Every check that must pass before any upload (CLAUDE.md "Quality rules", Nov 20). Used by
# `npm run release`, which is the only way to upload, before launch and after.
#
#   1. npm run test:scale  the launch-scale nights (accounted-scale.test.ts: 10, 150 and 500
#                      players, every seat) and the busy-week tests of the pick and the map
#      npm test        every unit test, including the accounted suites
#   2. types, lint, build
#   3. the four-seat pass (scripts/seats.mjs) on the local stand-in, which runs the real game
#      code: the game opened as four players in headless Chrome, lists checked from the screen;
#      then the Sunday pass (scripts/sunday-pass.mjs): a week, the pick, Sunday from four seats.
#      Starts the stand-in if it is not running. Note: it empties the stand-in's store first.
#
# Usage: npm run checks
set -uo pipefail
cd "$(dirname "$0")/.."

# The launch-scale nights first (10, 150 and 500 players, every seat), by name: a release
# never goes out without them, even if the rest of the suite were to change.
npm run test:scale || {
  echo "Scale checks failed: a list or count loses someone on a busy night."
  exit 1
}
npm test && npm run test:types && npm run lint && npm run build || {
  echo "Checks failed: tests, types, lint or build."
  exit 1
}

started=""
if ! curl -s -o /dev/null --max-time 2 http://localhost:5199/debug.html; then
  log=$(mktemp -t lumen-standin)
  npx vite --config vite.debug.config.ts --no-open >"$log" 2>&1 &
  started=$!
  for _ in $(seq 60); do
    curl -s -o /dev/null --max-time 2 http://localhost:5199/debug.html && break
    sleep 1
  done
fi

node scripts/seats.mjs "captures/before-upload" 430x701
status=$?
# The Sunday pick's screens (Phase 3): a week, the pick, Sunday from four seats, the map.
if [ $status -eq 0 ]; then
  node scripts/sunday-pass.mjs "captures/before-upload-sunday" 430x701
  status=$?
fi
[ -n "$started" ] && kill "$started" 2>/dev/null

if [ $status -ne 0 ]; then
  echo "Four-seat or Sunday pass failed: a screen leaves someone out or says the wrong thing."
  exit 1
fi
echo "All checks passed."
