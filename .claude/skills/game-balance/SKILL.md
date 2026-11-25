---
name: game-balance
description: Use after a game passes game-polish but doesn't feel fun or well-tuned yet — plays the game, adjusts difficulty/pacing parameters, updates docs/spec.md, and loops the change back through impl/test/check/codereview/qa/polish.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-balance

`game-qa` confirms the game works correctly. This skill is for the separate,
common problem: it works exactly as specced, and specced correctly, and
it's still not fun. That's a judgment call only playing (or watching
someone play) the game can answer — it's not caught by lint, tests, or a
one-off screenshot.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-balance/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_polish: done` for this game (presentation is settled
  first, so tuning is judged on the game as it will ship). Effects and UI
  problems noticed here go to `game-polish`, not into a tuning change.

## Added by the flow conversion

- The process (play, discuss, hand the tuning to `game-spec`, the autopilot
  measurement, the review and completion) lives in `flow.toml`.
- `fix_review` has `max_visits = 2`; exceeding it ends at `blocked`.
  The play / confirm loop has no limit: only the user decides the game is
  fun enough to ship.
