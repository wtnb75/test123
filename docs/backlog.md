# リポジトリ全体の拡張候補（backlog）

複数のゲームにまたがる作業（共有パッケージ・トップページなど）の候補を、上から順に並べたものです。上のカードが「次の候補」です。仕様（`spec.md`）ではありません。1 つのゲームだけに閉じる候補は各ゲームの `docs/backlog.md` に、新しいゲームのアイデアは `docs/ideas.md` に書きます。

- 規模: S = 1 つのファイルや画面の追加程度、M = 複数のゲームや仕組みにまたがる追加、L = 大きいので、1 PR 分に切り出してから採用する。
- 1 つのカードは 1 つの目的にする（1 変更 1 目的）。
- 共有パッケージの置き方は AGENTS.md 2.1 節に従う（`shared/<name>`、使うすべてのゲームのテストを通す）。

### トップページからハイスコアを初期化する（`index-reset`）

- 狙い: 記録を消す手段が、ブラウザのサイトデータの削除しか無い。消すとほかのゲームの記録や設定まで失う。根拠: ユーザーの声（初期化ボタンを付けたい）
- 何を足すか: トップページに、ベスト記録を初期化するボタンを足す。確認の手順を挟み、消すのは `<game-dir>.best` のキーだけにする。
- コアループへの効き方: 広げない — 記録の管理だけ。
- 種別: presentation-only
- 規模: S
- 出どころ: ユーザー
- メモ: トップページのハイスコア表示（`scripts/build-index.mjs` の `BEST_SCRIPT`）は実装済み。ハイスコアではない保存（`kogodrop.records` の学習記録、`digdle.daily` の日替わりの進行、`minefield-rogue-pad` の設定）は消さない。元に戻せないので、全ゲーム一括か、ゲームごとかを決める。

### トップページで共有 Phaser を先読みする（`index-prefetch`）

- 狙い: 共有ビルドのゲームは、カードを押してから `../vendor/phaser-<version>.esm.min.js` を取りに行くので、初回の起動に取得待ちが入る。トップページにいる間に取っておけば、その待ちが減るかもしれない。根拠: ユーザーの案、`scaffold/vite/config.prod.mjs`（ゲーム側はすでに同じ URL へ `modulepreload` を張っている）
- 何を足すか: `scripts/build-index.mjs` が、共有 Phaser の URL（`vendor/phaser-<version>.esm.min.js`）に対する `<link rel="prefetch" as="script">` をトップページ（と `labs.html`）に出す。pnpm workspace の `catalog:` で Phaser のバージョンが 1 つに揃うので、先読みは 1 本で足りる。
- コアループへの効き方: 広げない — 読み込みの待ちだけ。ゲームの挙動は変えない。
- 種別: presentation-only
- 規模: S
- 出どころ: ユーザー
- メモ: **効果は未確認**（ユーザーも怪しいと見ている）。実装の前に、`task build` の `output/` をサブパスで配信し、DevTools で次の 3 点を確かめる。(1) ゲームの起動時に vendor がキャッシュから出るか（GitHub Pages の `Cache-Control` は短い）、(2) Safari（iPhone）でも `prefetch` が再利用されるか、(3) トップページ自体の表示を遅らせないか。効果が見えなければ見送る。優先度が高い `modulepreload` は使わず、低優先度の `prefetch` か、アイドル時・カードの hover / touchstart での取得にする。通信量を節約する設定（Save-Data）の端末は先読みしない。バージョンが複数に分かれた場合（`catalog:` を使わないゲームが出たとき）は、`output/vendor/` を列挙して対応を見直す。

### 記録をモードごとに持てるようにする（`best-store-modes`）

