# STAGE=backlog (self) — consumer: game-extend

Before committing `docs/backlog.md`:

- Does every card have all its fields (狙い with 根拠, 何を足すか, コアループへの
  効き方, 種別, 規模, 出どころ)? One-line leftovers converted?
- Does each 狙い name a concrete problem with the current game, and does its
  根拠 point to something checkable (a spec section, automated-play numbers
  with their conditions, or the user's words)? "More content" is not one.
- If automated play was run, are the numbers medians over stated conditions,
  and is what a simple bot can't show said plainly?
- Is the order the one the user agreed to (top = next up)?
- Were stale cards updated and solved ones dropped (with the reason in the
  PR body, not the file)?
- Are the `状態: 着手可` / `合意` fields of pinned cards kept as they were —
  or removed, and the user told, where this change altered what the card
  adds? For a card pinned in this change (`game-extend MODE=pin`): does
  `合意` have every line (足すもの / 操作 / 見た目と初期値の方向 /
  変えないもの / 意図して変えるもの / 測ったこと / spec の置き場所 /
  ブランチ), readable without the conversation, and is `基準` the commit
  `git log -1 --format=%h origin/main -- <game-dir>/src <game-dir>/docs/spec.md <game-dir>/docs/spec` gives?
- Was the user told that the open backlog PR holds its games out of
  `game-autopilot`, and that merging it soon is recommended?
- Is the change docs-only on a `docs/<game-dir>-backlog` (one game) or
  `docs/backlog-<slug>` (several games, one PR) branch from
  `origin/main`, with the throwaway harness removed?
