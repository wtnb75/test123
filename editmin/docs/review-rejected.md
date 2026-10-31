# コードレビューで見送った指摘（editmin）

`game-codereview` が見送った指摘と、その理由です。次のレビュー（拡張のたび）で同じ指摘を繰り返さないための記録です。仕様ではありません。

- `src/game/scenes/Game.ts`（`applyCellSize`）: マスのクリックのたびにグリッドの定義も書き直す（`--cell` を使えば倍率の変更でだけ書けばよい） — 理由: 倍率の変更もクリックも、全マスのボタンを作り直す（`renderBoard`）より軽く、`--cell` と定義の二重管理は小さい。ズームは 1 操作に 1 回で、測定できる差ではない。
- `src/game/scenes/Game.ts`（`create` の `resize` リスナー）: Scene の再起動で解除されない。倍率・ホイールの時刻のフィールドが `create` で初期化されない — 理由: `resize` のリスナーは前からの作りで、この変更の範囲外。Scene は 1 つだけで再起動しない（spec: 単一 Scene。リロードで 32 px に戻る）。
- `src/game/logic/zoom.test.ts`: `Game.ts` のつなぎ（スクロール値を読む順序、入力欄の判定、ホイールの時刻、アンカーの座標）が単体テストされない — 理由: Scene の処理は spec で「ブラウザの確認」とした（DOM 側の確認）。スクロールの読む順序の不具合は修正し、ブラウザで「マスが動かない」ことを確かめる。
- `src/game/scenes/Game.ts`（`displayMode` の初期化）: `create` で `displayMode` を初期化しない — 理由: Scene は再起動しない（単一 Scene。リロードで「数字」に戻る）。再起動を入れる変更のときに `create` の先頭で `DISPLAY_MODE_DEFAULT` を入れる。
- `src/game/logic/displayMode.ts` と `public/style.css`（表示の規則が TS と CSS の 2 か所にある）: 数字・B・地雷の塗りの規則が、TS（`showNumbers` など）と CSS（`hide-numbers` など）に分かれている — 理由: 規則の判断は単体テストで固定している。CSS はクラスを当てるだけで、組み合わせの表を DOM で確かめるのは重い。規則を変えるときは `displayMode.test.ts` と CSS を同じ変更で直す。
- `src/game/scenes/Game.ts`（`onCellClick`）: キーボードの「クリック」（`event.detail === 0`）を、プレイ中は開かない扱いにしている。支援技術が出すクリックも落ちる — 理由: spec は「Space・Enter でマスが開かない」と定めており、キーボード由来を見分けるのは `detail` が標準の手段。プレイはマウス操作が前提。トレードオフとして PR の「未対応」に書く。
- `src/game/logic/play.ts`（`startPlay`）: 開始マスの周囲に爆弾が無いことを再確認しない — 理由: 開始マスの制約（`hasMineInZone` の拒否と、禁止マスへの爆弾の拒否）で、開始マスの周囲には爆弾が入らない。同じ制約を 2 か所で持つと、仕様の一つの規則が二つの実装に分かれる。
- `src/game/scenes/Game.ts`（`renderAll`）: 盤面の見た目の処理が 2 回走る（`renderBoard` と `updatePlayUi`） — 理由: 50 × 50 でも 2 回で、測定できる差ではない。`renderAll` の経路を組み直すと編集の経路にも触れる。
