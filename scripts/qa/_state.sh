#!/usr/bin/env bash
# Shared helpers for scripts/qa/*.sh (source this file; it is not meant to be run).
#
# State (the env file the scripts hand to each other, server logs, the --shared site) lives in a private directory
# instead of predictable world-writable /tmp paths:
#   - created 0700 and refused unless it is a real directory owned by the caller, so another local user cannot
#     pre-create it or plant a symlink that a redirect would follow;
#   - the env file is parsed (known keys, validated values), never `source`d, so its content cannot run code.

# qa_check_game <name>: a game directory name is one path component made of [A-Za-z0-9._-], no leading dot.
qa_check_game() {
  case "$1" in
    "" | .* | *[!A-Za-z0-9._-]*)
      echo "invalid game-dir name: '$1' (letters, digits, '.', '_', '-' only)" >&2
      exit 1
      ;;
  esac
}

# qa_state_dir: prints the private state directory (creating it), or exits.
qa_state_dir() {
  local dir
  dir="${TMPDIR:-/tmp}/qa-$(id -u)"
  [ -e "$dir" ] || [ -L "$dir" ] || mkdir -m 700 "$dir"
  if [ -L "$dir" ] || [ ! -d "$dir" ] || [ ! -O "$dir" ]; then
    echo "refusing to use ${dir}: not a directory owned by you" >&2
    exit 1
  fi
  chmod 700 "$dir"
  printf '%s\n' "$dir"
}

# qa_load_env <file>: sets BASE_URL, CONTAINER and PORT from <file> (KEY=VALUE lines). Anything else is ignored.
# Returns 1 (with all three empty) when a value does not look right, so a caller that must still clean up can go on.
qa_load_env() {
  local k v
  BASE_URL="" CONTAINER="" PORT=""
  while IFS='=' read -r k v || [ -n "$k" ]; do
    case "$k" in
      BASE_URL) BASE_URL="$v" ;;
      CONTAINER) CONTAINER="$v" ;;
      PORT) PORT="$v" ;;
    esac
  done <"$1"
  if [[ "$BASE_URL" =~ ^http://[A-Za-z0-9.-]+:[0-9]+(/[A-Za-z0-9._/-]*)?$ ]] \
    && [[ "$CONTAINER" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] \
    && [[ "$PORT" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  BASE_URL="" CONTAINER="" PORT=""
  echo "unexpected content in $1" >&2
  return 1
}
