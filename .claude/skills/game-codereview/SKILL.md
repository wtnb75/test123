---
name: game-codereview
description: Use after a game passes game-check to run a /code-review-style review of its code, let the user decide which findings to accept, fix the accepted ones, and loop until a round produces nothing worth fixing.
---

# game-codereview

`game-check` proves lint/test/coverage/build pass. It can't see bugs the
tests don't exercise: a listener never removed on shutdown, a timer that
keeps firing after game over, an off-by-one at a boundary nobody tested.
This skill looks for those, with the user deciding what actually gets
fixed.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_check: done` for this game — if not, send the user back
  to `game-check` first.

## Scope of the review

What changed on this branch under `<game-dir>`:

- committed: `git diff main...HEAD -- <game-dir>`
- uncommitted and untracked: `git status --porcelain --untracked-files=all -- <game-dir>`

For a first pass on a new game that is the whole game directory. When this
stage comes back after a revision (`game-spec` reset it), focus on the code
that revision changed — the conversation / `game-impl` summary says what
that was. Findings in code an earlier round already reviewed and nobody
changed are `should` at most.

## The loop

`task game:status:set PACKAGE=<game-dir> STAGE=codereview VALUE=in_progress`

Repeat rounds of review → triage → fix. **At most 3 rounds.**

### 1. Review

Invoke the `code-review` skill (the same thing as `/code-review`), aimed at
the scope above: `high` for round 1, `medium` for later rounds, which only
look at the previous round's fix diff. Don't pass `--fix` or `--comment` —
nothing gets changed or posted before the user has triaged.

If `code-review` isn't available in this session, launch one fresh
`general-purpose` agent (Agent tool) instead. Give it only: the game
directory, the scope above, `<game-dir>/docs/spec.md` and every
`docs/spec/*.md` it links to, AGENTS.md section 4, and the "Look for"
list below. Tell it to stay read-only and to return
findings in this format, most severe first, or `no findings`:

```
- <file:line> [correctness|lifecycle|performance|spec|maintainability]
  problem: <what's wrong>
  scenario: <concrete input/state → wrong result>
  suggestion: <fix>
```

Look for (Phaser-game-specific, on top of general correctness):

- listeners (`input.on`, `events.on`, keyboard keys, `window`/DOM events)
  registered more than once, or not removed on Scene `shutdown`;
- timers / tweens / `delayedCall` still running after a state change or
  Scene restart, touching destroyed objects;
- state not reset on restart (fields initialized in the constructor instead
  of `init`/`create`);
- allocation or `new` inside `update`;
- boundary behavior that contradicts the spec's (`docs/spec.md` or a
  linked file's) ルール / パラメータ表;
- magic numbers that should come from the parameter constants;
- tests that pass for the wrong reason (tautological expectations).

On later rounds, also pass the list of findings the user already rejected,
so they aren't raised again.

### 2. Triage — the user decides

Before showing anything, check each finding yourself. The reviewer can be
wrong: read the code path, and where cheap, reproduce the problem with a
failing test. Give each finding a recommendation: **accept** (real and
worth fixing now), **reject** (wrong, or not worth it here — say why), or
**spec** (fixing it changes player-visible behavior the spec defines or
leaves open).

Then show the user one numbered table (番号 / 場所 / 指摘 / 推奨 / 理由) and
ask **once** which ones to accept — "推奨どおり" is a valid answer. Don't
ask per finding.

### 3. Fix

- **accept** → fix it. For a correctness bug, write a regression test that
  fails before the fix and passes after. Keep each fix to that finding —
  no drive-by refactoring (AGENTS.md 4.1).
- **spec** → don't fix it in code. Hand the batch to `game-spec` as a
  revision (it resets downstream stages, so `game-impl` onward runs again
  and this stage comes back later). Findings that don't depend on the spec
  change can still be fixed in this round first.
- **reject** → remember the reason; report it at completion.

After the last fix of the round, run the `game-check` gate (lint, test,
test:coverage, build, all four, from the top). Don't start the next round
with a failing gate.

### When to stop

- A round whose findings are all rejected (or `no findings`) ends the loop.
- After round 3, list anything still open for the user with your
  recommendation instead of starting round 4.

## Review (before completion)

Run `game-review STAGE=codereview PACKAGE=<game-dir>` — a self-review
against its `STAGE=codereview` checklist — before marking this stage done.

## Completion

1. The loop ended as above, and the four gate commands pass after the last
   fix.
2. Report in one short block: rounds run, fixes made (with their regression
   tests), findings rejected and why, anything sent to `game-spec`.
3. `task game:status:set PACKAGE=<game-dir> STAGE=codereview VALUE=done`
4. Tell the user the next step is `game-qa`.
