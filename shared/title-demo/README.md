# title-demo

Title 画面の背景で流す「自動プレイのデモ」の進行を、ゲームに依存しない形で扱う共有パッケージです（ゲームではありません。公開の一覧には出ません）。

- 使うゲーム: `pushline`（盤面を押して一列を消す）、`spotdiff`（差分を見つけてタップする）
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

## ゲーム側の約束

- 乱数・時計・手順の求め方は `DemoGame` の中で注入できるようにする（テストの再現性）。
- Scene は、イベントに応じて演出を再生し、`opacity` を描画に掛ける。開始（`StartGate.start()` が `true`）したら、`tick` を呼ばず、再生中の演出を捨てる。
- 向きの変更（レイアウトの変更）では、このパッケージの状態に触れない（配置し直すだけ）。
