# dutchcalc 設計ドキュメント

## 背景・目的

競馬や toto などで複数の候補（馬・組み合わせ等）に賭けることを考えたとき、複数の倍率（オッズ）と合計購入口数を入力すると、「どの候補が当たっても払戻額がなるべく均等になる」ように口数を配分するツールを作る。

このリポジトリは複数のゲーム/ツールをディレクトリ単位で管理するモノレポであり（例: `kogodrop`, `editmin`, `nonoedit`, `calc1`）、各ディレクトリは Phaser.js + Vite + TypeScript + ESLint + Vitest の構成を共有する（ルート `AGENTS.md` 参照）。`editmin`（マインスイーパー盤面エディタ）・`nonoedit`（ノノグラム盤面エディタ）は「ゲーム」ではなく「ツール」として同じ構成を採用しており、本ツールもこれに倣う。

新規ディレクトリ名: `dutchcalc`

## スコープ

- 対象: 単一グループ内の「排他的な候補（どれか1つだけが当たる）」に対する口数配分計算
- 非対象: 複数グループの組み合わせ計算（toto の複雑な組み合わせベット全体の最適化等）、実際の購入・決済機能、オッズの自動取得

## アーキテクチャ

`dutchcalc/` を `editmin` と同じディレクトリ構成で新規作成する。

- `package.json` / `vite/config.dev.mjs` / `vite/config.prod.mjs` / `eslint.config.mjs` / `tsconfig.json`: `editmin` を雛形にコピーし、`name`/`description`等を差し替える
- `src/main.ts`, `src/game/main.ts`: Phaser 初期化（`editmin` を踏襲）
- `src/logic/allocate.ts`: 配分計算のピュア関数群。Phaser に依存しない純粋な TypeScript として実装し、Vitest で単体テストする
- `src/game/scenes/MainScene.ts`: 単一 Scene。DOM オーバーレイ（`Phaser.GameObjects.DOMElement`）でフォームと結果テーブルを描画する（`editmin` の `<input type="number">` パターンを踏襲）
- `docs/spec.md`: `AGENTS.md` 2.4 節の必須項目に沿ったゲーム（ツール）仕様書。実装フェーズで作成する
- `README.md`: ツールの目的・ルール・操作方法を記載

フォーム入力 → 計算 → 結果表示は単一 Scene 内の状態遷移として扱い、`init`/`create`/`update` の責務混在は避ける（フォーム構築は `create`、毎フレーム処理は使わない想定）。

## データモデル・配分アルゴリズム（`src/logic/allocate.ts`）

### 入力

- `odds: number[]` — 各候補の倍率（すべて 1.0 より大きい数値）
- `totalUnits: number` — 合計購入口数（整数）
- `unitPrice: number` — 1口あたり金額（100円単位、デフォルト 100 円）

### バリデーション（エラー時は結果ではなくエラーを返す／投げる）

- 候補数は 2 件以上
- 各 `odds[i]` は有限数かつ `> 1.0`
- `totalUnits` は正の整数
- `totalUnits < odds.length` の場合はエラー（全候補最低 1 口の保証を満たせない）
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

ステップ 3 の逐次貪欲法により、`sum(units) === totalUnits` が常に成立し、かつ払戻の最大・最小差が可能な限り小さくなるように配分される。

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

## UI（`MainScene`）

- 候補行: 倍率入力（`<input type="number" step="0.1" min="1.01">`）＋ 削除ボタンを行ごとに配置。「候補を追加」ボタンで行を増やせる（上限 20 件程度）
- 合計口数入力（`<input type="number" min="1" step="1">`）
- 1口あたり金額入力（`<input type="number" min="1" step="1">`、デフォルト 100）
- 「計算」ボタン押下で入力値を読み取り、`allocate()` を呼び出す
- バリデーションエラー時はエラーメッセージを結果エリアに表示し、テーブルは更新しない
- 成功時、結果を DOM テーブルで表示:
  - 候補ごとの行: 倍率 / 口数 / 払戻見込み額 / 回収率
  - サマリ行: 合計投資額 / 最小払戻額 / 最大払戻額 / バランス度（差）

初期状態は候補 2 行（空欄）＋ 合計口数・単価はデフォルト値を入れておく。

## テスト方針

`src/logic/allocate.ts` に対する Vitest 単体テストでカバレッジ 90% 以上を狙う（純粋関数のため到達しやすい）。

- 倍率がすべて同一 → 口数がほぼ均等に分配される（差が 1 以内）
- 倍率が大きく偏っている → 払戻額の `spread` が最小化されること、かつ `sum(units) === totalUnits` が常に成立すること
- 全候補が最低 1 口を得ること
- `totalUnits < candidates.length` の場合にエラーになること
- `odds[i] <= 1.0` を含む場合にエラーになること
- 候補が 1 件のみの場合、全口数がその候補に割り当てられること（境界値）
- `remaining === 0`（`totalUnits === candidates.length`）の場合、全候補が 1 口ずつになること
- 同一払戻額でタイになった場合、インデックスが小さい候補から優先して口数が加算されること（決定論的な挙動の確認）

Scene 側（DOM 操作・フォームの追加削除・エラー表示）は `editmin`/`nonoedit` の既存テストパターンに倣って必要最低限をカバーする。

## 完了条件

- `npm run lint` / `npm run test` / `npm run test:coverage` / `npm run build` がすべて成功する
- `src/logic/allocate.ts` のテストカバレッジが 90% 以上
- `README.md` に目的・ルール・操作方法を記載
- `docs/spec.md` を `AGENTS.md` 2.4 節の必須項目に沿って作成する
