---
name: game-review
description: The stage-exit review for this monorepo's game workflow — called by each game-* skill before it marks its stage done (STAGE=idea/extend/init/spec/impl/test/check/codereview/qa/polish/balance/publish). Holds every stage's review checklist in one place; spec/impl/test are reviewed by a fresh subagent, the rest by self-review.
---

# game-review

One place for "is this stage really ready to hand off?". Each `game-*` skill
calls this with its own stage before marking itself `done`. This skill does
not change status keys — the calling skill does that after the review
passes.

## Inputs

- `STAGE=<stage>` — the stage being completed.
- `PACKAGE=<game-dir>` (not needed for `STAGE=idea`; required for `STAGE=extend`).

## Principle: review for the next stage's needs

A stage is done when the **next** stage can start without guessing, not
when its own output merely looks complete. Each checklist below is written
from the point of view of whoever consumes the output next (e.g. the spec
checklist asks "can someone implement this without inventing anything?").

## Method per stage

| STAGE | Reviewer | Why |
|---|---|---|
| `spec`, `impl`, `test` | **Fresh subagent** (see below) | The output is consumed by the next stage; the author fills gaps from conversation context without noticing |
| `idea`, `extend`, `init`, `check`, `codereview`, `qa`, `polish`, `balance`, `publish` | Self-review against the checklist | Mechanically verifiable, or the user's subjective call — a subagent would only re-derive context (`codereview` already ran its own independent reviewer) |

### Running a subagent review

Launch one `general-purpose` agent (Agent tool). Give it **only**:

- the game directory, the stage, and the stage's checklist copied from this
  file (the "Checklist" subsection verbatim, including its "Don't flag"
  list);
- the artifacts to read (listed per stage below);
- for a revision: a 1-3 line summary of what changed and why, so it can
  focus on the changed parts — nothing else from the conversation.

Don't pass the conversation, design rationale, or your own opinion of the
output: the point is to see whether the artifact stands on its own.

Tell the agent: read-only (no edits, no git state changes), and return
findings in this format, blockers first:

```
- [blocker|should|nit] <location: file:line or spec section>
  problem: <what's missing/wrong>
  impact: <what the next stage would have to guess, or what breaks>
  suggestion: <concrete fix, or the question to ask the user>
```

and, when there are none, say `no findings` explicitly.

### Severity

- **blocker** — the next stage would have to invent a player-visible
  behavior or value, the output contradicts the spec / AGENTS.md, or
  something is plainly broken. Blocks completion.
- **should** — worth fixing, but the next stage can proceed without it.
- **nit** — wording, style, taste.

### Handling findings (keep it moving)

1. Check each finding before acting on it — the reviewer lacks context and
   can be wrong. Discard a finding only with a stated reason.
2. Fix blockers that you can resolve from facts already agreed (the
   concept, earlier user answers, AGENTS.md).
3. Blockers that need a decision only the user can make (a rule, a number
   with gameplay weight): collect them and ask the user **once**, together
   — not one question per round.
4. Re-run the review after fixing blockers. **At most 2 review rounds.**
   Anything still flagged after round 2 goes to the user as a list with
   your recommendation, instead of a third round.
5. `should`/`nit`: fix the cheap ones; show the rest to the user in one
   short list at completion. They never block.
6. Report to the user in one short block: rounds run, blockers fixed,
   questions answered, remaining should/nit.

---

## STAGE=idea (self)

Before summarizing the concept to the user:

- Does the concept fit in 1-3 lines, or is it several ideas stitched
  together?
- Is the MVP a single core loop, not multiple independent systems?
- Do target player and input spec agree (e.g. not keyboard-only for a
  "phone, spare time" audience)?
- Does the suggested `<game-dir>` name collide with an existing game?
- Is there enough to write a spec from: concept, target player, core loop,
  main input device, MVP / non-MVP scope?

## STAGE=extend (self) — consumer: game-spec

Before summarizing the agreed extension to the user:

- Is `status_publish` `done`? If not, did the user get the right reason
  (untracked / unfinished revision / not yet shipped)?
