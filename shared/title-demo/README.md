# title-demo

Title 画面の背景で流す「自動プレイのデモ」の進行を、ゲームに依存しない形で扱う共有パッケージです（ゲームではありません。公開の一覧には出ません）。

- 実装の入口は `TitleDemoRunner`（時計・開始の門・透明度をまとめたもの。下の「TitleDemoRunner」）。
- 使うゲーム: `pushline`（盤面を押して一列を消す）、`spotdiff`（差分を見つけてタップする）、`first-game`（数字を読んで推理し、ゴールへ進む）、`primtris`（落ちてくる数字を素因数でボックスへ仕分ける）、`digdle`（素数を色ヒントで推理する）、`calc1`（演算を選んで目標値に合わせる）、`absorb`（敵弾を吸って撃ち返す。本物の `Game` をボットが背景で遊ぶ）、`moleroam`（盤面をスクロールしてモグラを叩く。本物の `Game` をボットが背景で遊ぶ）
- Phaser に依存しない純粋なロジックだけを持つ。時刻は引数で渡す（テストで再現できる）。描画・演出・入力はゲーム側（Scene）が担当する
- 各ゲームは、自分の状態・ルール・手順の作り方を `DemoGame` として渡す。このパッケージは「いつ・何を 1 手進めるか」と「作り直しの透明度」だけを決める

仕様の元になっているのは、各ゲームの `docs/spec.md` の「Title」「デモ」の節です（pushline、spotdiff）。

## 使い方

```ts
import { DemoDirector, StartGate, type DemoGame } from 'title-demo';

const game: DemoGame<State, Action, Detail> = {
    start: () => createState(),            // a fresh run (also used at each rebuild)
    plan: (s) => solve(s),                 // actions that finish the current round, or null / 'pending'
    play: (s, a) => apply(s, a),           // plays one action: { moved, roundDone, detail }
    advance: (s) => nextStage(s),          // optional: see "advance"
};
const demo = new DemoDirector(game, { rounds: 4, timing: { stepMs: 220, waitMs: 500, fadeMs: 300 } }, now);

// every frame
const event = demo.tick(now);              // at most one event per call
const alpha = demo.opacity(now);           // opacity of the board while it is rebuilt
```

## API

```ts
type DemoPhase = 'waiting' | 'stepping' | 'fading-out' | 'fading-in';
type Plan<A> = A[] | null | 'pending';

interface PlayResult<R> {
    /** False when the action could not be played (the plan is dropped and made again). */
    moved: boolean;
    /** True when this action finished the round (a line cleared, a stage completed). */
    roundDone: boolean;
    /** How many rounds this action finished (default 1; counts toward `rounds`). Only meaningful with `roundDone`. */
    roundsDone?: number;
    /** What the Scene needs to play the effects of this action. */
    detail: R;
}

interface DemoGame<S, A, R> {
    start(): S;
    plan(state: S): Plan<A>;
    play(state: S, action: A): PlayResult<R>;
    advance?(state: S): void;
}

interface DemoTiming { stepMs: number; waitMs: number; fadeMs: number }
interface DemoOptions { rounds: number; timing: DemoTiming }

type DemoEvent<R> =
    | { kind: 'action'; detail: R }   // one action was played
    | { kind: 'advance' }             // `advance` ran: the state changed, redraw it
    | { kind: 'fade-out' }            // the board starts fading away: drop effects that are playing
    | { kind: 'fade-in' };            // a new run's state is in place (fully transparent): redraw it

class DemoDirector<S, A, R> {
    constructor(game: DemoGame<S, A, R>, options: DemoOptions, now: number);
    readonly state: S;                // the state of the current run
    readonly phase: DemoPhase;
    readonly rounds: number;          // rounds finished in the current run
    tick(now: number): DemoEvent<R> | null;
    opacity(now: number): number;     // 0..1; 1 except while fading
}

class StartGate {
    /** Whether the Scene is on its way to the game. */
    readonly leaving: boolean;
    /** A start request. True only for the first one. */
    start(): boolean;
}
```

## 振る舞い

時刻 `now` はミリ秒の数値で、ゲーム側が単調に増やして渡す（Scene の経過時間、または `performance.now()`）。

### フェーズ

| フェーズ | 内容 | 遷移 |
|---|---|---|
| `waiting` | 走り始め、1 ラウンドの終わり、作り直しの後から `waitMs` の待ち | 待ちが終わったとき（下の「待ちが終わったとき」。手順が `null` なら `fading-out`） |
| `stepping` | 手順の 2 手目以降を、前の手から `stepMs` ごとに進める | 手順の最後で `roundDone` なら `waiting`。手順が尽きても `roundDone` でなければ新しい `waiting`（手順を取り直す） |
| `fading-out` | `fadeMs` かけて透明になる | 経過したら `start()` で新しい走りを作り、`fading-in` へ（イベント `fade-in`） |
| `fading-in` | `fadeMs` かけて現れる | 経過したら `waiting`（ラウンド数は 0） |

