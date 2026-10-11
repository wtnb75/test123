# first-game: コードレビューで見送った指摘

`game-codereview` が、見送った指摘を理由つきで残すファイル（spec ではない）。レビュアーに渡して、同じ指摘を繰り返さないために使う。コードが無くなった行は消す。

- `src/game/core/title.ts`（`isStartKey` が pushline の `logic/titleGate.ts` と同じ 1 行の複製）: 共有パッケージに無い — 理由: 共有に移すには `shared/title-demo` と pushline も触る。1 行の複製で、3 本目のゲームで同じ判定が要るときに共通化すれば足りる
- `src/game/scenes/Game.ts`（`onPointerUp` がタッチのキャンセル `pointer.wasCanceled` を見ない。ゲームオーバー画面・ジョイスティック・盤面のタップ）: キャンセルで新しいゲームが始まる／動く — 理由: Game は今回の変更の対象外（変更していない）。入力の扱いの修正は別の変更（`docs/backlog.md` の `button-release-move` にまとめた）
- `src/game/scenes/Game.ts`（FLAG / STAGE ボタンを押した指を離すと盤面のタップとして扱われる疑い）: 隣のマスへ意図せず動く — 理由: 既存の挙動で、未再現。今回の PR に混ぜず、`docs/backlog.md` のカードにして、再現してから別の `fix` ブランチで扱う
- `src/game/scenes/Title.ts`（幅 32 px 以下の画面でボタンの幅が 0 になり、押せない）: 極端に狭い画面 — 理由: spec は幅 240 px 未満を保証しない（Enter / Space では始まる）。現実にない画面
- `src/game/scenes/Title.ts`（後始末を `shutdown` だけで行い、`destroy` では行わない）: シーンを削除するとリスナーが残る — 理由: `Title` は停止されるだけで削除されない。`Game` も同じ書き方
- `src/game/core/generator.ts`（上限に達したとき、解決不能な候補を使う恐れ）: 全ステージ解決可能の保証に反する — 理由: 既存の挙動で、spec に例外として明記した。候補の選び方を変えるのは、難しさに関わる別の変更
