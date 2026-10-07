---
status_idea: done
status_init: done
status_proto: done
status_spec: pending
status_impl: pending
status_test: pending
status_check: pending
status_codereview: pending
status_qa: pending
status_polish: pending
status_balance: pending
status_publish: pending
---

> spec-lite: プロトタイプ用の下書き。`game-spec` が完全版に仕上げる。

# モグラ巡り (moleroam)

## コンセプト

画面に収まらない広い盤面をスクロールしながら遊ぶモグラ叩き。画面外に出たモグラは画面端の矢印で方向がわかる。モグラに混じって出る「叩いてはいけない相手（ネコ）」を叩くと減点になり、矢印は出ない。

## コアループ

矢印を見て盤面をスクロールする → モグラを見つける → 叩く（加点）。ネコは叩かない（叩くと減点）。放置したモグラは引っ込む。60秒で終了し、スコアを表示する。

## 操作仕様

| 入力 | スクロール | 叩く |
|---|---|---|
| タッチ／マウス | ドラッグ | タップ（ドラッグ量がしきい値未満） |
| キーボード＋マウス | 矢印キー、またはマウスカーソルを画面端に寄せる | クリック、またはSpace（カーソルがあればその位置、なければ画面中央の照準を叩く） |
| キーボードのみ | 矢印キー | Space（画面中央の照準位置を叩く） |

## パラメータ表

`src/proto/params.ts` と一致させる。

| 名前 | 値 | 意味 |
|---|---|---|
| viewW × viewH | 1024 × 768 | 表示領域 |
| boardCols × boardRows | 8 × 6 | 穴の数（48個） |
| holeSpacing | 320 px | 穴の間隔（盤面は 2560 × 1920、画面の約2.5倍） |
| gameSeconds | 60 | 制限時間 |
| spawnIntervalMs | 1200 | 出現判定の間隔 |
| maxActive | 4 | 同時に出る数の上限（予兆中も数える） |
| friendRate | 0.25 | 出たものがネコである確率 |
| comboRate | 0.2 | 出現判定のとき、コンボ出現になる確率（空きが comboSize 以上あるとき） |
| comboSize | 3 | コンボ出現で同時に出る数（隣り合う穴） |
| telegraphMs | 800 | 予兆（穴が揺れる）の長さ。この間は叩けない |
| popLifetimeMs | 3000 | 予兆のあと、出ている（叩ける）時間 |
| hitRadius | 70 px | 叩きの当たり半径 |
| scoreMole | +10 | モグラを叩いた加点 |
| scoreFriend | -20 | ネコを叩いた減点（スコアは0未満にならない） |
| scrollSpeed | 700 px/s | 矢印キーのスクロール速度 |
| dragThresholdPx | 10 | タップとドラッグの境目 |
| arrowMargin | 40 px | 方向矢印を画面端から内側に置く距離 |
| edgeScrollZonePx | 90 | マウスカーソルが画面端からこの距離以内に入るとスクロールする帯の幅 |
| edgeScrollSpeed | 600 px/s | 端スクロールの最大速度（端に近いほど速い） |

## プレイテストで固まったこと

### 1回目

- PC のキーボード＋トラックボールではドラッグ操作が難しい。スマホのほうが良さそう → マウスカーソルを画面端に寄せるスクロールを追加。Space はカーソル位置を叩くようにした。
- スクロールしている間にモグラが引っ込んでしまう → 出る前の予兆（穴が揺れる、800ms、叩けない）を入れ、出ている時間を 1800ms → 3000ms に延ばした。出現間隔も 900ms → 1200ms にした。
- モグラが連携して出てくると面白そう → 隣り合う穴に3匹まとめて出るコンボ出現を追加（20%）。
- 叩いた／ネコだった／空振りの手応えを分けて見せたい → 叩いた＝つぶれる＋星＋「+10」、ネコ＝赤フラッシュ＋大きな揺れ＋「-20」、空振り＝白いリング＋「miss」（減点なし）。
