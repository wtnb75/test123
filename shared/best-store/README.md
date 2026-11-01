# best-store

ベスト記録の保存を、ゲームに依存しない形でそろえる共有パッケージです（ゲームではありません。公開の一覧には出ません）。

- Phaser に依存しない純粋なロジック。保存先（`localStorage` 相当）は引数で渡せる（テストで再現できる）。
- ゲームごとにキーと形式がばらばらだった保存を、トップページの一覧にそのまま出せる 1 つの約束にする。
- 既存ゲームの移行は `best-migrate`、トップページの表示は `index-best`（いずれもリポジトリ直下の `docs/backlog.md`）。

## 保存の約束

| 項目 | 内容 |
|---|---|
| キー | `<game-dir>.best`（例: `bouncewave.best`） |
| 値 | JSON `{ "score": number, "label": string }` |
| `score` | 大きいほど良い、有限の数。更新の判定に使う（厳密に超えたときだけ更新） |
| `label` | 一覧にそのまま出す表示用の文字列（例: 「WAVE 8」「ライン 12」） |

- 読めない値（壊れた JSON・型の違い・`score` が有限でない）は「記録なし」として扱い、次の記録で上書きする。
- 読み書きで例外が出ても、ゲームは止まらない。書けないときは、そのページの間だけメモリに持つ。
- 小さいほど良い記録（タイムなど）は、`score` に符号を反転した値を入れる（例: 12.3 秒 → `-12.3`）か、そのゲームの必要が出た時点でこのパッケージに足す。
- ベスト記録ではない保存（設定・日替わりの進行・学習記録）は、このパッケージの対象外。

## 使い方

```ts
import { BestStore } from 'best-store';

const store = new BestStore('bouncewave');          // key: "bouncewave.best"

store.load();                                       // { score, label } | null
const r = store.record(score, `WAVE ${wave}`);      // { best, isNew } | null (null: score is not finite)
```

使うゲームは `package.json` に `"best-store": "workspace:*"` と宣言する。

## API

- `new BestStore(game, storage?)` — `storage` は `() => KeyValueStorage | null`（既定は `browserStorage`）。呼ぶたびに読むので、あとから使えなくなっても落ちない。
- `load()` — 今のベスト（保存済みか、メモリ上のもののうち高い方）。なければ `null`。
- `record(score, label)` — 終わったプレイを記録する。`{ best, isNew }` を返す。`score` が有限でなければ `null` を返して何もしない。
- `bestKey(game)` / `parseBest(raw)` / `browserStorage()` — トップページや移行のコードが、同じ約束で読むための部品。
