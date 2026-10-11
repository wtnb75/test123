# scripts/qa — ブラウザ QA の共通ヘルパー

AGENTS.md 9節（Docker + Playwright でヘッドレスブラウザ確認）の手順をスクリプト化したもの。
`game-qa`（と `game-polish`・`game-balance` の画面確認）から使う。

```bash
scripts/qa/up.sh <game-dir> [port=5191] [--shared]      # dev サーバー（--shared なら公開と同じ共有ビルドをサブパスで配信）+ Playwright コンテナ（セッションと同じ Docker ネットワーク）
scripts/qa/run.sh <game-dir> <script.mjs> <out-dir> [extra files…]   # シナリオを実行して画面を <out-dir> に回収
scripts/qa/down.sh <game-dir> [port]                    # コンテナ・dev サーバー・トンネルを片付ける（QA が失敗しても必ず）
scripts/qa/share.sh <game-dir> [port=5191]              # dev サーバーを Cloudflare Quick Tunnel で公開し、URL を出す（別の端末で遊ぶ用）
```

| ファイル | 役割 |
|---|---|
| `up.sh` | dev サーバーを自セッションの Docker IP の `<port>` で起動し（全インターフェースには公開しない）、自セッションと同じネットワークに Playwright コンテナを立てて `playwright` を入れる。接続先 URL とコンテナの UTC 日付を表示する。`--shared` では、そのゲームを `SHARED_VENDOR=1` でビルドして `output/` と同じ並び（`<repo>/<game>/` と `<repo>/vendor/`）にし、`/<repo>/<game>/` で静的配信する |
| `run.sh` | スクリプトと追加ファイルを `docker cp` で渡して実行し、`/work/shots` の画面を回収する（実行のたびに空にする） |
| `down.sh` | コンテナの削除とサーバー・トンネルの停止（dev サーバーも `--shared` の静的サーバーも `share.sh` のトンネルも）。残っていればエラーにする |
| `share.sh` | `cloudflared tunnel --url` で dev サーバーを `https://*.trycloudflare.com` に公開し、URL を最後の行に出す。`<port>` で応答する dev サーバーがあればそれを使い、無ければ `127.0.0.1` で起動する。`cloudflared` が無ければエラーで止まる |
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

## 別の端末（スマホ等）で遊ぶ

```bash
scripts/qa/share.sh <game-dir> [port]   # 最後の行の https://….trycloudflare.com をスマホ等で開く
scripts/qa/down.sh <game-dir> [port]    # 終わったら必ず止める
```

- `cloudflared` を事前に入れておく（アカウント不要）。URL は実行のたびに変わる
- dev サーバーに認証は無く、URL を知る人は誰でも開ける。短時間だけ公開し、URL は見せたい相手にだけ渡す
- `.trycloudflare.com` の Host を許可するのは、`share.sh` が環境変数 `SHARE_TUNNEL=1` で起動した dev サーバーだけ（`scaffold/vite/config.dev.mjs`）。普通の `npm run dev` で起動済みのサーバーが `<port>` を使っていると、`share.sh` は案内を出して止まる（`down.sh` で止めてから再実行）。他のサービスのドメインを使うときは許可に足す
- ログは状態ディレクトリ（下記）に出る
- 発行された URL は、出力から数秒おいてから開く。直後に名前を引くと、その環境では 40 秒以上引けない状態が続くことがある（`curl` で即座に確認しない。8 秒待てば 200 になった）
- ビルド成果物（`--shared`）の公開は対象外。`up.sh --shared` はコンテナ内の QA 用

## 状態ファイルの置き場所

`up.sh` / `run.sh` / `down.sh` / `share.sh` が受け渡す状態（`<game-dir>.env`、サーバーのログ、`--shared` のサイト）は
`${TMPDIR:-/tmp}/qa-<uid>/` に置く（共通処理は `_state.sh`）。

- 0700 で作成し、シンボリックリンクや他ユーザー所有のディレクトリなら使わずに止まる（予測可能な `/tmp/qa-<game>.env` を他のユーザーに先回りされないため）
- `.env` は `source` せず、`BASE_URL` / `CONTAINER` / `PORT` だけを検証して読む。書き換えられていても何も実行されない
- `<game-dir>` は `[A-Za-z0-9._-]`（先頭にドットを付けない）のみ、`port` は数字のみ

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