### 待ちが終わったとき

1. 終えたラウンド数が `rounds` に達していれば、`fading-out`（イベント `fade-out`）。
2. そうでなく、直前が「ラウンドの終わり」で `advance` があれば、`advance(state)` を呼び（イベント `advance`）、新しい `waiting` に入る。
3. そうでなければ手順を使う。手順が `null`（取れない）なら `fading-out`。`'pending'`（計算中）なら、取れるまで待つ（次の `tick` で取り直す）。手順があれば `stepping` に入り、1 手目をその場で進める。

### 手順を求める時点

- `plan` は、待ちの開始時刻より後の `now` を持つ最初の `tick` で呼ぶ（同じ `now` の `tick` では呼ばない。コンストラクタで始まる最初の待ちも、構築時と同じ `now` の `tick` では呼ばない）。待ちの終わりに達していれば `now` に関わらず呼ぶ。得られた手順は、その待ちでは取り直さない（`'pending'` を除く）。次の呼び出しは呼ばない: ラウンド数が `rounds` に達しているとき、`advance` があるゲームでラウンドの終わりの待ち（待ちの終わりで `advance` に進む待ち）のとき。
- `plan` が `[]`（空配列）を返したときは、何も進めずに新しい `waiting` に入り、手順を取り直す（`null` とは違い、`fading-out` にはならない）。手順が取れないことを表すのは `null` だけ。
- `'pending'` を返す間は、`tick` のたびに呼び直す。1 手目は、待ちの終わりと、手順が得られた時刻のうち遅いほうに進める。

### 1 回の `tick` で起きること

- イベントは最大 1 つ。1 回の `tick` で進める手は最大 1 手（長いフレームのあとでも、手を連続して進めない）。
- 次の期限は、実際に手を進めた（フェーズが変わった）`tick` の `now` から数える。遅れを取り戻すために、続くフレームで手を連続して進めない（例: `stepMs` 220 のとき、`tick(5000)` で手を進めたら、次の手は `tick(5220)` 以降。`tick(5001)` では進まない）。`waiting` の長さ（`waitMs`）と透明化の長さ（`fadeMs`）も同じで、フェーズが変わった `tick` の `now` を始まりとする。
- `play` が `moved: false` を返したら、イベントなしで新しい `waiting` に入る（手順を取り直す）。

### 時刻の例（`stepMs` 220、`waitMs` 500、`fadeMs` 300、手順が 3 手で 3 手目が `roundDone`、`rounds` 1）

| t (ms) | 起きること |
|---|---|
| 0 | `waiting` の開始（構築時の `now`。`tick(0)` では `plan` を呼ばず、`tick(1)` で呼ぶ。499 まで何も起きない） |
| 500 | 1 手目（`stepping`） |
| 720 | 2 手目 |
| 940 | 3 手目（`roundDone`）→ `waiting` |
| 1440 | `fading-out`（イベント `fade-out`） |
| 1740 | `fading-in`（イベント `fade-in`、`opacity` は 0） |
| 2040 | `waiting` |
| 2540 | 新しい走りの 1 手目 |

`opacity`: `fading-out` の開始で 1、`fadeMs / 2` で 0.5、`fadeMs` で 0。`fading-in` は逆（0 → 1）。それ以外は 1。

## テスト

このパッケージの単体テストは、ゲームに依存しないテスト用の `DemoGame`（数値の列を進めるだけのもの）で、上の振る舞いを確認する。カバレッジはリポジトリ共通の閾値（90%）を守る。

## TitleDemoRunner

どの Title の Scene も、`DemoDirector` の周りに同じものを手で書いていた（Scene の時計を `update` の delta で数える、開始の門、透明度）。`TitleDemoRunner` はそれをまとめた、Phaser に依存しない薄い部品。

```ts
import { TitleDemoRunner } from 'title-demo';

// create(): 入るたびに新しい走り（時刻 0）
this.runner = new TitleDemoRunner(createTitleDemoGame(rng), TITLE_DEMO_OPTIONS);

// update(_time, delta)
const event = this.runner.update(delta);     // 開始が受け付けられたあとは null（時計も止まる）
if (event?.kind === 'action') { /* 演出を再生 */ }
this.view.setAlpha(this.runner.opacity());   // 走りの作り直しの透明化

// 開始（ボタン・キー・タップ）
if (this.runner.requestStart()) this.scene.start('Game', data);   // 最初の 1 回だけ true
```

