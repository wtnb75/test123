---
name: game-polish
description: Use after a game passes game-qa to improve how it looks and reads — hit/score/clear effects, input feedback, making it obvious what to touch and where to go next, readable HUD and screen flow — agreed with the user, recorded in docs/spec.md, and looped back through impl/test/check/codereview/qa.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-polish

`game-qa` confirms the game renders and plays as specced. A game can pass
that and still feel flat or confusing: nothing reacts when you tap, you
can't tell what's clickable, the result screen doesn't say how to retry.
This skill is for that layer — presentation and clarity — without touching
the rules or the tuning.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-polish/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

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
  screen, touch targets ≥ 44 CSS px, color never the only signal. The
  measurable checks (real text size after FIT, clipping, how much of the
  screen the board uses, black bars, control placement, the screen sizes to
  look at) are AGENTS.md section 4.6; run them, and take the whole-game
  picture with `scripts/qa/look.mjs`.
- **Browser tab**: `<title>` in `index.html` is the game's name and
  `public/favicon.png` is this game's own (see `task game:favicon`).

Out of scope — route elsewhere:

- numbers with gameplay weight (speeds, hit boxes, timing windows,
  scoring) → `game-balance`;
- new mechanics or rule changes → `game-spec` as a feature revision;
- bugs found along the way → `game-impl` (one change, one purpose).

## Implementation guardrails (pass these on to game-impl)

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

## Presentation-only revisions

When the current revision is presentation-only — `game-extend` classified
it so, or it is itself a polish change — and QA has just passed on it,
don't run polish, balance and the PR confirmation as three separate stops.
Ask **once**, with the QA screenshots:

1. does the look work (polish),
2. is the feel unchanged / still good (balance — say that no rule or
   gameplay number changed),
3. may the PR be committed, pushed and opened (publish).

If the user accepts all three, mark `polish` and `balance` done (their
`game-review` self-checks still apply — the screenshots and the explicit
answers are the evidence) and let `game-publish` run without asking its
confirmation again. If they want changes to the look, stay here and loop as
usual; if they want tuning, hand over to `game-balance`.

If a manual check of this revision was already requested (e.g. a
`share.sh` URL from `game-impl`), put the three questions (look / feel
unchanged and no rule or number changed / PR may be pushed) in that same
message, and treat the answer as covering only what was asked. If it
covered the look only, ask the other two before marking balance and
publish done.

## Autopilot

When `<game-dir>/.autopilot.md` exists (see `game-autopilot` "Autopilot
rules"), don't propose or ask. Check **the screenshots `game-qa` just took**
of the affected Scenes against section 4.6 of AGENTS.md — QA of this
revision shot them at the four sizes, so don't start the dev server and
container again for the same pictures. Shoot only what is missing (a size
or state QA did not cover) or what you changed here. Fix only what breaks
the agreed extension (cut-off text, overlap, targets under 44 px) as part of
that change, then run the review and mark the stage done. Extra polish is
left to the playtest.

## Coming back after an unrelated revision

A `game-balance` or bug-fix revision resets this stage too. If nothing
visual changed, don't invent new polish work: re-screenshot the affected
Scenes, confirm the existing effects still look right, and ask the user to
confirm before marking done.

## Showing screenshots to the user

Screenshots written to your scratchpad are not visible to the user, who is
often following from another device. When the user has to judge something by
eye (the proposal, the before/after of a change, the QA screenshots for a
combined confirmation), send the files with the `SendUserFile` tool if you
have it (`display: "render"`; a caption saying what to look at, and for a
before/after say which is which). Send the few that matter, not every
frame. Without that tool, say where the files are and describe what they
show, and ask the user to open them or to play the dev-server URL
(`scripts/qa/up.sh` prints one).

## Added by the flow conversion

- The process (observe, assess, propose, agree, record in the spec,
  hand-off to `game-impl`), the entries for re-visits, the review and
  completion live in `flow.toml`. The sections above describe the
  presentation-only, autopilot and unrelated-revision rules the entries
  follow.
- `fix_review` and `fix_review_both` have `max_visits = 2`; exceeding
  either ends at `blocked`. The `combined` loop (an answer covering only
  part of the three questions) has no limit: the user's answer ends it.
