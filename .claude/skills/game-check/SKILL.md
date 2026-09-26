---
name: game-check
description: Use to run the full completion gate for a game in this monorepo — unused scaffold assets, lint, test, coverage, build (AGENTS.md section 6) — before it's considered ready for QA or publishing.
---

# game-check

Run the completion gate from `AGENTS.md` section 6 for `<game-dir>` and
report the result honestly. This skill never claims success with a failing
gate (AGENTS.md 7: 禁止事項 — lint/test/buildの失敗を残したまま完了扱いに
しない).

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.

## Steps

`task game:status:set PACKAGE=<game-dir> STAGE=check VALUE=in_progress`

Inside `<game-dir>`, run in order and capture each result:

1. Check `public/` (including `public/assets/`) for files carried over
   from `task newgame`'s scaffold that nothing actually uses — most
   commonly `bg.png` and `logo.png`, the Phaser template's stock demo
   images, which are dead weight in every game in this repo since they
   draw via `Phaser.Graphics` instead of raster assets (AGENTS.md 技術要件
   convention). For each file under `public/`, grep `src/` and
   `index.html` for its filename; if nothing references it, delete it
   (`git rm` if already tracked). This can't be caught by `vite build`
   succeeding — Vite copies everything under `public/` into `dist/`
   verbatim regardless of whether anything references it, so an unused
   file here ships forever unless removed by hand. If a filename search
   turns up nothing but you suspect it might still be referenced via a
   dynamically-built path (e.g. a template string), double-check before
   deleting rather than assuming the grep is conclusive.
2. `npm run lint` — must be 0 errors. Any disable comment in the codebase
   must already carry a reason and be minimally scoped (AGENTS.md 4.4); if
   you find one without a reason while here, that's worth flagging, not
   silently leaving.
3. `npm run test`
4. `npm run test:coverage` — statement/branch/function/line all ≥ 90%.
5. `npm run build` — must produce static output with no Node-server-only
   runtime dependency.

## On failure

Do not mark this stage done. Report exactly which command failed and why,
fix root causes (not by disabling checks), and re-run from the top. If a
coverage shortfall can't be closed in this pass, state the shortfall and a
concrete plan per AGENTS.md 6 — don't paper over it.

## Review (before completion)

Run `game-review STAGE=check PACKAGE=<game-dir>` — a self-review against
its `STAGE=check` checklist — before marking this stage done. Fix anything that
fails rather than just noting it.

## Completion

1. All five steps done — scaffold cleanup applied, and the four commands
   pass.
2. `task game:status:set PACKAGE=<game-dir> STAGE=check VALUE=done`
3. Tell the user the next step is `game-codereview`.