- 狙い: `best-store` の約束は 1 ゲーム 1 件（`<game-dir>.best`）で、モードごとにスコアが独立するゲームの記録を持てない。今そのゲームは無いが、モードのあるゲームは出てきそうなので、そのとき保存の形が各ゲームで別々になるのを防ぎたい。根拠: ユーザーの指摘（モードごとにスコアが独立するケースがありそう）、digdle（モード × 桁数の統計）
- 何を足すか: `shared/best-store` に、モード別の記録 `<game-dir>.best.<mode>`（同じ `{score, label}`）を足す。トップページに出す代表の 1 件は、これまでどおり `<game-dir>.best`。
- コアループへの効き方: 広げない — 保存の形だけ。
- 種別: presentation-only（共有パッケージの追加）
- 規模: S
- 出どころ: ユーザー
- メモ: **該当するゲームが出るまで採用しない**（先に足しても使う場所が無く、1 本分の形に合わせて作ると外れる）。足すときは、`BestStore` に `mode` を渡す形を、そのゲームの spec と一緒に決める。トップページは代表の 1 件だけを読めば足りる。

### Scene の共通部品（ボタン・回転の案内・画面の大きさ・Result の入力ガード）を共有にする（`shared-scene-ui`）

- 狙い: 新しいゲームほど、同じ部品を前のゲームから写して始めている。`scenes/ui.ts` の `addButton`・`addLabel`・`RotateGuard`・`SceneExit`・`applyScreenSize` / `screenSizeChanged`・`onKeyPress` / `onKeyDown` と、`logic/screen.ts` の `computeScreenSize`・`fitScale`・`rotatePromptScale`・`promptFontSize` が、bouncewave・stepup・flipbreak・wordfall・typerain・match3・moleroll の 7 本にある（`ui.ts` だけで計 約 1,500 行。`computeScreenSize` は absorb にもある）。写しなので、1 本で直した不具合がほかに届かない。実際に、Result に入った直後の入力を無視する時間は、ある 8 本（match3・typerain・wordfall・stepup・moleroll・moleroam・mazetd・pushline。定数も作りも別々）と、無い本（bouncewave・flipbreak は、Result が開いた直後の Space / Enter・ボタンですぐリトライする）に分かれている。根拠: 2026-11-15 の全体レビュー（各ゲームの `scenes/ui.ts`・`logic/screen.ts` の export の比較、`scenes/Result.ts` の検索）、flipbreak の `docs/review-rejected.md`（Result の直後の Space / Enter）
- 何を足すか: Phaser に依存しない部分（画面の大きさ・回転の案内の倍率・入力ガードの時計）を `shared/<name>` に出し、次に Phaser に依存する部品（ボタン・回転の案内・Scene の出口）を別の共有パッケージ（または同じパッケージの別の入口）に出す。7 本を順に載せ替える。Result の入力ガードは、共有の 1 つの値にそろえる。
- コアループへの効き方: 広げない — 写しを減らし、直した不具合が全部のゲームに届くようにする。
- 種別: presentation-only（リファクタリング。Result の入力ガードが無かった 2 本だけ、直後の入力を無視するようになる）
- 規模: L（最初の PR は、Phaser に依存しない `screen.ts` の 4 関数と、その 7 本の載せ替えに切り出す。部品ごとに 1 PR）
- 出どころ: コードレビュー
- メモ: 写しの間に小さな違いがある（`ROTATE_PROMPT_TEXT` の改行、ボタンの引数、`onKeyDown` の自動リピートの扱い）。先に 7 本の差を表にして、共有の形に入れる違い（引数にする）と、ゲーム側に残す違いを分ける。Phaser に依存する共有パッケージは `shared/game-list-link` が先例（共有ビルドで Phaser を二重に含めないこと、`scenes/**` がカバレッジの対象外であることとの関係を確かめる）。`task newgame` の雛形（`scaffold/base-template`）に入れるかも決める。次の新規ゲームを作る前に 1 本目の PR を入れると、写しが 8 本目に増えない。

### 効果音の共通部品を作る（`shared-sfx`）

