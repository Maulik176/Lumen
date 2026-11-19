#!/bin/bash
# The one way to put a build in front of players once Lumen has launched (docs/LAUNCH.md,
# "Release routine"). It refuses uncommitted work and a running playtest watcher, runs every
# check, asks before uploading, uploads once through `devvit playtest` (which installs the build
# on r/lumen_game_dev), stops the watcher so later saves never go live, and tags the commit.
# Never `devvit publish`: the hackathon forbids it.
#
# Usage: npm run release            (asks you to type "upload")
#        npm run release -- --yes   (no question: for Claude, after Maulik said to release)
set -uo pipefail
cd "$(dirname "$0")/.."

stop_watchers() {
  pkill -f "devvit playtest" 2>/dev/null || true
  pkill -f "scripts/dev-build.ts" 2>/dev/null || true
}

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit first: a release is always a commit, so what is live can be found again."
  exit 1
fi
if pgrep -f "devvit playtest|scripts/dev-build.ts" >/dev/null; then
  echo "A playtest watcher is running. Stop it first (it uploads every save)."
  exit 1
fi

commit=$(git rev-parse --short HEAD)
echo "Checking $commit before release..."
npm test && npm run test:types && npm run lint && npm run build || {
  echo "Checks failed: nothing was uploaded."
  exit 1
}

if [ "${1:-}" != "--yes" ]; then
  read -r -p "Upload $commit to r/lumen_game_dev, live for players and judges? Type upload: " answer
  [ "$answer" = "upload" ] || { echo "Not uploaded."; exit 1; }
fi

log=$(mktemp -t lumen-release)
LUMEN_RELEASE=1 npm run dev >"$log" 2>&1 &
ready=no
for _ in $(seq 200); do
  if grep -q "Playtest ready" "$log"; then ready=yes; break; fi
  if grep -q "401\|not logged in" "$log"; then break; fi
  sleep 3
done
# Let the install settle, then stop the watcher before anything else can upload.
[ "$ready" = yes ] && sleep 10
stop_watchers
sleep 1
if pgrep -f "devvit playtest|scripts/dev-build.ts" >/dev/null; then
  echo "WARNING: a playtest watcher is still running. Stop it now: pkill -f 'devvit playtest'"
fi

if [ "$ready" != yes ]; then
  echo "The upload did not finish. Nothing new should be live; check the log: $log"
  tail -15 "$log"
  exit 1
fi

version=$(grep -o "Version: v[0-9.]*" "$log" | tail -1 | cut -d' ' -f2)
git tag "release-${version:-unknown}" "$commit" 2>/dev/null || true
echo
echo "Live: $version from commit $commit (tagged release-$version). Playtest watcher stopped."
echo "Now the quick phone check (docs/LAUNCH.md): open today's post in the Reddit app, the feed"
echo "card paints, the island opens, a tap places a piece, and the change you released works."
echo "Something wrong? Release the previous tag: git checkout release-<previous> && npm run release"
