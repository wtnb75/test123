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
3. On agreement, invoke `game-spec` to update `docs/spec.md` first (AGENTS.md
   2.4: 仕様変更時は docs/spec.md を先に更新), documenting the tuning
   change and why. `game-spec` resets every downstream stage back to
   `pending` on its own as part of any revision — this skill doesn't need
   to do that itself.
4. Hand off to `game-impl` to apply the tuning change, then let the normal
   impl → test → check → codereview → qa → polish chain run again
   (`game-codereview` and `game-polish` only look at what the tuning
   changed, so these passes are short).

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
2. Tell the user the next step is `game-publish`.
