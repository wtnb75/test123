# NonoEdit

作る、試す、解けるか測る。ノノグラム職人のための実験場!!

## どんなツール?

- モノクロノノグラムをその場で編集
- 行ヒント・列ヒントを即時更新
- 論理解可否と難易度をその場で解析
- PBM (`P1`) でインポート/コピー
- 同じ画面でそのままプレイ検証

## 特徴

- 編集モードはクリックと直線ドラッグ対応（水平/垂直）
- Test Play でも直線ドラッグ対応
- 5マスごとの境界線表示で位置を見失いにくい
- モバイルは 1 カラム + 下部タブ (`編集` / `情報` / `入出力`)
- 解析で使用手筋の回数まで表示

## ルール

- 正解盤面は `filled` / `empty` の 2 状態
- プレイヤー盤面は `unknown` / `filled` / `marked` の 3 状態
- クリア判定は `filled` の一致のみ
- `unknown` と `marked` はクリア条件に含めない

## 操作方法

### 編集モード

- タップ/クリック: 単セル編集
- ドラッグ: 直線編集（水平/垂直）
- `Resize`: 盤面サイズ変更
- `Import`: PBM テキスト貼り付け読み込み
- `Copy PBM`: 現在盤面を PBM 形式でコピー
- `Test Play`: プレイモード開始

### テストプレイモード

- 入力モード: `Fill` / `Mark` をトグル切替
- タップ/クリック:
	- `Fill` 時: `unknown -> filled`, `filled/marked -> unknown`
	- `Mark` 時: `unknown -> marked`, `filled/marked -> unknown`
- ドラッグ（直線）:
	- 範囲内に `unknown` があれば、`unknown` のみを現在モードで更新
	- `unknown` がなく、現在モード対象（`filled` または `marked`）のみで構成される場合は `unknown` に戻す
	- `filled` と `marked` の混在のみの場合は変更しない
- クリア時に `moves` と `time` を表示
- `Edit` で編集に戻る

### キーボード

- `1-9`: サイズプリセット (`5,7,10,12,15,18,20,22,25`)
- `C`: Copy PBM
- `D`: 解析再実行
- `T`: Test Play 開始
- `E`: Edit に戻る
- `R`: 盤面クリア

## 解析手筋

- `full-line-fill`
- `full-line-empty`
- `edge-overlap`
- `candidate-common`
- `cross-constraint`
- `region-split`
- `box-reduction`
- `probe-consistency`

## PBM 仕様

形式は Netpbm `P1`。エクスポート時に以下コメントを付与します。

- `# difficulty: <rank>`
- `# score: <value>`
- `# unique: <true|false>`

インポート時はコメント行を無視します。

## 開発メモ

- 依存インストール: `npm install`
- 開発サーバー: `npm run dev`
- lint: `npm run lint`
- テスト: `npm run test`
- カバレッジ: `npm run test:coverage`
- ビルド: `npm run build`

詳細仕様は `docs/spec.md` を参照してください。
