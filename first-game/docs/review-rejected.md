# first-game: コードレビューで見送った指摘

`game-codereview` が、見送った指摘を理由つきで残すファイル（spec ではない）。レビュアーに渡して、同じ指摘を繰り返さないために使う。コードが無くなった行は消す。

- `src/game/core/title.ts`（`isStartKey` が pushline の `logic/titleGate.ts` と同じ 1 行の複製）: 共有パッケージに無い — 理由: 共有に移すには `shared/title-demo` と pushline も触る。1 行の複製で、3 本目のゲームで同じ判定が要るときに共通化すれば足りる
- `src/game/scenes/Title.ts`（幅 32 px 以下の画面でボタンの幅が 0 になり、押せない）: 極端に狭い画面 — 理由: spec は幅 240 px 未満を保証しない（Enter / Space では始まる）。現実にない画面
- `src/game/scenes/Title.ts`（後始末を `shutdown` だけで行い、`destroy` では行わない）: シーンを削除するとリスナーが残る — 理由: `Title` は停止されるだけで削除されない。`Game` も同じ書き方
- `src/game/core/generator.ts`（上限に達したとき、解決不能な候補を使う恐れ）: 全ステージ解決可能の保証に反する — 理由: 既存の挙動で、spec に例外として明記した。候補の選び方を変えるのは、難しさに関わる別の変更（`docs/backlog.md` の `generator-reliability`）
- `src/game/scenes/Game.ts`（差分に solver テスト・GOAL 矢印・backlog が混ざり「1 変更 1 目的」に反する）— 理由: 承認済みの修正 spec（入力の頑健化の項目 10・11、backlog の更新）に含まれ、1 本の修正 PR にまとめると合意済み
- `src/game/scenes/Game.ts`（死亡・ゴール・キャンセル時のパッド解除が Scene のコードにあり単体テストが無い）— 理由: Scene はカバレッジ対象外。QA のシナリオ（spec 完了条件）で確認する
- `src/game/scenes/Game.ts`（`refreshHud` が更新のたびに localStorage を読む）— 理由: 元のコードも毎回読んでいた。最適化は別の変更（`docs/backlog.md` の `render-cost` の近く）
- `src/game/core/highScore.ts`（`parseLeadingInteger` を `startStage.ts` から import して結合している）— 理由: spec が開始ステージとハイスコアに同じ読み方（`parseInt`）を求めている
- `src/game/scenes/Game.ts`（`joystickState`/`dragState` と `PressTracker` の二重管理）— 理由: 既存の構造で、置き換えは大きな設計変更（4.1）。解除は `discardPointerState` に集約済み
- `src/game/core/flow.ts`（`restarting` フェーズは観測できず二重再起動の守りにならない）— 理由: NEW GAME は `scene.start` が次のフレームで処理されるので、その間 `restarting` が続き、守りとして働く（RETRY は同期）
- `src/game/core/flow.ts`（`restartKeyAction` が修飾キー単独でも NEW GAME にする）— 理由: spec が「修飾キーだけを含む他のキーは NEW GAME」と決めている（元の挙動）
- `src/game/core/highScore.ts`（書き込み失敗後、同じスコアでは再書き込みされない）— 理由: spec の規則どおり（「スコア > ハイスコア（セッション最大を含む）」のときだけ書く）。保存が壊れている環境の例外的なケース
- `src/game/scenes/Game.ts`（`applyResult` の先頭の `flow.playing` の戻りが結果を黙って捨てる）— 理由: すべての呼び出し元が先に `flow.playing` を確認していて、先頭の戻りは念のための防御
- `src/game/core/demoBot.ts`（`planDemo` が毎手 `analyzeCurrentState` を全計算する）— 理由: 実測で `planDemo` は最大 6 ms（ステージ 3、最大 66 手）。分析の使い回しは spec で実装裁量だが、複雑さに見合わない
- `src/game/scenes/Title.ts`（`resize` で同期のステージ 1 の生成が走る）— 理由: 実測で生成は最大 3 ms。時間上限（1500 ms）に届くのは大きいステージだけ
- `src/game/scenes/Title.ts`（`resize` のたびの再描画にデバウンスが要る）— 理由: サイズ・位置・ステージが同じなら再描画しない。残る再描画は配置が変わるときだけで、盤面は最大約 100 マス
- `src/game/core/titleDemo.ts`（`generateStage` の実時間の上限で再現性が崩れる恐れ）— 理由: ステージ 1〜3 の生成は数 ms で上限に届かない。再現性のテストはシード付き
- `src/game/scenes/Title.ts`（`drawnKey` が手組みの文字列で、`force` の真偽値が壊れやすい）— 理由: 再描画の条件（ステージ番号・幅・原点・セル）を全て含み、盤面は正方形。リセットは create・非表示・描画の 3 点で足りている
- `src/game/core/title.ts`（高さ約 120 px 未満で名前とボタンが重なる）— 理由: spec が保証するのは高さ 320 px 以上
- `src/game/core/titleDemo.test.ts`（「生成に影響しない」テストは落ちようがない）— 理由: spec のテスト観点に明記された回帰条件。将来モジュール内の状態を持ち込んだときの安全網
- `src/game/core/demoBot.ts`（ミューテーション: 隣接の並べ替え・開示済みの爆弾の歩行判定・`invalid` の判定が生き残る）— 理由: 等価（`neighbors8` が既にインデックス順。開示済みの爆弾は死亡後だけ。`movePlayer` は `invalid` を返さない）
- `src/game/scenes/Game.ts`（死亡直後の「T = タイトルへ」の案内が、`DeathDelay` の間は効かない）— 理由: R・他のキーの案内も同じ時点で出ていて同じ扱い。`DeathDelay` は 0.6 秒
- `src/game/scenes/Game.ts`（触れたままの別の指が、戻った Title の Start の上で離れるとすぐ開始する）— 理由: Title の「押し始めの位置は問わない」は spec 済みの既存の挙動。マルチタッチの稀なケース
- `src/game/scenes/Game.ts`（`restartLayout` が無いままゲームオーバーの画面の離しが何も起こさず止まる。'new' に落とすべき）— 理由: `showRestart` とボタンの表示は常に同時で、`restartLayout` は表示と同時に入る。到達しない分岐を置かない（不変条件は保たれている）
- `src/game/scenes/Game.ts`（`DeathDelay` 中に押し始めた指が TITLE を選べない、というテストが Scene に無い）— 理由: `onPointerDown` が `awaitingRestart` のときだけ押下を記録する単純な条件で、Scene のコード。QA（spec 完了条件）で確認する
- `src/game/scenes/Game.ts`（ゲームオーバーのボタンの置き直しを呼ぶ Scene の経路・`DeathDelay` の間の `resize` に単体テストが無い）— 理由: Scene はカバレッジ対象外。純粋なレイアウトは手計算の値で確認済みで、回転は QA（spec 完了条件）で確認する
- `src/game/scenes/Game.ts`（320 px 未満へ狭めた画面でボタンが画面外に出る）— 理由: spec が保証するのは幅・高さとも 320 px 以上。クランプは spec にない新しい挙動
- `src/game/scenes/Game.ts`（`restartLayout` の有無が「出ている」判定を兼ね、`restartButtons` と二重管理）— 理由: 出入口は `showRestartButtons` / `hideRestartButtons` に集約され、全ての出口が両方を空にする。元の構造
- `src/game/scenes/Game.ts`（`onResize` の前の呼び出しが例外を投げるとボタンの置き直しが飛ぶ）— 理由: その場合は盤面・パッドも止まり、画面ごと壊れる。推測の域
- `src/game/scenes/Game.ts`（置き直しのキー一覧 `['retry','newGame','title']` が型と別に書いてある。型リテラルが 3 箇所）— 理由: ボタンは spec で 3 つに固定。足すなら spec の改訂が先で、そのときに直せば足りる。見た目の nit
- `src/game/scenes/boardView.ts`（差分更新で足した文字の Image が、盤面の外のマーカーより手前になる）— 理由: マーカーは盤面の外側でマスの文字と重ならず、見た目は同じ
- `src/game/scenes/boardView.ts`（差分更新の経路で見た目の決定を 2 回計算する）— 理由: 呼び出し単体はステージ 100 で約 10 ms で、spec の目標（20 ms 以下）内
- `src/game/scenes/boardView.ts`（チャンクの計算に単体テストが無い）— 理由: Phaser に依存する描画。QA のステージ 50・100 の画素比較で確認する
- `src/game/core/cellAppearance.test.ts`（参照モデルを旧コードから手で転記している）— 理由: 旧コードは Phaser に依存し Vitest で動かせない。二重のレビューで旧コードと照合済み