- Is it exactly one extension? Were the others split off and named as
  later cycles?
- Is the reason a concrete problem with the current game (what feels
  missing or dull), not just "more content"?
- Is its effect on the core loop stated (deepens it / widens it)?
- Are added or changed controls stated, or explicitly "none"?
- Is the direction for looks and initial numbers stated?
- Is there an explicit "must not change" list (controls feel, rules,
  scoring, difficulty), and is every intended change to existing behavior
  agreed as such?
- Does it fit one PR? If code structure has to change, was the user told?
- Is the spec location decided by the `game-spec` "Spec layout" rule
  (a new `docs/spec/<slug>.md` vs. editing `docs/spec.md`)? If
  `docs/spec.md` is over 600 lines, was the separate split cycle offered?
- Is there a branch slug that doesn't collide with an existing
  `feat/<game-dir>-<slug>` branch?

## STAGE=init (self)

- Is the current branch `feat/<game-dir>` (or the next free `-2`/`-3`/...
  variant), branched from `main`?
- Did `task newgame` finish — is `<game-dir>/package.json` the merged
  version (has `catalog:` deps from `base.json`)?
- Is `<game-dir>` registered in `pnpm-workspace.yaml` and as a
  commented-out line in `Taskfile.yml` `GAMES`?
- Does `<game-dir>/docs/spec.md` have all 11 `status_*` keys, `idea`/`init`
  `done`, the rest `pending`?
- Did `pnpm install` run (`<game-dir>/node_modules` exists,
  `pnpm-lock.yaml` changed)?
- Does `package.json` `description` describe this game?
- Was `task game:favicon` run (`public/favicon.png` differs from
  `scaffold/base-template/public/favicon.png`)? If it failed, was the user
  told?

## STAGE=spec (subagent) — consumer: game-impl

Artifacts for the subagent: `<game-dir>/docs/spec.md` and every
`<game-dir>/docs/spec/*.md` (the spec is all of them — see `game-spec`
"Spec layout"), `AGENTS.md` sections 2.4 and 4. For a revision, the change
summary — for an extension, including its "must not change" list.

Run this **before** showing the draft to the user for approval, so the user
approves a spec that has already been through review.

### Checklist

- **Required items**: all items listed in AGENTS.md 2.4 are present, with no
  "TBD", "未定", empty section or placeholder one-liner.
- **Implementer dry run** (the core check): for each Scene, mentally write
  its `create` and `update` from the spec alone. List every value or
  behavior you would have to invent. Each one must be either stated in the
  spec or covered by the 実装裁量 section. Typical gaps:
  - numbers: canvas size, object sizes, speeds, durations/timers, counts,
    probabilities, limits — an initial value is enough (game-balance tunes
    it later), but there must be one (in the パラメータ表);
  - content: are levels/questions/items a fixed list or generated? If
    generated, the rule, and any guarantee (e.g. "always solvable",
    "no duplicates within a round");
  - randomness: what is random, what isn't;
  - input details: tap vs. drag threshold, long press, what happens on
    simultaneous inputs, periods when input is ignored (during animations,
    countdowns, result overlays);
  - edge cases: ties, win and lose conditions met in the same frame/move,
    zero and maximum values, what happens when the player does nothing;
  - scoring: the formula, and how it is displayed;
  - persistence: is anything kept across sessions (high score, settings)?
    If yes, where (e.g. `localStorage`) and what happens when it's
    unavailable;
  - presentation: drawing policy (Phaser Graphics vs. image assets), text
    language, rough layout of each Scene's regions.
- **State transitions**: every Scene's internal phases are named, and each
  transition's trigger is explicit (player action vs. timer vs. game-logic
  condition). No "and then it moves on".
- **Internal consistency**: MVP範囲 matches コアループ/ルール (nothing core is
  also listed as non-MVP); every control in 操作仕様 is used in some Scene;
  numbers in the パラメータ表 match any numbers in the prose.
