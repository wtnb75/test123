# レビューで見送った指摘

`game-codereview` で見送った指摘と、その理由。次のレビューで同じ指摘を繰り返さないために残す（spec ではない）。

- `src/game/core/analysisJob.ts`: 1 回の Worker のエラー・応答の遅れで、以降ずっと同期実行になる — 理由: spec が「以降の要求も同期実行」と決めている（`docs/spec/analysis-async.md` の「フォールバック」「応答のない Worker」）。再試行は別の目的
- `src/game/scenes/Game.ts` 編集の確定: 盤面が変わらなくても解析を要求する、連続した編集のたびに Worker を作り直す — 理由: spec が「編集の確定のたびに解析を始め、走っている解析を打ち切る」と決めている。省略・間引きは合意の外
- `src/game/core/analysisView.ts` `TECHNIQUES` / `src/game/scenes/Game.ts` `techLabels`: 手筋の一覧が `solver.ts` と合わせて 3 か所にある — 理由: パネルの表示は元から Game.ts に並びを持っていた。この変更の目的の外
- `src/game/scenes/Game.ts` パネル: 手筋の回数の色を表示文字（`'0'`・`'-'`）で決める、`timeout: 3s` の文字が直書き — 理由: 元からの書き方（`3s` の文字は元からある）。動作に影響しない
- `src/game/core/analysisView.ts`: `canCopy` / `copyBlockedMessage` / `playWarningOnArrival` が小さなラッパーで重複する — 理由: テストできる純関数として切り出した結果。動作に影響しない
- `src/game/core/analysisJob.ts`: Worker の解放が `stopRunning`・`dispatch`・`handleFailure`・`fallBack`・`dispose` に分かれる — 理由: 機能の不具合はない。リファクタリングは別の目的
