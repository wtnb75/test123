---
name: game-polish
description: Use after a game passes game-qa to improve how it looks and reads — hit/score/clear effects, input feedback, making it obvious what to touch and where to go next, readable HUD and screen flow — agreed with the user, recorded in docs/spec.md, and looped back through impl/test/check/codereview/qa.
---

# game-polish

`game-qa` confirms the game renders and plays as specced. A game can pass
that and still feel flat or confusing: nothing reacts when you tap, you
can't tell what's clickable, the result screen doesn't say how to retry.
This skill is for that layer — presentation and clarity — without touching
the rules or the tuning.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm.
- Requires `status_qa: done` for this game.

## What belongs here (and what doesn't)

In scope:

- **Feedback / effects**: every player action and every scoring, damage,
  clear or failure event gets a visible (and, if the game has sound, audible)
  response — tweens, flashes, particles, score pop-ups, light screen shake,
  scene transitions (fade/slide).
- **Affordance**: what can be touched looks touchable (button shape,
  hover/press state, pulsing hint on the first thing to do); what can't,
  doesn't.
- **Flow (動線)**: how the player gets from title → play → result → retry,
  and how many taps it takes; a first-time player knows what to do within a
  few seconds without reading the README (a one-line hint, a demo motion, a
  highlighted first target).
- **Readability**: HUD placement and size, contrast, text size on a phone
  screen, touch targets ≥ 44 CSS px, color never the only signal.
- **Browser tab**: `<title>` in `index.html` is the game's name and
  `public/favicon.png` is this game's own (see `task game:favicon`).

Out of scope — route elsewhere:

- numbers with gameplay weight (speeds, hit boxes, timing windows,
  scoring) → `game-balance`;
- new mechanics or rule changes → `game-spec` as a feature revision;
- bugs found along the way → `game-impl` (one change, one purpose).

## Process

`task game:status:set PACKAGE=<game-dir> STAGE=polish VALUE=in_progress`

1. **Observe.** Reuse `game-qa`'s Docker+Playwright setup (AGENTS.md 9).
   Screenshot every Scene and state, at a desktop size and a phone-sized
   viewport (e.g. 390×844). For effects and transitions a single shot
   isn't enough — take a short burst (e.g. every 50-100 ms across the
   event) so motion can be judged. Clean up the container and dev server
   afterwards, as in `game-qa`.
2. **Assess** against the in-scope list above. For each problem, note the
   Scene/state and the screenshot that shows it.
3. **Propose** a numbered list of concrete changes, ordered by impact:
   clarity problems (player doesn't know what to do) first, missing
   feedback second, pure juice last. Each item: what changes, where
   (Scene/state), why (which observed problem), rough cost, and any risk
   (performance, input delay). "Add more juice" is not a proposal;
   "score +N text rises 40 px and fades over 0.5 s at the catch point" is.
4. **Agree with the user.** Taste is theirs — ask once which items to do
   (or "全部" / "上から N 件").
5. **Record in the spec first** (AGENTS.md 2.4). Invoke `game-spec` as a
   revision: agreed effects and UI go into 画面・Scene構成 (an 演出・UI
   subsection per Scene or one shared list), durations and sizes that
   matter to the player go into パラメータ表, and details that genuinely
   don't matter (exact easing, particle tint) go into 実装裁量.
   `game-spec` resets the downstream stages itself.
6. **Implement** via `game-impl`, then the normal chain runs again:
   test → check → codereview → qa → back to this skill.

### Implementation guardrails (pass these on to game-impl)

- Effects never delay input: no animation on the input path that blocks
  the next action, unless the spec explicitly says input is ignored during
  it.
- No allocation per frame: create particle emitters, tweens' targets and
  text objects once and reuse them; cap particle counts.
- Keep effect logic out of rule logic — rules stay pure and testable,
  effects hang off events/state changes in the Scene.
- Draw with Phaser Graphics / generated textures as the rest of the repo
  does. Don't pull in external image, font or sound assets without asking
  the user (licensing, and it's a new dependency).
- Keep flashes and shake mild (no full-screen strobing).

## Coming back after an unrelated revision

A `game-balance` or bug-fix revision resets this stage too. If nothing
visual changed, don't invent new polish work: re-screenshot the affected
Scenes, confirm the existing effects still look right, and ask the user to
confirm before marking done.

## When to stop looping

Like `game-balance`, only the user decides it looks good enough. Show
before/after screenshots of each change and ask explicitly.

## Review (before completion)

Run `game-review STAGE=polish PACKAGE=<game-dir>` — a self-review against
its `STAGE=polish` checklist — before marking this stage done.

## Completion

1. Agreed changes are in the file that owns the element (`docs/spec.md`
   or its `docs/spec/<slug>.md`), implemented, and QA has passed on the
   polished version.
2. The user confirmed the look and flow.
3. `task game:status:set PACKAGE=<game-dir> STAGE=polish VALUE=done`
4. Tell the user the next step is `game-balance`.
