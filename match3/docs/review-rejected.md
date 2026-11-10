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
- `src/game/logic/board.ts` の `shuffleBoard`: `kinds` が省略可の引数で、盤面と種類を 4 か所で同期させている — 理由: 省略可にしたのは、既存のテスト・呼び出しを変えないため（呼び出し元は `Round` の 1 か所）。盤面と種類を 1 つの型にまとめる作り直しは、今回の目的の外。
- `src/game/logic/special.ts` の `findRuns`: `findMatches`（`board.ts`）と並びの走査が重複している — 理由: 両者が一致することをテストで固定している。既存の `findMatches` を書き換えるのは今回の目的の外。
- `src/game/logic/special.ts` の `groupRuns`: グループの配列を毎回複製していて二次の計算量 — 理由: 盤面は 64 マスで、体感できない。
- `src/game/scenes/Game.ts` の `COLOURED_KINDS`: 種類の一覧が `Kind` と別に手書き — 理由: (色, 種類) のテクスチャ名が 25 通りで重ならないことをテストで固定していて、足し忘れは QA の画像で見える。
- `src/game/logic/autoplay.test.ts`: max ボットが候補ごとに `tryFirst` を 2 回呼ぶ — 理由: テスト全体で約 3 秒で、直す価値が無い。
- `src/game/logic/hint.ts` の `findHint`: 段が消える数より優先されるので、特殊な石を作る手より下の段の 3 個消しを指す — 理由: 合意した基準（下の段 → 消える数 → 探索の順）そのもの。見直すなら spec の改訂で、PR のテストプレイで確かめる。
- `src/game/logic/hint.ts` の `swapIn`: 交換の複製が `swapCells` / `Round.swapStones` と 3 つになる — 理由: 共通化は `board.ts` と `round.ts` を触る整理で、この変更の目的の外。
- `src/game/logic/hint.ts` の `findHint`: 数えるときに交換の順（先の石を先に）で数が変わりうる — 理由: 2 つの交換する石は色が違い、同じ並びの「できる位置」に両方は入らないので、順は数に効かない。テストで全組・全局面の順序違いの数が一致することを確かめている。
- `src/game/logic/hint.ts` の `findHint`: 盤面と石の種類を複製している — 理由: spec の技術要件が複製を求めていて、出す瞬間に 1 回だけ呼ぶので、コストは 64 マス分で無視できる。
- `src/game/logic/hint.test.ts`: オラクルのテストの下限（`states` など）が種 1〜12 に依存する — 理由: 空振りを防ぐための下限で、余裕を持たせてある。種や生成の変更で落ちたときは、下限を見直すきっかけになる。
