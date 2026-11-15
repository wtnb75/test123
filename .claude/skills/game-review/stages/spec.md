# STAGE=spec (subagent) — consumer: game-impl

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
- **Effects** (演出・UI sections): every item of `game-spec`'s 演出・UI
  checklist is settled — trigger and same-frame cases, time rule, phase
  changes and restart, draw order, interplay with other effects, screen
  bounds, parameters and boundary test points.
- **State transitions**: every Scene's internal phases are named, and each
  transition's trigger is explicit (player action vs. timer vs. game-logic
  condition). No "and then it moves on".
- **Internal consistency**: MVP範囲 matches コアループ/ルール (nothing core is
  also listed as non-MVP); every control in 操作仕様 is used in some Scene;
  numbers in the パラメータ表 match any numbers in the prose.
- **Reachability**: for each rule, penalty and parameter, name a state in
  which it takes effect. A rule that another rule makes unreachable (a
  penalty for entering a hole of depth 3 when a rule forbids entering one)
  is removed or reworded.
- **No spec-lite leftovers** (first write after `game-proto`): the
  `> spec-lite:` banner and the `## プレイテストで固まったこと` section are
  gone, their content absorbed into the proper sections (ルール, パラメータ表,
  画面・Scene構成, 実装裁量), and nothing refers to `src/proto/`.
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
- **Spatial continuity** (only when the spec joins places in space):
  redo the hand-worked example for two exits or edges from the rules
  and check that the arrival lands where the walk leads; list any
  rule the example needs that the spec does not state.

Don't flag:
- anything the 実装裁量 section explicitly delegates;
- non-MVP features, or "it would be more fun if…" ideas (that's
  game-balance);
- exact tuning of a number that already has an initial value;
- for a revision: problems only in unchanged sections — report them as
  `should`, never `blocker`.
