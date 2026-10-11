#!/usr/bin/env bash
# Run one Playwright script in the QA container started by up.sh, then copy its screenshots out.
#
# Usage: scripts/qa/run.sh <game-dir> <script.mjs> <out-dir> [extra files to copy next to the script...]
#
# The script imports helpers with `import { ... } from './lib.mjs'` (see scripts/qa/lib.mjs) and writes
# screenshots to /work/shots (lib's `shot`). Extra files (e.g. a JSON with answer positions) land in /work.
# /work/shots is emptied first, so each run only returns its own screenshots.
set -euo pipefail
# shellcheck source=scripts/qa/_state.sh
source "$(dirname "$0")/_state.sh"

GAME="${1:?usage: run.sh <game-dir> <script.mjs> <out-dir> [extra files...]}"
SCRIPT="${2:?script.mjs missing}"
OUT="${3:?out-dir missing}"
shift 3

qa_check_game "$GAME"
ENV_FILE="$(qa_state_dir)/${GAME}.env"
[ -f "$ENV_FILE" ] || { echo "run scripts/qa/up.sh ${GAME} first" >&2; exit 1; }
qa_load_env "$ENV_FILE" || { echo "run scripts/qa/up.sh ${GAME} again" >&2; exit 1; }

docker exec "$CONTAINER" bash -c 'rm -rf /work/shots && mkdir -p /work/shots'
docker cp "$SCRIPT" "${CONTAINER}:/work/$(basename "$SCRIPT")"
for f in "$@"; do docker cp "$f" "${CONTAINER}:/work/$(basename "$f")"; done

status=0
docker exec -w /work -e "QA_BASE_URL=${BASE_URL}" "$CONTAINER" node "$(basename "$SCRIPT")" || status=$?

mkdir -p "$OUT"
docker cp "${CONTAINER}:/work/shots/." "$OUT/"
echo "screenshots: $OUT ($(ls "$OUT" | wc -l) files)"
exit "$status"
