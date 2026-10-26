# Title とデモ

`docs/spec.md` の拡張。起動時の最初の画面として `Title` Scene を新設し、背景で、ボットが操作する本物のゲーム（`Demo` Scene）を流す。

## 概要

起動時は、`Title`（名前・一言・START・操作の説明）を最初に出す。START で、`Game` が従来どおり「3 → 2 → 1」（`ready`）から始まる。`Title` の背後では、本物の `Game` と同じ `World`・描画・演出を使うデモ（`Demo` Scene）が、ボットの操作で流れ、「敵弾を吸って溜め、解放して撃ち返す」流れを開始前に見せる。ルール・得点・難易度・操作・見た目は変えない。

## 操作仕様

- START（ボタンのタップ・クリック）、`Enter`、`Space`: `Game` を始める。最初の 1 回だけ有効（同じフレームの 2 回目以降は無視する）。ボタンは指が触れた瞬間（`pointerdown`）に働く。`Game` の開始より前から触れていた指は、`Game` では「記録のない指」として無視される（`docs/spec.md` の「指の役割の寿命」）。`Enter` / `Space` を押したままでも、`Game` の `ready` では解放として受け付けない（従来どおり）。
- デモは操作を受け付けない（画面のほかの場所のタップ・キー入力は何も起こさない。`Demo` は入力のリスナーを持たない）。
- `Space` を押してもページがスクロールしない（`Title` を離れるときにキーのキャプチャを解除する）。
- `Game` の操作・タッチの指の振り分けは変わらない。

## 画面・Scene構成

### Scene と受け渡し

| Scene | キー | 役割 |
|-------|------|------|
| `Title` | `Title` | 起動時の最初の Scene。画面の大きさを決め、`Demo` を並行して起動し、前面に名前・START・操作の説明を出す |
| `Demo` | `Demo` | `Game` を継承した背景用の Scene。本物と同じ `World`・描画・演出を、ボットの入力で動かす。HUD・一時停止・`GameOver` への遷移・準備のカウントダウン・解放ボタンは無い |
| `Game` | `Game` | プレイ本体（`docs/spec.md`）。変わらない |
| `GameOver` | `GameOver` | 変わらない |

- 起動順: `Title`（最初の Scene）→ START で `Game` → `GameOver` →（リトライで）`Game`。`GameOver` から `Title` へは、TITLE ボタンとキー T で戻る（`docs/spec.md` の「GameOver 画面」の「入力」）。
- `Title` は、`Scene` の開始時に、`Game` と同じ規則（`docs/spec.md` の「レイアウト方針」。短辺 768、縦横比 1024〜1536 の範囲）で画面の大きさを決めて `scale.setGameSize` し、カメラの大きさを合わせる。そのあと `Demo` を `scene.launch` し、`Title` を前面に置く（`Demo` の上に重ねる）。`Title` が表示されている間に端末を回転しても画面の大きさは変えない（`Scale.FIT` で縮小表示される）。
- START: `Demo` を停止し（`scene.stop('Demo')`）、`Title` を終えて `Game` を始める（`scene.start('Game')`。`Game` は従来どおり `ready`（3 秒）から始まる）。`Title` に何秒いても、`Game` の進行（`ready` の 3 秒・`playing` の経過時間・難易度）は START の時点から数える。
- `Title` は `localStorage` などの保存を使わない。

### Title のレイアウト

画面の大きさを幅 W・高さ H（短辺は常に 768）とする。座標は画面の座標で、中心は `x = W / 2`。値は四捨五入して整数にそろえる。

