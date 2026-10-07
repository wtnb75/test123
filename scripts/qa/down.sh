#!/usr/bin/env bash
# Clean up after a QA run: remove the Playwright container and stop the dev server started by up.sh.
# Run it even when QA failed (AGENTS.md section 9).
#
# Usage: scripts/qa/down.sh <game-dir> [port]   (port defaults to the one recorded by up.sh, else 5191)
set -euo pipefail

GAME="${1:?usage: down.sh <game-dir> [port]}"
ENV_FILE="/tmp/qa-${GAME}.env"
PORT="${2:-}"
CONTAINER="${GAME}-qa"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi
PORT="${PORT:-5191}"

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

# npm and vite are both started with the port on the command line
pkill -f "npm run dev --port ${PORT}" 2>/dev/null || true
pkill -f "vite.js --config vite/config.dev.mjs --port ${PORT}" 2>/dev/null || true
sleep 1

if pgrep -f "vite.js --config vite/config.dev.mjs --port ${PORT}" >/dev/null 2>&1; then
  echo "dev server on port ${PORT} is still running" >&2
  exit 1
fi
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "container ${CONTAINER} is still there" >&2
  exit 1
fi
echo "cleaned up: container ${CONTAINER} removed, dev server on port ${PORT} stopped"
