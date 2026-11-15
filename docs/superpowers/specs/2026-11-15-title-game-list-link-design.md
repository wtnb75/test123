# Title 画面の「ゲーム一覧へ戻る」リンク 設計

## 目的
公開サイト（`output/<game>/`）で、各ゲームの Title 画面から一覧（`output/index.html`）へ戻れるようにする。

## ゴール / ノンゴール
- ゴール: 全ゲームの Title に小さいリンクが出る。ゲーム中・結果画面には出ない。
- ゴール: 試作 / 公開 / どちらでもない、の別をソースに持ち込まない（Taskfile だけで決める現状を保つ）。
- ノンゴール: labs.html への出し分け。リンク先は常に `../`。
- ノンゴール: Title の Canvas 内のレイアウト変更、Title の作り直し。

## 制約
- 公開物は `./` ベース（`config.prod.mjs`）。`../` は `output/` の並びでのみ有効。dev サーバー（`/` 直下）では一覧が無いので、リンクは本番ビルドにだけ入れる。
- Title は 25 本ほどが各自の Scene。表示の切り替えは各 Title から知らせる必要がある。
- 4.6 節: 最小画面（375×550 / 667×310）で、文字・ボタンと重ならない。実寸で補助文字 11px 以上、タップの的 44px 以上（または別手段）。
- `#app` / `#game-container` の大きさを変えない（変えると Title が RESIZE で作り直される）。

## 案
1. **(採用) HTML リンクを Vite プラグインで注入 + 共有の小さな呼び出し。**
   `scaffold/vite/` に safe-area と同じ形のプラグインを足し、本番ビルドだけ `<a href="../">` を `position: fixed` で注入する（既定は非表示。セーフエリア内に置く）。`shared/game-list-link` に `showGameListLink(scene)` を置き、各 Title の `create()` から 1 行呼ぶ（Scene の `shutdown` で非表示に戻す）。
2. 各 Title に Phaser ボタンを足す: 25 本分のレイアウト・テスト・最小画面確認が要り、却下。
3. 常時表示: ゲーム中にも出るため却下（ユーザー要望）。

## 決めたこと
- 位置・見た目・文言（例「← ゲーム一覧」）は、全 Title を `scripts/qa/look.mjs` で見て重ならない場所を決める（実装側の裁量）。
- 重なる Title があれば、そのゲームの Title の配置を最小限で調整する（別 PR にしない）。

## 今後作られるゲームへの適用（ユーザー承認済み）
プラグインの注入は `scaffold/` 共通設定経由で新規ゲームにも自動で効く。Title からの呼び出しは自動では入らないため、次の 2 つを足す。
1. **雛形・スキルに入れる**: `task newgame` のテンプレート、および Title を作るスキル（`game-impl`、`game-title`）の手順に `showGameListLink(scene)` の呼び出しと `shared/game-list-link` の依存宣言（`workspace:*`）を書く。
2. **ゲートで検出する**: `task game:check` 系に「Title Scene が `showGameListLink` を呼んでいるか」のチェックを足す。`AGENTS.md` の 4.6 節（または 2.2 節）にも 1 行加える。

## 実装側に任せること
- プラグインの注入位置、CSS の細部、共有パッケージ名、テストの切り方。

## 完了条件
- `task build` で作った `output/` で、全ゲームの Title にリンクが出て、押すと一覧に戻る。
- ゲーム中・結果画面では出ない。dev サーバーでは出ない。
- 各ゲームの lint / test / coverage / build が通る。
- 新規ゲームの雛形・スキルに呼び出しが入っている。
- Title が `showGameListLink` を呼んでいないゲームを、品質ゲートが失敗として報告する（既存の全ゲームは通る）。
