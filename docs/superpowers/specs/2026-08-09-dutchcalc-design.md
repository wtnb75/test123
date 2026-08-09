# dutchcalc 設計ドキュメント

## 背景・目的

競馬や toto などで複数の候補（馬・組み合わせ等）に賭けることを考えたとき、複数の倍率（オッズ）と合計購入口数を入力すると、「どの候補が当たっても払戻額がなるべく均等になる」ように口数を配分するツールを作る。

このリポジトリは複数のゲーム/ツールをディレクトリ単位で管理するモノレポであり（例: `kogodrop`, `editmin`, `nonoedit`, `calc1`）、各ディレクトリは Phaser.js + Vite + TypeScript + ESLint + Vitest の構成を共有する（ルート `AGENTS.md` 参照）。`editmin`（マインスイーパー盤面エディタ）・`nonoedit`（ノノグラム盤面エディタ）は「ゲーム」ではなく「ツール」として同じ構成を採用しており、本ツールもこれに倣う。

新規ディレクトリ名: `dutchcalc`

## スコープ

- 対象: 単一グループ内の「排他的な候補（どれか1つだけが当たる）」に対する口数配分計算
- 非対象: 複数グループの組み合わせ計算（toto の複雑な組み合わせベット全体の最適化等）、実際の購入・決済機能、オッズの自動取得

## アーキテクチャ

### プロジェクト作成手順

`AGENTS.md` 2.2 節の規定に従い、`editmin` を手でコピーするのではなく scaffold コマンドで作成する（`editmin`/`nonoedit` も同じ手順で作られている）。

1. `task newgame PACKAGE=dutchcalc` を実行する（内部で `npm create @phaserjs/game@latest dutchcalc` → 不要な `log.js` 削除 → `task pkgmod` による `package.json` の共通化まで行われる）
2. 生成された Web Bundler(Vite) + TypeScript テンプレートを土台に、`editmin` の DOM オーバーレイ方式（フォーム入力を `<input>` で構築するパターン）へ寄せて `src/main.ts`, `src/game/main.ts`, `index.html`, `public/`, `src/vite-env.d.ts`, `tsconfig.json`, `eslint.config.mjs`, `vite/config.*.mjs` を調整する。scaffold 由来のファイルなので `index.html` / `public/`（favicon, style.css）/ `LICENSE` / `vitest.config.ts` 等の取りこぼしは発生しない
3. `pnpm-workspace.yaml` の `packages:` リストに `dutchcalc` を追加登録する（登録しないと `pnpm -r run lint/test/build` などモノレポ横断コマンドから認識されない）
4. `Taskfile.yml` の `GAMES` 変数には **追加しない**。`dutchcalc` は `editmin`/`nonoedit` と同様「ツール」であり、GitHub Pages 公開一覧（`task build:output` が生成する `output/index.html`）には現時点で載せない方針とする。将来公開する場合のために `#- dutchcalc` の形でコメントアウトしておく

### ファイル構成

- `src/game/logic/allocate.ts`: 配分計算のピュア関数群。Phaser に依存しない純粋な TypeScript として実装し、Vitest で単体テストする
- `src/game/scenes/Game.ts`: 単一 Scene。DOM オーバーレイ（`Phaser.GameObjects.DOMElement`）でフォームと結果テーブルを描画する（`editmin` の `<input type="number">` パターンを踏襲）
- `docs/spec.md`: `AGENTS.md` 2.4 節の必須項目に沿ったゲーム（ツール）仕様書。既に作成済み（`AGENTS.md` 2.4 の規定通り実装前に作成した）
- `README.md`: ツールの目的・ルール・操作方法を記載

フォーム入力 → 計算 → 結果表示は単一 Scene 内の状態遷移として扱い、`init`/`create`/`update` の責務混在は避ける（フォーム構築は `create`、毎フレーム処理は使わない想定）。

## データモデル・配分アルゴリズム（`src/game/logic/allocate.ts`）

### 入力

- `odds: number[]` — 各候補の倍率（すべて 1.0 より大きい数値）
- `totalUnits: number` — 合計購入口数（整数）
- `unitPrice: number` — 1口あたり金額（100円単位、デフォルト 100 円）

### バリデーション（エラー時は結果ではなくエラーを返す／投げる）

- 候補数は 2 件以上
- 各 `odds[i]` は有限数かつ `> 1.0`
- `totalUnits` は正の整数
- `totalUnits < odds.length` の場合はエラー（全候補最低 1 口の保証を満たせない）
- `totalUnits` は上限 100,000 以下（ステップ 3 の逐次貪欲ループが `remaining` 回まわるため、計算量の暴走を防ぐ上限。超過時はエラー）
- `unitPrice` は 100 以上かつ 100 の倍数

