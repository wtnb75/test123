---
name: game-impl
description: Use to implement or modify a game's Phaser.js code against its approved docs/spec.md, following this monorepo's Scene/preload/create/update discipline (AGENTS.md section 4).
---

# game-impl

Implement against the approved `<game-dir>/docs/spec.md`. Do not start this
skill if `status_spec` isn't `done` — send the user back to `game-spec`
first.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.

## Before writing code

`task game:status:set PACKAGE=<game-dir> STAGE=impl VALUE=in_progress`

Re-read `<game-dir>/docs/spec.md` fully — it is the source of truth for
scope. If what's being asked diverges from the spec, stop and route back to
`game-spec` first (AGENTS.md: 仕様変更時は spec.md を先に更新).

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
instead of a new request.

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

## Self-review (before completion)

Re-read the diff against these and fix anything that fails, don't just note
it:

- Does every changed file serve the one stated purpose of this session? Any
  drive-by refactor or formatting-only change to unrelated code should be
  reverted out.
- Check each rule in the list above individually against the diff (Scene
  responsibilities, `preload`/`create`/`update` separation, per-frame
  allocation, explicit state, listener cleanup) — don't just assume they
  were followed because they were kept in mind while writing.
- Does the implemented behavior match `docs/spec.md` exactly, including
  edge cases it specifies (boundary conditions, MVP-vs-non-MVP scope)? Flag
  anything implemented that the spec doesn't actually ask for.
- Existing feel (input response, speed, transitions) unchanged, unless that
  was the explicit point of this change.

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
2. No unrelated files touched.
3. `task game:status:set PACKAGE=<game-dir> STAGE=impl VALUE=done`
4. Tell the user the next step is `game-test`.

Don't run lint/full test/coverage here — that's `game-check`'s job. This
skill's job is working code against the spec, not the quality gate.
