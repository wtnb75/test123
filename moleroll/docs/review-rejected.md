# moleroll コードレビューで却下した指摘

`game-codereview` が、採用しなかった指摘と理由を 1 行ずつ残すファイルです（仕様ではありません）。同じ指摘が次のラウンド・次の拡張で繰り返されないようにするためのものです。

- `src/game/scenes/CubeView.ts`: 矢印・Pop の描画で毎フレーム小さなオブジェクト（`arrowFor` の点、`order` の要素、`forEach` のクロージャ）を作る — 理由: 数が有界（Pop 最大 4、矢印最大 4、見える面 3）で、数百個規模だった頂点計算はすでに配列を作らない形にした。これ以上は使い回しの複雑さが増えるだけ
- `src/game/scenes/` の Title・Result・ui・CubeView: レイアウト・フォント・色・目や耳の大きさの数値が `params.ts` に無い — 理由: ゲーム性の数値ではなく、仕様の「レイアウト方針」にある配置値と見た目の値。各 Scene の先頭に名前付き定数で置いてある。`params.ts` はパラメータ表の値の置き場
- `src/game/scenes/Game.ts`: `this.input.keyboard!` で非 null を仮定している — 理由: キーボードプラグインは Phaser の既定で有効で、このゲームの設定でも無効にしていない（null にならない）
- `src/game/scenes/ui.ts`: `BUTTON_FONT_PX`（32）が `params.ts` に無く、`HUD_FONT_PX` と同じ値 — 理由: 上の「レイアウト・フォントの数値」と同じ。値を分けたのは、HUD とボタンを別々に調整できるようにするため
- `src/game/scenes/Result.ts`: `this.exit` をハンドラ登録の後で代入していて、呼び出しの順序に依存する — 理由: ハンドラが動くのは入力イベントの時点（`create()` の後）で、同期で呼ばれることはない
- `src/game/scenes/Game.ts`: HUD の表示値（`shown*`）の重複と、`displaySeconds` を毎フレーム呼ぶこと — 理由: 動作上の問題はなく、`displaySeconds` は生成を伴わない数値演算
- `src/game/scenes/{Game,Title,Result}.ts`: dev 専用の `window.__qa` の getter が旧 Scene を保持する — 理由: dev ビルド専用（本番バンドルには入らない）で、次の Scene が上書きする
