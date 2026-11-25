---
name: game-codereview
description: Use after a game passes game-check to run a /code-review-style review of its code, let the user decide which findings to accept, fix the accepted ones, and loop until a round produces nothing worth fixing.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-codereview

`game-check` proves lint/test/coverage/build pass. It can't see bugs the
tests don't exercise: a listener never removed on shutdown, a timer that
keeps firing after game over, an off-by-one at a boundary nobody tested.
This skill looks for those, with the user deciding what actually gets
fixed.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-codereview/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

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

## Level by size

The review costs the same whether the change is 30 lines or 1000, unless
the level is matched to it:

| The change | Round 1 | Rounds |
|---|---|---|
| A new game's first pass; a revision of size M or L; anything touching Scene start/stop, input handling or shared parts | `high` | at most 3 |
| A revision of size **S** (the backlog card's 規模, or — without a card — one module or one Scene's local change, no new state or listener) | `medium` | at most 2 |

Later rounds are `medium` and look only at the previous round's fix diff,
as below. Say which row was used in the report. When in doubt, the first
row.

## What to look for

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
- tests that pass for the wrong reason (tautological expectations);
- for a Title / demo: a demo rebuilt several times leaves the same number of listeners
  and timers; Title's keys and key captures are released on shutdown; the game's
  clock is not taken from `this.time.now` (stale after a Title); the normal path
  (Game → result → Game) is unchanged.

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

## Added by the flow conversion

- Triage (with its approval gate), fixes, the gate run, the stop rules, the
  self-review and completion live in `flow.toml`.
- `fix_gate` has `max_visits = 3` and `fix_self` has `max_visits = 2`
  (exceeding either ends at `blocked`). `review_next` has `max_visits = 2`
  (rounds 2 and 3); exceeding it goes on to `open_items`. The size-S limit
  of 2 rounds is decided at `continue_check`.
