# レビューで見送った指摘

`game-codereview` で出て、採用しなかった指摘と理由。次のレビューで同じ指摘をくり返さないために残す。

- `src/game/scenes/Game.ts`（`update` の同じフレームの順序と `ending` のタイマー）: Scene の中にあり、単体テストされない — 理由: spec が「Scene のグルーは QA で確認する」としている。順序の肝（入力 → 時間）は `Round` のテストで固定済み。`Round` に更新処理を足すのは大きな変更になる
- `src/game/scenes/Result.ts` / `Title.ts` / `ui.ts`（配置の数値 y = 24 / 56 / 84 / 106、`LIST_LEFT`、`padEnd(9)`、`RotateGuard` の余白・文字・透明度・深さ）: `params.ts` に無い — 理由: spec は、これらを「H = 528 の例」と実装裁量としていて、ゲーム性の数値ではない
- `src/game/scenes/Game.ts`（`refreshTargets` の色のキャッシュ）: トレイを変える別の経路ができるとずれる — 理由: 今は、トレイが変わる経路がすべて `refreshAfterTrayChange` を通る。直す害のほうが大きい
- `src/game/scenes/Game.ts`（落ちてくる文字のプール化）: 文字ごとに Rectangle・Text・Container を作って壊す — 理由: 出現は 0.65 秒に 1 回で毎フレームではない。プール化は変更が大きく、得るものが小さい
- `src/game/scenes/ui.ts`（Safari の確定 Enter）: Safari は IME の確定 Enter を `isComposing=false` で送ることがある（`keyCode === 229` でも判定できる） — 理由: PC の Safari と日本語 IME の組み合わせだけで、実機で確かめていない。spec の文面は「変換中」。困る報告が出たら足す
- `src/game/scenes/Result.ts`（`this.input.mousePointer` の二重指定）: `manager.pointers[0]` がマウスと同じ — 理由: 動作に問題はなく、直す価値が無い
- `src/game/logic/effects.ts`（`EffectCounts` の `ghosts` と `pops`、`fullHint` と `shake` が常に同じ値）: 冗長 — 理由: spec が演出ごとに別の行として定めているので、分けて持つほうが読みやすい。害はない
- `src/game/scenes/Result.ts`（スコアの数え上げが比例幅フォントで、桁が増えると左右にわずかにずれる）: 理由: spec は「固定幅を推奨」とだけ書いた実装裁量。数字は等幅で、ずれは 600 ms の間の数 px。QA で見て気になれば直す
- `src/game/scenes/ui.ts`（ボタンごとの `pointerupoutside` が `pointerout` とほぼ重複）: 理由: 押したまま画面の外で離した場合の保険で、実害はない
- `src/game/scenes/ui.ts`（`mouseIsOver` のマウス座標が、画面の大きさが変わった直後やキャンバスの外で古い）: 理由: 影響は見た目だけで、マウスを動かせば直る
- `src/game/scenes/Game.ts`（`take()` の TIME の強調が `shouldBumpTime` を遠回りに通る。`updateHud()` が先に走るので `prevShown` の分岐は使われない）: 理由: 判定の出どころを 1 つにするための形で、振る舞いは正しい。順序の注意はコメントで足りる
- `src/game/logic/best.test.ts`（壊れた値・保存失敗のテストが `shared/best-store` のテストと重なる）— 理由: spec のテスト観点が wordfall 側でも確かめるよう書いている。共有側の契約が変われば気づける
- `src/game/logic/best.ts`（`loadBest` が薄いラッパー）— 理由: `formatBest` を数値のまま保てて、画面側の変更が最小になる
- `src/game/logic/best.ts`（スコア 0 を記録しないガードが wordfall 側にある。共有ストアに `minScore` を足す案）— 理由: spec で決めた設計。共有ストアは変えない
- `src/game/scenes/Game.ts`（DEV 専用の `?qatime=` が `Round` の内部を直接書き換える）: 理由: QA の補助だけ。`Round` に時間の上限のような状態は無い
- `src/game/logic/tray.ts` の `resolveCompletions`: 取り除く文字が 0 個の完成が続くと、連鎖に上限が無い — 理由: 続くには、新しく引いた語がその都度トレイの文字だけで揃う必要があり、確率が急速に 0 に近づく。上限は仕様に無い規則を足すことになる
- `src/game/scenes/Game.ts` の `spawn`（手がかり用の縁 2 つと光を全部の文字に作る。遅延生成の案）: 理由: 作るのは 650 ms に 1 回だけ（プール化を見送った理由と同じ）。遅延生成は複雑さを増やすわりに得が小さい
