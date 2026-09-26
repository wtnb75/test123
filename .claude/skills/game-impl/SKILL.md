---
name: game-impl
description: Use to implement or modify a game's Phaser.js code against its approved docs/spec.md, following this monorepo's Scene/preload/create/update discipline (AGENTS.md section 4).
---

# game-impl

Implement against the approved spec — `<game-dir>/docs/spec.md` plus every
`docs/spec/*.md` linked from its `## 拡張` section (see `game-spec` "Spec
layout"). Do not start this skill if `status_spec` isn't `done` — send the
user back to `game-spec` first.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.

## Before writing code

`task game:status:set PACKAGE=<game-dir> STAGE=impl VALUE=in_progress`

Re-read the spec fully (`<game-dir>/docs/spec.md` and its linked files) — it is the source of truth for
scope. If what's being asked diverges from the spec, stop and route back to
`game-spec` first (AGENTS.md: 仕様変更時は spec.md を先に更新).

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

### If code already exists, implement the delta, not a rewrite

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

## Review (before completion)

After `npm run build` succeeds, run `game-review STAGE=impl
PACKAGE=<game-dir>`. A fresh subagent checks the change against
`docs/spec.md` (every rule/parameter implemented, nothing invented,
parameters in one place, logic testable without Phaser) and the Phaser
rules above. Fix blockers; a finding that turns out to be a spec gap goes
to `game-spec` as described in "When the spec is silent".

## Before declaring done: does this need a human look first?

Playtesting and feel feedback are normally deferred to `game-qa` (does it
work) and `game-balance` (is it fun) — not this skill or `game-test`, so
that "broken" and "not fun" stay separate signals and cheap automated
checks run before human time is spent.

But if this session implemented something whose *feel* can't be judged by
reading the diff — a new input/gesture mechanic, physics- or math-heavy
interaction, timing-sensitive behavior, anything where "does this feel
right" genuinely can't be answered without touching it — say so explicitly
and offer the user a quick manual check (e.g. `npm run dev` and try it in
a browser) before moving on. This is the user's call, not a silent skip —
offer it, don't force it, and don't default to offering it for ordinary
changes that don't carry this risk.

**This can loop, and that's normal, not a failure.** If the check surfaces
real problems, some fixable here and some that are actually spec-level
decisions (an interaction rule, a scoring formula, a state-machine detail
the spec got wrong or left too vague) — fix what's implementation-only
directly, then route the rest to `game-spec` as a revision (see AGENTS.md:
仕様変更時は spec.md を先に更新). Once that revision lands you're back
here — re-read the updated spec, apply the delta (see above), and offer
another quick check if the changed part is still feel-sensitive. Treat
this as the expected shape of implementing a genuinely new mechanic, not
as something to route around: writing `game-test` cases before this
settles risks wasting that work on a mechanic that's still moving.

## Completion

1. `npm run build` succeeds (static output).
2. `game-review STAGE=impl` has no remaining blockers.
3. `task game:status:set PACKAGE=<game-dir> STAGE=impl VALUE=done`
4. Tell the user the next step is `game-test`.

Don't run lint/full test/coverage here — that's `game-check`'s job. This
skill's job is working code against the spec, not the quality gate.
