# scripts/qa — ブラウザ QA の共通ヘルパー

AGENTS.md 9節（Docker + Playwright でヘッドレスブラウザ確認）の手順をスクリプト化したもの。
`game-qa`（と `game-polish`・`game-balance` の画面確認）から使う。

```bash
scripts/qa/up.sh <game-dir> [port=5191] [--shared]      # dev サーバー（--shared なら公開と同じ共有ビルドをサブパスで配信）+ Playwright コンテナ（セッションと同じ Docker ネットワーク）
scripts/qa/run.sh <game-dir> <script.mjs> <out-dir> [extra files…]   # シナリオを実行して画面を <out-dir> に回収
scripts/qa/down.sh <game-dir> [port]                    # コンテナと dev サーバーを片付ける（QA が失敗しても必ず）
```

| ファイル | 役割 |
|---|---|
| `up.sh` | dev サーバーを `0.0.0.0:<port>` で起動し、自セッションと同じネットワークに Playwright コンテナを立てて `playwright` を入れる。接続先 URL とコンテナの UTC 日付を表示する。`--shared` では、そのゲームを `SHARED_VENDOR=1` でビルドして `output/` と同じ並び（`<repo>/<game>/` と `<repo>/vendor/`）にし、`/<repo>/<game>/` で静的配信する |
| `run.sh` | スクリプトと追加ファイルを `docker cp` で渡して実行し、`/work/shots` の画面を回収する（実行のたびに空にする） |
| `down.sh` | コンテナの削除とサーバーの停止（dev サーバーも `--shared` の静的サーバーも）。残っていればエラーにする |
| `lib.mjs` | シナリオ用ヘルパー（`launch` / `newPage` / `shot` / `burst` / `tap` / `setHidden` / `waitForQa` / `fps` / `report`） |
| `smoke.mjs` | どのゲームにも使える最小の確認（デスクトップとスマホ、フレームレート、中央を1回タップ、コンソールエラーと 4xx/5xx のリクエスト）。失敗時は原因のリクエストを表示する |

## 共有ビルド（公開と同じ形）の確認

公開されるのは `SHARED_VENDOR=1` のビルド（Phaser を含めず、import map で `../vendor/` から読む）で、サブパスの下で配信される。dev サーバーでは動いても、アセットのパスや vendor の欠落はここでしか見えない。

```bash
scripts/qa/up.sh <game-dir> 5192 --shared
scripts/qa/run.sh <game-dir> scripts/qa/smoke.mjs <out-dir>
scripts/qa/down.sh <game-dir> 5192
```

全ゲームを作る `task build`（`output/`、CI が行う）は、ここでは動かさない。

## シナリオを書くときのルール（どれも一度は QA を無駄にした）

- **Playwright のクロック（`page.clock.*`）を使わない**: ゲーム内の時間が実時間より遅れる。日付で内容が決まるゲームは、コンテナの UTC 日付（`up.sh` が表示）に合わせて期待値を作る。
- **ページは1つずつ**: 複数ページを同時に開くとソフトウェア GPU を奪い合い、どれも大きく遅れる。次のシナリオの前に `page.context().close()` する。
- **時間ではなく状態を待つ**: 固定の `sleep` のあとにクリックすると、ステージクリアの一時停止中に当たって無視される。開発ビルドでゲームが `window.__qa`（`{ phase, stage, timeLeft }` のような読み取り専用の状態）を出していれば `waitForQa(page, () => window.__qa?.phase === 'clear')` で待つ。出していなければ、画面で確認してから操作する。
- `fps` が 60 を大きく下回るときは、ゲームではなくハーネスを疑う（上の2点）。
- ホストのパスを `-v` でコンテナにマウントしない（空ディレクトリになる）。受け渡しは `docker cp`（`run.sh` がやる）。

## ゲーム側の約束（任意）

開発ビルドだけ `window.__qa` に状態を出すと、シナリオが堅くなる。本番ビルドには出さない。

```ts
if (import.meta.env.DEV) (window as unknown as { __qa: unknown }).__qa = { /* 読み取り用の getter */ };
```
