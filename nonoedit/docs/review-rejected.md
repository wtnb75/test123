# レビューで見送った指摘

`game-codereview` で見送った指摘と、その理由。次のレビューで同じ指摘を繰り返さないために残す（spec ではない）。

- `src/game/core/analysisJob.ts`: 1 回の Worker のエラー・応答の遅れで、以降ずっと同期実行になる — 理由: spec が「以降の要求も同期実行」と決めている（`docs/spec/analysis-async.md` の「フォールバック」「応答のない Worker」）。再試行は別の目的
- `src/game/scenes/Game.ts` 編集の確定: 盤面が変わらなくても解析を要求する、連続した編集のたびに Worker を作り直す — 理由: spec が「編集の確定のたびに解析を始め、走っている解析を打ち切る」と決めている。省略・間引きは合意の外
- `src/game/core/analysisView.ts` `TECHNIQUES` / `src/game/scenes/Game.ts` `techLabels`: 手筋の一覧が `solver.ts` と合わせて 3 か所にある — 理由: パネルの表示は元から Game.ts に並びを持っていた。この変更の目的の外
- `src/game/scenes/Game.ts` パネル: 手筋の回数の色を表示文字（`'0'`・`'-'`）で決める、`timeout: 3s` の文字が直書き — 理由: 元からの書き方（`3s` の文字は元からある）。動作に影響しない
- `src/game/core/analysisView.ts`: `canCopy` / `copyBlockedMessage` / `playWarningOnArrival` が小さなラッパーで重複する — 理由: テストできる純関数として切り出した結果。動作に影響しない
- `src/game/core/analysisJob.ts`: Worker の解放が `stopRunning`・`dispatch`・`handleFailure`・`fallBack`・`dispose` に分かれる — 理由: 機能の不具合はない。リファクタリングは別の目的
- `src/game/core/editOps.ts`: `applyEditClick` / `applyPlayClick` が常に 1 を返す（戻り値が定数）— 理由: 切り出し前のシグネチャと戻り値を変えない合意。`undo-redo` で履歴の形が決まるときに見直す
- `src/game/core/editOps.ts`: ドラッグの適用が `DragRange` 全体（`targetX` / `targetY` を含む）を受け取り、プレビューの型と結びつく — 理由: 切り出し前と同じ形を保つ合意。`paint-shapes` で矩形の呼び出しが要るときに決める
- `src/game/core/editOps.ts`: 範囲の走査が複数回・クロージャで、盤面外の座標を検査しない — 理由: 25 × 25 で無視できる。盤面外の扱いは切り出し前と同じで、挙動を変えない
- `src/game/scenes/Game.ts`: タップかドラッグかの判定（`drag.moved`）に自動テストが無い — 理由: Scene はカバレッジの対象外で、spec が Scene の受け持ちと決めている。実ブラウザの QA で確かめる
- `src/game/core/editOps.ts` / `Game.ts`: 改行コードが混在する（`Game.ts` は CRLF、新しいファイルは LF）— 理由: `Game.ts` の CRLF を保って差分を小さくするため。統一は別の目的
- `src/game/core/analysisView.ts` `hardest`: `unsolved` のとき `-` にする（`hardestTechnique` は `logical` を見ないのに表示で隠す）— 理由: spec の `Hardest` の値の表で合意した動作
- `src/game/scenes/Game.ts` モバイルの情報タブ: 行を 16 px 間隔に詰めた、`timeout: 3s` が `hardest` の行の右端で重なりうる — 理由: `unsolved` のときは `hardest` が `-` で重ならない。最小画面での収まりは QA のスクリーンショットで確かめる
- `docs/spec/solver.md` / `Game.ts`: 行ラベルが小文字の `hardest:`（spec は `Hardest`）— 理由: 文言（英語）は実装裁量。他の行と揃えている
- `src/game/scenes/Game.ts` パネル: 行の y 座標を手で並べている — 理由: 元からの書き方で、この変更の目的の外
- `src/game/core/history.ts` / `Game.ts` Undo/Redo のキー: 非ラテン配列で `key` と Phaser/物理キーが食い違う、修飾キーなしの `z`/`y` と長押しの繰り返しで履歴が一気に減る — 理由: spec が「`Z`/`Y`（Shift の有無は問わない）」と決めていて、繰り返しは実装裁量に書いてある
- `src/game/scenes/Game.ts` プレイ中の `R` が履歴に 1 手を残す — 理由: spec「操作仕様」の例外として決めた挙動（編集に戻ってから元に戻せるように）
- `src/game/scenes/Game.ts` Undo/Redo の結線（記録の呼び出し・キーの解除・メッセージ）に自動テストが無い、モバイルの編集タブに `Undo`/`Redo` のメッセージが出ない — 理由: Scene は単体テストの対象外で、spec が QA で確かめると決めている。メッセージは文字だけを要求している
- `src/game/scenes/Game.ts` モバイルの編集行: `find(...)!` とプレイ中の幅 94 の直書き、PC の折り返しのしきい値（888）と座標の直書き、パネルの高さが全タブで増える — 理由: lint は通り、動作に影響しない。折り返した行の収まりは QA（幅 720〜887px）で確かめる。パネルの高さはタブ切り替えで盤面が動かないための選択
- `src/game/scenes/Game.ts` / `history.ts`: Undo/Redo で盤面を二重にコピーする — 理由: 25 × 25 で無視できる
- `docs/spec.md`: frontmatter の段階が `pending` に戻っている — 理由: `game-spec` のリセットによる想定どおりの状態。PR を開く前に各段階が `done` に戻る
