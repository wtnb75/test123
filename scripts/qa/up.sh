#!/usr/bin/env bash
# Start what a browser QA run needs (AGENTS.md section 9):
#   1. a server for <game-dir> listening on 0.0.0.0:<port>:
#        default   the Vite dev server (fast, hot reload)
#        --shared  the published shape: the game built with SHARED_VENDOR=1 (Phaser left out, loaded through an
#                  import map from ../vendor/), laid out like output/ (<repo>/<game>/ and <repo>/vendor/) and served
#                  under the repo sub-path, the way GitHub Pages serves it. dist-shared/ alone does not run.
#   2. a Playwright container on THIS session's Docker network (not --network host)
#   3. playwright installed in the container, plus scripts/qa/lib.mjs copied to /work
#
# Usage: scripts/qa/up.sh <game-dir> [port=5191] [--shared]
# Env:   PLAYWRIGHT_TAG (default v1.56.0-noble)
#
# Writes /tmp/qa-<game-dir>.env (BASE_URL, CONTAINER, PORT) for run.sh / down.sh.
# Clean up with scripts/qa/down.sh <game-dir> [port].
set -euo pipefail

SHARED=0
ARGS=()
for a in "$@"; do
  if [ "$a" = "--shared" ]; then SHARED=1; else ARGS+=("$a"); fi
done
GAME="${ARGS[0]:?usage: up.sh <game-dir> [port] [--shared]}"
PORT="${ARGS[1]:-5191}"
TAG="${PLAYWRIGHT_TAG:-v1.56.0-noble}"
PW_VERSION="${TAG#v}"
PW_VERSION="${PW_VERSION%%-*}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${GAME}-qa"
ENV_FILE="/tmp/qa-${GAME}.env"
LOG="/tmp/qa-${GAME}-server.log"

[ -d "$ROOT/$GAME" ] || { echo "no such game directory: $GAME" >&2; exit 1; }

# This session's own network name and IP (a QA container must join the same network to reach the server).
NET_LINE="$(docker inspect "$(hostname)" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{$v.IPAddress}}{{"\n"}}{{end}}' | head -n 1)"
NET="${NET_LINE%% *}"
IP="${NET_LINE##* }"
[ -n "$NET" ] && [ -n "$IP" ] || { echo "could not find this session's Docker network" >&2; exit 1; }

BASE_URL="http://${IP}:${PORT}"
answers() { curl -s -o /dev/null --max-time 2 "$1"; }

if [ "$SHARED" = 1 ]; then
  # Same layout as `task build`'s output/: <site>/<repo>/<game>/ next to <site>/<repo>/vendor/, served under /<repo>/.
  REPO="$(basename "$(git -C "$ROOT" remote get-url origin 2>/dev/null || echo site)" .git)"
  SITE="$(mktemp -d "/tmp/qa-site-${GAME}-XXXXXX")"
  (cd "$ROOT/$GAME" && SHARED_VENDOR=1 npm run build >"$LOG" 2>&1) || { echo "shared build failed; see $LOG" >&2; exit 1; }
  mkdir -p "$SITE/$REPO/$GAME"
  rsync -a "$ROOT/$GAME/dist-shared/" "$SITE/$REPO/$GAME/"
  node "$ROOT/scripts/vendor-phaser.mjs" "$SITE/$REPO/vendor" "$ROOT/$GAME"
  BASE_URL="http://${IP}:${PORT}/${REPO}/${GAME}/"
  if answers "$BASE_URL"; then
    echo "something already answers on port ${PORT}; run down.sh first" >&2
    exit 1
  fi
  (cd "$SITE" && exec nohup python3 -m http.server "$PORT" --bind 0.0.0.0 >"$LOG" 2>&1 </dev/null) &
else
  if answers "$BASE_URL/"; then
    echo "dev server already answers on port ${PORT}"
  else
    # exec + redirects: the backgrounded subshell must not keep this script's stdout (a pipe) open
    (cd "$ROOT/$GAME" && exec nohup npm run dev -- --port "$PORT" --host 0.0.0.0 >"$LOG" 2>&1 </dev/null) &
  fi
fi
for _ in $(seq 1 30); do
  answers "$BASE_URL" && break
  sleep 1
done
answers "$BASE_URL" || { echo "server did not start; see $LOG" >&2; exit 1; }

# Playwright container (docker pulls the image the first time)
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --network "$NET" "mcr.microsoft.com/playwright:${TAG}" sleep infinity >/dev/null
docker exec "$CONTAINER" bash -c "mkdir -p /work && cd /work && npm init -y >/dev/null && npm install playwright@${PW_VERSION} 2>&1 | tail -n 1"
docker cp "$ROOT/scripts/qa/lib.mjs" "${CONTAINER}:/work/lib.mjs"

cat >"$ENV_FILE" <<EOF
BASE_URL=${BASE_URL}
CONTAINER=${CONTAINER}
PORT=${PORT}
EOF

MODE="dev server"
[ "$SHARED" = 1 ] && MODE="shared build (served under the repo sub-path)"
echo "ready: ${MODE}  BASE_URL=${BASE_URL} container=${CONTAINER} (container UTC date: $(docker exec "$CONTAINER" date -u +%Y%m%d))"
echo "next:  scripts/qa/run.sh ${GAME} <script.mjs> <out-dir> [extra files...]"
