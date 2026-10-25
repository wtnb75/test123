# レビューで見送った指摘

`game-codereview` で見送った指摘と、その理由。次のレビューで同じ指摘を繰り返さないために残す（spec ではない）。

- `src/game/logic/kogodrop.ts`（`generateSlots` の 4 段のフォールバック）: take の段（同品詞の strict / loose、別品詞の strict / loose）・重複の段・パディングが重なって読みにくい — 理由: 順序は spec の規則 2・3・5 と 1 対 1 に対応し、テストで固定している。構造を変えるのはこの変更の目的の外。

- `src/game/scenes/Game.ts`: `nextContainer` が宣言だけで読まれていない（TS6133） — 理由: 今回の変更の前からある。無関係なので、この PR では直さない
- `src/game/logic/retry.ts` `recordAnswer` / `Result.ts` の復習ボタン件数: `wrongEntries` に同じ語が重複して入り、Result の復習ボタンの件数（`totalCount - correctCount`）と Review の一覧が語数と合わないことがある — 理由: 既存の挙動（`docs/spec.md` のテスト観点に「重複して追加される」とある）。再挑戦の N は `id` で重複を除いているので影響しない
- `src/game/scenes/Result.ts`: ボタンの座標・高さの一部がリテラルのまま、y が `height` の比から絶対 px になった — 理由: spec が絶対 px（論理 540 × 960 固定）で書いている。この PR の目的の外
- `src/game/scenes/Review.ts`: `shutdown()` メソッドは Phaser から呼ばれない（イベントを登録していない） — 理由: 既存の挙動。新しい経路（再挑戦・もう一度・タイトルへ）はどれも `destroyOverlay` を通る
- `src/game/scenes/Review.ts`: オーバーレイの大きさ・配置が、画面の回転・リサイズに追従しない — 理由: 既存の挙動
- `src/game/scenes/Game.ts` 回答の保存: 複数のタブで同時に遊ぶと、古い記録の全体を書き戻して他のタブの変更（記録を消す操作を含む）を上書きする — 理由: 同時に 2 タブで遊ぶ場合だけ。spec は回答ごとの保存と、メモリ上の記録を認めている。保存のたびに読み直すと、書けないときのメモリ保持と両立しない
- `src/game/scenes/Title.ts` 記録を消す操作: `removeItem` が失敗しても、表示が消えて消えたように見える — 理由: spec が「保存の失敗でゲームを止めない（無視する）」と決めている。次に Title を開くと、記録があれば部品がまた出る
- `src/game/scenes/Title.ts` 切り替え: 書き込みが失敗する環境では、Title に戻ると選択がオンに戻る — 理由: spec は「メモリの上にだけ持ってよい」と任意にしている。書き込みが失敗する環境（容量超過・プライベートモード）の話
- `src/game/logic/kogodrop.ts` `createQuestionSequence`: `weightOf` が 5 番目の位置引数で、呼び出しが長い — 理由: 既存の引数の並び（`rng`・`excludeIds`）に足しただけ。オプションのオブジェクトにする変更は別の目的
- `src/game/scenes/Title.ts` 記録を消す操作: Scene 終了時のタイマーの後始末を明示的に書いていない、Scene の結線が単体テストの対象外 — 理由: Phaser の Clock が Scene の終了で `delayedCall` を破棄する。Scene の結線は `game-qa` の範囲
- `src/game/scenes/Game.ts` 回答ごとの同期保存（`JSON.stringify` + `localStorage.setItem`）: 保存の遅い環境でフラッシュの開始の瞬間に引っかかりうる — 理由: 最大 160 語の小さなデータ。仕様は回答ごとの保存
