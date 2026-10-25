# fukuwarai: reject したコードレビューの指摘

- `src/game/logic/dragTransform.ts`: 回転の立ち上げが pointermove 1 回あたりの距離なので、端末のイベント頻度（120Hz など）で感触が変わる — 理由: 速さの単位は px/回のまま（現行の仕組みと同じ）と合意済み。時間換算は合意の範囲外
- `src/game/logic/dragTransform.ts`: しきい値が論理 px なので、小さい画面では実寸が小さい — 理由: 同上（論理 px は全パラメータ共通の前提）
- `src/game/logic/dragTransform.ts`: 3〜4 px/回で崖があり、遅い動きは積算されない — 理由: 3→8 px/回の ramp は実測して合意済み（4 px/回の 320px の引っ張りは −88.5° で向きが付く）
- `src/game/logic/dragTransform.ts`: 5〜8 px/回の微調整や往復の動きは回転しうる — 理由: 合意した範囲は 3 px/回以下の微調整。それ以上は意図して引っ張りとみなす
- `src/game/logic/dragTransform.test.ts`: 固定値（11 回・88px・0.005 など）がチューニングで落ちる — 理由: spec の手計算値に結び付けた意図的な固定。チューニング時は spec と合わせて更新する
- `docs/spec.md`: パラメータ表に `SCORE_BUTTON_Y` などが無い — 理由: 既存部分で今回の目的外
- `src/game/scenes/Game.ts`: ドロップ先の表示の呼び出し順（開始・消去・確認演出）と「領域が変わったときだけ描き直す」判定が単体テストされていない — 理由: Scene の結合部は Phaser に依存し、spec が `game-qa` の確認に委ねている（純粋部分は `dropHint.test.ts` でテスト済み）
- `src/game/scenes/Game.ts`: ラベルの文字色（`#14524b` / `#8f2f14`）と塗りの矩形が Scene 内の分岐にある — 理由: 文字色は spec の実装裁量で委ねられている。塗りの矩形は 2 領域の固定の分岐で、増える予定がない
- `src/game/logic/constants.test.ts`: 既存定数の値を固定する変更検知テストで、再調整で落ちる — 理由: spec の完了条件「変えないもの」の回帰条件を満たすための意図的な固定。再調整するときは spec と合わせて更新する
- `src/game/scenes/Game.ts`: 2 本目の指／ポインタが、別のドラッグの表示と離す判定を左右しうる — 理由: 既存の入力の扱い（1 つの `activeDragId` とシーン全体の `pointerup`）は、この拡張で変えないと合意した。複数ポインタ対応は別の拡張
- `src/game/scenes/Game.ts`: 領域が変わるたびに塗りと線の `Graphics` を描き直す — 理由: 変わるのは境界をまたいだときだけで、コストは小さい。2 状態を事前に作る利点より複雑さが大きい
- `docs/backlog.md`: `drag-settle` を削除すると、向き直しの追従距離の課題が追えない — 理由: 合意は微調整の乱れのみ。向き直しは、必要なら新しいカードにする
- `src/game/scenes/Game.ts`: お題を `registry` で受け渡す部分（読む・書く・`Result` への番号）に単体テストが無い — 理由: Scene の処理は spec で `game-qa`（「もう一度」を数回押して元絵の顔が毎回変わる・採点と小さい正解の顔が同じお題）で確かめるとした。`pickTopic` は単体テスト済み。
- `src/game/scenes/Game.ts`: `answers` と `topicIndex` が 2 つのフィールドで、同期が必要 — 理由: `create` の 1 か所で続けて代入し、他では書き換えない。getter にする整理は、この変更の範囲外。
- `docs/spec.md`: 採点のカーブの測定値が、QA 前なのに事実として書かれている — 理由: 値は実ブラウザの測定で、`game-qa` で同じ測定を（実際のお題のデータで）やり直して確かめる。
- `src/game/logic/outline.ts`（`dashSegments`）: 頂点をまたぐ破線が弦になり、角が 1〜2px 切られる（鼻の三角形）— 理由: 見た目の細部で、破線の描き方は spec の実装裁量。頂点で分けると位相の処理が増える。
- `src/game/logic/outline.ts`（`dashSegments`）: 閉じた輪郭の継ぎ目で、開いたままの破線が捨てられ欠けて見える — 理由: 同上（実装裁量。関数のコメントに明記済み）。
- `src/game/logic/outline.ts`（`dashSegments` / `faceOverlaySegments` の dash・gap 引数）: 本番は既定値（定数）しか渡さない — 理由: テストで手計算の値（4px・4px など）を直接検証するため。変えるときは定数と合わせる。
- `src/game/logic/resultLayout.test.ts`: 重ねの定数（`RESULT_FACE_CENTER_Y` 210・`RESULT_OVERLAY_LINE_PX` 3）を literal で固定 — 理由: spec のパラメータ表の値そのものを回帰条件として固定している（完了条件）。
- `docs/spec.md`（frontmatter）: 公開後改訂の `game:reset` で `qa` 以降が `pending` に戻る差分 — 理由: `game-spec` の手順による意図的な再初期化（公開済みの仕様を変えたため）。

