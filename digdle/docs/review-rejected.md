# コードレビューで見送った指摘（digdle）

`game-codereview` が見送った指摘と、その理由です。次のレビュー（拡張のたび）で同じ指摘を繰り返さないための記録です。仕様ではありません。

- `src/game/scenes/Game.ts`（キー入力）: Scene を開始したキーを押し続けると、自動リピートの keydown が盤面に入力される — 理由: 旧実装（選択画面での押しっぱなし）でも同じ挙動。通常のタップでは起きない。`event.repeat` を捨てると、プレイ中の押しっぱなし入力の挙動が変わる。spec に「自動リピートは通常のキー入力として扱う」と明記した
- `docs/backlog.md`: 拡張の PR に backlog の変更が混ざっている — 理由: `game-spec` の手順で、採用したカードの削除と、後回しの候補の追記を、拡張と同じブランチで行うと決まっている
- `src/game/scenes/Game.ts`（`init()`）: フィールドの初期化を 15 行手で書いていて、足し忘れの余地がある — 理由: 現状は漏れなし。整理は別の変更（1 変更 1 目的）
- `src/game/logic/selectLayout.ts`: 桁数の候補（2〜6）が複数の場所にあり、Scene 間のデータのヘルパーが Title のレイアウトのファイルにある — 理由: 内部構造は実装裁量。桁数の追加は想定外で、必要になったときに整理する
- `src/game/scenes/Title.ts`（`renderDemo`）: 進み具合の対応づけが Scene にあり単体テストされない — 理由: テスト済みの純関数（`typedDigits` / `isJudged`）を呼ぶだけの薄い層。「古い行が残らない」は QA の連続スクリーンショットで確認する
- `src/game/logic/titleDemo.ts`（既定の素数表）: Title の `create` のたびに 4 桁の素数を数え直す — 理由: 1 ms 未満。キャッシュは増える状態に見合わない
- `src/game/scenes/Title.ts` / `Game.ts`（dev 専用の `__qa`）: update が毎フレーム新しいオブジェクトで上書きする・Game と Title で上書きと統合の方針が違う — 理由: dev ビルドだけ（本番の bundle に入らないことを確認済み）。QA の読み取りは自分が決めた項目だけで、どちらでも結果が変わらない
- `src/game/scenes/Title.ts`（shutdown）: `director` などを shutdown で null にしない — 理由: `create` で毎回作り直し、`update` は `starting` と `director` の null で守られている。Scene が再開しても古い状態は使われない
- `src/game/logic/titleDemo.ts`: 空行の重複と、1 行が長い `createDemoGame` の宣言 — 理由: lint は 0 件（指摘のルールは設定に無い）。見た目だけの整形
- `src/game/logic/titleLayout.ts`（2 列の左の列の定数）: 縦並びの定数から導かれていない（170・22・62・118） — 理由: spec が値を決めている。変えるときは spec から直す
- `src/game/logic/titleLayout.ts`: `cell === null \|\| board === null` の重複とデモの組み立ての重複 — 理由: 整理のみ（1 変更 1 目的）
- `src/game/logic/titleDemo.ts`: レイアウトの定数がボット側のファイルにある — 理由: 内部構造は実装裁量で、効果が小さい
- `src/game/scenes/Title.ts`（`renderDemo`）: alpha の比較がセルのループの中にある — 理由: 20 セルだけで影響がない
- `src/game/logic/titleLayout.ts`（ボタンの高さ 40・52 px）: 44 px の目安より小さい — 理由: ユーザーの依頼（ボタンを小さくして）による。QA で実機を確認する