| 要素 | 位置 | 見た目 |
|------|------|--------|
| 暗幕 | 画面全体 | 黒、不透明度 `TITLE_VEIL_ALPHA`（デモの上、文字の下） |
| 名前 `absorb` | 中心 y = `0.2 × H` | `TITLE_NAME_SIZE` px、白、太字 |
| 一言「弾を吸って、撃ち返せ」 | 中心 y = 名前の y + 70 | `TITLE_TAGLINE_SIZE` px、`#cccccc` |
| START ボタン | 中心 y = `0.6 × H`、`TITLE_START_WIDTH` × `TITLE_START_HEIGHT` | 塗り `#3b82f6`、ラベル「START」`TITLE_START_SIZE` px、白 |
| 操作の説明 1 行目「移動: 矢印 / WASD　解放: Space / X / Enter」 | 中心 y = START の y + 110 | `TITLE_HINT_SIZE` px、`#aaaaaa` |
| 操作の説明 2 行目「タッチ: ドラッグで移動 / ボタンか 2 本目の指で解放」 | 中心 y = 1 行目の y + 38 | 同上 |
| 黒い幕（走りの作り直し） | 画面全体 | 黒、不透明度 `1 − runner.opacity()`（暗幕の上、文字の下） |

- 描画順（奥から）: `Demo`（ゲームの画面）→ 暗幕 → 黒い幕 → 名前・一言・START・操作の説明。文字・START は走りの作り直しの間も隠さない。
- 手計算の例（`TITLE_*` の初期値で。名前の y / 一言の y / START の y / 操作の説明の y 1・2 行目）:

  | 画面（幅 × 高さ） | ゲームの大きさ（W × H） | 縮小率（`min(幅 / W, 高さ / H)`） | 名前 | 一言 | START | 説明 1 | 説明 2 |
  |---|---|---|---|---|---|---|---|
  | 375 × 550（iPhone SE の Safari 縦） | 768 × 1126 | 0.488 | 225 | 295 | 676 | 786 | 824 |
  | 667 × 310（同 横） | 1536 × 768（2:1 に収める） | 0.404 | 154 | 224 | 461 | 571 | 609 |
  | 390 × 844 | 768 × 1536（2:1 に収める） | 0.508 | 307 | 377 | 922 | 1032 | 1070 |
  | 1280 × 720 | 1365 × 768 | 0.9375 | 154 | 224 | 461 | 571 | 609 |
  | 1024 × 768（iPad 横） | 1024 × 768 | 1.0 | 154 | 224 | 461 | 571 | 609 |

  どの大きさでも、全ての要素が画面の中に収まり、重ならない（START の上端〜説明 2 の下端は、短辺方向の高さ 768 の中に収まる: START の上端 = 461 − 84 / 2 = 419、説明 2 の下端 = 説明 2 の y + `TITLE_HINT_SIZE` / 2 = 609 + 13 = 622）。説明の各行は、幅 768 から左右の余白 40 px ずつを引いた 688 px に収まる 1 行（`TITLE_HINT_SIZE` 26 px で約 650 px）。縮小率が小さい画面では、文字・START が小さくなる（375 × 550 で説明が約 13 px・START の高さが約 41 px、667 × 310 で説明が約 10.5 px・START の高さが約 34 px）が、許容する（タップの的が 44 px に満たない画面があるが、`Space` / `Enter` でも始められる）。書体は `Game` の HUD と同じ（`monospace`）。

### Demo（背景のゲーム）

- `Demo` は `Game` と同じ `World` を、同じ描画・演出で動かす。`Demo` の画面の大きさは `Title` が決めたもの（`Game` の開始時の規則と同じ）。
- `Game` との違い（これ以外は `Game` と同じ）:
  - 入力は、キーボード・ポインタではなく、ボットが毎フレーム決める（下記）。キーボード・ポインタ・一時停止のきっかけのリスナーは持たない。
  - 準備のカウントダウン（3 → 2 → 1・GO!）と、そのための演出は出さない。`World` は、`Scene` の開始時に、準備を飛ばしてすぐ `playing` にする（`World.beginPlay()`）。
  - HUD（スコア・ライフ・ストック・ボス HP バー）、ボスの予告文字「BOSS」、タッチの解放ボタンは描かない。
  - 一時停止は無い（画面が隠れても、フォーカスが外れても止めない）。
  - `world.phase` が `over` になっても `GameOver` を始めない。最後の画面のまま、次の作り直しまで止まる。
