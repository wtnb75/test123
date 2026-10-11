# Title のデモ（プレイ風景）の展開調査

共有パッケージ `shared/title-demo`（`DemoDirector` / `StartGate`）を使って、Title の背景に「ボットのプレイ風景」を流すゲームを広げるための、全ゲームの現状調査です。仕様ではありません（各ゲームの仕様は、そのゲームの `docs/spec.md`）。

- 調査日: 2026-10-12
- 対象: `origin/main`（`6b2717b`）の全 16 ゲーム

## 現状

### デモあり（3 本）

`first-game`・`pushline`・`spotdiff`（`package.json` に `title-demo: workspace:*`）。

### Title はあるが、デモなし（4 本）

| ゲーム | 公開 | Title の中身 | デモにできそうか |
|---|---|---|---|
| `primtris` | 一覧 | 名前・一言説明・桁数の選択（122 行） | ◎ 純粋なロジックとオラクルテスト。落下パズルのボットが作りやすい |
| `kogodrop` | 一覧 | 名前・言語・難易度・出題数の選択・警告（340 行） | ○ 選択 UI が多く、デモの置き場所の設計が要る |
| `moleroam` | labs | 名前・一言説明・操作説明・Start（68 行） | ○ 画面より大きい盤面をスクロールして叩く様子。ボットはやや重い |
| `fukuwarai` | 非公開 | 名前・一言・スタートのみ（39 行） | △ 公開されていないので優先度は低い |

### Title がない（9 本）

| ゲーム | 公開 | 今の流れ | 備考 |
|---|---|---|---|
| `digdle` | 一覧 | `MainGame` だけ | 素数の Wordle。判定が純粋で、推測の様子は見せやすい |
| `calc1` | 一覧 | `MainGame` だけ | 自動で解く様子が見せられる |
| `absorb` | 一覧 | `MainGame` → `GameOver` | 見栄えは一番。Title の新設とリアルタイムのボットが要る |
| `shoot1` | labs | `Boot` → `GameScene` → `GameOver` | |
| `mazetd` | labs | `MainGame` → `Result` | ボットは重い |
| `cjump` | 非公開 | `Boot` → `StageSelect` → … | ステージ選択が入口 |
| `nonoedit`・`editmin`・`dutchcalc` | 非公開 | `MainGame` だけ | ゲームではなくエディタ・計算ツール。デモは意味が薄い |

## 進め方

1. **Title がないゲーム**: まず Title の新設 + spec の整備（`first-game` の #123 と同じ）、その後にデモ（#125 と同じ）。
2. **Title があるゲーム**: すぐデモ。ゲームごとに、配置・描画・ボットの手順を書く（`title-demo` が持つのは、進行と開始の門だけ）。
3. **backlog**: `absorb`・`moleroam`・`spotdiff`・`first-game` にはある。他のゲームは `game-extend` の前に `game-backlog` で候補を作る（またはユーザーの案を直接渡す）。
4. デモを足したら、`shared/title-demo/README.md` の「使うゲーム」に足す。

## 推奨の順

| 順 | ゲーム | 理由 |
|---|---|---|
| 1 | `primtris` | Title あり・ロジックが純粋・ボットが素直 |
| 2 | `digdle` | 公開済み。Title の新設は要るが、デモは読みやすい |
| 3 | `calc1` | 同上 |
| 4 | `kogodrop` | Title の選択 UI の扱いを決める |
| 5 | `absorb` | 見栄えは一番だが、Title の新設とリアルタイムのボットが要る |
| 6 | `moleroam` | labs。Title あり |
| 以降 | `shoot1`・`mazetd`・`fukuwarai`・`cjump` | labs・非公開。公開の方針が決まってから |
| 対象外 | `nonoedit`・`editmin`・`dutchcalc` | エディタ・ツール |
