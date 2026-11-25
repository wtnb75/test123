---
name: game-check
description: Use to run the full completion gate for a game in this monorepo — unused scaffold assets, lint, test, coverage, build (AGENTS.md section 6) — before it's considered ready for QA or publishing.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-check

Run the completion gate from `AGENTS.md` section 6 for `<game-dir>` and
report the result honestly. This skill never claims success with a failing
gate (AGENTS.md 7: 禁止事項 — lint/test/buildの失敗を残したまま完了扱いに
しない).

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-check/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
  The flow's `<game-dir>` is this value.

## Scaffold cleanup

`task newgame` carries scaffold files into `public/` (including
`public/assets/`) that nothing actually uses — most commonly `bg.png` and
`logo.png`, the Phaser template's stock demo images, which are dead weight in
every game in this repo since they draw via `Phaser.Graphics` instead of
raster assets (AGENTS.md 技術要件 convention).

This can't be caught by `vite build` succeeding — Vite copies everything
under `public/` into `dist/` verbatim regardless of whether anything
references it, so an unused file here ships forever unless removed by hand.
If a filename search turns up nothing but the file might still be referenced
via a dynamically-built path (e.g. a template string), double-check before
deleting rather than assuming the grep is conclusive.

## Small revisions

After a one-rule or one-module revision, `check` may be marked `done` once
all four commands and the Title link check pass from the top after the last
change (the scaffold cleanup only when the change touched `public/` or the
build). Say in the report that the small-revision path was used. Anything
bigger runs the whole flow.

## Added by the flow conversion

The original had no loop limits. The flow adds `max_visits` to `fix` (5) and
`fix_review` (2); exceeding either ends at `blocked` (stage not done, report
to the user).