### アルゴリズム

1. 全候補に `units[i] = 1` を割り当てる（最低保証）
2. `remaining = totalUnits - odds.length` を計算する
3. `remaining` 回、以下を繰り返す:
   - 現在の払戻見込み額 `units[i] * odds[i]` が最小となる候補 `i` を選ぶ（同値の場合はインデックスが最小のものを優先）
   - その候補の `units[i]` を 1 増やす
4. 各候補について以下を算出する:
   - `payout[i] = units[i] * odds[i] * unitPrice`
   - `totalInvestment = totalUnits * unitPrice`
   - `returnRate[i] = payout[i] / totalInvestment`
5. 全体のサマリとして以下を算出する:
   - `totalInvestment`
   - `minPayout` / `maxPayout`（`payout[]` の最小・最大）
   - `spread = maxPayout - minPayout`（バランス度。小さいほど均等）

ステップ 3 の逐次貪欲法（+ 後続のローカルサーチ改善）により、`sum(units) === totalUnits` が常に成立し、かつ払戻の最大・最小差が小さくなるように配分される。

※この方法は「差(spread)が真に最小になる」ことを数学的に証明したものではないヒューリスティックである。逐次貪欲法だけでは最適解から大きく外れるケースがあるため、その後段に「最大払戻の候補から最小払戻の候補へ、差が厳密に縮む間だけ1口ずつ移す」ローカルサーチを追加し、精度を改善している。それでも全入力に対して最適性を保証するものではない。妥当性はテスト方針の全探索比較テストで、代表的なケースについてのみ確認する。

### 出力型（例）

```ts
interface CandidateResult {
  odds: number;
  units: number;
  payout: number;
  returnRate: number;
}

interface AllocationResult {
  candidates: CandidateResult[];
  totalInvestment: number;
  minPayout: number;
  maxPayout: number;
  spread: number;
}
```

エラー時は `Error` を投げる（呼び出し側の Scene で捕捉し、DOM 上にエラーメッセージを表示する）。

## UI（`Game`）

- 候補行: 倍率入力（`<input type="number" step="0.1" min="1.01">`）＋ 削除ボタンを行ごとに配置。「候補を追加」ボタンで行を増やせる（上限 20 件程度）
- 候補行が 2 件のときは削除ボタンを無効化する（最低 2 候補を維持）
- 合計口数入力（`<input type="number" min="1" step="1">`、上限 100,000）
- 1口あたり金額入力（`<input type="number" min="1" step="1">`、デフォルト 100）
- 「計算」ボタン押下で入力値を読み取り、`allocate()` を呼び出す
- バリデーションエラー時はエラーメッセージを結果エリアに表示し、テーブルは更新しない
- 成功時、結果を DOM テーブルで表示:
  - 候補ごとの行: 倍率 / 口数 / 払戻見込み額 / 回収率
  - サマリ行: 合計投資額 / 最小払戻額 / 最大払戻額 / バランス度（差）

初期状態は候補 2 行（空欄）＋ 合計口数・単価はデフォルト値を入れておく。

## テスト方針

`src/game/logic/allocate.ts` に対する Vitest 単体テストでカバレッジ 90% 以上を狙う（純粋関数のため到達しやすい）。

- 倍率がすべて同一 → 口数がほぼ均等に分配される（差が 1 以内）
- 倍率が大きく偏っている → 払戻額の `spread` が最小化されること、かつ `sum(units) === totalUnits` が常に成立すること
- 全候補が最低 1 口を得ること
- `totalUnits < candidates.length` の場合にエラーになること
- `odds[i] <= 1.0` を含む場合にエラーになること
- `remaining === 0`（`totalUnits === candidates.length`）の場合、全候補が 1 口ずつになること
- 同一払戻額でタイになった場合、インデックスが小さい候補から優先して口数が加算されること（決定論的な挙動の確認）
- 代表的な入力（2〜4 件程度）について、全探索（ブルートフォース）で求めた最小 `spread` の配分と一致することを確認する（アルゴリズムの妥当性検証。全入力での一致を保証するものではない）
- `totalUnits` が上限（100,000）を超える場合にエラーになること

Scene 側（DOM 操作・フォームの追加削除・エラー表示）は `editmin`/`nonoedit` の既存テストパターンに倣って必要最低限をカバーする。

## 完了条件

- `npm run lint` / `npm run test` / `npm run test:coverage` / `npm run build` がすべて成功する
- `src/game/logic/allocate.ts` のテストカバレッジが 90% 以上
- `README.md` に目的・ルール・操作方法を記載
- `docs/spec.md` を `AGENTS.md` 2.4 節の必須項目に沿って作成する