- `update(deltaMs)`: 時計を `deltaMs` 進めて `tick` する（イベントは最大 1 つ）。負の delta は 0 として扱う。`requestStart()` が `true` を返したあとは、`tick` も時計も動かず、`null` を返す。
- `clock` / `leaving` / `state` / `director`: 描画やテスト用の読み取り。演出の開始時刻（`rowStartedAt[row] = runner.clock` など）は `clock` を使う。
- 選択の変更でデモを作り直すゲーム（primtris の桁数）のように、時計を自分で管理したい場合は、これまでどおり `DemoDirector` を直接使ってよい。

## dev 専用の `window.__qa`（Title の形）

QA のスクリプト（`scripts/qa/title-viewports.mjs` など）が読む、dev ビルドだけの読み取り専用のオブジェクト。`if (import.meta.env.DEV) { … }` の中に直接書く（メソッドを呼ぶ形にすると、使われない本体が本番の bundle に残る）。ビルドのあとに `rg -c __qa <game>/dist/assets/*.js` が何も出さないことを確かめる。

```ts
(window as unknown as { __qa?: unknown }).__qa = {
    scene: 'Title',
    demoVisible: boolean,        // デモを描いているか（置けない画面では false）
    demoPhase: director.phase,   // 'waiting' | 'stepping' | 'fading-out' | 'fading-in'
    demoRounds: director.rounds, // 今の走りで終えたラウンド数
    // ゲーム固有の値（行数・スコア・選択中のモードなど）は、同じオブジェクトに足してよい
};
```

## 本物のゲームを背景で動かす型（absorb）

簡略描画のデモを作らず、ゲームの `Game` Scene そのものをボットの入力で動かして、Title の背後に流す形。見た目が実際のプレイと必ず一致し、デモ用の描画を別に持たなくてよいが、`Game` の Scene に差し替え用の hook が要る。absorb（`absorb/src/game/scenes/Title.ts`・`DemoGame.ts`・`logic/demoBot.ts`・`logic/demoRun.ts`）が参照実装。簡略描画に比べて工数が大きいので、採るかどうかは最初に決める（`game-title`）。

### 構成

- **Scene**: `Title`（最初の Scene）、`Demo`（`Game` を継承した別の Scene。key は別）、`Game`、`GameOver`。`main.ts` の Scene の並びは `[Title, Game, GameOver, Demo]`（先頭が自動で始まる）。
- **Title**: `create` で `scene.launch('Demo')` して `scene.bringToTop()` で自分を前面に置く。暗幕（黒 + 低い不透明度）、黒い幕（走りの作り直し用）、文字・START は Title が持つ。START では `scene.stop('Demo')` してから `scene.start('Game')`。
- **走りの作り直し**: `fade-in` イベント（画面が黒の瞬間）で `scene.stop('Demo')` + `scene.launch('Demo')`（`bringToTop` は最初の 1 回でよい）。黒い幕の不透明度は `1 - runner.opacity()`。
- **`TitleDemoRunner`**: ラウンド 1・手順 1 つの何もしない `DemoGame`（`rounds` 1、`waitMs` = 走りの長さの半分、`fadeMs`、`plan` は `[0]`、`play` は `{ moved: true, roundDone: true }`）。幕が閉じ始めるのは最初が「走りの長さ」、以降は「走りの長さ + 2 × `fadeMs`」ごと（幕が閉じる `fadeMs` と開く `fadeMs`、どちらも待ちに数えない）。
- **`Game` の hook**（通常の経路は変えない。`Game` の `private` のうち Demo が使うものを `protected` にする）:

| hook | `Game` | `Demo` |
|---|---|---|
| `startWorld()`（World を作った直後） | 何もしない（`ready` から始まる） | `world.beginPlay()`（カウントダウンを飛ばす） |
| `setupControls()` | キー・ポインタ・一時停止のトリガーを登録 | 何もしない（リスナーを持たない） |
| `readInput()` | キーを読む | ボットの入力を書く |
| `drawHudLayer()` | HUD・カウントダウンの文字 | 何もしない |
| `onWorldOver()` | `GameOver` を始める | 何もしない（最後の画面で止まる） |

### ボット

- 乱数を使わない純関数（ゲームの状態 → 入力）にする。同じ状態なら同じ入力。テストは手計算の例と、シードを固定した走りの性質。
- **動きに見栄えを持たせる**: 「定位置に留まる」だけだと、敵弾が近くに無いときに静止して見える。ゆっくり巡回する目標点（プレイ経過時間だけで決まる）を置いて、そこへ寄る項を足す（absorb の `DEMO_ROAM_*`）。
- **品質は性質テストで測る**: 走りの長さ全体の生存率、解放などの「見せたい動き」の回数（ボットが押した数を数える。自動の解放を含めない）、画面の横断幅。閾値は spec に書く。

### 落とし穴

