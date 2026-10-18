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
- `src/game/logic/gameLayout.ts`（`computeToastPlacement`）: 幅 160 未満では折り返し幅の下限 20 が背景の最大幅を超える — 理由: spec の想定は幅 320 px 以上。下限 20 は Phaser の高度な折り返しが例外を投げないためのもの
- `src/game/logic/gameLayout.ts`（`pickToastFontSize`）: 12 px でも 58 px を超える通知を切り詰めない — 理由: spec が「保証しない・許容する」と明記している（従来の下限の挙動）
- `src/game/scenes/Game.ts`（通知の背景）: 背景の高さが奇数だと上下の端が半ピクセルになる — 理由: 見た目の差がほぼ無く、spec も高さの偶数化を求めない。幅だけ偶数にしたのは `🏠` / `◀️` との位置の保証のため
- `src/game/scenes/Game.ts`（`toastMaxWidth` の初期値 0）: `createToastUi` の前に通知を出すと 0 幅になる — 理由: `toastBg` / `toastText` の null 判定で `createToastUi` の前には到達しない
- `src/game/logic/gameLayout.ts`（`TOAST_PADDING_X` / `TOAST_PADDING_Y`）: 余白の定数の使われ方が非対称 — 理由: 保守性のみ。値は両方とも定数に集約済み
- `src/game/logic/gameLayout.test.ts`（`ROWS_BY_DIGITS`）: 試行回数をテスト内の固定値で持つ — 理由: spec の表が独立した基準。ゲーム側の定数と共有すると、ゲーム側の誤りを見逃す
- `src/game/scenes/Game.ts`（結果表示の文字 y=52・82）: 通知の帯の境界 60 px と近い — 理由: 今回の変更では動かしていない既存の配置。QA のスクリーンショットで確認する
- `src/game/scenes/Game.ts`（`showToast`）: 通知のたびに文字を最大 5 回測り直す — 理由: 不正入力の Enter 時だけで、コストが小さい
- `src/game/logic/daily.ts`（`parseDailySave`）: 範囲外のキー（2〜6 以外）の値が不正だと保存全体が空になる — 理由: spec が「値が文字列の配列でない → 全体を空」と明記している。通常の遊びでは起きない
- `src/game/logic/daily.ts`（`saveGuesses`）: 日付をまたいで開いたままの古いラウンドが、新しい日の保存を置き換える — 理由: 日付をまたぐ放置と複数タブが重なる場合だけ。「日付が違えば置き換える」は spec どおり
- `src/game/scenes/Game.ts`（`startDailyRound`）: `startRound` の後半と重複し、素数表を `gameApi.primeMap` から取らない — 理由: 整理のみ（1 変更 1 目的）。素数表は共有の 1 つ
- `src/game/scenes/Title.ts`（`refreshDigitLabels`）: 再構築のたびに保存を 5 回解析・再生する — 理由: 数百バイトの JSON で、リサイズとモード切替のときだけ
- `src/game/logic/daily.ts`（`createDailyStorage`）: 読み書きが一度失敗すると以後ずっとメモリを読む・読み込み失敗の直後の書き込みがメモリを元にする — 理由: 「一度失敗したら以後はメモリ」は spec どおり。ブラウザの保存のブロックは持続的で、読みが失敗する環境では書きも失敗する
- `src/game/scenes/Title.ts`（`refreshDigitLabels`）: 0 時をまたいで Title を開きっぱなしにすると印が古い — 理由: 放置してまたぐ場合だけ。Game は新しい日付で始まるので、実害は表示の遅れのみ
- `src/game/scenes/Title.ts`（`onKeyDown`）: 全モードで自動リピートを捨てる — 理由: 最初の keydown で既に開始するので、リピートに意味のある機能が無い
- `docs/spec/daily.md`: 保存キーの名前が spec は `dailyStorageKey`、コードは `DAILY_STORAGE_KEY` — 理由: シンボル名は実装裁量。値（`digdle.daily`）は一致している
