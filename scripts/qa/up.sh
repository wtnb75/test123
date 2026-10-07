#!/usr/bin/env bash
# Start what a browser QA run needs (AGENTS.md section 9):
#   1. a dev server for <game-dir> listening on 0.0.0.0:<port>
#   2. a Playwright container on THIS session's Docker network (not --network host)
#   3. playwright installed in the container, plus scripts/qa/lib.mjs copied to /work
#
# Usage: scripts/qa/up.sh <game-dir> [port=5191]
# Env:   PLAYWRIGHT_TAG (default v1.56.0-noble)
#
# Writes /tmp/qa-<game-dir>.env (BASE_URL, CONTAINER, PORT) for run.sh / down.sh.
# Clean up with scripts/qa/down.sh <game-dir> [port].
set -euo pipefail

GAME="${1:?usage: up.sh <game-dir> [port]}"
PORT="${2:-5191}"
TAG="${PLAYWRIGHT_TAG:-v1.56.0-noble}"
PW_VERSION="${TAG#v}"
PW_VERSION="${PW_VERSION%%-*}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CONTAINER="${GAME}-qa"
ENV_FILE="/tmp/qa-${GAME}.env"
LOG="/tmp/qa-${GAME}-dev.log"

[ -d "$ROOT/$GAME" ] || { echo "no such game directory: $GAME" >&2; exit 1; }

# This session's own network name and IP (a QA container must join the same network to reach the dev server).
NET_LINE="$(docker inspect "$(hostname)" --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{$v.IPAddress}}{{"\n"}}{{end}}' | head -n 1)"
NET="${NET_LINE%% *}"
IP="${NET_LINE##* }"
[ -n "$NET" ] && [ -n "$IP" ] || { echo "could not find this session's Docker network" >&2; exit 1; }

# dev server (kept in the background; down.sh stops it)
if curl -s -o /dev/null --max-time 2 "http://${IP}:${PORT}/"; then
  echo "dev server already answers on port ${PORT}"
else
  # exec + redirects: the backgrounded subshell must not keep this script's stdout (a pipe) open
  (cd "$ROOT/$GAME" && exec nohup npm run dev -- --port "$PORT" --host 0.0.0.0 >"$LOG" 2>&1 </dev/null) &
  for _ in $(seq 1 30); do
    curl -s -o /dev/null --max-time 2 "http://${IP}:${PORT}/" && break
    sleep 1
  done
  curl -s -o /dev/null --max-time 2 "http://${IP}:${PORT}/" || { echo "dev server did not start; see $LOG" >&2; exit 1; }
fi

# Playwright container (docker pulls the image the first time)
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --network "$NET" "mcr.microsoft.com/playwright:${TAG}" sleep infinity >/dev/null
docker exec "$CONTAINER" bash -c "mkdir -p /work && cd /work && npm init -y >/dev/null && npm install playwright@${PW_VERSION} 2>&1 | tail -n 1"
docker cp "$ROOT/scripts/qa/lib.mjs" "${CONTAINER}:/work/lib.mjs"

cat >"$ENV_FILE" <<EOF
BASE_URL=http://${IP}:${PORT}
CONTAINER=${CONTAINER}
PORT=${PORT}
EOF

echo "ready: BASE_URL=http://${IP}:${PORT} container=${CONTAINER} (container UTC date: $(docker exec "$CONTAINER" date -u +%Y%m%d))"
echo "next:  scripts/qa/run.sh ${GAME} <script.mjs> <out-dir> [extra files...]"
