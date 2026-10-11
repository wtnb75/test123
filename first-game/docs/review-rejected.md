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
