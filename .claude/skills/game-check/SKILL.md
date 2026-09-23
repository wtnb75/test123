---
name: game-check
description: Use to run the full completion gate for a game in this monorepo — lint, test, coverage, build (AGENTS.md section 6) — before it's considered ready for QA or publishing.
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

1. `npm run lint` — must be 0 errors. Any disable comment in the codebase
   must already carry a reason and be minimally scoped (AGENTS.md 4.4); if
   you find one without a reason while here, that's worth flagging, not
   silently leaving.
2. `npm run test`
3. `npm run test:coverage` — statement/branch/function/line all ≥ 90%.
4. `npm run build` — must produce static output with no Node-server-only
   runtime dependency.

## On failure

Do not mark this stage done. Report exactly which command failed and why,
fix root causes (not by disabling checks), and re-run from the top. If a
coverage shortfall can't be closed in this pass, state the shortfall and a
concrete plan per AGENTS.md 6 — don't paper over it.

## Self-review (before completion)

The four commands passing is necessary but not sufficient — also check:

- Was any failure fixed at the root cause, or masked (a new lint-disable
  comment, a loosened assertion, a lowered coverage threshold)? A masked
  fix doesn't count as passing; go back and fix the real issue.
- Do any lint-disable comments in the diff lack a reason, or cover more
  code than necessary?
- Does the build output actually look like a working static site (not just
  "the build command exited 0") — spot-check `dist/` if anything about the
  build step changed.

## Completion

1. All four commands pass.
2. `task game:status:set PACKAGE=<game-dir> STAGE=check VALUE=done`
3. Tell the user the next step is `game-qa`.
