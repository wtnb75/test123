---
name: game-qa
description: Use to visually confirm a game in this monorepo actually works in a real browser — canvas rendering, input feel, clear/game-over states — via the Docker+Playwright headless-browser procedure in AGENTS.md section 9 (helpers in scripts/qa/).
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-qa

`game-check` verifies lint/test/build pass. This skill verifies the game
*actually renders and plays* — Vitest can't see canvas output, so this is
the only step that looks at real pixels.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-qa/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_codereview: done` for this game — if not, send the user
  back to `game-codereview` (or `game-check` before it) first.

## Scope of a revision's QA

Re-shooting everything after a small change (a 6-line generator change took
minutes of idle-time scenarios that could not have changed) is not the point
of QA; but a change that touches shared code can break any screen. Classify
the change from the spec revision and the diff, and re-shoot accordingly:

| What the change touches | Re-shoot |
|---|---|
| **Shared parts**: build config, `index.html`, canvas size / orientation / layout, Scene start-stop-restart, input handling, pause, anything every state goes through | Every Scene and state (the full set), checked against the regression conditions in 完了条件 |
| **A Title / demo addition** (no rule, number or in-game screen changes; the first Scene and the start of the game do) | The Title at the sizes in the spec's layout table (`scripts/qa/title-viewports.mjs`; `"fresh": true` where the size is decided at Title start), the standard scenario (`scripts/qa/title-start.mjs`: START by Enter / Space / click after a long idle, the game starts from its start, the demo's cycle), plus one representative shot of each existing Scene and the Game → result → Game path. Offer a real-device check |
| **A local change to rules or content**: generation, judging, scoring, a new kind of element, a tuning number | The states where the change shows (its own screens, bursts for effects), plus **one representative shot per Scene on both viewports** (`scripts/qa/smoke.mjs` covers title and first tap), plus only the 完了条件 regression items the change could reach (e.g. the result screen when scoring changed) |
| **Wording only** (README, spec text, comments) | `scripts/qa/smoke.mjs` only |

In autopilot (`<game-dir>/.autopilot.md` exists), shoot the states where the
change shows at all four sizes of AGENTS.md 4.6 (375 × 550, 667 × 310,
390 × 844, 1280 × 720) and keep the files: `game-polish` checks these
instead of starting the containers a second time.

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
  Write the publishing code inline inside `if (import.meta.env.DEV) { … }`
  (not in a method called from it: the unused method body stays in the
  production bundle), and check `rg -c __qa <game-dir>/dist/assets/*.js`
  prints nothing after `npm run build`.
- If the frame rate reported by `fps` is far below 60, fix the harness
  (see the rules above) before judging the game's feel.
- **Keep each run short and split by viewport.** One script per viewport
  (or per scenario that waits for a state such as the Result screen), each
  under about 2 minutes. Run `scripts/qa/run.sh` in the background with a
  `timeout`, and poll for the screenshots (`docker exec <container> ls
  /work/shots`); `run.sh` prints nothing until it finishes. If a run has
  produced no new file for a minute, kill the node process in the container
  (`docker exec <container> pkill node`) and rerun only the missing part.

## Added by the flow conversion

- The procedure (up, shoot, down, the shared build check), the judgement,
  the self-review and completion live in `flow.toml`; the commands are in
  its prompts and in `AGENTS.md` section 9 and `scripts/qa/README.md`.
- `fix_review` has `max_visits = 2`; exceeding it ends at `blocked`.
