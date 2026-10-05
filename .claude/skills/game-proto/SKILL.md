---
name: game-proto
description: Use right after game-init for a new game, before the full spec — writes a short spec-lite, builds a throwaway playable prototype, and loops playtest → fix with the user until the core loop feels right; the numbers and rules that settle there feed game-spec.
---

# game-proto

Get to something playable fast, play it, and let what you learn decide the
spec — instead of settling the spec first and finding out afterwards that
the loop isn't fun. This is for the **first pass of a new game** only (before
`status_publish` is `done`). A published game's changes go through
`game-extend` / `game-balance`, not here.

The prototype code is **throwaway**. What carries forward is what the
playtests settled (numbers, rules, screens) and any pure logic worth porting.
`game-impl` writes the real code from the full spec.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
  Do not start this skill if `status_init` isn't `done` — send the user to
  `game-init` first.

## Before starting

`task game:status:set PACKAGE=<game-dir> STAGE=proto VALUE=in_progress`

## Step 1: spec-lite

Write the body of `<game-dir>/docs/spec.md` below the existing frontmatter
(do not touch the `status_*` keys by hand). Only these five items — the
rest of AGENTS.md 2.4 is `game-spec`'s job later:

ゲーム名 / コンセプト（1-3行） / コアループ / 操作仕様 / パラメータ表

Start the body with this line so `game-spec` knows it is a draft:

```markdown
> spec-lite: プロトタイプ用の下書き。`game-spec` が完全版に仕上げる。
```

Pull concept, core loop and input from the `game-idea` conversation. The
パラメータ表 only needs reasonable initial values (see `game-spec`
"パラメータ表 and 実装裁量" for what counts); it is what the playtests will
tune. Keep it short — a page, not a document. Don't ask the user to approve
it as a design document; it is a working note and will change.

## Step 2: build the prototype

Smallest thing that lets the user play the core loop end to end — usually
one Scene: start, play, an ending the player can restart from. Skip
anything the loop doesn't need (title screen, sound, effects, persistence).

Rules for the code (deliberately lighter than `game-impl`):

- Everything you add lives in `<game-dir>/src/proto/`, with its own
  `src/proto/main.ts` exporting `StartGame` like the template's
  `src/game/main.ts`. The only edit outside it is changing the import in
  `src/main.ts` from `./game/main` to `./proto/main`. This is what lets
  `game-impl` find and remove it cleanly later.
- **Every number from the パラメータ表 lives in one file**
  (`src/proto/params.ts`) and the spec-lite table matches it. Tuning
  during playtests means editing this file.
- **Keep game rules in pure functions** (`src/proto/logic.ts`, no Phaser
  imports): collision/hit tests, scoring, spawn tables, win/lose
  conditions. This is the part that can be ported later; Scene code
  can't.
- Prefer what Phaser provides (tweens, timers, camera effects) over
  hand-rolling — same as `game-impl`.
- **Not required here**: Scene responsibility split, tests, coverage,
  lint-clean code, effects/polish. Don't spend time on them.
- Don't add dependencies and don't touch files outside `<game-dir>`.

## Step 3: playtest loop

1. Start the dev server in the background from `<game-dir>`
   (`npm run dev -- --host 0.0.0.0 --port <PORT>`) and give the user a URL
   they can actually reach (when this session runs in a container, that is
   the session's IP, not `localhost` — see AGENTS.md section 9). Check it boots and renders without console errors before asking
   them to play; if you can't see the browser, say so rather than
   guessing it works. (An optional headless screenshot via the AGENTS.md
   section 9 procedure is fine for "does it start", never for "is it
   fun".)
2. Ask once, open-ended: play it and tell me what felt wrong, boring or
   unclear — and what felt good, so it isn't tuned away. Don't pre-load
   a questionnaire.
3. Sort each point and fix it, then report what changed in a few lines:
   - **A number** (too fast, too many, too generous) → edit
     `params.ts` and the spec-lite table together.
   - **A rule** (what ends the run, how scoring works, what an input
     does) → change `logic.ts` / the Scene and the spec-lite text.
   - **Screens / flow** (what the player sees and when) → change the
     Scene and note it in the spec-lite.
   - **The loop itself isn't fun** → don't patch around it. Say so
     plainly and offer: change the core mechanic and re-prototype, or
     go back to `game-idea` (and stop this stage). The user decides.
4. Repeat from 2 until the user says it's settled. Only the user decides
   that — your own opinion that it "works" doesn't end the loop. Keep
   rounds small and quick; one change at a time that the user can feel is
   better than a batch they can't tell apart.
5. Stop the dev server (and any QA container) when the loop ends.

Write what the playtests settled into the spec-lite as you go, under a
`## プレイテストで固まったこと` section: rules the user confirmed or
changed, why a number ended up where it did, things that felt good and must
stay, screens that turned out to be needed. This is the input `game-spec`
cannot reconstruct from the code.

## Review (before completion)

Run `game-review STAGE=proto PACKAGE=<game-dir>` — a self-review against
its `STAGE=proto` checklist. Fix anything that fails.

## Completion

1. Show the user a short summary: the final パラメータ表 values, the rules
   and screens that settled, which `src/proto/` files hold pure logic
   worth porting, and what will be dropped. In the same question, ask
   whether to commit the prototype as a WIP commit on this branch (so
   `game-impl` and the user can still read it from git history after
   `src/proto/` is removed) — don't commit without the answer.
2. `task game:status:set PACKAGE=<game-dir> STAGE=proto VALUE=done`
3. Continue without asking: invoke `game-next` with `PACKAGE=<game-dir>`.
   It dispatches `game-spec`, which turns the spec-lite and the playtest
   notes into the full spec and stops for the user's approval (see
   `game-next` "Continuous mode").

`src/proto/` stays in place until `game-impl` replaces it — don't delete
it here, and don't promote it into the real implementation by copying it
over wholesale.
