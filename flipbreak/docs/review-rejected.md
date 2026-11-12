# flipbreak 見送ったコードレビューの指摘

`game-codereview` で出て、採用しなかった指摘と理由です（同じ指摘を繰り返し検討しないための記録。仕様ではありません）。

- `src/game/logic/physics.ts`（`stepWorld` ほか）: 物理の刻みごとに小さなオブジェクト（結果・タプル）を作る — 理由: 寿命が短く小さい値で、1 秒に数百個程度。使い回すと返した値を別の場所が書き換える事故の元になる（`stepWorld` の結果はテストでも値として使う）。仕様の「新しく作らない」は表示物（Phaser のオブジェクト）の話
- `src/game/logic/input.ts`（`route`）、`src/game/scenes/Game.ts`（`collectPointers`）: 毎フレームにクロージャ・配列・結果を作る — 理由: 上と同じ（1 フレームに数個）
- `src/game/logic/physics.ts`（`collideBlock`）: `blockRect` と同じ計算をコピーしている — 理由: 割り当てを避けるための意図的なコピー。当たりのテストは手計算した座標（描く矩形 (22, 61) 34 × 16 の各面）で書いてあり、ずれればテストが落ちる
- `src/game/logic/session.ts`（`FrameEvents.launched`）: Scene が使っていない — 理由: テストで使っている。発射の効果音・演出（`game-polish`）の入口として残す
- `src/game/scenes/Game.ts`（回転の案内）: 案内の間も押しっぱなしの指は、案内が消えると 0 から溜め直す — 理由: 仕様どおり（案内が消えたら続きから再開し、溜めは 0 に戻す。指が押されていれば溜めは進む）
- `src/game/scenes/Game.ts`（`drawnStage` と `drawnBlocksVersion`）: 描き直しの記録が 2 つある — 理由: どちらも正しく動き、面の開始は必ず版を進める。まとめても挙動は変わらない
- `src/game/params.ts`（`HUD_X` など）: 仕様の表に無い — 理由: HUD の左端 x = 6 は仕様の本文にあり、溜めの棒の太さ・位置は実装裁量
- `src/game/scenes/Game.ts`（フリッパーの描画）: 毎フレーム描き直している — 理由: 動く物なので毎フレームでよく、負荷は小さい
- `src/game/scenes/Game.ts`（回転の案内が消えた直後）: 1 フレームだけ古い表示が残るかもしれない — 理由: 影響は 1 フレーム以下
- `src/game/scenes/effects.ts`: 演出のコード（Scene 側）に単体テストが無い — 理由: Scene の接着部分（共通設定でカバレッジの対象外）。タイマーの計算は純粋な関数（`ghostBall`・`scoreBumpScale`・`TrailBuffer` など）に出してテスト済み。描画の層の順は QA で確かめる
- `src/game/scenes/Result.ts`: Result が開いた直後の Space / Enter ですぐリトライする — 理由: 押しっぱなし・自動リピートでは発火しない約束は守られている。押し直しは本人の操作で、待ち時間を入れるのは操作の仕様の変更（ゲームオーバーの演出 0.8 秒とフェード 0.25 秒で既に間がある）
- `src/game/scenes/Game.ts`: 回転の案内が出ている間、手で数える演出（点滅・SCORE の強調）の時計だけ止まる — 理由: 1〜2 フレームの差で、案内が出る間は画面が覆われている
- `src/game/scenes/effects.ts`（`POP_MARGIN`・`SHAKE_BLEED`・色・縁取りなどの数値）: `params.ts` の外にある — 理由: 仕様の本文か実装裁量に書いてある見た目の細部（調整の対象ではない）
- `src/game/scenes/Game.ts`（軌跡）: 玉を落とした・面が変わったあとも古い軌跡が残る — 理由: 玉を置き直したフレームは速さ 0 で記録されて軌跡が空になり、同じフレームで描き直される。面クリアの間は玉も止まって見えるので、軌跡が玉のそばに残るのは自然
- `src/game/scenes/effects.ts`（`POOL_SIZE` 16）: 「+100」が足りなくなる — 理由: 玉は 1 つで、0.5 秒に 16 個のブロックを崩すことは起きない
- `src/game/scenes/Game.ts`（回転の案内の間は `render` が走らない）: 溜めの棒が 1 フレーム残るかもしれない — 理由: 案内が全面を覆い、解けた次のフレームで直る
- `src/game/scenes/Game.ts`（溜めの棒の表示の状態が `chargeBar.visible` に依存）: 将来 1 つだけ隠すと食い違う — 理由: 今は 1 か所でしか切り替えていない（将来の注意点）
- `src/game/logic/session.ts`（`stalls` の Map）: 台から消えた玉の項目が、玉を落とす・面の始まりまで残る — 理由: 1 面あたり数個で、`loseBall` と `startStage` で空になる。実害なし
- `src/game/logic/physics.ts`（`World.ball` + `extras`）: `balls[]` 1 本にしたほうが単純 — 理由: 既存のテストと呼び出しの形を保つための構造で、玉の追加と同じ 1 つの目的に収めるため。大きな構造変更は別の変更にする
- `src/game/logic/physics.ts`（`specialBalls` / `specialBlocks`）: モジュール内の作業用配列 — 理由: `stepWorld` の呼び出しごとに空にし、再入しない。割り当てを避けるための意図的なもの
- `src/game/logic/physics.ts`（`settleBalls` の走査）: 玉の一覧を何度も走査する — 理由: 玉は最大 3 個で、負荷は小さい
- `src/game/logic/trail.ts`（`TrailSet` のスロット）: 玉の数が `slots` を超えると落ちる — 理由: 玉は `MULTI_BALL_MAX` 個までで、`slots` の既定値と同じ。到達しない
- `src/game/scenes/effects.ts`（`drawTrail`）: 面クリアの間、消える玉の軌跡が残る — 理由: 面クリアの間は玉も止まって見える（軌跡の項と同じ）
- `src/game/scenes/Game.ts`（`render`）: 玉の表示物の `setVisible` を毎フレーム呼ぶ — 理由: 3 個だけで、影響が小さい
- `src/game/logic/physics.ts`（`settleBalls`）: 上限 3 個のとき、同じ刻みに抜ける玉があっても玉を足さない — 理由: `docs/spec/multiball.md` の「足す → 取り除く」の順の取り決めどおり（合意の範囲）。順を変えるのは仕様の変更（spec の指摘として、PR の「未対応の指摘」に載せる）
- 1 フレームより短いタップは取りこぼしてよい（入力は毎フレームの状態で読む）— 理由: 人の指では起きない長さで、仕様の実装裁量に書いて許容した
