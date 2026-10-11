#!/usr/bin/env bash
# Put a game's dev server on the internet through a Cloudflare Quick Tunnel, so it can be tried from another machine
# or a phone. Nothing is configured: cloudflared hands out a random https://<words>.trycloudflare.com URL every run.
#
# The dev server has no authentication. Anyone who learns the URL can load the game (and the source it serves), so
# share the URL only with whoever should see it and stop the tunnel when done: scripts/qa/down.sh <game-dir> [port].
#
# Usage: scripts/qa/share.sh <game-dir> [port=5191]
# Needs: cloudflared on PATH (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
#
# Reuses a dev server that already answers on <port> (e.g. one started by up.sh); otherwise starts one bound to
# 127.0.0.1 (the tunnel connects locally, so nothing else needs to reach it).
# Prints the public URL on stdout as the last line; progress goes to stderr.
set -euo pipefail

GAME="${1:?usage: share.sh <game-dir> [port]}"
PORT="${2:-5191}"

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SERVER_LOG="/tmp/share-${GAME}-server.log"
TUNNEL_LOG="/tmp/share-${GAME}-tunnel.log"
LOCAL_URL="http://localhost:${PORT}"
answers() { curl -s -o /dev/null --max-time 2 "$1"; }

[ -d "$ROOT/$GAME" ] || { echo "no such game directory: $GAME" >&2; exit 1; }
command -v cloudflared >/dev/null 2>&1 || {
  echo "cloudflared is not installed; see the download page in the header of this script" >&2
  exit 1
}
if pgrep -f "cloudflared tunnel .*--url ${LOCAL_URL}" >/dev/null 2>&1; then
  echo "a tunnel for port ${PORT} is already running; run down.sh first (its URL is in ${TUNNEL_LOG})" >&2
  exit 1
fi

if answers "$LOCAL_URL/"; then
  echo "dev server already answers on port ${PORT}" >&2
else
  # exec + redirects: the backgrounded subshell must not keep this script's stdout (a pipe) open
  (cd "$ROOT/$GAME" && exec nohup npm run dev -- --port "$PORT" --host 127.0.0.1 >"$SERVER_LOG" 2>&1 </dev/null) &
  for _ in $(seq 1 30); do
    answers "$LOCAL_URL/" && break
    sleep 1
  done
  answers "$LOCAL_URL/" || { echo "dev server did not start; see $SERVER_LOG" >&2; exit 1; }
fi

: >"$TUNNEL_LOG"
(exec nohup cloudflared tunnel --no-autoupdate --url "$LOCAL_URL" >"$TUNNEL_LOG" 2>&1 </dev/null) &

URL=""
for _ in $(seq 1 30); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -n 1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
[ -n "$URL" ] || { echo "no tunnel URL after 30s; see $TUNNEL_LOG" >&2; exit 1; }

echo "public: the dev server has no authentication; stop it with scripts/qa/down.sh ${GAME} ${PORT}" >&2
echo "$URL"