- **幕の矩形**: Phaser の `Rectangle` は、`setAlpha` が塗りの不透明度に掛かる。塗りを不透明度 0 で作って `setAlpha(1 - opacity)` すると、幕は一度も出ない（塗りは 1 で作り、`setAlpha(0)` から始める）。QA で幕の途中の `__qa.curtain` と画像を確かめる。
- **`time.now`**: Title を挟むと、更新されなかった間の `time.now` が古いまま残る（calc1 で、最初のラウンドの持ち時間が削られた）。持ち時間・経過時間は delta か `game.loop.time` で数える。Title に何秒いても、START のあとのカウントダウンが通常どおり始まることを QA で確かめる。
- **リスナー**: Demo は入力のリスナーを持たない。Title の Enter / Space と Space のキャプチャは、`shutdown` で解除する。Demo を何度作り直しても、リスナー・タイマーの数が増えないこと。
- **画面サイズ**: Title の開始時に画面サイズを決めるゲームは、`scripts/qa/title-viewports.mjs` のケースに `"fresh": true` を付ける（リサイズでは配置が変わらないため）。
- **配置と被写体の重なり**: 自機などが操作説明の行の上を通る。読めなくならないか、画面写真で確かめる（暗幕で下げる・説明の位置を変える）。
- **ボスなどの予告文字・HUD**: Demo では描かない。spec の「Game との違い」に書く。
- **`__qa`**: Title は上の形、Game は `{ scene: 'Game', phase, ... }`、Demo の World の値は別の dev 専用のグローバルにする。本番の bundle に残らないことを確かめる。

## Title のデモの spec のひな形

`docs/spec/title-demo.md`（分割ファイル。必須の見出しは `game-spec` スキルの「Spec layout」）に、次を書く。digdle・primtris で毎回同じ項目を足したので、最初から入れておく。

- **概要**（1〜3 行）: 何を見せるか。ルール・得点・数値は変えない。
- **操作仕様**: デモは操作を受け付けない。Title の既存の操作は、再生中・透明化中も変わらず働く。
- **画面・Scene構成**
  - レイアウト: デモを置く場所と大きさの式。**置けない画面でどうするか**（デモなしにするか、配置を変えるか）。**手計算の例の表**に、少なくとも iPhone SE の Safari の縦（375 × 550）と横（667 × 310 程度）、スマホ縦（390 × 844）、PC（1280 × 720）、置けない境界の前後（1 px 差）を入れる。実機の表示領域はアドレスバー分だけ画面の高さより低い。
  - 見た目（色・枠・文字の大きさ）、描画順、リサイズでの扱い（走りは作り直さず、今の状態から描き直す。置けなくなっても進行は続ける）。
- **状態**: `DemoDirector` との対応表（状態 `S`・ラウンド・`start`・`plan`・`play`・`advance`・`timing`）、時計の数え方（`TitleDemoRunner`）、開始の門、演出を捨てるイベント（`advance`・`fade-out`・`fade-in`）、透明化は盤面だけに掛けること。
- **ボット**: 乱数を注入できること、手の選び方、同じ手を繰り返さないこと、ラウンドの終わり。
  - 本物のゲームを背景で動かす型では、乱数を使わない純関数にし、動きの見栄え（巡回の目標点）と品質の閾値（走りの長さ全体の生存率・見せたい動きの回数・横断幅）を spec に書く。

- **ルール**: ゲーム本体に影響しない。保存しない（`localStorage` を使わない）。
- **パラメータ表**: 待ち・透明化・セルの大きさの上下限・余白など。値同士の制約（例: 待ち > 1 手の演出の長さ）も書く。
- **テスト観点**: 配置の境界値（1 px 差）、ボットの性質テスト（空振りの検査つき: 勝ち・負けの両方を数える）、時刻列の手計算、負けの経路を固定した乱数で、リサイズでの配置の切り替え。
- **完了条件**: 画面サイズごとのスクリーンショット（`scripts/qa/title-viewports.mjs`）、デモの再生中の入力（開始・モード切替）、置けない画面で Title が崩れないこと。
- **実装裁量**: 純粋ロジックの置き場所、細かい演出（短い動き）、乱数の種。

QA は `scripts/qa/title-viewports.mjs` を使う（画面サイズを順に切り替え、`__qa.demoVisible` を確かめ、スクリーンショットを撮る）。Title の開始時に画面サイズを決めるゲームは、ケースに `"fresh": true` を付ける。START・持ち時間・走りの作り直しは `scripts/qa/title-start.mjs`（標準シナリオ）で確かめる。

## ゲーム側の約束

- 乱数・時計・手順の求め方は `DemoGame` の中で注入できるようにする（テストの再現性）。
- Scene は、イベントに応じて演出を再生し、`opacity` を描画に掛ける。開始（`StartGate.start()` / `TitleDemoRunner.requestStart()` が `true`）したら、`tick` を呼ばず、再生中の演出を捨てる。
- 向きの変更（レイアウトの変更）では、このパッケージの状態に触れない（配置し直すだけ）。
