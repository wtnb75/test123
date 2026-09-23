#!/usr/bin/env bash
# Read/update per-stage progress status stored as flat frontmatter keys
# (status_<stage>: <value>) in <game-dir>/docs/spec.md.
#
# A game only participates once its docs/spec.md carries a status_idea key;
# games without that frontmatter are left untouched (see AGENTS.md skill
# design notes).
set -euo pipefail

STAGES=(idea init spec impl test check qa balance publish)

usage() {
  cat <<'EOF'
Usage:
  game-status.sh get <game-dir> [stage]
  game-status.sh set <game-dir> <stage> <value>
  game-status.sh next <game-dir>
  game-status.sh dashboard
  game-status.sh detect
EOF
  exit 1
}

spec_file() {
  echo "${1%/}/docs/spec.md"
}

frontmatter() {
  awk '/^---$/{n++; if (n == 1) next; if (n == 2) exit} n == 1' "$1"
}

is_eligible() {
  local f
  f=$(spec_file "$1")
  [[ -f "$f" ]] && rg -q '^status_idea:' "$f"
}

known_stage() {
  local stage="$1" s
  for s in "${STAGES[@]}"; do
    [[ "$s" == "$stage" ]] && return 0
  done
  return 1
}

get_stage() {
  local f="$1" stage="$2"
  frontmatter "$f" | rg "^status_${stage}: " | awk '{print $2}'
}

cmd_get() {
  local game="$1" stage="${2:-}" f
  f=$(spec_file "$game")
  [[ -f "$f" ]] || { echo "no spec.md for $game" >&2; exit 1; }
  if [[ -n "$stage" ]]; then
    known_stage "$stage" || { echo "unknown stage: $stage" >&2; exit 1; }
    get_stage "$f" "$stage"
  else
    local s
    for s in "${STAGES[@]}"; do
      printf '%s: %s\n' "$s" "$(get_stage "$f" "$s")"
    done
  fi
}

cmd_set() {
  local game="$1" stage="$2" value="$3" f
  f=$(spec_file "$game")
  [[ -f "$f" ]] || { echo "no spec.md for $game" >&2; exit 1; }
  known_stage "$stage" || { echo "unknown stage: $stage" >&2; exit 1; }
  case "$value" in
    pending|in_progress|done) ;;
    *) echo "value must be pending|in_progress|done" >&2; exit 1 ;;
  esac
  rg -q "^status_${stage}: " "$f" || { echo "no status_${stage} key in $f" >&2; exit 1; }
  sd "^status_${stage}: .*" "status_${stage}: ${value}" "$f"
}

cmd_next() {
  local game="$1" s v
  for s in "${STAGES[@]}"; do
    v=$(cmd_get "$game" "$s")
    if [[ "$v" != "done" ]]; then
      echo "$s"
      return
    fi
  done
  echo "complete"
}

eligible_games() {
  fd -HI -t f --full-path -g '**/docs/spec.md' . -d 3 2>/dev/null | while read -r f; do
    local game="${f%/docs/spec.md}"
    game="${game#./}"
    is_eligible "$game" && echo "$game"
  done
}

cmd_dashboard() {
  local game found=0
  while read -r game; do
    [[ -z "$game" ]] && continue
    found=1
    printf '%-16s next=%s\n' "$game" "$(cmd_next "$game")"
  done < <(eligible_games)
  [[ "$found" -eq 1 ]] || echo "no games with status frontmatter yet"
}

cmd_detect() {
  local candidates c game v branch
  # Each game gets a dedicated branch (feat/<game> for a first pass,
  # <type>/<game>-<slug> for a post-publish revision — see the game-init /
  # game-spec skills), so the current branch is the most precise signal for
  # "which game is this" once work has been committed there (at which point
  # `git status --porcelain` below goes quiet and would otherwise lose
  # track). Check it first; falls through untouched for branches that don't
  # match any known game (e.g. still on main, or a pre-convention branch).
  branch=$(git branch --show-current 2>/dev/null || true)
  if [[ -n "$branch" ]]; then
    while read -r game; do
      [[ -z "$game" ]] && continue
      if [[ "$branch" == "feat/$game" || "$branch" =~ ^[^/]+/${game}(-.*)?$ ]]; then
        echo "$game"
        return
      fi
    done < <(eligible_games)
  fi

  candidates=$(git status --porcelain 2>/dev/null | awk '{print $2}' | rg -o '^[^/]+' | sort -u || true)
  for c in $candidates; do
    is_eligible "$c" && { echo "$c"; return; }
  done

  while read -r game; do
    [[ -z "$game" ]] && continue
    v=$(cmd_next "$game")
    [[ "$v" != "complete" ]] && { echo "$game"; return; }
  done < <(eligible_games)

  echo "none"
}

main() {
  [[ $# -ge 1 ]] || usage
  local sub="$1"; shift
  case "$sub" in
    get) [[ $# -ge 1 ]] || usage; cmd_get "$@" ;;
    set) [[ $# -eq 3 ]] || usage; cmd_set "$@" ;;
    next) [[ $# -eq 1 ]] || usage; cmd_next "$@" ;;
    dashboard) cmd_dashboard ;;
    detect) cmd_detect ;;
    *) usage ;;
  esac
}

main "$@"
