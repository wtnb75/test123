# レビューで見送った指摘

コードレビュー（`game-codereview`）で、直さないと決めた指摘と理由。同じ指摘を繰り返さないために残す。

- `scenes/Title.ts`: 色・`HINT_MARGIN`・深度などのシーン内定数が `constants.ts` に無い — 理由: 見た目だけの値で、spec が名前を付けて決めているのは `TITLE_*` のみ（実装裁量）
- `scenes/DemoGame.ts`: Demo でも `Game.createHud` が HUD のテキスト・グラフィックスを作る（描かれない） — 理由: 作成は 1 回だけで表示は空。`createHud` の hook を足すと `Game` の差分が広がるわりに得るものが無い
- `scenes/Title.ts`: Title の時計は生の delta、Demo の World は `pause.frame(delta)` — 理由: 長い 1 フレームで数 ms ずれるだけで、幕が下りる時刻が動くのみ
