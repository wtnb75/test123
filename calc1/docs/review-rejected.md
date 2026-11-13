# コードレビューで見送った指摘（calc1）

`game-codereview` が見送った指摘と、その理由です。次のレビュー（拡張のたび）で同じ指摘を繰り返さないための記録です。仕様ではありません。

- `src/game/scenes/Game.ts`（`scoreLine` の `clearedLevel` の配線）: `this.roundLevel` を渡しているかは、単体テストで確かめられない（Phaser の Scene の中） — 理由: `clearResult` は渡された level をそのまま記録する。配線は、クリア後のベストの Lv が、クリアしたレベルと一致することを手動 QA で確かめる（N と N+1 の取り違えを防ぐ）。

- `src/game/titleDemo.ts`（盤面の幾何）: 行の高さ・ボタンの寸法・x が `Game.renderTable` と重複している — 理由: spec（title-demo.md の「レイアウト」）が値を決めている。`Game` の盤面は見た目を変えない方針で触らない。次に盤面を触るときに統合する
- `src/game/titleDemo.ts`（問題の生成）: `Game.startRound` の「200 回・フォールバック」の複製 — 理由: `Game` のロジックを触らない。値は spec の表で `Game` と同じと決めている。共通化は別の変更で
- `src/game/titleDemo.ts`（`DemoState.result`）: `progress.won` と同じ値の二重持ち — 理由: 整理のみ（1 変更 1 目的）。spec とテストの対応がそのまま読める
- `src/game/titleDemo.ts` / `Title.ts`（ラベルの色のリテラル）: palette に入っていない — 理由: 見た目の整理のみ（1 変更 1 目的）
- `src/game/logic.ts`（`generateProblem`）: 範囲と難易度が定数の配列から読まれ、テストがその配列を書き換えて戻している（引数で注入すべき） — 理由: 書き換えは `afterEach` で必ず戻し、並列実行もしない。引数を増やすと `Game` の呼び出しと仕様の呼び出し形が複雑になる。
- `src/game/winCount.test.ts`: 「ちょうど 200 回試す」テストが、乱数の呼び出し回数（手ごとのシャッフルの回数）に依存している — 理由: 乱数の引き順は仕様（初期値・目標値・各手の候補）で、固定されている。回数を直接数える別の方法（関数の差し替え）は、実装の内側に寄りすぎる。
- `src/game/logic.ts`: `randomBetween` が `titleDemo.ts` にもある — 理由: `Title` とデモは変えない条件（回帰）で、重複の整理は無関係な変更になる。
- `src/game/scenes/Game.ts`（`startRound`）: 問題の生成の時間（最大 200 回）が同期で、ラウンドの時間から引かれる — 理由: 平均 1.2 回で数 ms〜10 ms 程度（測定）。200 回に達することはほぼ起きず、今までも同じ作りだった。
- `docs/backlog.md`: 機能のブランチに混ざっている — 理由: `game-spec` の手順で、採用したカードの削除と後回しの候補の追記を、拡張と同じブランチで行うと決まっている
- `src/game/scenes/Game.ts`（`loadLevel` / `saveLevel` / `handleLossLevelChoice` に生の `localStorage` を渡している。保存先が塞がれていると勝ちの処理で例外になりうる）: ベスト以外の保存も `browserStorage()` に揃えるべき — 理由: レベルの保存（`calcRushLevel`）は今までの挙動で、ベストの保存形式の移行とは別の変更（1 変更 1 目的）。spec にも「レベルの保存の扱いは今までどおり」と書いた。直すなら spec の改訂から
- `src/game/logic.ts`（`saveBest` が `{score, label}` を手で組み立てる。共有パッケージに書き込みの関数が無い）: 共有に `serializeBest` を足すべき — 理由: 共有パッケージの変更は使うすべてのゲームのテストに及ぶ（範囲外）。形は `parseBest` と同じ 2 項目で、単体テストが書かれた JSON を固定している
- `src/game/logic.ts`（保存された `label` が長い・変なとき、そのまま結果画面に出る）: 検証か切り詰めが要る — 理由: 手で書き換えた値だけの話で、プレイでは `Lv.<数>` しか書かれない。以前も、保存された `level` の値は検証せずに表示していた
- `src/game/scenes/Game.ts`（中心 x = 240 の直書き: ステータス行・得点行・表のパネル、文字サイズ 22 / 25 px）: `RESULT_BUTTON_X` だけを定数にして、他は直書きのまま — 理由: 240 は画面全体の中心として既存の Game の全体に使われている。中心 x を 1 か所にまとめるのは Game 全体の整理で、1 変更 1 目的に合わない。別の変更で決める（記録のみ）
- `src/game/layout.ts`（`valuePairScale` の倍率に下限が無い）: 極端な値で文字が読めないほど縮む — 理由: spec（result-fit）で「f に下限は設けない。極端な選択のときだけ許容」と合意済み。下限や省略表示にするなら spec の改訂から（PR 本文の「未対応の指摘」に記録）
- `src/game/layout.ts`（`tableMetrics` が定数の配列をそのまま返す）: 呼び出し側が書き換えると共有の定数が壊れる — 理由: 既存の `BUTTON_CENTERS_X` も同じ作りで、書き換える呼び出しは無い
- `src/game/scenes/Game.ts`（値の組がちょうど列いっぱいのとき、行の背景の右端 476 に接する）: 右の余白が無い — 理由: spec が列の右端を 476 と決めている。ちょうど上限のときだけ
- `src/game/scenes/Game.ts`（縮めた文字が `setScale` でぼやける）: `fontSize` を変えて描き直すべき — 理由: 実装裁量（フォントの大きさか倍率か）。縮めるのは極端な値のときだけ
- `src/game/scenes/Game.ts`（`setScale` + `setX` の配置が自動テストされない）: 配置の計算を純関数にしてテストすべき — 理由: Scene の glue は QA のスクリーンショットで確かめると spec に書いてある。式は 1 行
- `src/game/layout.ts`（`valuePairScale` が NaN の幅を守らない）: `!(total > 0)` にすべき — 理由: Phaser のテキストの幅は描画用 canvas の測定値で NaN にならない。起こり得ない入力
