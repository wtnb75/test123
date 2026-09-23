---
name: game-spec
description: Use to write or update <game-dir>/docs/spec.md for a game in this monorepo — the required spec file per AGENTS.md section 2.4, and the file that carries this repo's workflow-progress frontmatter for game-next/game-status.
---

# game-spec

Write (or revise) `<game-dir>/docs/spec.md`. Per `AGENTS.md` 2.4, this file
must exist and be filled in **before** implementation starts, and any later
spec change must be made here first, with implementation/tests following.

## Inputs

- `PACKAGE=<game-dir>`. If not given, run `task game:detect` and confirm
  with the user before proceeding.

## Required content (AGENTS.md 2.4 — all of these, no placeholders)

ゲーム名 / コンセプト（1-3行） / ターゲットプレイヤー / コアループ / 操作仕様
/ 画面・Scene構成 / ルール（勝利・失敗・スコア条件） / MVP範囲 / 非MVP範囲 /
技術要件（Phaser/Vite/ESLint/Vitest） / テスト観点 / 完了条件

Pull concept/core-loop/target-player/scope from the `game-idea` conversation
if this is a first write. For a revision (e.g. coming out of
`game-balance`), only change the sections that actually changed and note
what changed in the conversation with the user — don't silently rewrite
unrelated sections.

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
before the six-stage reset below overwrites it:

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
  it, and check out a fresh branch from `main` before drafting anything:
  `git checkout main && git checkout -b <type>/<game-dir>-<slug>`. Pick
  `<type>` from context if it's obvious (a bug found in `game-qa`/
  `game-check` → `fix`; a `game-balance` tuning pass → `balance`; a new
  mechanic/stage/feature request → `feat`), but confirm it with the user
  rather than assuming — don't hardcode a fixed list, this varies by game.
  If that branch name already exists, don't reuse or overwrite it silently
  (same reasoning as `game-init`) — pick a different slug or append `-2`,
  `-3`, ... and tell the user.

### Any revision resets downstream stages — this skill's job, not the caller's

A revision to an already-`done` spec means everything downstream is now
potentially stale, no matter who asked for the revision — `game-balance`
tuning a number, `game-impl` finding mid-implementation that a mechanic in
the spec doesn't work, `game-qa` finding a rule doesn't match what's on
screen. Don't rely on the caller to remember this or to have its own reset
logic: handle it here, uniformly, every time, as part of completing a
revision (not a first write):

```
task game:status:set PACKAGE=<game-dir> STAGE=impl VALUE=pending
task game:status:set PACKAGE=<game-dir> STAGE=test VALUE=pending
task game:status:set PACKAGE=<game-dir> STAGE=check VALUE=pending
task game:status:set PACKAGE=<game-dir> STAGE=qa VALUE=pending
task game:status:set PACKAGE=<game-dir> STAGE=balance VALUE=pending
task game:status:set PACKAGE=<game-dir> STAGE=publish VALUE=pending
```

Run all six unconditionally — resetting a stage that's already `pending`
is a harmless no-op, and trying to guess which stages the change "actually
affects" is exactly the kind of judgment call that's easy to get wrong.
(If the caller is itself mid-flight or the stage this settles it into
looks different from what the caller expects, that's fine: `game-next`
will route back to wherever the pipeline actually is next.)

## Self-review (before showing the user)

Check the draft against these before presenting it, and fix anything that
fails inline rather than asking the user to catch it:

- **Placeholder scan**: no "TBD", "未定", empty sections, or vague
  one-liners standing in for a real answer.
- **Completeness**: all 12 required items from AGENTS.md 2.4 are present
  (see the list above) — go down the list and check each one off.
- **Internal consistency**: does MVP範囲 actually match what's described in
  コアループ/ルール (nothing described as core play that's simultaneously
  listed as non-MVP)? Does 操作仕様 agree with 画面・Scene構成 (e.g. a
  control that has no scene it's used in)?
- **Ambiguity**: could ルール（勝利・失敗・スコア条件） or 完了条件 be read
  two different ways by whoever implements them? If so, pick one meaning
  and make it explicit rather than leaving it open. Same for any Scene's
  internal state transitions (see 画面・Scene構成 above) — is every
  transition's trigger named, with no "and then it moves on somehow" gaps?
- For a revision: did you actually run the six downstream resets above,
  not just remember that they exist?
- For a revision: did you check `status_publish`'s value *before* resetting
  it, and branch accordingly (new branch only if it was `done`)?

## Completion

1. Draft the content below the existing frontmatter, self-review it, show
   it to the user, and get explicit approval — this is a design document
   other steps depend on, not a formality.
2. Once approved and the file is written:
   `task game:status:set PACKAGE=<game-dir> STAGE=spec VALUE=done`
3. Tell the user the next step is `game-impl`.
