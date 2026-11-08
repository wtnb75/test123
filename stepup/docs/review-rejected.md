# stepup: code review で見送った指摘

`game-codereview` が、見送った指摘を理由つきで残すファイルです（次の回・次のサイクルで同じ指摘を繰り返さないため）。仕様ではありません。

- `src/game/scenes/Game.ts` の update: 物理が可変 `dt` で進み、ジャンプの頂点がリフレッシュレートで変わる（60Hz 約 99.9 px、120Hz 約 102 px、30fps 約 95 px） — 理由: 差は最大でも約 5%。1/60 s の固定刻みにすると、スマホに多い 120Hz の画面でカクつく。仕様は固定刻みを許可しているが求めてはいない。QA・`game-balance` で端末差が見えたら再検討する
- `src/game/scenes/Game.ts` の `pending`: 案内（縦にしてください）が出たとき、ためたアクションが残り、案内が消えた直後に空打ちが起きる — 理由: `pending` に入るのは案内が出ていない間だけで毎フレーム消費される。残るのは、操作と向き変更が同じフレームに重なった 1 回分だけで、実際にはほぼ起きない
- `src/game/scenes/Game.ts` の render ほか: 毎フレーム小さなオブジェクトを作る（予告の三角形、`judge` のクロージャ、`pressAction` の `filter`） — 理由: 多くても 1 フレームに 10 個ほどで、AGENTS.md 4.2 の「不要な生成」に当たるほどではない。可読性を優先する（実装レビューでも許容と判断）
- `src/game/logic/sim.ts` の `0.5`、`src/game/logic/physics.ts` の `SCREEN_WIDTH * 2`: パラメータ表に無い数値の直書き — 理由: どちらも仕様の本文が固定している値（クリアの許容 `goalY + 0.5`、「画面より広い」足場）で、調整の対象ではない
- 3 つの Scene の `__qa` の重複と `window` への代入 — 理由: 開発専用で本番ビルドには入らない（`__qa` が `dist/` に無いことを `game-check` で確認済み）。他のゲームも同じ形
- `src/game/scenes/ui.ts`: `BG_CSS` と `BG_COLOR`、`COLOR.goalText` と `COLOR.goal` が同じ色を 2 回書いている — 理由: 見た目の細部（実装裁量）で挙動に影響しない。変えるときは同じファイルの隣の行
- `src/game/scenes/Game.ts` の開発専用 `warp` の `0.6` — 理由: QA 用のおおまかな位置合わせで、本番ビルドには入らない
- `src/game/scenes/Game.ts` の `onBlur`: blur で `pending` とキーの状態を消さない — 理由: キーは Phaser が blur で自動的にリセットする。`pending` は高々 1 フレーム分（案内のときと同じ）
- `src/game/logic/physics.test.ts` の「上昇中は通り抜ける」: `vy >= 0` の条件を確かめていない — 理由: 上昇中は前の足が上面以上にあれば新しい足は上面に届かないので、`vy >= 0` が無くても結果が変わらない（等価変異。変異チェックで確認済み）
