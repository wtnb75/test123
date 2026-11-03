# レビューで見送った指摘

コードレビュー（`game-codereview`）で、直さないと決めた指摘と理由。同じ指摘を繰り返さないために残す。

- `scenes/Title.ts`: 色・`HINT_MARGIN`・深度などのシーン内定数が `constants.ts` に無い — 理由: 見た目だけの値で、spec が名前を付けて決めているのは `TITLE_*` のみ（実装裁量）
- `scenes/DemoGame.ts`: Demo でも `Game.createHud` が HUD のテキスト・グラフィックスを作る（描かれない） — 理由: 作成は 1 回だけで表示は空。`createHud` の hook を足すと `Game` の差分が広がるわりに得るものが無い
- `scenes/Title.ts`: Title の時計は生の delta、Demo の World は `pause.frame(delta)` — 理由: 長い 1 フレームで数 ms ずれるだけで、幕が下りる時刻が動くのみ
- `scenes/GameOver.ts`: GameOver の shutdown 解除・create での再初期化を単体テストに入れていない — 理由: Scene の配線は単体テストの対象外（AGENTS 4.5）。`titleExit.test.ts` は純粋な判定のみを対象にし、Scene の後始末は QA で確かめる
- `logic/retry.ts`: `inRect` を Phaser の `Geom.Rectangle.Contains` に替える — 理由: 判定は `logic/` の純粋関数に残し、spec の「テスト観点」が矩形の辺の境界を単体テストで確かめると定めている。Phaser の `Contains` と同じ半開区間で、動きは変わらない
- `logic/retry.ts`: `resolve()` が本番コードから呼ばれていない — 理由: 既存の `retry.test.ts` が `resolve` の真偽値を固定しており、テストを緩めないため残す。呼び出しは増やさない
- `scenes/GameOver.ts`: `retry` と `titleRect` をフィールド宣言で初期化し、`create` で作り直している — 理由: Scene の生成ごとに 1 回だけで、毎フレームの確保ではない。`elapsed` や `lines` と同じ書き方に揃えている
- `logic/retry.ts`: `pointerDown(onTitleButton = false)` の既定値 — 理由: 本番の呼び出しは `GameOver.onPointerDown` の 1 か所だけ。既存の `retry.test.ts` が引数なしで `pointerDown()` を呼んでおり（リトライの意味で）、既定値を外すとそのテストの意味が変わる
- `logic/enemy.ts`: `createLeech` が `placeAtEdge` の辺・位置の計算を写している — 理由: `placeAtEdge` は定位置（station）の設定と一体で、leech には定位置が無い。辺の選び方（`pickSpawnEdge`）は共有しており、残りは数行。分けると既存の敵の差分が広がる
- `scenes/Game.ts`: 紐を描く条件と吸い取りの条件が別々に書かれている — 理由: どちらも `LEECH_DRAIN_RADIUS` と `leechDrainRate` を使い、紐は d ≤ 半径（`hasTether`、spec どおり）。仕様の変更は spec と 1 か所ずつ同時に直す
- `logic/world.ts`: `stockBeforeDrain` は `stock + stockDrained` で足りる冗長な状態 — 理由: 吸い取りの後の `checkContact` で接触のストック +`HIT_STOCK_BONUS` が入るので、その式は接触のフレームで吸い取り直前の値と合わない
- `logic/world.ts`: 体当たりで壊れた leech が、そのフレームの `drainRate`（色）には入るが粒は出ない — 理由: 吸い取りは体当たりより前に起きていて、解放弾で壊れた場合と同じ 1 フレームの差。spec が「そのフレームの全 leech」としか決めていない
- `logic/constants.ts`: `DRAIN_EPS` のコメントが循環している — 理由: 具体的な数値の例は、速度の定数が変わると古くなる（前のコメントがそうだった）。一般的な書き方にしている
- `logic/leech.ts` / `world.ts` / `scenes/Game.ts`: 吸い取り速度を 3 か所（吸い取り・粒・紐）で計算している — 理由: 敵は多くても十数体。同じフレームで解放弾に壊れた leech に粒が出ない 1 フレームの差は、spec が「そのフレームの全 leech」としか決めておらず、見た目にほぼ出ない
- `logic/leech.ts`: `leechOrbitPoint` が leech ごと・フレームごとに点を作る — 理由: 同時に最大 2 体で、1 フレーム 2 個の小さなオブジェクト。`drainStep` の分は、吸い取りが無いフレームでは呼ばないようにした
- `logic/world.ts`: `countLeeches`・`drainStock`・`drawTethers` が敵の配列を毎回走査する — 理由: 敵は多くても十数体で、carrier の追跡用フィールドのような別の一覧を持つと、除去時の同期が増える
- `logic/world.ts`: `drainCarry` が公開フィールド — 理由: `spawnTimer` などと同じく、テストが状態を直接置けるようにしている書き方
