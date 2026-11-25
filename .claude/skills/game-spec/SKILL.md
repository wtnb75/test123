---
name: game-spec
description: Use to write or update <game-dir>/docs/spec.md for a game in this monorepo — the required spec file per AGENTS.md section 2.4, and the file that carries this repo's workflow-progress frontmatter for game-next/game-status.
allowed-tools: Bash(deskil --version), Bash(deskil flow:*)
---

Before anything else, run `deskil --version`. If the command is not found, tell the user to run `uv tool install git+https://github.com/wtnb75/deskil` and stop.

# game-spec

Write (or revise) `<game-dir>/docs/spec.md`. Per `AGENTS.md` 2.4, this file
must exist and be filled in **before** implementation starts, and any later
spec change must be made here first, with implementation/tests following.

Run this skill as a step-by-step flow:

1. Run `deskil flow start .claude/skills/game-spec/flow.toml --arg package=<game-dir>`.
2. Follow the instructions in the output. When the work is done, run the
   `next` command shown at the end of the output.
3. Repeat until the output ends with `Flow complete.`

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm
  with the user before proceeding.

## Required content (AGENTS.md 2.4 — all of these, no placeholders)

ゲーム名 / コンセプト（1-3行） / ターゲットプレイヤー / コアループ / 操作仕様
/ 画面・Scene構成 / ルール（勝利・失敗・スコア条件） / パラメータ表 / MVP範囲 /
非MVP範囲 / 技術要件（Phaser/Vite/ESLint/Vitest） / テスト観点 / 完了条件 /
実装裁量

**First write of a new game** (`status_spec` was `pending`; the file holds
the spec-lite from `game-proto`): read `first-write.md` next to this file
first — how to build the full spec from the spec-lite, and the backlog that
is written with it. A revision doesn't need that file.

For a revision (e.g. coming out of
`game-balance`), only change the sections that actually changed and note
what changed in the conversation with the user — don't silently rewrite
unrelated sections. Exception: if an older spec lacks a required section
that was added to AGENTS.md later (e.g. パラメータ表 / 実装裁量), add it as
part of the revision.

Write for a reader who wasn't in the conversation: `game-impl` (and the
`game-review` subagent) will see only the spec (this file and any
`docs/spec/*.md` it links to). Anything agreed in the conversation but
not written here is lost.

### Revisions coming from `game-extend`

`game-extend` hands over one agreed extension of a published game: what
is added and why, what must not change, where it goes (a split file or
the body — see "Spec layout" below), and a branch name. When writing it:

- Put it where `game-extend` decided. For a split file, also add its line
  to `## 拡張` in `docs/spec.md`.
- Write each "must not change" item as a regression condition in 完了条件
  and a matching case in テスト観点 — in the split file when there is one,
  otherwise in `docs/spec.md`. Don't add a separate section for them.
- Remove the item from 非MVP範囲 if it was listed there.
- Don't record history in the spec ("added in v2", changelogs). The spec
  always describes the current game; the why lives in the PR description
  and git history.
- A ratio or count threshold written into 完了条件 must come from a
  measurement with this spec's own numbers (a throwaway harness over
  seeded runs), not from a guess or from a probe that used other numbers.
  Put the measured value next to the threshold (in the parameter's
  meaning column or the condition), so `game-impl` can tell a regression
  from a miss.
- Update `<game-dir>/docs/backlog.md` in the same branch (create it if
  missing): remove the card this revision implements, and add the
  candidates the summary lists as "left for later" that aren't there yet,
  as cards in the `game-backlog` "Card format" (put why it was left in
  メモ), at the bottom unless the user ranked them. Keep the other cards'
  order. The backlog is not part of the spec — only the ranked list
  `game-extend` picks from (`game-backlog` maintains it).

`game-title` hands over the same way (a post-publish, presentation-only revision whose spec location is always `docs/spec/title-demo.md`, written from the template in `shared/title-demo/README.md`); its hand-over also carries the test / codereview / qa notes — write them into テスト観点 and 完了条件 of that file, with the "must not change" list as regression conditions.

### パラメータ表 and 実装裁量

- **パラメータ表**: a table of every number with gameplay weight — canvas
  size, object sizes, speeds, timers, counts, probabilities, limits,
  scoring coefficients — with an initial value and one-line meaning. The
  initial value only has to be reasonable; `game-balance` tunes it later.
  Prose elsewhere should refer to these names instead of repeating numbers.
- **実装裁量**: an explicit list of things `game-impl` may decide on its
  own (e.g. exact colors, easing curves, internal module structure,
  animation lengths under 0.3s). This separates "deliberately delegated"
  from "forgot to specify". Anything player-visible that is in neither the
  spec nor this list will be treated as a gap by `game-review`.

### 画面・Scene構成 needs more than a Scene table

A one-line-per-Scene table (name → role) is necessary but not sufficient.
Also include, inline or as a short subsection, whichever of these actually
apply to this game — skip what genuinely doesn't apply, don't pad:

