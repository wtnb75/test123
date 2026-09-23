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
- **Generate only states the game can really reach.** Random or exhaustive
  inputs must respect the invariants normal play maintains (for example, an
  opened zero cell always has its unflagged neighbors opened). Otherwise a
  failure may just be an impossible input, and you will chase a bug that is
  not there.
- **Guard against vacuous runs.** A loop over thousands of random cases that
  never hits the interesting branch proves nothing. Count the cases that
  exercised each outcome (a deduction was made, a game was won, a timeout
  fired) and assert the counts are above zero. This has caught a generator
  that never produced the shape being tested.
- **Keep big loops cheap.** Calling `expect(...)` hundreds of thousands of
  times is slow (one such test took seconds). Inside a hot loop use a plain
  `if` and `expect.fail(message)` with the failing input in the message.
- **Sweep time-dependent code deterministically.** Replace `Date.now` with a
  clock that advances one tick per call and run with budgets 1, 2, 3, …
  so every timeout check is hit; assert that a timed-out run reports
  failure and that a completed run equals the untimed result.
- **Pick expected values independently.** Don't choose fixtures by running
  the current implementation and keeping what it happens to output; if you
  must (characterization test), say so in the test and pair it with an
  oracle check. Avoid assertions that pass for almost any result, such as
  `toBeGreaterThanOrEqual(0)` or `?? 0` on a value you expect to exist.
- **Make a rejection test reject for the reason you name.** When testing
  validation or boundaries, build an input that is valid in every other
  respect and assert the specific message or error code, not just
  `toThrow()` / `ok: false`. Otherwise another check (a length mismatch, a
  different range) can reject the input and the check you meant to test may
  be missing or wrong without any test failing. Two such holes were found
  only through mutation checks.
- **Exporting internals for tests is fine** when behavior does not change —
  mention it in the PR.
- **Spot-check with mutations before finishing.** Temporarily break the
  code in 3–5 ways (flip `<` / `<=`, shift a range by one, loosen a
  condition), run the new tests, and restore the code (`git status` must be
  clean afterwards). Every mutant should make a test fail; for one that
  survives, add a test or explain why it is equivalent (no observable
  change). Do this in a throwaway script under the scratchpad, not by
  committing broken code. Mutants that only change speed (removing an early
  exit or a prune) or that no valid input can reach are equivalent — say so
  rather than chasing them. Survivors are often gaps in the tests, not just
  in the code: read each one.
- **When an oracle test fails, find out who is wrong.** It is either a bug
  in the implementation or a wrong assumption in the oracle. Check what the
  code is documented or intended to guarantee before deciding — don't bend
  the test to pass, and don't call it a bug without evidence. If it is a
  real bug, don't fix it inside the test PR: report it and fix it on its own
  branch (AGENTS.md: one change, one purpose), with a failing regression
  test first. In the test PR, record the gap (an `it.todo` with the
  numbers, and the PR description); in the fix PR turn it into a real test.
  If the code documents itself as a heuristic, whether to make it exact is
  the user's decision — report the size of the gap and propose a fix.

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
- Does every random or exhaustive loop prove it exercised what it claims (a
  non-zero count of the interesting outcome)?
- Does each rejection/boundary test fail *only* if the check it is named
  after is broken?

## Completion

1. `npm run test` and `npm run test:coverage` both pass at ≥90% across all
   four metrics, or the shortfall and a concrete plan to close it are
   written up for the user (AGENTS.md 6: don't claim done at a coverage gap
   without explaining why and what's next).
2. If oracle tests or mutation checks were used, say in the PR/summary what
   the oracle was, which mutants were caught, and which survived and why.
3. `task game:status:set PACKAGE=<game-dir> STAGE=test VALUE=done`
4. Tell the user the next step is `game-check`.