- 狙い: 効果音のカードが 16 本のゲームの backlog にあり（bouncewave・calc1・cjump・digdle・flipbreak・fukuwarai・kogodrop・match3・mazetd・minoclimb・moleroam・primtris・pushline・shoot1・stepup・wordfall）、どれも「WebAudio で合成・外部の音声ファイルなし・最初の操作まで鳴らせない・消音の切り替え」と同じことを書いている。最初の 1 本が自分の形で作ると、残りの 15 本が写すことになる。根拠: 2026-11-15 の全体レビュー（各ゲームの `docs/backlog.md` の `sound` / `sfx` / `sound-effects` のカード）
- 何を足すか: `shared/sfx`（仮）に、(1) 最初の操作で `AudioContext` を起こす処理、(2) 短い合成音（周波数・長さ・波形・減衰を渡して鳴らす）、(3) 消音の設定と保存（全ゲームで 1 つのキー）、(4) ページが隠れたときに止める処理、を置く。音色の表（どの出来事にどの音か）は各ゲームに置く。
- コアループへの効き方: 広げない — 各ゲームの効果音のカードの土台。
- 種別: presentation-only（共有パッケージの追加）
- 規模: M（共有パッケージと、最初の 1 本のゲームへの組み込み。残りのゲームは各ゲームのカードで 1 本ずつ）
- 出どころ: コードレビュー
- メモ: 最初に使うゲームを 1 本決め、そのゲームのカードと同じ時期に作る（使う場所なしに先に作らない）。音の合成は Phaser に依存させない（`AudioContext` を注入して単体テストする）。消音の設定は全ゲーム共通にするか、ゲームごとにするかを決める。共通にするなら、トップページにも切り替えを置くかを決める。

### 自動の一時停止を、時間で進むゲームに順に入れる（`pause-rollout`）

- 狙い: `shared/pause`（`PauseState`）は absorb だけが使っている。「戻ったときに操作してから再開する」のカード（`pause-resume`）は 13 本の backlog にあり（bouncewave・calc1・first-game・flipbreak・mazetd・minoclimb・moleroam・primtris・shoot1・spotdiff・stepup・typerain・wordfall。absorb は実装済み）、どれから入れるか・幕の見た目をそろえるかが決まっていない。`HIDDEN` / `BLUR` をつなぐ部分と幕の表示は、README の決めで各ゲームの Scene に置くので、2 本目からは absorb の Scene の写しになる。根拠: 2026-11-15 の全体レビュー（`shared/pause/README.md`、各ゲームの `docs/backlog.md`）、ユーザーの声（復帰時に突然再開されるゲームがある。フォーカス外れとスマホで動作を揃えたい）
- 何を足すか: 入れる順を決め（制限時間のあるもの・弾が降り続けるものが先: calc1・typerain・wordfall・stepup・bouncewave・shoot1・minoclimb …）、2 本目を入れるときに、Scene 側の結線（`HIDDEN` / `BLUR` の登録と解除・幕と「タップで再開」の文字）を共有の部品にするかを決める。
- コアループへの効き方: 広げない — 復帰時の不意の失敗を防ぐ。各ゲームのルールは変えない。
- 種別: gameplay（各ゲームのカードで 1 本ずつ。このカードは順番と共有の形を決める）
- 規模: S（順番と共有の形の決定）＋ 各ゲーム S
- 出どころ: コードレビュー / ユーザー
- メモ: 各ゲームの backlog のメモは、このカードを指している。bouncewave・mazetd・minoclimb・wordfall には、手動の一時停止ボタンのカード（`pause`）が別にある（自動の停止の後に、同じ `PauseState` に載せる）。first-game はターン制なので、対象から外れるかもしれない（そのゲームのカードのメモ）。幕の部品を共有にするなら `shared-scene-ui` と同じパッケージに置くかを決める。

### ベスト記録の定型（0 は書かない・表示の文字列）を `best-store` に寄せる（`best-helpers`）

