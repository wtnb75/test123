---
name: game-proto
description: Use right after game-init for a new game, before the full spec — writes a short spec-lite, builds a throwaway playable prototype, and loops playtest → fix with the user until the core loop feels right; the numbers and rules that settle there feed game-spec.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-proto

Get to something playable fast, play it, and let what you learn decide the
spec — instead of settling the spec first and finding out afterwards that
the loop isn't fun. This is for the **first pass of a new game** only (before
`status_publish` is `done`). A published game's changes go through
`game-extend` / `game-balance`, not here.

The prototype code is **throwaway**. What carries forward is what the
playtests settled (numbers, rules, screens) and any pure logic worth porting.
`game-impl` writes the real code from the full spec.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-proto/flow.toml`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.

## Background

- Keep rounds small and quick: one change at a time that the user can feel is
  better than a batch they can't tell apart.
- The prototype's pure logic (`src/proto/logic.ts`) is the part that can be
  ported later; Scene code can't. That is why game rules stay in pure
  functions and every parameter lives in `src/proto/params.ts`.
- What the playtests settled (`## プレイテストで固まったこと`) is the input
  `game-spec` cannot reconstruct from the code. `## 見送ったこと` becomes
  `docs/backlog.md` cards in `game-spec`, which then removes the section.
- `src/proto/` stays in place until `game-impl` replaces it. A committed WIP
  prototype stays readable in git history after that.

## Added by the flow conversion

`fix_review` has `max_visits = 2`; exceeding it ends at `blocked` (stage not
done). The playtest loop (`feedback`, `build`, `serve`, `core_decision`) has no
limit: only the user decides when it is settled.