- **Layout policy**: when a Scene has more than one meaningful spatial
  region (a play area vs. a tray/palette, a HUD, persistent buttons), say
  roughly where each one is (top/bottom/center is enough — not pixel
  coordinates). If the whole Scene is just "the play area," this can be a
  single sentence.
- **State transitions**: when a Scene has internal phases/states (a
  countdown before play starts, a reveal-then-hide step, a result overlay
  within the same Scene rather than a separate one), name the phases and
  say exactly what triggers each transition (a specific player action vs.
  a timer vs. a game-logic condition). "Various phases" is not enough —
  ambiguity here is exactly the kind of thing that stalls `game-impl`.
- **演出・UI** (usually added by a `game-polish` revision): the effects
  and UI cues each Scene has — what triggers each one, what it looks like,
  and whether input is accepted while it plays. Player-relevant durations
  and sizes go into the パラメータ表; cosmetic details (easing, tint) can
  be delegated in 実装裁量. Settle every item of the checklist below in the
  draft — they are the gaps the spec review kept finding in effect sections.

#### 演出・UI checklist

For each effect, write down (or delegate in 実装裁量, explicitly):

- **Trigger**: the exact event, which variants count (manual/automatic,
  every enemy kind, the boss…) and which don't; what happens when several
  fire in the same frame (one effect each, or one restart).
- **Time rule**: the shared "t = 0 on the trigger frame, gone at exactly
  D" convention (or why this one differs, e.g. "stays at 1 after the
  fade"), and whether a new trigger restarts or stacks.
- **Same-frame edges**: the trigger landing in the frame the phase changes
  (e.g. the last life lost → `ending`), and the order when two things in
  one frame feed the effect (e.g. a kill and its settlement).
- **Phase and restart**: does it play on through `ending` / result
  screens, is it cut off, and is nothing left after a restart?
- **Draw order**: which layer, relative to every other effect, the HUD and
  persistent buttons (name them).
- **Interplay**: other effects that can fire at the same time (a camera
  shake moving it, another popup at the same spot) — what the player sees.
- **Screen bounds**: text or shapes near the edges — clamp (by what size,
  measured how) or allowed to overflow.
- **Numbers in the パラメータ表** and **test points with hand-worked
  boundary values** (start, midpoint, exactly D), plus the regression
  conditions from the extension's "must not change" list.
- **Test seam**: through which data the effect is checked (the fields of
  the per-move result the Scene receives, a layout table, a timeline
  function). Don't write "a pure function" unless the implementation will
  have one; an effect drawn inside a Scene is checked through the data it
  is fed, and by QA.

## Spec layout: `docs/spec.md` plus linked files

A game's spec is `docs/spec.md` **and every `docs/spec/*.md` it links
to**. Anything that reads, hands over or reviews "the spec" (`game-impl`,
`game-test`, `game-review`, `game-qa`) uses all of them.

- `docs/spec.md` is the body and the index. It alone carries the
  `status_*` frontmatter and every AGENTS.md 2.4 required item for the base
  game. When at least one split file exists, it has a `## 拡張` section
  listing each one as a relative link with a one-line description:

  ```markdown
  ## 拡張

  - [タイムアタックモード](spec/time-attack.md) — 制限時間内のスコアを競う別モード
  ```

- Where a change goes:

  | Change | Where |
  |---|---|
  | An element with its own rules, parameters and screens (a new mode, a set of stages, a self-contained system, a new Scene) | a new `docs/spec/<slug>.md` |
  | A change to an existing element, or a small addition (changing an existing parameter, adding a button to an existing Scene) | edit the relevant section of `docs/spec.md` in place |
  | An extension that changes an existing rule (in `docs/spec.md` or another split file) | edit the file that owns that rule |

  Every file always describes the *current* spec. Never stack changes as
  diffs ("v2: speed is now 300").