- 狙い: `shared/best-store` を使う 11 本のうち、各ゲームの `logic/best.ts` に同じ形の薄い関数が増えている。typerain と wordfall の `best.ts` は丸写し（23 行ずつ。「スコア 0 は記録しない」のガードと `loadBest` / `formatBest`）。stepup の `recordRun` / `titleBestText`、calc1 の `saveBest`（`{score, label}` を手で組み立てる）も同じ役割。ガードを片方だけ直すと食い違う。保存の取得（`browserStorage` と同じ「触ると例外になる環境」の守り）も、digdle の `daily.ts`・kogodrop の `weakWords.ts`・first-game の `highScore.ts` に 1 つずつあり、calc1 の `Game.ts` は `localStorage` を守りなしで直接渡している（calc1 の backlog の `storage-guard`）。根拠: 各ゲームの `docs/review-rejected.md`（typerain「必要なら全体バックログのカードにする」、stepup「バックログ向き」、wordfall「共有ストアに `minScore` を足す案」、calc1「共有に `serializeBest` を足すべき」）、2026-11-15 の全体レビュー
- 何を足すか: `BestStore` に、記録する下限（例: `minScore`。既定は今までどおり下限なし）と、表示用の読み出し（記録が無いときの文字列を渡す）を足す。ベスト以外の保存をするゲームは、共有の `browserStorage` を使う。
- コアループへの効き方: 広げない — 保存の定型を 1 か所にする。
- 種別: presentation-only（共有パッケージの変更。保存の形・キーは変えない）
- 規模: S〜M（共有の変更は S。使う全ゲームのテストを通す。各ゲームの載せ替えは 1 本ずつ）
- 出どころ: コードレビュー
- メモ: 「0 は書かない」の決めはゲームごとに spec にある（first-game・wordfall・typerain・stepup）。共有に寄せても、各ゲームの spec の文は変えない。`best-store-modes` を採るなら、`BestStore` の引数の形を同じ時期に決める。

### シード付きの乱数を共有にする（`shared-rng`）

- 狙い: mulberry32（シード付きの乱数）の写しが、本番のコードに 6 本（first-game `core/random.ts`・digdle `logic/primes.ts`・spotdiff `logic/random.ts`・cjump `logic/prng.ts`・bouncewave `logic/titleDemo.ts`・minoclimb `logic/round.ts`）、テスト用の補助に 5 本（pushline `testkit.ts`、moleroll・wordfall・match3・typerain の `testing.ts`。match3 と typerain は線形合同法）、テストのファイルの中に約 30 か所ある。`| 0` と `>>> 0` の書き方が混ざっていて、同じシードで同じ列が出るかは 1 つずつ確かめないと分からない。日替わりの盤面（digdle・spotdiff）は、この列が変わると全員の盤面が変わる。根拠: 2026-11-15 の全体レビュー（`0x6d2b79f5` と `1664525` の検索）、minoclimb・moleroam の `docs/review-rejected.md`（テストの補助の重複を見送り）
- 何を足すか: `shared/rng`（仮）に `mulberry32(seed)` と、テストでよく使う補助（決まった列を返す `seq` など）を置く。新しいゲームとテストはこれを使う。
- コアループへの効き方: 広げない — 写しを減らす。
- 種別: presentation-only（共有パッケージの追加）
- 規模: S（共有の追加と、テストの補助の載せ替え）
- 出どころ: コードレビュー
- メモ: **本番の 6 本は、出る列が 1 ビットも変わらないことを fixture で確かめてから載せ替える**（digdle の日替わりの答え、spotdiff の日替わりの絵、cjump のルートのシード表、first-game の盤面の fixture）。確かめられないものは写しのまま残す。テストの中の写しは、そのテストを触るときに置き換える（まとめて書き換えない）。

### 改行コードを LF にそろえる（`line-endings`）

