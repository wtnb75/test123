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

- committed: `git diff origin/main -- <game-dir>`
- uncommitted and untracked: `git status --porcelain --untracked-files=all -- <game-dir>`

`code-review` works from a diff, and new files that aren't committed yet
have none ("no diff to read"; it then just reads the files). So don't rely on
the diff to define the scope: name the files or directories (and say what
changed) in the arguments you give it — see "What to hand the reviewer".

For a first pass on a new game that is the whole game directory. When this
stage comes back after a revision (`game-spec` reset it), focus on the code
that revision changed — the conversation / `game-impl` summary says what
that was. Findings in code an earlier round already reviewed and nobody
changed are `should` at most.

## Findings you rejected: `docs/review-rejected.md`

Reviewers raise the same things again in the next round and in the next
cycle (an extension re-reviews code a previous cycle already judged). Keep
what was rejected, with the reason, in `<game-dir>/docs/review-rejected.md`
(not part of the spec; it ships with the PR like `docs/backlog.md`), one
line each:

```markdown
- `<file or area>`: <the finding in one line> — 理由: <why it was rejected>
```

Read it at the start and hand its lines to the reviewer; at completion
append this run's rejected findings. Drop a line when the code it is about
is gone, and keep the file short (merge near-duplicates).

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
`docs/spec/*.md` it links to, AGENTS.md section 4, the lines of
`docs/review-rejected.md`, and the "Look for" list below. Tell it to stay
read-only and to return
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

#### What to hand the reviewer

Always pass, in the arguments: the level, the game directory, the scope
(files/directories and what changed), the round number, and the lines of
`docs/review-rejected.md` plus anything rejected earlier in this run so they
aren't raised again. For example:

```
high <game-dir> — scope: src/game/logic, src/game/scenes (new game, first pass).
Already rejected, do not raise again: <lines from docs/review-rejected.md>
```

For round 2 and later, say it is a re-review of the previous round's fixes
only (name the files and what each fix did), at level `medium`.

### 2. Triage — the user decides

Before showing anything, check each finding yourself. The reviewer can be
wrong: read the code path, and where cheap, reproduce the problem with a
failing test. Give each finding a recommendation: **accept** (real and
worth fixing now), **reject** (wrong, or not worth it here — say why),
**spec** (fixing it changes player-visible behavior the spec defines or
leaves open), or **spec (clarify)** (the code is already right; only the
spec's wording is missing or inaccurate about it).

When a finding says a library already provides what the code hand-rolls
(e.g. Phaser `camera.shake`, tweens), lean towards **accept**: keep only
the decision logic ("when to shake") pure and tested, and let the library
do the rest. That the hand-rolled version is easier to unit-test is not by
itself a reason to reject.

Then show the user one numbered table (番号 / 場所 / 指摘 / 推奨 / 理由) and
ask **once** which ones to accept — "推奨どおり" is a valid answer. Don't
ask per finding.

The exception is a round from round 2 on in which, after your checks, every
finding is **reject**: nothing would change, so don't ask. Show the table
with the reasons, say the loop ends here and that the user can ask for any
item to be reconsidered, and go on to completion. Round 1 is always asked.
A round with even one accept, spec or spec (clarify) is asked as usual.

### 3. Fix

- **accept** → fix it. For a correctness bug, write a regression test that
  fails before the fix and passes after. Keep each fix to that finding —
  no drive-by refactoring (AGENTS.md 4.1).
- **spec** → don't fix it in code. Hand the batch to `game-spec` as a
  revision (it resets downstream stages, so `game-impl` onward runs again
  and this stage comes back later). Findings that don't depend on the spec
  change can still be fixed in this round first.
- **spec (clarify)** → hand it to `game-spec` as a clarification-only
  revision (see its "Clarification-only revisions"): it only resets the
  stages after this one, so this loop carries on where it was.
- **reject** → remember the reason; report it at completion and add it to
  `docs/review-rejected.md`.

After the last fix of the round, run the `game-check` gate (lint, test,
test:coverage, build, all four, from the top). Don't start the next round
with a failing gate.

### When to stop

- A round whose findings are all rejected (or `no findings`) ends the loop
  (from round 2 on without asking, see "Triage").
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
3. Append this run's rejected findings to `<game-dir>/docs/review-rejected.md`
   (create it if missing; drop lines about code that is gone). It is part
   of the change, like the accepted fixes.
4. `task game:status:set PACKAGE=<game-dir> STAGE=codereview VALUE=done`
5. Continue without asking: invoke `game-next` with `PACKAGE=<game-dir>`. It
   dispatches `game-qa` and keeps going until a stage needs the user
   (see `game-next` "Continuous mode").