- A split file has no frontmatter and has these sections, in this order,
  each filled in (write 「なし」 for one that genuinely doesn't apply —
  don't omit it): 概要（1-3行: 何を足し、コアループにどう効くか） /
  操作仕様（追加・変更分） / 画面・Scene構成（追加・変更分。レイアウト方針・
  状態遷移・演出・UI を含む） / ルール / パラメータ表 / テスト観点 / 完了条件 /
  実装裁量. The rules above for パラメータ表, 実装裁量 and 画面・Scene構成
  apply to split files too.
- Moving existing text out of `docs/spec.md` into split files is a
  docs-only change with no behavior change, run as its own cycle — read
  `split.md` next to this file when doing one ("Splitting an existing
  spec": its own `docs/<game-dir>-split-spec` branch, text moved verbatim,
  no downstream reset, a docs-only PR). `game-extend` offers this when
  `docs/spec.md` is over 400 lines. Accumulated 演出・UI sections are the
  usual first candidates (e.g. one `docs/spec/effects.md` holding them all).

## Progress frontmatter

`game-init` already created `docs/spec.md` with the frontmatter block
(`status_idea`/`status_init: done`, `status_spec: pending`, rest
`pending`) — this skill never creates that block itself, only the status
values change:

`task game:status:set PACKAGE=<game-dir> STAGE=spec VALUE=in_progress`

before drafting, and `VALUE=done` at completion (below). Don't touch the
frontmatter block by hand otherwise.

### A revision after publish needs its own branch — check before resetting anything

Before touching frontmatter or drafting, check the *current* value of
`status_publish` (`task game:status PACKAGE=<game-dir> STAGE=publish`) —
before the downstream reset below overwrites it:

- **First write** (`status_spec` was `pending`): no branch action. You're
  already on the branch `game-init` created (`feat/<game-dir>`).
- **Pre-publish revision** (`status_spec` was `done`, but `status_publish`
  is not `done` yet — e.g. `game-balance` iterating before the game has
  ever shipped): still no new branch. Keep working on the same
  `feat/<game-dir>` branch — this is normal, expected iteration on work
  that hasn't been proposed as a PR yet.
- **Post-publish revision** (`status_publish` is currently `done` — this
  game already has a merged PR, and this is a follow-up change): this
  needs a *new*, distinctly-named branch, not a reuse of the old
  `feat/<game-dir>` (which may already be deleted, and mixing a fix into a
  branch named after the original feature is confusing history). Ask the
  user what kind of change this is and a short kebab-case slug describing
  it, and check out a fresh branch from `origin/main` before drafting
  anything: `git fetch origin && git checkout --no-track -b <type>/<game-dir>-<slug> origin/main`
  (not `git checkout main`: in a worktree session `main` may be checked out
  elsewhere, and `origin/main` is the up-to-date base). Pick
  `<type>` from context if it's obvious (a bug found in `game-qa`/
  `game-check` → `fix`; a `game-balance` tuning pass → `balance`; a new
  mechanic/stage/feature request → `feat`; anything coming from
  `game-extend` or a 着手可 card → the branch name agreed there, `feat/…`
  or, for a restructuring with no player-visible change, `refactor/…` —
  that agreement is the confirmation), but otherwise
  confirm it with the user
  rather than assuming — don't hardcode a fixed list, this varies by game.
  If that branch name already exists, don't reuse or overwrite it silently
  (same reasoning as `game-init`) — pick a different slug or append `-2`,
  `-3`, ... and tell the user. Then
  `task game:status:set PACKAGE=<game-dir> STAGE=spec VALUE=in_progress`
  before drafting (the downstream reset happens at completion).

### Any revision resets downstream stages — this skill's job, not the caller's

(Except a verbatim split — see `split.md`, and a
clarification-only revision — see below.)

A revision to an already-`done` spec means everything downstream is now
potentially stale, no matter who asked for the revision — `game-balance`
tuning a number, `game-impl` finding mid-implementation that a mechanic in
the spec doesn't work, `game-qa` finding a rule doesn't match what's on
screen. Don't rely on the caller to remember this or to have its own reset
logic: handle it here, uniformly, every time, as part of completing a
revision (not a first write):

```
task game:reset PACKAGE=<game-dir>
```

This sets `impl`, `test`, `check`, `codereview`, `qa`, `polish`, `balance`
and `publish` back to `pending` in one go (a stage that has no key yet gets
one). For a normal revision, always run it in full (the only exceptions are
the verbatim split and the clarification-only revision named above) — resetting a stage that's already `pending`
is a harmless no-op, and trying to guess which stages the change "actually
affects" is exactly the kind of judgment call that's easy to get wrong.
(If the caller is itself mid-flight or the stage this settles it into
looks different from what the caller expects, that's fine: `game-next`
will route back to wherever the pipeline actually is next.)

### Clarification-only revisions

Sometimes a revision only writes down what the implementation already
does and was never in doubt — typically a `game-codereview` finding
classified **spec (clarify)**: a draw order the code already follows, a
wording that was inaccurate about existing behavior, an edge case the code
handles in the only sensible way. Such a revision:

- changes no player-visible behavior and needs **no** code change — if the
  code would have to change to match, it is a normal revision;
- still goes through `game-review STAGE=spec` and the user's approval
  (usually folded into the question that raised it);
- resets only the stages after `codereview` —
  `qa`, `polish`, `balance`, `publish` — with
  `task game:reset PACKAGE=<game-dir> FROM=qa`, because the implementation,
  tests and gate are untouched; say in the conversation which finding it
  records and why nothing earlier needs to run again.

## Added by the flow conversion

- The review and completion steps (review, approval, the downstream reset,
  `status:set … done`, the hand-off to `game-next`) live in `flow.toml`.
- `fix_review` and `split_fix` have `max_visits = 2`. Exceeding `fix_review`
  goes on to the user's approval (with the remaining findings); exceeding
  `split_fix` ends at `blocked`.
- Autopilot (`<game-dir>/.autopilot.md` exists) skips the approval; a
  question the agreement does not answer still goes to the user.
