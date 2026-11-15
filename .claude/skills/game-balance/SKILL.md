---
name: game-balance
description: Use after a game passes game-polish but doesn't feel fun or well-tuned yet — plays the game, adjusts difficulty/pacing parameters, updates docs/spec.md, and loops the change back through impl/test/check/codereview/qa/polish.
---

# game-balance

`game-qa` confirms the game works correctly. This skill is for the separate,
common problem: it works exactly as specced, and specced correctly, and
it's still not fun. That's a judgment call only playing (or watching
someone play) the game can answer — it's not caught by lint, tests, or a
one-off screenshot.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_polish: done` for this game (presentation is settled
  first, so tuning is judged on the game as it will ship). Effects and UI
  problems noticed here go to `game-polish`, not into a tuning change.

## Process

`task game:status:set PACKAGE=<game-dir> STAGE=balance VALUE=in_progress`

1. Play the game (or reuse `game-qa`'s Docker+Playwright setup to drive
   several playthroughs) focused on feel, not correctness: is the
   difficulty curve fair, is there a dead spot where nothing interesting
   happens, does an early failure feel like a "wait, again?" or like
   information the player can act on next time? After an extension
   (`game-extend`), also judge the existing flow with the new element in
   play: did it flatten or spike the existing difficulty curve, or change
   pacing that the regression conditions said to keep?
2. Discuss findings with the user — this is a subjective call, don't decide
   alone what "fun" means for their game. Propose specific parameter
   changes (speed, spawn rate, hit-box size, timing windows, etc.) with
   reasoning, not vague "make it more fun" edits.
3. On agreement, invoke `game-spec` to update the file that owns the
   element (`docs/spec.md` or its `docs/spec/<slug>.md`) first (AGENTS.md
   2.4: 仕様変更時は docs/spec.md を先に更新), documenting the tuning
   change and why. `game-spec` resets every downstream stage back to
   `pending` on its own as part of any revision — this skill doesn't need
   to do that itself.
4. Hand off to `game-impl` to apply the tuning change, then let the normal
   impl → test → check → codereview → qa → polish chain run again
   (`game-codereview` and `game-polish` only look at what the tuning
   changed, so these passes are short).

For a presentation-only revision whose polish confirmation already asked
about the feel (`game-polish` "Presentation-only revisions"), that answer
is the sign-off: mark this stage done without asking again.

**Autopilot** (`<game-dir>/.autopilot.md` exists — see `game-autopilot`
"Autopilot rules"): no tuning and no question. The initial numbers from the
agreement stay. What this stage still does, for a **gameplay** change only,
is measure them once so the PR does not go out blind:

- Run automated play as `game-backlog` "Automated play" describes (a
  throwaway harness on the pure logic, seeded runs, 40–60 seeds per
  condition, medians) in the conditions where the new element is in play.
- Put the numbers next to the before-numbers where they exist: the card's
  根拠, the comparison `game-extend` step 5 made (測ったこと in the
  agreement), or a condition of the same harness in which the new element
  is off (e.g. the stage before it appears). Don't build a second checkout
  of `origin/main` for a before-run.
- Hand the table and its conditions to `game-publish` for the PR body, with
  what a simple bot can't tell. Don't change a number because of it. If a
  number contradicts the agreement's 変えないもの (an "unchanged" median
  moved), that is a stop: write it under 「止まった理由」 and ask.

A presentation-only change, or a game with no pure logic a bot can drive,
has nothing to measure: say so in the hand-off. Then mark this stage done
and note that the numbers have not been tried by hand (the PR body says so;
the playtest is where the user judges them).

## When to stop looping

Only the user decides the game is fun enough to ship — don't declare this
stage done on your own judgment. Ask explicitly.

## Review (before completion)

Run `game-review STAGE=balance PACKAGE=<game-dir>` — a self-review against
its `STAGE=balance` checklist — before marking this stage done. Fix anything that
fails rather than just noting it.

## Completion

Once the user confirms the current feel is good and QA has passed again on
the tuned version:

1. `task game:status:set PACKAGE=<game-dir> STAGE=balance VALUE=done`
2. Continue without asking: invoke `game-next` with `PACKAGE=<game-dir>`. It
   dispatches `game-publish` and keeps going until a stage needs the user
   (see `game-next` "Continuous mode").
