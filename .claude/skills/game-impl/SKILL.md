---
name: game-impl
description: Use to implement or modify a game's Phaser.js code against its approved docs/spec.md, following this monorepo's Scene/preload/create/update discipline (AGENTS.md section 4).
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-impl

Implement against the approved spec — `<game-dir>/docs/spec.md` plus every
`docs/spec/*.md` linked from its `## 拡張` section (see `game-spec` "Spec
layout"). Do not start this skill if `status_spec` isn't `done` — send the
user back to `game-spec` first.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-impl/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.

## Before writing code

`task game:status:set PACKAGE=<game-dir> STAGE=impl VALUE=in_progress`

Re-read the spec fully (`<game-dir>/docs/spec.md` and its linked files) —
it is the source of truth for scope. If what's being asked diverges from
the spec, stop and route back to `game-spec` first (AGENTS.md: 仕様変更時は
spec.md を先に更新).

### When the spec is silent

The spec already passed `game-review STAGE=spec`, so gaps should be rare —
but when writing code reveals one, don't guess silently and don't stall:

- **Listed in 実装裁量, or no player-visible effect** (internal structure,
  helper naming): decide it yourself and move on. Mention player-visible
  choices you made under 実装裁量 in the completion summary.
- **Player-visible and not delegated** (a rule, a number, what happens in
  an edge case): collect all such gaps, then ask the user once with a
  recommended answer for each, and route the answers to `game-spec` as a
  revision before implementing that part. Parts of the spec that aren't
  affected can be implemented meanwhile.

### Completion criteria that are measured

When 完了条件 / テスト観点 holds a threshold on a ratio or a count
("下限を満たさない盤面は 10% 以下"), measure it with the spec's own numbers
as soon as the build works (a throwaway harness in the scratchpad; remove
anything you put in the tree with `git clean`), and put the result in the
completion summary. If it misses, do not change a number from the
パラメータ表 (attempts, probabilities, limits) in the code alone: show the
user a table of the measured results for the candidate values and route
the change through `game-spec`, like any other player-visible gap.

### If `src/proto/` exists (first implementation after `game-proto`)

That is the throwaway prototype, not code to build on. Read it for what the
spec doesn't say in code form (how a rule was implemented, what the
playtests tuned), then write the real implementation from the spec:

- Port the pure logic (`src/proto/logic.ts`, `params.ts`) into the real
  structure, adjusting it to the spec; carry nothing over wholesale
  because it happens to work.
- Write Scenes fresh under the Scene/preload/create/update rules below.
- Point `src/main.ts` back at `./game/main` (the prototype's
  `src/proto/main.ts` replaced that import) and remove `src/proto/` before
  declaring done: `git rm -r src/proto` if it was committed, otherwise
  `git clean -fd src/proto`. A committed prototype stays readable in the
  history; an uncommitted one is gone after this, which is what the user
  chose when `game-proto` asked about the WIP commit.
- A player-visible behavior that exists only in the prototype and not in
  the spec is a spec gap: ask via the "When the spec is silent" route.
  Don't silently keep it, don't silently drop it.

### If code already exists, implement the delta, not a rewrite

(This applies to code that is real implementation, not `src/proto/`.)

`status_impl` coming back to this skill after already having been `done`
once (check `<game-dir>/src` for existing files, not just the status key)
means there's working code to build on, not a blank slate. Figure out what
actually changed between the spec version that code was built against and
the current one — the conversation that led to this revision is usually
the fastest way to know exactly what changed and why, faster than diffing
prose by hand — and touch only the code that change affects. Rewriting
unaffected parts "while you're in there" is exactly the unrelated-change
problem the rules below warn about, just triggered by a spec revision
instead of a new request. Regression conditions in 完了条件 (added for an
extension from `game-extend`) list what this change must leave alone —
treat them as limits on the delta.

## Rules (AGENTS.md 3-4)

- One change, one purpose per session — don't mix in unrelated refactoring.
- Don't break existing feel (input response, speed, UI transitions) unless
  that's explicitly the point of this change.
- Separate Scene responsibilities (init / progress / result display); don't
  mix `preload`/`create`/`update` concerns.
- Keep per-frame work minimal; avoid needless object allocation in `update`.
- Manage game state explicitly — no global pollution.
- Register input listeners without duplication; clean them up on Scene
  shutdown.
- Assume static-site distribution only — no Node-server-only APIs, and
  asset paths must survive `vite build`.
- Dev-only QA state (`window.__qa`): write it inline inside
  `if (import.meta.env.DEV) { … }`, with its names and strings inside that
  block only (a field or method holding them stays in the production
  bundle). `game-check` verifies it.
- A Title Scene calls `showGameListLink(this)` (`import { showGameListLink }
  from 'game-list-link'`) in `create()`, so the published site shows a link
  back to the game list on the Title only. The Title's name, buttons and
  text stay clear of the link's area (top-left, a 24px pill with a 44px tap area, inside the
  safe area). `task newgame` already adds the dependency (`base.json`);
  `game-check` fails a Title that does not call it.
- Prefer what Phaser (or another library already in use) provides over
  hand-rolling the same behavior — camera shake, tweens, timers, text
  metrics. Keep only the game's own decisions (when, how much) in pure,
  tested logic.

### Known Phaser gotcha: Container custom hit-area coordinates

If a `Container` gets `setSize(w, h)` and then
`setInteractive(customShape, callback)` (the pattern for a non-rectangular
or off-origin hit area — e.g. `Geom.Circle` for a part that rotates, so the
hit area doesn't need to rotate with it), the `(x, y)` your callback
receives is **not** relative to the container's local origin `(0, 0)` — it's
offset by `(w * 0.5, h * 0.5)` (the Container's default origin). Define the
shape shifted by that same amount (e.g. `new Geom.Circle(radius, radius,
radius)` for a `setSize(radius*2, radius*2)` container), not centered on
`(0, 0)`. Missing this makes hit-testing silently wrong in a way that's easy
to misread as "the hit area is just too small" — confirmed by direct
instrumentation (logging the callback's `x, y` against the container's
known position) in `fukuwarai`, not by guessing from symptoms.

## Added by the flow conversion

- The review, the optional manual feel check, completion and the hand-off
  to `game-next` live in `flow.toml`.
- `fix_build` and `fix_review` have `max_visits = 3`; exceeding either
  ends at `blocked` (stage not done, report to the user).
- The feel-check loop (`offer_check` → `fix_feel` → `build`) has no limit:
  the user decides. A spec-level problem ends this flow at `to_spec`; the
  revision resets this stage and the flow is started again afterwards.
