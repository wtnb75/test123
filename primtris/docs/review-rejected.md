# primtris: コードレビューで見送った指摘

`game-codereview` が、見送った指摘を理由つきで残すファイル（spec ではない）。レビュアーに渡して、同じ指摘を繰り返さないために使う。コードが無くなった行は消す。

- `src/game/scenes/Title.ts`（時間の状態機械（clock・frozenAt・schedule など）が Scene の中にあり、結線が単体テストされない）— 理由: 純粋な部分（手・時刻表・フェード・配置）は単体テスト済み。結線は QA の連続撮影で確認する方針。コントローラの切り出しは別の変更
- `src/game/scenes/Title.ts`（桁数の入れ替えのたびに `BoxesView` とタイルを破棄・再作成する）— 理由: 作り直すのは入れ替えの 1 回だけで、数十個のオブジェクト。再利用の複雑さに見合わない
- `src/game/scenes/Title.ts`（`waitStart` を `DemoDirector` の内部の時間割から Scene が再計算している）— 理由: どちらも同じ定数（`TITLE_DEMO_OPTIONS`）から作っていて、ずれない
- `src/game/scenes/Title.ts`（桁数の入れ替え後、フェードインの端数分だけ、ディレクターの開始より早く完全に現れる）— 理由: 最大 1 フレーム（spec は ±1 フレームの精度）。最初の手の時刻は正しい
- `src/game/scenes/Title.ts`（ヒントの y を、桁数を渡して `demoLayout` から読んでいる）— 理由: 値は桁数に依存しない定数で、読みにくさだけ。動作に影響しない
- `src/game/scenes/Game.ts`（待ち時間用の `placed` と `tally.placed` の二重管理）— 理由: 待ち時間の個数をスコアから切り離すのは spec の意図。等しいことは単体テストで固定済み。統合は別の変更
- `src/game/scenes/Result.ts` / `Game.ts`（Result に `score` と 3 つの小計を別々に渡す）— 理由: どちらも同じ `tally` から 1 か所で作る。ずれる経路が無い
- `src/game/logic/primtris.ts`（`PlacementResult.scoreDelta` が本番で未使用）— 理由: 既存テストが参照し、「既存のテストは書き換えない」が回帰条件。削除は無関係なリファクタ
- `src/game/logic/scoring.ts`（`applyDrop` にパラメータを注入できない）— 理由: 先回りの汎化。バランス調整は定数の変更で足りる
- `src/game/scenes/Game.ts`（Scene の結線＝加点・COMBO・リトライのリセットにテストが無い）— 理由: Scene はテスト対象外の方針。QA の撮影で確認する
- `src/game/logic/scoring.test.ts`（初期値を固定するテストと、オラクルの 5・6 の直書き）— 理由: spec の初期値を固定するのが意図。オラクルは実装と独立にするため直書き
- `src/game/scenes/Result.ts`（論理サイズが 540 × 960 以外のときの内訳の衝突）— 理由: 論理サイズは固定で、spec で手計算済み
- `src/game/scenes/Title.ts` / `logic/titleDemo.ts`（ミューテーションの生き残り: `wrong.length > 0` の判定と 1e-9 の比較）— 理由: 等価（間違った候補は常に 1 つ以上ある。端数の誤差の吸収）
