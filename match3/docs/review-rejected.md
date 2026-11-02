# match3 のコードレビューで却下した指摘

`game-codereview` で却下した指摘と、その理由です。同じ指摘を繰り返さないために残します（仕様ではありません）。

- `src/game/scenes/Game.ts` の `attempt()` / `showHint`: 途中で例外が出ると `phase` が固まる、`gems` が null だとヒントが例外を出す — 理由: 画面の石（`gems`）と盤面（`round.board`）は同じ手順（`steps`）で更新していて、ずれる経路が無い。`catch` で握りつぶすとバグが隠れる。
- `src/game/scenes/ui.ts` / `src/game/logic/layout.ts`: 案内の文字の大きさ・ボタンの枠線・配置のオフセットが直書き — 理由: 配置のオフセットは spec の本文で位置を固定していて、手計算の値としてテストで確認している。案内・ボタンの枠はゲーム性に関わらず、調整するなら `game-polish` で扱う。
- `src/game/logic/board.ts` の `findMove`: 候補の交換ごとにフルの `findMatches` を呼ぶ無駄 — 理由: 8 × 8 では体感できない。シャッフルの 100 回の試行に達するのは、ごくまれな場合だけ。
- `src/game/logic/round.test.ts` の `Round.reshuffle`（並べ直し）のテストが乱数の種に依存する — 理由: 乱数は固定した種で結果は決まっている。種を変えたときの心配で、失敗しても「作り直しに落ちた」と分かる。
- `src/game/scenes/Game.ts` の `bumpScore`: 連鎖で強調が重なると数字が 1.0 に戻ってから再び膨らむ — 理由: spec が「1.0 から数え直す」と定めた挙動そのもの。
- `src/game/scenes/Game.ts` の `popup`: 倍率を 2 か所で計算している — 理由: 倍率は `size` の 1 か所で求めて、切り詰めと文字の大きさの両方に使っている。
- `src/game/logic/score.ts` の `clampPopup`: 倍率の引数が省略できる / 盤面が小さいと y の範囲が逆転する — 理由: 既定値 1.0 は従来の動作で、呼び出し元は倍率を渡している。今の盤面（8 × 8、1 マス 44）では範囲は逆転しない。盤面の大きさを変えるときは spec の改訂で扱う。
- `src/game/scenes/Game.ts` の `?qapopups`（開発ビルド専用の確認用フラグ）が入力と重なる — 理由: 開発ビルド専用で本番に出ない。
- `src/game/scenes/Game.ts` の `refreshHud`: 色が変わらなくても `setColor` が再描画する — 理由: 呼ばれるのは消去ごとで毎フレームではなく、体感できない。