- **走りの作り直し**: 走りは `DEMO_RUN_SECONDS` 秒。`Title` が、共有パッケージ `title-demo` の `TitleDemoRunner`（`rounds` 1、`waitMs` = `DEMO_RUN_SECONDS / 2`、`fadeMs` = `DEMO_FADE`）で時計を数え、`fade-out` で黒い幕を閉じ始め、`fade-in` イベント（画面が黒の瞬間）で `Demo` を作り直し（`stop` して `launch`。新しい `World`・演出・乱数）、幕が上がる。1 つ目の走りは `Title` の開始から（`Demo` の起動と同時）。
- `World` の乱数は `Math.random`（`Game` と同じ）。`TitleDemoRunner` の時計は、`Title` の `update` の経過時間（delta）で数える。ボット自体は乱数を使わない。

### 走りの作り直し（TitleDemoRunner の対応）

| `DemoDirector` の要素 | このゲームでの内容 |
|---|---|
| 状態 `S` | 無い（空の値） |
| ラウンド | 1 つの走り（`rounds` = 1） |
| `start()` | 空の状態を返す（走りの作り直しでも同じ） |
| `plan(state)` | 何もしない 1 つの手順（`[0]`）を返す |
| `play(state, action)` | 何も変えずに `{ moved: true, roundDone: true }` を返す（`waitMs` 後に `action` イベントが 1 回出て、ラウンドが終わる。イベントは無視する） |
| `advance` | 無い |
| `timing` | `stepMs` は使われない。`waitMs` = `DEMO_RUN_SECONDS` × 1000 / 2、`fadeMs` = `DEMO_FADE` × 1000 |

### ボット

`World` を読んで、そのフレームの入力（`moveX`・`moveY`・`release`）を決める純粋な関数。乱数を使わず、同じ `World` の状態なら同じ入力になる（`dragX`・`dragY` は 0）。

1. **移動**: 8 方向と静止の 9 つの動きを、次の得点で比べ、最大のものを選ぶ（同点は、静止 → 上 → 右上 → 右 → 右下 → 下 → 左下 → 左 → 左上 の順で先のもの）。`DEMO_LOOKAHEAD` 秒先の自機の位置（その動きで `PLAYER_SPEED` で進み、移動範囲（`PLAYER_MIN_Y`〜画面下端 − `PLAYER_RADIUS`、`PLAYER_RADIUS`〜画面幅 − `PLAYER_RADIUS`）に収めた位置）を `p` とする。
   - 敵（ボスを含む。種類によらない）ごとに、`d = (p と敵の中心の距離) − 敵の半径 − PLAYER_RADIUS` として、`d < DEMO_ENEMY_MARGIN` なら `DEMO_ENEMY_WEIGHT × (DEMO_ENEMY_MARGIN − d)` を引く。
   - 敵弾のうち `p` から `FIELD_RADIUS` 以内にあるものの数 × `DEMO_BULLET_WEIGHT` を足す（吸収できる位置へ寄る）。
   - 巡回の目標点 `T` と `p` の距離 / H × `DEMO_HOME_WEIGHT` を引く（画面の下寄りを、左右・上下に大きく行き来する）。`T` は `world.elapsed`（プレイ経過秒。`t` とする）だけで決まり、`T.x = W / 2 + W × DEMO_ROAM_X_RATIO × sin(2π × t / DEMO_ROAM_X_PERIOD)`、`T.y = H × DEMO_HOME_Y_RATIO + H × DEMO_ROAM_Y_RATIO × sin(2π × t / DEMO_ROAM_Y_PERIOD)`（`t` = 0 では画面の中央、高さ `H × DEMO_HOME_Y_RATIO`）。
