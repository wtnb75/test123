---
name: game-test
description: Use to write or update Vitest unit tests for a game in this monorepo, targeting the 90% coverage gate (AGENTS.md section 4.5) — boundary values, error paths, regression cases, and oracle/mutation checks for logic-heavy modules.
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

## Logic-heavy modules: check correctness, not just coverage

The 90% gate only proves code was *executed*. A solver, generator, or rules
engine can be fully covered and still wrong (a real bug survived 90%+
coverage in this repo because hand-written examples were all simple). For
that kind of module — not for Scenes or rendering glue — also do the
following. Use judgement on size: a few hundred lines of pure logic is
worth it, a trivial helper is not.

- **Compare against an independent oracle.** Enumerate every input of a
  small size (or use seeded random inputs) and check the result against a
  brute-force answer written separately from the implementation. Test
  *soundness* first: everything the code claims must hold in every state
  consistent with its input. *Completeness* (finding everything findable) is
  optional — heuristic solvers are allowed to miss things. Do not copy the
  implementation's own steps into the oracle; that only re-proves itself.
- **Sweep time-dependent code deterministically.** Replace `Date.now` with a
  clock that advances one tick per call and run with budgets 1, 2, 3, …
  so every timeout check is hit; assert that a timed-out run reports
  failure and that a completed run equals the untimed result.
- **Pick expected values independently.** Don't choose fixtures by running
  the current implementation and keeping what it happens to output; if you
  must (characterization test), say so in the test and pair it with an
  oracle check. Avoid assertions that pass for almost any result, such as
  `toBeGreaterThanOrEqual(0)` or `?? 0` on a value you expect to exist.
- **Exporting internals for tests is fine** when behavior does not change —
  mention it in the PR.
- **Spot-check with mutations before finishing.** Temporarily break the
  code in 3–5 ways (flip `<` / `<=`, shift a range by one, loosen a
  condition), run the new tests, and restore the code (`git status` must be
  clean afterwards). Every mutant should make a test fail; for one that
  survives, add a test or explain why it is equivalent (no observable
  change). Do this in a throwaway script under the scratchpad, not by
  committing broken code.
- **When an oracle test fails, find out who is wrong.** It is either a bug
  in the implementation or a wrong assumption in the oracle. Check what the
  code is documented or intended to guarantee before deciding — don't bend
  the test to pass, and don't call it a bug without evidence. If it is a
  real bug, don't fix it inside the test PR: report it and fix it on its own
  branch (AGENTS.md: one change, one purpose), with a failing regression
  test first.

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
- For logic-heavy modules: is there at least one check whose expected value
  comes from somewhere other than the implementation (oracle, hand-derived
  value), and did a mutation spot-check show the tests can fail?

## Completion

1. `npm run test` and `npm run test:coverage` both pass at ≥90% across all
   four metrics, or the shortfall and a concrete plan to close it are
   written up for the user (AGENTS.md 6: don't claim done at a coverage gap
   without explaining why and what's next).
2. If oracle tests or mutation checks were used, say in the PR/summary what
   the oracle was, which mutants were caught, and which survived and why.
3. `task game:status:set PACKAGE=<game-dir> STAGE=test VALUE=done`
4. Tell the user the next step is `game-check`.
