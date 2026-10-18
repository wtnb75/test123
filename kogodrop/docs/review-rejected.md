# レビューで見送った指摘

`game-codereview` で見送った指摘と、その理由。次のレビューで同じ指摘を繰り返さないために残す（spec ではない）。

- `src/game/scenes/Game.ts`: `nextContainer` が宣言だけで読まれていない（TS6133） — 理由: 今回の変更の前からある。無関係なので、この PR では直さない
- `src/game/logic/retry.ts` `recordAnswer` / `Result.ts` の復習ボタン件数: `wrongEntries` に同じ語が重複して入り、Result の復習ボタンの件数（`totalCount - correctCount`）と Review の一覧が語数と合わないことがある — 理由: 既存の挙動（`docs/spec.md` のテスト観点に「重複して追加される」とある）。再挑戦の N は `id` で重複を除いているので影響しない
- `src/game/scenes/Result.ts`: ボタンの座標・高さの一部がリテラルのまま、y が `height` の比から絶対 px になった — 理由: spec が絶対 px（論理 540 × 960 固定）で書いている。この PR の目的の外
- `src/game/scenes/Review.ts`: `shutdown()` メソッドは Phaser から呼ばれない（イベントを登録していない） — 理由: 既存の挙動。新しい経路（再挑戦・もう一度・タイトルへ）はどれも `destroyOverlay` を通る
- `src/game/scenes/Review.ts`: オーバーレイの大きさ・配置が、画面の回転・リサイズに追従しない — 理由: 既存の挙動
