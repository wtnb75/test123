# コードレビューで見送った指摘（editmin）

`game-codereview` が見送った指摘と、その理由です。次のレビュー（拡張のたび）で同じ指摘を繰り返さないための記録です。仕様ではありません。

- `src/game/scenes/Game.ts`（`applyCellSize`）: マスのクリックのたびにグリッドの定義も書き直す（`--cell` を使えば倍率の変更でだけ書けばよい） — 理由: 倍率の変更もクリックも、全マスのボタンを作り直す（`renderBoard`）より軽く、`--cell` と定義の二重管理は小さい。ズームは 1 操作に 1 回で、測定できる差ではない。
- `src/game/scenes/Game.ts`（`create` の `resize` リスナー）: Scene の再起動で解除されない。倍率・ホイールの時刻のフィールドが `create` で初期化されない — 理由: `resize` のリスナーは前からの作りで、この変更の範囲外。Scene は 1 つだけで再起動しない（spec: 単一 Scene。リロードで 32 px に戻る）。
- `src/game/logic/zoom.test.ts`: `Game.ts` のつなぎ（スクロール値を読む順序、入力欄の判定、ホイールの時刻、アンカーの座標）が単体テストされない — 理由: Scene の処理は spec で「ブラウザの確認」とした（DOM 側の確認）。スクロールの読む順序の不具合は修正し、ブラウザで「マスが動かない」ことを確かめる。
- `src/game/scenes/Game.ts`（`displayMode` の初期化）: `create` で `displayMode` を初期化しない — 理由: Scene は再起動しない（単一 Scene。リロードで「数字」に戻る）。再起動を入れる変更のときに `create` の先頭で `DISPLAY_MODE_DEFAULT` を入れる。
- `src/game/logic/displayMode.ts` と `public/style.css`（表示の規則が TS と CSS の 2 か所にある）: 数字・B・地雷の塗りの規則が、TS（`showNumbers` など）と CSS（`hide-numbers` など）に分かれている — 理由: 規則の判断は単体テストで固定している。CSS はクラスを当てるだけで、組み合わせの表を DOM で確かめるのは重い。規則を変えるときは `displayMode.test.ts` と CSS を同じ変更で直す。
- `src/game/scenes/Game.ts`（`onCellClick`）: キーボードの「クリック」（`event.detail === 0`）を、プレイ中は開かない扱いにしている。支援技術が出すクリックも落ちる — 理由: spec は「Space・Enter でマスが開かない」と定めており、キーボード由来を見分けるのは `detail` が標準の手段。プレイはマウス操作が前提。トレードオフとして PR の「未対応」に書く。
- `src/game/logic/play.ts`（`startPlay`）: 開始マスの周囲に爆弾が無いことを再確認しない — 理由: 開始マスの制約（`canSetStart` の拒否と、`canPlaceMine` による禁止マスへの爆弾の拒否）で、開始マスの周囲には爆弾が入らない。同じ制約を 2 か所で持つと、仕様の一つの規則が二つの実装に分かれる。
- `src/game/scenes/Game.ts`（`renderAll`）: 盤面の見た目の処理が 2 回走る（`renderBoard` と `updatePlayUi`） — 理由: 50 × 50 でも 2 回で、測定できる差ではない。`renderAll` の経路を組み直すと編集の経路にも触れる。
- `src/game/logic/board.ts`（`adjacentMineCount` を `play.ts` から import）: 編集盤面の規則がプレイ用モジュールに依存する — 理由: 近傍・隣接数の計算を 1 か所にするための再利用で、`play.ts` は型を広げただけ。移すと `play.ts` と `play.test.ts` の範囲外の変更になる。後続カードで盤面の規則が増えたときに移す。
- `src/game/scenes/Game.ts`（`forbiddenCells`）と `canPlaceMine`: 開始マス未指定のときの扱いが 2 か所にある — 理由: 前者は描画用に空の集合を返すだけの薄い関数で、後者は設置の判定。結果は一致しており、規則（禁止領域の範囲）は `forbiddenZone` の 1 か所。
- `src/game/logic/board.ts`（`zoneHasMine` と `canSetStart`）: 同じ規則の入り口が 2 つ — 理由: spec が「禁止領域に爆弾があるか」「開始マスを設定できるか」を別の規則として挙げ、テストも分けている。
- `src/game/logic/evaluateDifficulty.ts`: ソルバー内に開始マス周囲の集合を作る処理がある — 理由: 既存のコードで、この変更は `evaluateDifficulty` とそのテストを変えない約束。
- `src/game/logic/board.test.ts`: 範囲外の開始マス・トグル後の再計算の専用テストが無い — 理由: 範囲外の入力の扱いは spec で定めていない。トグル後の再計算は爆弾の有無で `toBoardText` の結果が変わるテストで押さえている。
- `src/game/scenes/Game.ts`（`onHistoryKey`）: キーの自動リピート（`event.repeat`）でも取り消しが続く。長押しで履歴を使い切る — 理由: エディタの標準の挙動で、やり直しで戻せる。spec に制限の定めが無く、足すと挙動を決める変更になる。
- `src/game/scenes/Game.ts`（`updatePlayUi`）: 履歴ボタンが disabled になるとフォーカスが落ちる — 理由: マスの描き直しでもフォーカスが落ちる既存の作りと同じで、この変更の範囲外。
- `src/game/scenes/Game.ts`（「反映」）: 丸めたサイズが入力欄に戻らない。入力欄の `min`/`max` の直書き — 理由: 今までどおり（spec は、入力欄を戻すのは取り消し・やり直しのあとだけと定義）。`min`/`max` は既存。
- `src/game/scenes/Game.ts`（状態表示と `updateAnalysis`）: 「評価エラー」が取り消し・「反映」の状態表示を上書きしうる — 理由: 制約を満たす盤面では評価エラーに到達しない。トグルと同じ既存の順序。
- `src/game/scenes/Game.ts`（`snapshot` / `applySnapshot`）: 盤面のコピーが多く、地雷を 2 つの表現で持つ — 理由: 2500 マスで測定できる差は無く、マスのボタンの描き直しのほうが重い。履歴の 100 手 × 2500 は小さい。
- `src/game/scenes/Game.ts`（履歴ボタン）: タップの的が 44 px 未満 — 理由: 既存のサイドバーのボタンと同じ見た目。backlog の `look-mobile` で扱う。
- `src/game/scenes/Game.ts`（ドラッグ編集の `onBoardPointerDown`）: 離したあとの `suppressClick` が次の押下まで残る。ストローク中の別ポインター（`pointerId`・`pointerType`）を見ていない。ストローク中の左ボタンの押下は無視する — 理由: 本物のクリックは必ず盤面の押下を先に受けて解除される。別ポインターの混在と、離し損ねの直後の押下は、ごくまれで害が小さい（`pointermove` の `buttons` で終わる）。
- `src/game/logic/paint.ts`（`visitCell` の配列コピー、`strokeStatus` と `strokeStatusText` が別、`N` = 0 かつ `M` = 0 の保護、`onCellClick` を `paint.ts` に通さない）: 理由: 純粋関数は引数を変えない契約（spec）で、50 × 50 でも測れる差が無い。区分（純粋）と文言（Scene の選択）は spec が分けている。`N` = 0 かつ `M` = 0 は到達しない。1 マスのクリックの経路は変えない約束。
- `src/game/scenes/Game.ts`（ストローク中のキーボード: 押している間の Enter・Space でサイドバーのボタン、ウィンドウの `blur`）: 理由: 左ボタンを押したままキーを押す同時操作で、ごくまれ。離し損ねは `pointermove` の `buttons` で終わる。
- `src/game/scenes/Game.ts`（`onStrokeMouseDown` が効かない可能性、`applyCellViews(only)` が全ボタンを走査する）: 理由: 前者は未確認の推測で、効かなくても中ボタンの自動スクロールが出るだけ（QA で確かめる）。後者は 2500 マスの走査で、測れる差が無い。
- `src/game/scenes/Game.ts`（`onCellClick` の結線）: `canSetStart` / `canPlaceMine` の呼び出しが単体テストされない — 理由: Scene は spec でブラウザの確認（QA）の対象。QA で開始マスの拒否・禁止マスへの拒否の文言を確かめる。
