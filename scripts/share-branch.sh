#!/usr/bin/env bash
# Share the game changed on a remote branch through a Cloudflare Quick Tunnel, without touching the current checkout.
#
# Usage: scripts/share-branch.sh [branch]
# Env:   ALL_GAMES  space-separated game directories (the Taskfile passes it)
#        PORT       dev server port (default 5191)
#
# Flow: list live remote branches -> pick one -> `git diff --name-only origin/main...origin/<branch>` -> the games
# whose directory appears in it -> temporary detached worktree under /tmp -> pnpm install -> scripts/qa/share.sh.
# Stops (tunnel, dev server, worktree) on Ctrl-C. The dev server has no authentication: see scripts/qa/share.sh.
set -euo pipefail

PORT="${PORT:-5191}"
GAMES="${ALL_GAMES:?ALL_GAMES is required (run through: task share:branch)}"

git fetch --prune origin >&2

BRANCH="${1:-}"
if [ -z "$BRANCH" ]; then
  mapfile -t BRANCHES < <(git for-each-ref --format='%(refname:strip=3)' refs/remotes/origin | grep -vxE 'HEAD|main')
  [ "${#BRANCHES[@]}" -gt 0 ] || { echo "no remote branches other than main" >&2; exit 1; }
  if command -v fzf >/dev/null 2>&1; then
    BRANCH="$(printf '%s\n' "${BRANCHES[@]}" | fzf --prompt='branch> ')"
  else
    PS3='branch number: '
    select BRANCH in "${BRANCHES[@]}"; do [ -n "$BRANCH" ] && break; done
  fi
fi
[ -n "$BRANCH" ] || { echo "no branch selected" >&2; exit 1; }
git rev-parse --verify --quiet "origin/$BRANCH" >/dev/null || { echo "no such remote branch: $BRANCH" >&2; exit 1; }

# Games whose directory has a changed file (shared/* and the like never match: only ALL_GAMES entries count)
CHANGED="$(git diff --name-only "origin/main...origin/$BRANCH")"
FOUND=()
for g in $GAMES; do
  if printf '%s\n' "$CHANGED" | grep -q "^${g}/"; then FOUND+=("$g"); fi
done
[ "${#FOUND[@]}" -gt 0 ] || { echo "origin/$BRANCH changes no game (shared packages and docs only?)" >&2; exit 1; }

if [ "${#FOUND[@]}" -eq 1 ]; then
  GAME="${FOUND[0]}"
else
  echo "origin/$BRANCH changes several games:" >&2
  PS3='game number: '
  select GAME in "${FOUND[@]}"; do [ -n "$GAME" ] && break; done
fi
echo "sharing $GAME from origin/$BRANCH" >&2

WT="/tmp/share-${GAME}-$(printf '%s' "$BRANCH" | tr '/' '-')"
cleanup() {
  trap - EXIT INT TERM
  "$WT/scripts/qa/down.sh" "$GAME" "$PORT" || true
  git worktree remove --force "$WT" || true
}
trap cleanup EXIT INT TERM

git worktree add --detach "$WT" "origin/$BRANCH" >&2
(cd "$WT" && pnpm install --frozen-lockfile >&2)
"$WT/scripts/qa/share.sh" "$GAME" "$PORT"

echo "sharing; press Ctrl-C to stop" >&2
sleep infinity
