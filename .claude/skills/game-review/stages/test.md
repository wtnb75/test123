# STAGE=test (subagent) — consumer: game-check

Artifacts for the subagent: `<game-dir>/docs/spec.md` and every
`docs/spec/*.md` it links to (especially テスト観点, ルール and 完了条件),
the test files and the source they cover, the latest
`npm run test:coverage` summary, and for a revision
`git diff origin/main -- <game-dir>` limited to test files.

### Checklist

- **Spec traceability**: every item in テスト観点, every rule boundary and
  every failure condition in ルール has at least one test. Missing ones are
  blockers.
- **Names** describe behavior and condition, not "test1" or the function
  name.
- **Not tautological**: expected values come from the spec or are derived
  by hand/oracle, not re-computed with the implementation's own logic or
  copied from its current output (unless labelled as a characterization
  test).
- **Determinism**: time, `Math.random()` and external state are injected or
  mocked, never used directly in assertions.
- **Logic-heavy modules** (see game-test): an independent oracle exists;
  the mutation spot-check was done and its result reported; random or
  exhaustive loops assert non-zero counts of the interesting outcomes;
  rejection tests fail only for the check they are named after.
- **Coverage**: ≥90% on all four metrics without lowered thresholds or new
  `coverage.exclude` entries for testable code.
- **Existing tests kept** (revision): no existing test was deleted, or had
  its assertion loosened or its expected value changed, to make the change
  pass — unless the spec changed that behavior. Each regression condition
  in 完了条件 has a test that would fail if that behavior changed.

Don't flag: Scene rendering glue that is reasonably left to game-qa.
