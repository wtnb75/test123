---
name: game-test
description: Use to write or update Vitest unit tests for a game in this monorepo, targeting the 90% coverage gate (AGENTS.md section 4.5) — boundary values, error paths, and regression cases.
---

# game-test

Write Vitest unit tests for `<game-dir>`. This is unit-level coverage work,
not the pass/fail gate itself (that's `game-check`) and not the visual/feel
check (that's `game-qa`).

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.

## Before writing tests

`task game:status:set PACKAGE=<game-dir> STAGE=test VALUE=in_progress`

## Rules (AGENTS.md 4.5)

- Test names describe behavior: what happens under what condition.
- Prioritize boundary values, error/abnormal paths, and cases that
  previously caused a regression.
- Inject or mock time, randomness, and external dependencies for
  reproducibility — never rely on real timers or `Math.random()` in
  assertions.
- Run `npm run test:coverage` inside `<game-dir>` and check statement,
  branch, function, and line coverage are all ≥ 90%. If not, find the
  uncovered branches and add tests for them — don't lower the threshold in
  `vitest.config.ts` (or the shared `scaffold/vitest.base.mjs`) to make the
  number pass, and don't add per-game `coverage.exclude` entries for code
  that can be unit tested.

## Self-review (before completion)

Go through the new/changed tests and fix anything that fails these, rather
than leaving it for `game-check`'s coverage number to (not) catch:

- Does each test name actually describe a behavior and condition, not just
  "test1" or the function name repeated?
- Is any test tautological — reimplementing the same logic in the test as
  in the code, so it can't fail when the logic is wrong? Assert against
  known expected values, not against "whatever the function currently
  returns."
- Are boundary values, error paths, and previously-seen regressions
  actually covered, or does coverage come mostly from the happy path?
- Is anything nondeterministic (time, `Math.random()`, external state) used
  directly in an assertion instead of injected/mocked?

## Completion

1. `npm run test` and `npm run test:coverage` both pass at ≥90% across all
   four metrics, or the shortfall and a concrete plan to close it are
   written up for the user (AGENTS.md 6: don't claim done at a coverage gap
   without explaining why and what's next).
2. `task game:status:set PACKAGE=<game-dir> STAGE=test VALUE=done`
3. Tell the user the next step is `game-check`.