2. **解放**: `world.stock ≥ DEMO_RELEASE_STOCK` のとき、または `world.stock ≥ DEMO_RELEASE_MIN_STOCK` で自機から `DEMO_RELEASE_RANGE` 以内に画面内の敵（1 体でも）がいるとき `release: true`。ストックが 0 のときは `false`。解放すると、同じステップのうちにストックは 0 になる（続けて解放しない）。「画面内の敵」は、`removed` でなく、画面の中にいる敵（`World` が解放弾の標的にするものと同じ）で、1. の敵からの減点でも同じものだけを数える（画面の外にいる敵は数えない）。
3. `phase` が `playing` でないとき（`ending`・`over`。`Demo` は `beginPlay` のあと `ready` にならない）は、静止・解放なし。
4. 得点の比べ方: 得点は実数で、リストの順に `>`（より大きい）で比べる（同点なら先のものが残る）。敵・敵弾の位置は現在の位置（予測しない）。斜めの動きは速さを `√½` 倍にする（`World` の入力と同じ）。移動範囲への収め方は `World` の `clampX` / `clampY` と同じ。

## ルール

デモは `Game` のルール・得点・難易度・敵の出現に影響しない（`Demo` の `World` は `Game` の `World` と同じコードで、別のインスタンス）。`Title` から `Game` を始めるとき、渡すデータは無い。

## パラメータ表

| 名前 | 初期値 | 意味 |
|------|--------|------|
| `DEMO_RUN_SECONDS` | 40 秒 | 1 つの走りの長さ（`TitleDemoRunner` の `waitMs` はこの半分） |
| `DEMO_FADE` | 0.5 秒 | 走りの作り直しの、幕が閉じる・開く時間（それぞれ） |
| `TITLE_VEIL_ALPHA` | 0.35 | デモの上の暗幕の不透明度 |
| `TITLE_NAME_SIZE` | 72 px | 名前の文字の大きさ |
| `TITLE_TAGLINE_SIZE` | 30 px | 一言の文字の大きさ |
| `TITLE_START_WIDTH` × `TITLE_START_HEIGHT` | 320 × 84 px | START ボタンの大きさ |
| `TITLE_START_SIZE` | 40 px | START のラベルの文字の大きさ |
| `TITLE_HINT_SIZE` | 26 px | 操作の説明の文字の大きさ |
| レイアウトの割合・間隔 | 名前 `0.2 × H`、一言 +70、START `0.6 × H`、説明 +110 / +38、色は「Title のレイアウト」の表 | 値の正は「Title のレイアウト」の表（名前を付けた値ではない） |
| `DEMO_HOME_Y_RATIO` | 0.78 | 巡回の中心の高さ（画面の高さ H に対する比） |
| `DEMO_ROAM_X_RATIO` | 0.35 | 巡回の左右の振れ幅（画面の幅 W に対する比。中心は画面中央） |
| `DEMO_ROAM_X_PERIOD` | 9 秒 | 左右の 1 往復の時間（振れ幅 358 px のとき最高 250 px/秒で、自機の速さ 320 より遅い） |
| `DEMO_ROAM_Y_RATIO` | 0.1 | 巡回の上下の振れ幅（H に対する比） |
| `DEMO_ROAM_Y_PERIOD` | 5.5 秒 | 上下の 1 往復の時間 |
| `DEMO_LOOKAHEAD` | 0.25 秒 | 動きを比べる先読みの時間 |
| `DEMO_ENEMY_MARGIN` | 80 px | 敵から離れたい距離（これより近いと減点） |
| `DEMO_ENEMY_WEIGHT` | 3 | 敵への近さの減点の重み |
| `DEMO_BULLET_WEIGHT` | 1 | 吸収できる敵弾 1 つあたりの加点 |
| `DEMO_HOME_WEIGHT` | 40 | 巡回の目標点からの距離（H に対する比）の減点の重み |
| `DEMO_RELEASE_STOCK` | 12 | これ以上溜まったら解放する |
| `DEMO_RELEASE_MIN_STOCK` | 4 | 敵が近いときに解放する最小のストック |
| `DEMO_RELEASE_RANGE` | 320 px | 「敵が近い」距離（自機の中心から敵の中心まで） |

## テスト観点