- 狙い: CRLF のファイルが 14 本ある（`scaffold/base-template/src/game/main.ts`・`scenes/Game.ts` と、そこから作った calc1・digdle・dutchcalc・editmin・nonoedit・primtris・shoot1 の `main.ts` / `scenes/Game.ts`）。`.gitattributes` が無いので、雛形から作る新しいゲームにも CRLF が入る。同じゲームの中で CRLF と LF が混ざり（nonoedit は「`Game.ts` の CRLF を保って差分を小さくする」と見送った）、エディタや置換のツールによっては、関係ない行まで差分に出る。根拠: 2026-11-15 の全体レビュー（行末の `\r` の検索）、nonoedit の `docs/review-rejected.md`
- 何を足すか: `.gitattributes`（`* text=auto eol=lf`）を足し、14 本を LF に直す。雛形（`scaffold/base-template`）も直す。
- コアループへの効き方: 広げない — 差分を読みやすくする。
- 種別: presentation-only（改行だけ。挙動は変えない）
- 規模: S
- 出どころ: コードレビュー
- メモ: 改行だけの 1 つの PR にする（ほかの変更と混ぜると、レビューで中身の差分が埋もれる）。開いている PR が同じファイルを触っていると衝突するので、PR が少ないときに入れる。`task scaffold:update-base-template` が雛形を上書きするとき、CRLF に戻らないかを確かめる。

### トップページの絞り込みが、壊れた URL で止まらないようにする（`index-hash-guard`）

- 狙い: トップページのタグの絞り込みは、URL の `#tag=…` を `decodeURIComponent` で読む。`#tag=%E0%A4%A` のような壊れた値では例外になり、その後の処理（カードの表示の切り替え・チップのクリックの登録）が動かない。手で書き換えた URL・途中で切れたリンクで起きる。根拠: 2026-11-15 の全体レビュー（`scripts/build-index.mjs` の `fromHash`）。コードを読んだ結果で、ブラウザでは未確認
- 何を足すか: 読めない `#tag=` は「絞り込みなし」として扱う（例外を捕まえる）。
- コアループへの効き方: 広げない — 一覧が常に使えるようにする。
- 種別: presentation-only（不具合の修正）
- 規模: S
- 出どころ: コードレビュー
- メモ: 値は `textContent` と既知のタグとの照合にしか使っていないので、スクリプトの埋め込みにはならない（安全性の問題ではなく、止まるだけ）。`build-index` のテストに、壊れた値の例を足す。

### 依存の更新と脆弱性の確認を、定期的に回す（`deps-audit`）

- 狙い: 依存の更新（`.github/workflows/update-deps.yml`）は手動の実行（`workflow_dispatch`）だけで、定期の実行が無い。CI（`main.yml`・`branch.yml`）に、既知の脆弱性の確認（`pnpm audit`）も無い。配布物は静的サイトで、実行時の依存は Phaser だけだが、ビルド・テスト・QA の道具（Vite・Vitest・ESLint・Playwright）は多く、古いまま気づかないおそれがある。GitHub の Dependabot の警告は有効で、2026-11-15 の push の時点で、既定のブランチに 1 件（moderate）が出ている。根拠: 2026-11-15 の全体レビュー（`.github/workflows/`、push のときの GitHub の表示）
- 何を足すか: `update-deps` に週 1 回程度の `schedule` を足し、CI に `pnpm audit`（本番の依存は失敗、開発の依存は警告）を足す。
- コアループへの効き方: 広げない — 保守だけ。
- 種別: presentation-only（CI の設定）
- 規模: S
- 出どころ: コードレビュー
- メモ: 今回のレビューでは `pnpm audit` を実行していない（外部への問い合わせになるため）。まず、出ている 1 件（リポジトリの Security タブの Dependabot の警告）の中身を見て、手動の `update-deps` で消えるかを確かめる。そのうえで、失敗にする水準を決める。Phaser の更新は、`bouncewave`・`moleroam`・`pushline` などの `docs/review-rejected.md` が「Phaser を上げるときは QA で確かめる」と書いた前提（入力イベントの順序・`pointer.id` が添字であること・手書きのスプライン）に当たるので、自動でマージしない。
