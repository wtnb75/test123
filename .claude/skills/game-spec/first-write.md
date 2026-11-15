# game-spec: the first write of a new game

## First write after `game-proto`

For a new game, `docs/spec.md` already has a body: the spec-lite and its
`## プレイテストで固まったこと` section (see `game-proto`). Build the full
spec from it, not from scratch:

- The パラメータ表 values and rules the playtests settled are the initial
  values — keep them, don't re-derive or re-tune them. Add the numbers the
  spec-lite didn't have (anything else with gameplay weight).
- Fill the missing required items (ターゲットプレイヤー, 画面・Scene構成,
  ルール, MVP/非MVP範囲, 技術要件, テスト観点, 完了条件, 実装裁量). 画面・Scene
  構成 describes the screens as the playtests ended up, not the prototype's
  single-Scene shortcut: add what a real game needs (title/result flow) as
  agreed with the user.
- Fold the playtest notes into the proper sections (rules into ルール,
  "why this number" into the table's meaning column, "must stay" items into
  完了条件), then remove the `> spec-lite:` banner and the
  `## プレイテストで固まったこと` and `## 見送ったこと` sections (the latter
  becomes backlog cards, below). The spec describes the current
  game, not how it got there.
- Technical requirements name which game rules are pure logic (hit tests,
  scoring, spawn rules, win/lose conditions) by their role, the way any
  spec does. Don't refer to `src/proto/` or its files — the spec has to
  stand on its own for a reader who never sees the prototype;
  `game-impl` reads the prototype for the details.

## Backlog from the first write

Whatever did not make the MVP is not lost: write
`<game-dir>/docs/backlog.md` in the same first write (header and card format
from `game-backlog`). Cards come from 非MVP範囲, the spec-lite's cut items,
ideas the `game-idea` conversation trimmed, and anything dropped in
`game-proto` playtests (with why in メモ). Rank them by how directly they
strengthen the core loop, or leave them in the order found when the user
hasn't ranked. A card needs a concrete problem (狙い); a bare "more
content" line isn't one. Show the backlog with the spec draft for approval.
It is not part of the spec, and `game-publish` ships it in the first PR.
Items dropped later by `game-impl` / `game-polish` are added the same way.
