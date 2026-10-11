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
# Starts the dev server itself (bound to 127.0.0.1: the tunnel connects locally) with SHARE_TUNNEL=1, which is what makes
# scaffold/vite/config.dev.mjs accept *.trycloudflare.com Host headers. A dev server already answering on <port> is
# reused only if it accepts them too; otherwise stop it and run this again.
# Logs go to the private state directory (see scripts/qa/_state.sh), not to predictable world-writable /tmp paths.
# Prints the public URL on stdout as the last line; progress goes to stderr.
# Do not look the URL up in the first few seconds: a name resolved right after it is issued can keep failing for
# 40s+ on that resolver (checked: waiting ~8s first gave 200 every time).
set -euo pipefail
# shellcheck source=scripts/qa/_state.sh
source "$(dirname "$0")/_state.sh"

GAME="${1:?usage: share.sh <game-dir> [port]}"
PORT="${2:-5191}"
qa_check_game "$GAME"
case "$PORT" in "" | *[!0-9]*) echo "invalid port: $PORT" >&2; exit 1 ;; esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOCAL_URL="http://localhost:${PORT}"
answers() { curl -s -o /dev/null --max-time 2 "$1"; }
# 200 only when the dev server accepts a *.trycloudflare.com Host header (a blocked host gets 403)
accepts_tunnel_host() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 -H 'Host: probe.trycloudflare.com' "$LOCAL_URL/")" = 200 ]
}

STATE_DIR="$(qa_state_dir)"
SERVER_LOG="${STATE_DIR}/${GAME}-server.log"
TUNNEL_LOG="${STATE_DIR}/${GAME}-tunnel.log"

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
  accepts_tunnel_host || {
    echo "a dev server on port ${PORT} refuses *.trycloudflare.com hosts (it was not started by share.sh);" >&2
    echo "stop it, or run scripts/qa/down.sh ${GAME} ${PORT}, then run share.sh again" >&2
    exit 1
  }
  echo "dev server already answers on port ${PORT}" >&2
else
  # exec + redirects: the backgrounded subshell must not keep this script's stdout (a pipe) open
  (cd "$ROOT/$GAME" && SHARE_TUNNEL=1 exec nohup npm run dev -- --port "$PORT" --host 127.0.0.1 >"$SERVER_LOG" 2>&1 </dev/null) &
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