- `World.beginPlay()`（純粋）: `ready` のとき `playing` にして `phaseTime` を 0 に戻す。すでに `playing`・`ending`・`over` なら何も変えない。呼んだ直後から敵が出現する（`spawnTimer` の通常の進み方）。
- ボットの入力（手計算の例。画面 768 × 1536）:
  - ストックが 0 なら `release: false`。ストック 12 なら（敵が遠くても）`true`。ストック 4 で 320 px 以内に敵がいれば `true`、4 未満なら `false`。
  - 敵（半径 20）が自機の真上 60 px（`d` = 60 − 20 − 10 = 30 < 80）にいて、ほかに何もないとき、選ばれる動きは下向きの成分を持つ（`moveY > 0`。下・右下・左下のどれか）。上・静止・右・左より得点が高い（手計算: 上は敵に近づき減点 270、静止は 150、右・左は 30、右上・左上は約 160、下向きの 3 つは 0 のうち、留まる高さからのずれの小さい動きが勝つ）。
  - 近くに敵がなく、自機が `H × 0.78` より 80 px 以上（先読みの 0.25 秒で進む距離）上にいれば、下（`moveX = 0`、`moveY = 1`）が選ばれる（留まる高さまでの残りが最も小さくなり、斜め（56.6 px 進む）より高い得点）。留まる高さから 28 px 以内では、静止が勝つ（行き過ぎない）。吸収できる敵弾が真横にあって、ほかが同じなら、そちらへ動く（同点の順に注意）。
  - 巡回: 近くに何もなく、`t` = `DEMO_ROAM_X_PERIOD / 4`（2.25 秒、`T.x` が右端の `W / 2 + W × DEMO_ROAM_X_RATIO`、`T.y` は `H × DEMO_HOME_Y_RATIO` よりやや下）のとき、自機が画面中央・`H × DEMO_HOME_Y_RATIO` にいれば、右向きの成分を持つ動き（`moveX = 1`）が選ばれる。`t` = 3 × `DEMO_ROAM_X_PERIOD` / 4 では左向き（`moveX = −1`）。
  - 品質（走りの性質）: 40 秒の走りで、自機の x の最大 − 最小が画面の幅の 40% 以上（あちこち動く）である走りが 90% 以上、かつ上の生存率・解放の条件を満たす。
  - `phase` が `ending` / `over` のときは静止・解放なし。
  - 同じ `World` の状態で 2 回呼んだ結果が同じ（乱数を使わない）。
- ボットの品質（多数のシード。`World` を `DEMO_RUN_SECONDS` 秒、ボットの入力で進める）: 40 秒の間に `phase` が `ending`・`over` にならない割合が 80% 以上で、解放が 1 回以上ある割合が 90% 以上（空振りの検査: 解放の回数を数え、0 でないこと）。満たせないときはパラメータを調整する。
- 走りの時刻列（`TitleDemoRunner`、`rounds` 1、`waitMs` 20000、`fadeMs` 500、時刻は構築時を 0 とする）: 20000 で `action`（何もしない。イベントは無視する）、40000 で `fade-out`（黒い幕が閉じ始める。不透明度は 1 → 0 で、40250 で 0.5）、40500 で `fade-in`（このとき `Demo` を作り直す）、41000 で `waiting`、61000 で `action`、81000 で `fade-out`。つまり幕が閉じ始めるのは、最初が 40 秒、以降は 41 秒ごと（`DEMO_RUN_SECONDS` + 2 × `DEMO_FADE`）。
- Title の配置（純関数。手計算の値）: 上の表の 5 画面の名前・一言・START・説明の y、START の上端 419・説明 2 の下端 622（H = 768 のとき）。縮小率の式。
- 入力（Scene の動作。QA で確認する）: START のタップ・`Enter`・`Space` で `Game` が始まる（1 回だけ）。デモの再生中・幕の閉じ開きの間も働く。`Space` でページがスクロールしない。START の前後で `Demo` が止まる（`Game` 始まりのあと `Demo` の更新が走らない）。
- 回帰: `Game` → `GameOver` → `Game` の流れ、ルール・得点・難易度、操作（キーボード・タッチの指の振り分け）、一時停止、演出、画面の大きさの規則、既存のロジックのテストは変更しない（`World.beginPlay()` のテストは `world.test.ts` に追記するだけで、既存のテストを書き換えない）。`Title` に何秒いても、START のあとの `ready`（3 秒）・`playing` は通常どおり始まる（QA で、`Title` に 12 秒いてから START して、`Game` が `ready` から始まることを確かめる）。
- 後始末（QA・コードレビューで確認する）: `Demo` を 5 回作り直しても、キー・ポインタ・`visibilitychange` / `blur` のリスナーと、タイマーの数が、最初の 1 回から増えない。`Title` の `shutdown` で、`Enter` / `Space` のキーのリスナー・START のポインタのリスナー・`Space` のキャプチャを解除する。

