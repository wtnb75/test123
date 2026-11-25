---
name: game-init
description: Use when a game concept has been agreed (see game-idea) and needs its directory scaffolded via `task newgame` — the required first filesystem step for any new game in this monorepo (AGENTS.md section 2.2).
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-init

Scaffold a new game directory. Follows `AGENTS.md` section 2.2/2.3 exactly —
never call `pnpm create @phaserjs/game@latest` directly.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-init/flow.toml`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`: folder name only (kebab/lowercase, e.g. `cjump`). If
  not given, ask the user — do not guess a name silently.
- `IDEA=<仮タイトル>` (optional): the entry in `docs/ideas.md` this game comes
  from, passed by `game-idea`. Absent when the idea never went through the
  list.

## Background

- The branch exists so `game-publish` can later open a PR scoped to exactly
  this game, without picking this game's changes out of a working tree that
  also has unrelated work in it. Always branch from `origin/main`: in a
  worktree session `main` may be checked out elsewhere or be behind, and
  branching from `origin/main` keeps the current branch's work out.
- `spec_stub` creates `docs/spec.md` with only the frontmatter so the game is
  visible to `task game:detect` / `task game:next` / `game-next` immediately.
  Use the Write tool, not a shell `printf`/`echo`: in a worktree-isolated
  session a shell command whose argument starts with `---` is refused as
  "cannot be shown not to be git".
- The `GAMES` line `task newgame` leaves is commented out on purpose:
  `game-publish` moves it into `LAB_GAMES` (labs.html, the default for a
  first publish). The top page (`GAMES`) is a later, separate step.

## Added by the flow conversion

`fix_review` has `max_visits = 2`; exceeding it ends at `blocked` (no hand-off
to `game-next`; report to the user).