- **Unambiguous rules**: ルール and 完了条件 cannot be read two ways.
- **Testability**: 技術要件 names which logic is pure (testable without
  Phaser) vs. Scene glue, and テスト観点 lists concrete cases (boundaries,
  failure paths), not just "test the logic".
- **Verifiable 完了条件**: each condition can be checked by a test, a
  command or a screenshot.
- **Split files** (when `docs/spec/` exists): every link in `## 拡張`
  resolves, every `docs/spec/*.md` is linked from `## 拡張`, only
  `docs/spec.md` has frontmatter, and each split file has all its required
  sections (概要 / 操作仕様 / 画面・Scene構成 / ルール / パラメータ表 /
  テスト観点 / 完了条件 / 実装裁量, 「なし」 allowed).
- **Regression conditions** (extension revision): every "must not change"
  item in the change summary appears in 完了条件 and テスト観点.

Don't flag:
- anything the 実装裁量 section explicitly delegates;
- non-MVP features, or "it would be more fun if…" ideas (that's
  game-balance);
- exact tuning of a number that already has an initial value;
- for a revision: problems only in unchanged sections — report them as
  `should`, never `blocker`.

## STAGE=impl (subagent) — consumer: game-test

Artifacts for the subagent: `<game-dir>/docs/spec.md` and every `docs/spec/*.md` it links to; the change set —
`git diff main -- <game-dir>` plus untracked files from
`git status --porcelain --untracked-files=all -- <game-dir>` (for a first
implementation, simply all of `<game-dir>/src`); AGENTS.md section 4.

Run after `npm run build` succeeds, before offering the user a manual
check.

### Checklist

- **Spec conformance**: for each rule, state transition and parameter in
  the spec (spec.md and its linked files), point to where it is
  implemented. Anything missing is a blocker;
  anything implemented that the spec doesn't ask for is a blocker unless
  it's an implementation detail with no player-visible effect.
