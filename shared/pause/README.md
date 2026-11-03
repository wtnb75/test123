# pause

時間で進むゲームの自動一時停止の状態を、ゲームに依存しない形でそろえる共有パッケージです（ゲームではありません。公開の一覧には出ません）。

- Phaser に依存しない純粋なクラス `PauseState`。`absorb` の実装を切り出したもの。
- 停止のきっかけ（ページが見えなくなった・ウィンドウがフォーカスを失った）で止まり、戻っても勝手には動き出さない。再開はプレイヤーの操作（停止の後に押し直した再開キー、またはクリック・タップ）だけ。
- Phaser のイベント（`Core.Events.HIDDEN` / `Core.Events.BLUR`）をつなぐ部分、暗幕と文字の表示は、各ゲームの Scene に置く（このパッケージには入れない）。

## 約束

| 項目 | 内容 |
|---|---|
| 停止のきっかけ | `trigger()`。`HIDDEN` と `BLUR` のどちらが先でも、両方でも 1 回の停止。次の `frame()` から止まる |
| 再開 | 停止中に押し下げた再開キー（`keyDown(code, false)`）か、`pointerDown()`。自動リピート（`repeat: true`）と、停止のきっかけより前（同じフレームを含む）に届いた操作では再開しない |
| 再開に使った操作 | ゲームに渡さない（`keyDown` は `false`、`pointerDown` は `true` を返す） |
| 時間 | `frame(deltaMs)` が、そのフレームで進める秒数を返す。停止中は 0、それ以外は `maxDt` で切り詰めた delta（再開したフレームも） |

## 使い方

```ts
import { PauseState } from 'pause';

const pause = new PauseState({ maxDt: 0.05, resumeKeyCodes: [32, 88, 13] }); // both optional

// Scene.create: hook the Phaser events and remove them on shutdown
events.on(Core.Events.HIDDEN, () => pause.trigger());
events.on(Core.Events.BLUR, () => pause.trigger());

// keydown: act only when keyDown returns true
if (pause.keyDown(event.keyCode, event.repeat)) doAction();
// pointerdown: return when the pause takes the tap
if (pause.pointerDown()) return;

// Scene.update
const dt = pause.frame(delta); // seconds; 0 while paused
if (pause.pausedThisFrame) dropInputInFlight();
if (pause.isPaused) return;
```

使うゲームは `package.json` に `"pause": "workspace:*"` と宣言する。

## API

- `new PauseState({ maxDt?, resumeKeyCodes? })` — 既定は `maxDt = 0.05`（秒）、`resumeKeyCodes = [32, 88, 13]`（Space・X・Enter）。
- `trigger()` / `keyDown(keyCode, repeat)` / `pointerDown()` / `frame(deltaMs)`
- `isPaused` — 停止中か。`pausedThisFrame` — 停止が始まったフレームだけ `true`（飛行中の入力を捨てるのに使う）。
