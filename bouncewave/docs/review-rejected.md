# コードレビューで見送った指摘

`game-codereview` で採らなかった指摘と、その理由。次のレビューで同じ指摘を繰り返さないために残す（spec ではない）。

- `src/game/logic/run.ts` / `src/game/scenes/Game.ts`: `frameDt`（1 フレームの経過秒の上限）を Game.update と stepRun の両方で掛けている — 理由: 結果は同じ（冪等）。stepRun 単体でも安全に呼べるように残す。規則は `frameDt` の 1 か所にあり、テストもそれを前提にしている
- `src/game/scenes/ui.ts` addButton: ボタン自身の pointerup が Scene 全体の pointerup より先に届く順番に依存している — 理由: Phaser 4.2.1 のソース（InputPlugin.processUpEvents）で確認済みで、コメントに書いてある。Phaser を上げるときは QA でボタンを押して確かめる
- `src/game/scenes/Title.ts` onResize: スマホのアドレスバーの出入りで高さが変わるたびに Title を作り直す — 理由: spec の「Title にいる間に大きさが変わったら決め直す」どおり。START との重なりはまれ。実機のテストプレイで気になれば polish / balance で扱う
- `src/game/scenes/ui.ts` RotateGuard.refresh: 案内が出ている間、表示の大きさが変わるたびに setFontSize を呼んでいる — 理由: Phaser 4.2.1 の TextStyle.setFontSize は同じ値なら作り直さない
- `src/game/scenes/ui.ts` RotateGuard: 折り返しの余白 40 px を params.ts に置いていない — 理由: Title の説明文と同じ配置の余白で、spec の実装裁量（配置の間隔）の範囲
- `src/game/scenes/Title.ts`: 最初の Title のフェード（0.2 秒）の途中で画面を回すと、並べ直した Title はフェードしないので途中で明るくなる — 理由: 0.2 秒以内に回したときだけのごく小さな見た目の違いで、手間に見合わない
- `src/game/scenes/effects.ts` Pool: Phaser の Group で使い回せる — 理由: Group.get は (scene, x, y, テクスチャ, フレーム) で作るスプライト向けで、Text・Rectangle・Arc には合わない。先に作っておく管理が結局要る
- `src/game/scenes/ui.ts` SceneExit: 「いつもデータを渡す」に単体テストが無い — 理由: scenes/ は Phaser を読み込むので node の単体テストの対象外（共通の vitest 設定）。QA の「回したあと Result → Title でフェードする」で確かめる
- `src/game/scenes/Game.ts` HUD: SCORE の x = 160 が余白の定数とつながっていない — 理由: 「WAVE 10」でも幅は約 126 px で届かず、3 桁のウェーブは現実に届かない
- `src/game/scenes/Game.ts` / effects.ts: ending で WAVE CLEAR の拡大を止めると、文字が途中の大きさのまま残る — 理由: 同時に文字を空にしているので見えない。ending で中央に文字を出す変更をするときに一緒に直す
- `src/game/scenes/effects.ts` hint: 消す関数を 2 回呼ぶとフェードが最初からになる — 理由: Game.hintDone で 1 回しか呼ばれない
- `src/game/logic/physics.test.ts`: 上の壁のテストが 64・73・74 を直接書いている — 理由: spec のテスト観点（74 → 73）をそのまま書いた意図した期待値（実装から求めると写しになる）
- `src/game/logic/run.test.ts` seeded plays: 左右・下の範囲（9 / 531 / 高さ + 9）が数値のまま — 理由: 枠の改訂より前からあるコードで、その改訂とは関係ない
- `src/game/scenes/Game.ts` HUD: 「HUD は上の枠の線より上」をコードで確かめていない — 理由: HUD の文字の大きさは 26 で固定。spec の実装裁量に条件があり、QA の画面写真で確かめる
- `src/game/logic/run.test.ts` seeded plays: 上の壁の跳ね返りの数え方が「壁の線にちょうど戻す」作りに頼っている／同じフレームに敵にも当たると数えそこねる — 理由: spec が「`FIELD_TOP` + 半径に戻す」と決めており、確かめているのは 0 より多いことだけ
- `src/game/scenes/effects.ts` +N: はみ出さない範囲が壁ではなく画面の端のまま — 理由: 敵の中心は x 36 以上で、「+990」でも幅は約 40 px。範囲に当たることが無く、壁にも届かない。spec も「画面の左右からはみ出さない」で、壁に重なってよいと書いてある
- `src/game/scenes/ui.ts` SHAKE_BLEED: カメラの拡大率 1 と、幅 < 高さを前提にしている — 理由: このゲームはカメラを拡大せず、論理の幅（540）はいつも高さ（756 以上）より小さい。spec にも書いてある
- `src/game/scenes/Game.ts` syncEnemies: 新しい編隊が出るフレームで、敵の位置を 2 回設定している — 理由: 1 ウェーブに 1 回だけのごく小さな重複
- `src/game/logic/formation.ts` formationSpeed: `total <= 0` の守りはゲームからは届かない — 理由: 前の回で守りとして入れると決めた。0 で割らないことを関数の側でも保証しておく
- `src/game/scenes/ui.ts` addButton: ボタンごとに Scene 全体の listener を登録している — 理由: ボタンは最大 2 個で、shutdown で外している。まとめても得るものが小さい
