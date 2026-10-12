# コードレビューで見送った指摘（calc1）

`game-codereview` が見送った指摘と、その理由です。次のレビュー（拡張のたび）で同じ指摘を繰り返さないための記録です。仕様ではありません。

- `src/game/titleDemo.ts`（盤面の幾何）: 行の高さ・ボタンの寸法・x が `Game.renderTable` と重複している — 理由: spec（title-demo.md の「レイアウト」）が値を決めている。`Game` の盤面は見た目を変えない方針で触らない。次に盤面を触るときに統合する
- `src/game/titleDemo.ts`（問題の生成）: `Game.startRound` の「200 回・フォールバック」の複製 — 理由: `Game` のロジックを触らない。値は spec の表で `Game` と同じと決めている。共通化は別の変更で
- `src/game/titleDemo.ts`（`DemoState.result`）: `progress.won` と同じ値の二重持ち — 理由: 整理のみ（1 変更 1 目的）。spec とテストの対応がそのまま読める
- `src/game/titleDemo.ts` / `Title.ts`（ラベルの色のリテラル）: palette に入っていない — 理由: 見た目の整理のみ（1 変更 1 目的）
- `docs/backlog.md`: 機能のブランチに混ざっている — 理由: `game-spec` の手順で、採用したカードの削除と後回しの候補の追記を、拡張と同じブランチで行うと決まっている
