# primtris: コードレビューで見送った指摘

`game-codereview` が、見送った指摘を理由つきで残すファイル（spec ではない）。レビュアーに渡して、同じ指摘を繰り返さないために使う。コードが無くなった行は消す。

- `src/game/scenes/Title.ts`（時間の状態機械（clock・frozenAt・schedule など）が Scene の中にあり、結線が単体テストされない）— 理由: 純粋な部分（手・時刻表・フェード・配置）は単体テスト済み。結線は QA の連続撮影で確認する方針。コントローラの切り出しは別の変更
- `src/game/scenes/Title.ts`（桁数の入れ替えのたびに `BoxesView` とタイルを破棄・再作成する）— 理由: 作り直すのは入れ替えの 1 回だけで、数十個のオブジェクト。再利用の複雑さに見合わない
- `src/game/scenes/Title.ts`（`waitStart` を `DemoDirector` の内部の時間割から Scene が再計算している）— 理由: どちらも同じ定数（`TITLE_DEMO_OPTIONS`）から作っていて、ずれない
- `src/game/scenes/Title.ts`（桁数の入れ替え後、フェードインの端数分だけ、ディレクターの開始より早く完全に現れる）— 理由: 最大 1 フレーム（spec は ±1 フレームの精度）。最初の手の時刻は正しい
- `src/game/scenes/Title.ts`（ヒントの y を、桁数を渡して `demoLayout` から読んでいる）— 理由: 値は桁数に依存しない定数で、読みにくさだけ。動作に影響しない
- `src/game/scenes/Title.ts` / `logic/titleDemo.ts`（ミューテーションの生き残り: `wrong.length > 0` の判定と 1e-9 の比較）— 理由: 等価（間違った候補は常に 1 つ以上ある。端数の誤差の吸収）