## 完了条件

- 起動すると `Title` が出て、背後でデモが流れる（吸収フィールドが敵弾を吸い、ストックが溜まり、解放弾が敵を倒す様子。スクリーンショットの連続で確認する）。
- START（ボタン・`Enter`・`Space`）で、`Game` が従来どおり（`ready` の 3 秒から）始まる。デモの再生中・幕の閉じ開きの間も START が働く。
- 約 40 秒ごと（最初の走りは 40 秒、以降は 41 秒。`DEMO_RUN_SECONDS` × 1000 / 2 を `waitMs` に使う）に、黒い幕が閉じて新しい走りが始まる（`Demo` は `GameOver` を始めない）。
- 画面サイズ（375 × 550・667 × 310・390 × 844・1280 × 720）で、`Title` の全ての要素が画面の中に収まり、重ならない（`scripts/qa/title-viewports.mjs`）。
- `Game` のルール・得点・難易度・操作・一時停止・演出・`GameOver` 画面とリトライの流れ・画面の大きさの規則は変わらない。`Title` に何秒いても、`Game` は START から通常どおり進む。
- `Title`・`Demo` を離れたとき、キー・ポインタのリスナー・タイマー・`Space` のキャプチャが残らない。
- `Title` と `Demo` を同時に動かしても、QA で 60 fps 近く（50 fps 以上）を保つ。
- `npm run lint` / `npm run test` / `npm run test:coverage` / `npm run build` が成功し、既存のロジックのテストは変更されない。

## 技術要件

- `absorb/package.json` に `"title-demo": "workspace:*"` を宣言する（共有パッケージ `title-demo` の `TitleDemoRunner` を使う）。`shared/title-demo/README.md` の「使うゲーム」に absorb を足す。`pnpm install` でロックファイルを更新する。
- `Demo` は `Game` を継承し、通常のプレイの経路（`Game` → `GameOver`）の挙動・見た目は変えない。`Game` の `private` のうち `Demo` が使うものを `protected` にし、差し替える部分は小さな hook に分ける。
- ボットと `Title` の配置は、Phaser に依存しない純関数にして単体テストする。`World.beginPlay()` も純粋で、単体テストする。

## 実装裁量

- `Demo` を `Game` の継承で作るための、`Game` の `private` を `protected` にする範囲と、`Game` に足す差し替えの hook の名前・数（入力の読み取り、HUD の描画、一時停止のきっかけの設定、準備と開始の文字、`GameOver` への遷移、キーボード・ポインタの設定）。通常のプレイの挙動は変えない。
- ボットの純粋ロジック・`Title` の配置の計算をどのファイルに置くか、関数の名前と分け方。
- 黒い幕の閉じ開きの細かい動き（直線。`DEMO_FADE` 秒の長さは仕様）。
- 暗幕の色（黒）・START の押している間・ホバーの見た目。押したら、演出なしですぐ `Game` を始める。
- dev ビルドだけの `window.__qa`（`Title`: `{ scene: 'Title', demoVisible, demoPhase, demoRounds }`、`Game` の開始時: `{ scene: 'Game' }`）と、デモの `World` の状態を読む dev 専用の値。`if (import.meta.env.DEV) { … }` の中に直接書き、本番の bundle に残らないことを確かめる。
