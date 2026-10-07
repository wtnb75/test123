---
name: game-qa
description: Use to visually confirm a game in this monorepo actually works in a real browser — canvas rendering, input feel, clear/game-over states — via the Docker+Playwright headless-browser procedure in AGENTS.md section 9 (helpers in scripts/qa/).
---

# game-qa

`game-check` verifies lint/test/build pass. This skill verifies the game
*actually renders and plays* — Vitest can't see canvas output, so this is
the only step that looks at real pixels.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_codereview: done` for this game — if not, send the user
  back to `game-codereview` (or `game-check` before it) first.

## Procedure — full detail in `AGENTS.md` section 9, summary here

`task game:status:set PACKAGE=<game-dir> STAGE=qa VALUE=in_progress`

Use the helpers in `scripts/qa/` (see `scripts/qa/README.md`); don't rebuild
the Docker + Playwright setup by hand.

1. `scripts/qa/up.sh <game-dir> [port]` — starts the dev server on
   `0.0.0.0:<port>` and a Playwright container on *this session's* Docker
   network (not `--network host`, which can't reach this session's
   `localhost`), installs `playwright` in it, and prints the base URL and the
   container's UTC date (games that pick content by date need it).
2. Write the scenario as an ES module under the scratchpad that imports from
   `./lib.mjs` (`launch`, `newPage`, `shot`, `burst`, `tap`, `setHidden`,
   `waitForQa`, `fps`, `report`). `scripts/qa/smoke.mjs` is a generic
   starting point (desktop and phone viewport, frame rate, one tap, console
   errors). Run it with
   `scripts/qa/run.sh <game-dir> <script.mjs> <out-dir> [extra files…]`; the
   screenshots come back in `<out-dir>` (files move with `docker cp`, never a
   bind mount).
3. Take screenshots at the states that matter for this game (title,
   mid-play, clear, game-over, and every state/Scene the spec names), on a
   desktop and a phone-sized viewport. For effects and transitions take a
   short burst (`burst`, every 50–100 ms). Judge on speed feel,
   hit-detection feel, and whether transitions match the spec, not just "it
   didn't crash". The spec is `docs/spec.md` plus its linked
   `docs/spec/*.md` files.

   For a revision (this game passed QA before — e.g. after `game-extend`),
   how much to re-shoot depends on what the change touched — see "Scope of
   a revision's QA" below. The first QA of a game is always the full set.
4. `scripts/qa/down.sh <game-dir> [port]` — removes the container and stops
   the server. Always, even if QA failed.
5. **Shared build check** (what is actually published): the dev server runs
   a different bundle from the one GitHub Pages serves — Phaser is left out
   of `dist-shared/` and loaded from `../vendor/` through an import map, and
   the site lives under a sub-path, so a wrong asset path or a missing
   vendor file only shows up there. After the dev-server run, do
   `scripts/qa/up.sh <game-dir> <port> --shared` (builds with
   `SHARED_VENDOR=1`, lays it out like `output/`, serves it under `/<repo>/`),
   run `scripts/qa/run.sh <game-dir> scripts/qa/smoke.mjs <out-dir>` (it
   fails on a missing canvas, console errors or 4xx/5xx requests, and its
   screenshots show title and the first tap), look at them, then
   `scripts/qa/down.sh <game-dir> <port>`. Do it every time a game goes
   through QA, and always when `index.html` or the build config changed
   (AGENTS.md 4.3). `task build` itself (all games, CI) stays CI's job.

## Scope of a revision's QA

Re-shooting everything after a small change (a 6-line generator change took
minutes of idle-time scenarios that could not have changed) is not the point
of QA; but a change that touches shared code can break any screen. Classify
the change from the spec revision and the diff, and re-shoot accordingly:

| What the change touches | Re-shoot |
|---|---|
| **Shared parts**: build config, `index.html`, canvas size / orientation / layout, Scene start-stop-restart, input handling, pause, anything every state goes through | Every Scene and state (the full set), checked against the regression conditions in 完了条件 |
| **A local change to rules or content**: generation, judging, scoring, a new kind of element, a tuning number | The states where the change shows (its own screens, bursts for effects), plus **one representative shot per Scene on both viewports** (`scripts/qa/smoke.mjs` covers title and first tap), plus only the 完了条件 regression items the change could reach (e.g. the result screen when scoring changed) |
| **Wording only** (README, spec text, comments) | `scripts/qa/smoke.mjs` only |

Write the class and the reason in the QA report in one line ("local change:
only the difference generator; rendering, input, layout untouched"), so the
user can overrule it. When in doubt, take the larger class. The shared build
check (step 5) is done in every case.

Rules for scenarios (each one cost a QA run before):

- **No Playwright clock** (`page.clock.*`): it slows the game's frame-based
  time so the game clock falls behind the wall clock. For date-dependent
  games, use the container's UTC date instead.
- **One page at a time**; close its context before the next scenario.
  Several pages share the software GPU and each game runs far slower.
- **Wait for a state, not for a time.** A fixed sleep before a click makes
  the click land during a "clear" pause and get ignored. If the game exposes
  `window.__qa` in the dev build (a small read-only state object such as
  `{ phase, stage, timeLeft }`), use `waitForQa`; otherwise confirm with a
  screenshot before acting.
- If the frame rate reported by `fps` is far below 60, fix the harness
  (see the rules above) before judging the game's feel.

## On failure

Don't mark this stage done. Report what looked wrong with the screenshots
as evidence, and route back to `game-impl` for a fix (one change, one
purpose — don't bundle the fix with unrelated work).

## Review (before completion)

Run `game-review STAGE=qa PACKAGE=<game-dir>` — a self-review against
its `STAGE=qa` checklist — before marking this stage done. Fix anything that
fails rather than just noting it.

## Completion

1. Screenshots confirm the game renders and behaves as the spec describes.
2. `task game:status:set PACKAGE=<game-dir> STAGE=qa VALUE=done`
3. Continue without asking: invoke `game-next` with `PACKAGE=<game-dir>`. It
   dispatches `game-polish` and keeps going until a stage needs the user
   (see `game-next` "Continuous mode").