- **Invented behavior**: any player-visible behavior decided in code that
  the spec neither states nor delegates in 実装裁量 → blocker (route to a
  spec revision, don't just accept it).
- **Parameters**: values from the パラメータ表 live in one place (constants
  / config), not scattered literals, so game-balance can tune them.
- **Testability for game-test**: game logic is separable from Scenes (pure
  functions/classes); time and randomness are injectable.
- **Phaser rules (AGENTS.md 4.2)**, each checked individually: Scene
  responsibilities separated; `preload`/`create`/`update` not mixed; no
  needless allocation in `update`; explicit state, no globals; input
  listeners registered once and cleaned up on shutdown.
- **Distribution (4.3)**: no Node-server-only APIs; asset paths survive
  `vite build`.
- **Scope**: every changed file serves this change's one purpose — no
  drive-by refactors or unrelated formatting.
- **Revision**: only the parts affected by the spec change were modified;
  existing feel (input response, speed, transitions) is unchanged unless
  that was the point.

Don't flag: test coverage (game-test), lint style (game-check), fun/tuning
(game-balance).

## STAGE=test (subagent) — consumer: game-check

Artifacts for the subagent: `<game-dir>/docs/spec.md` and every
`docs/spec/*.md` it links to (especially テスト観点, ルール and 完了条件),
the test files and the source they cover, the latest
`npm run test:coverage` summary, and for a revision
`git diff main -- <game-dir>` limited to test files.

### Checklist

- **Spec traceability**: every item in テスト観点, every rule boundary and
  every failure condition in ルール has at least one test. Missing ones are
  blockers.
- **Names** describe behavior and condition, not "test1" or the function
  name.
- **Not tautological**: expected values come from the spec or are derived
  by hand/oracle, not re-computed with the implementation's own logic or
  copied from its current output (unless labelled as a characterization
  test).
- **Determinism**: time, `Math.random()` and external state are injected or
  mocked, never used directly in assertions.
- **Logic-heavy modules** (see game-test): an independent oracle exists;
  the mutation spot-check was done and its result reported; random or
  exhaustive loops assert non-zero counts of the interesting outcomes;
  rejection tests fail only for the check they are named after.
- **Coverage**: ≥90% on all four metrics without lowered thresholds or new
  `coverage.exclude` entries for testable code.
- **Existing tests kept** (revision): no existing test was deleted, or had
  its assertion loosened or its expected value changed, to make the change
  pass — unless the spec changed that behavior. Each regression condition
  in 完了条件 has a test that would fail if that behavior changed.

Don't flag: Scene rendering glue that is reasonably left to game-qa.

## STAGE=check (self) — consumer: game-qa

- All four commands (lint, test, test:coverage, build) passed in the last
  run, from the top, after the last fix.
- Was any failure masked instead of fixed (new lint-disable comment, looser
  assertion, lowered threshold)? Masked doesn't count.
- Do lint-disable comments in the diff carry a reason and minimal scope?
- Does `public/` contain any file not referenced by `src/` or `index.html`?
- If the build setup changed: does `dist/` actually look like a working
  static site?

## STAGE=codereview (self) — consumer: game-qa

- Did the user make the accept/reject call, once per round, on a table
  with your recommendation — not you alone?
- Was each finding checked against the code before it was recommended,
  and does every rejected one have a stated reason?
- Does every accepted correctness fix have a regression test that failed
  before the fix?
- Did findings that change player-visible behavior go to `game-spec`
  instead of being fixed straight in code?
- Did the four `game-check` commands pass after the *last* fix?
- Does the diff contain only the accepted fixes — no drive-by refactoring?
- Did the loop end properly (a round with nothing accepted, or round 3
  with the rest handed to the user)?

## STAGE=qa (self) — consumer: game-polish

- Is there a screenshot for every Scene and every state transition named in
  the spec — spec.md and its linked files (title, mid-play, clear,
  game-over, overlays)?
- For a revision: besides the changed parts, was every existing Scene/state
  re-shot and checked against the regression conditions in 完了条件?
- For each screenshot, can you say which spec rule/Scene it confirms?
- Is each 完了条件 in the spec (spec.md and its linked files, including
  split files' regression conditions) checked by either a screenshot or
  an earlier stage (test/check)? List any that nothing checked.
- Was feel (speed, hit detection, transition timing) judged against the
  spec, not just "it rendered"?
- Were the QA container and dev server actually cleaned up?

## STAGE=polish (self) — consumer: game-balance

- Was every Scene/state looked at on both a desktop and a phone-sized
  viewport, with bursts of frames for effects and transitions?
- Is each implemented change one the user picked, recorded in the file
  that owns it (演出・UI / パラメータ表 / 実装裁量) before it was
  implemented?
- Did anything with gameplay weight (speed, hit box, timing window,
  scoring) sneak in? That belongs to `game-balance` — back it out.
- Do effects leave input responsive, and are emitters/tweens/texts created
  once rather than per frame?
- Can a first-time player tell what to touch first and how to retry,
  from the screenshots alone?
- Are `<title>` and `favicon.png` this game's own?
- Did QA pass again on the polished version, and did the user confirm the
  look with before/after screenshots?

## STAGE=balance (self) — consumer: game-spec (revision) / game-publish

- Is every proposed change a specific number with a reason ("spawn interval
  1.2s → 0.9s, the 3s gap before the first obstacle felt dead")?
- Does the file that owns the element record the reason, not just the
  new number, and is the パラメータ表 updated?
- After an extension: was the existing difficulty curve and pacing judged
  with the new element in play, not only the new element on its own?
- Did the user explicitly say the current feel is good enough to ship?

## STAGE=publish (self) — consumer: the PR reviewer

- Does `README.md` let a stranger understand the goal, rules and controls?
- Is `status_balance` genuinely `done` (user signed off)?
- Is `public/favicon.png` this game's own, not the template's stock icon?
- First publish: is the `Taskfile.yml` `GAMES` line for this game actually
  uncommented? Post-publish revision: it already was — does the diff leave
  `Taskfile.yml` untouched?
- Post-publish revision: does `README.md` reflect the changed rules and
  controls, and does the PR body say what was added and why?
- Is the branch not `main`, and does `git show --stat` touch only files
  that belong to this change?
