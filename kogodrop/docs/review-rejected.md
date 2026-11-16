# レビューで見送った指摘

`game-codereview` で見送った指摘と、その理由。次のレビューで同じ指摘を繰り返さないために残す（spec ではない）。

- `src/game/logic/kogodrop.ts`（`generateSlots` の 4 段のフォールバック）: take の段（同品詞の strict / loose、別品詞の strict / loose）・重複の段・パディングが重なって読みにくい — 理由: 順序は spec の規則 2・3・5 と 1 対 1 に対応し、テストで固定している。構造を変えるのはこの変更の目的の外。

- `src/game/scenes/Game.ts`: `nextContainer` が宣言だけで読まれていない（TS6133） — 理由: 今回の変更の前からある。無関係なので、この PR では直さない
- `src/game/scenes/Result.ts`: ボタンの座標・高さの一部がリテラルのまま、y が `height` の比から絶対 px になった — 理由: spec が絶対 px（論理 540 × 960 固定）で書いている。この PR の目的の外
- `src/game/scenes/Review.ts`: `shutdown()` メソッドは Phaser から呼ばれない（イベントを登録していない） — 理由: 既存の挙動。新しい経路（再挑戦・もう一度・タイトルへ）はどれも `destroyOverlay` を通る
- `src/game/scenes/Review.ts`: オーバーレイの大きさ・配置が、画面の回転・リサイズに追従しない — 理由: 既存の挙動
- `src/game/scenes/Game.ts` 回答の保存: 複数のタブで同時に遊ぶと、古い記録の全体を書き戻して他のタブの変更（記録を消す操作を含む）を上書きする — 理由: 同時に 2 タブで遊ぶ場合だけ。spec は回答ごとの保存と、メモリ上の記録を認めている。保存のたびに読み直すと、書けないときのメモリ保持と両立しない
- `src/game/scenes/Title.ts` 記録を消す操作: `removeItem` が失敗しても、表示が消えて消えたように見える — 理由: spec が「保存の失敗でゲームを止めない（無視する）」と決めている。次に Title を開くと、記録があれば部品がまた出る
- `src/game/scenes/Title.ts` 切り替え: 書き込みが失敗する環境では、Title に戻ると選択がオンに戻る — 理由: spec は「メモリの上にだけ持ってよい」と任意にしている。書き込みが失敗する環境（容量超過・プライベートモード）の話
- `src/game/logic/kogodrop.ts` `createQuestionSequence`: `weightOf` が 5 番目の位置引数で、呼び出しが長い — 理由: 既存の引数の並び（`rng`・`excludeIds`）に足しただけ。オプションのオブジェクトにする変更は別の目的
- `src/game/scenes/Title.ts` 記録を消す操作: Scene 終了時のタイマーの後始末を明示的に書いていない、Scene の結線が単体テストの対象外 — 理由: Phaser の Clock が Scene の終了で `delayedCall` を破棄する。Scene の結線は `game-qa` の範囲
- `src/game/scenes/Game.ts` 回答ごとの同期保存（`JSON.stringify` + `localStorage.setItem`）: 保存の遅い環境でフラッシュの開始の瞬間に引っかかりうる — 理由: 最大 160 語の小さなデータ。仕様は回答ごとの保存
- `src/game/scenes/Game.ts` `startNewTile`: ログを消したあと、正解スロットが 0 や 2 になっても黙って進む（開発用の検査か、先頭の一致への代替を足す案） — 理由: ログの削除が目的。不変条件は `generateSlots` の単体テスト（スロット数 4〜6・適応のプールとの組み合わせ）で守る
- `docs/spec.md` 完了条件: 「`eslint-disable no-console` が 0 件」を lint の設定（`reportUnusedDisableDirectives` など）で強制する案 — 理由: この変更の目的の外。確かめ方は grep として完了条件に書いた
- `docs/spec.md` の `status_*`: ログの削除だけなのに balance / polish / publish まで `pending` に戻る — 理由: `game-spec` の手順（改訂は `task game:reset` を全段階で行う）。コードも変わるので、clarification-only の経路には当たらない
- `src/game/scenes/Review.ts` の `correctEntries`: 同じ語が複数回正解されると「正解した単語も表示」に重複して並び、件数の表示も重複を数える — 理由: `review-all-count`（backlog）の範囲。`review-count` の「変えないもの」に入っている
- `src/game/scenes/Review.ts`: 「全単語を復習する」から開いた Review が、トグルがオフの間は「間違えた単語はありません」だけを出し、全語が見えにくい（トグルを初期でオンにする案） — 理由: 全問正解のときから既存の挙動で、合意の範囲外（見た目の変更）。PR 本文の「未対応の指摘」に載せた
- `src/game/logic/retry.test.ts`: `resultReviewLabel` のテストが Result.ts の引数の選び方（`uniqueEntries(wrongEntries).length`・`totalCount`）を押さえない — 理由: Scene の結線は単体テストの対象外（Phaser 依存）。`game-qa` で、同じ語を 2 回間違えた記録を使って確かめる
- `src/game/scenes/Result.ts`: Review に渡すのが重複を含む生の `wrongEntries` で、Review の `init` が重複を除く — 理由: 合意（記録の `wrongEntries` は重複を含み、表示するときに除く）のとおり。除く場所は Review の `init` の 1 か所
- `docs/spec.md` の `status_*`: 改訂で qa 以降が `pending` に戻る — 理由: `game-spec` の手順どおり。QA は次の段階で行う
