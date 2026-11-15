# game-list-link

各ゲームの Title 画面にだけ「← ゲーム一覧」のリンクを出す共有パッケージです（ゲームではありません。公開の一覧には出ません）。

- Phaser に依存しない。Scene は `events.once('shutdown', …)` を持つものなら何でも渡せる（`SceneLike`）。
- リンク本体は `scaffold/vite/game-list-link.mjs`（Vite プラグイン）が本番ビルドの HTML に注入する（`<a id="game-list-link" href="../">`、最初は非表示）。このパッケージは、その表示・非表示を切り替えるだけ。
- リンク先は常に `../`（公開サイトでは `<site>/<game>/` の隣に `<site>/index.html` がある）。試作（labs）かどうかをソースに持ち込まない。
- dev サーバーでは注入されない（一覧ページが無い）ので、`showGameListLink` は何もしない。

## 使い方

Title Scene の `create()` で 1 回呼ぶ。`package.json` に `"game-list-link": "workspace:*"` を宣言する（`task newgame` は `base.json` 経由で入る）。

```ts
import { showGameListLink } from 'game-list-link';

create() {
    // ...build the Title...
    showGameListLink(this);
}
```

## 約束

| 項目 | 内容 |
|---|---|
| 表示 | `showGameListLink(scene)` を呼ぶとリンクが見える（`data-visible="true"`） |
| 非表示 | その `scene` の `shutdown`（Game への遷移、作り直し）で隠れる |
| 作り直し | Title を作り直したときは、`create()` がもう一度呼ぶので再び見える |
| リンクが無いページ | 何もしない（例外を出さない） |

呼び忘れは `task game:check-title-link`（`scripts/check-game-list-link.mjs`）が検出する。`Title.ts` を持つゲームが対象。

## 位置と大きさ

画面の左上（セーフエリアの内側）に重ねて表示する（`position: fixed`。レイアウトには入らないので Phaser の RESIZE は起きない）。見た目は高さ 24px・幅 100px 程度の小さな帯（文字 12px）で、見えない `::after` でタップ領域を高さ 44px にしている（Title の名前など、上端に近い文字に重ならないようにするため）。Title の主な文字・ボタンは、この左上の領域（幅 100px × 高さ 44px）に置かない（AGENTS.md 4.6）。タップ領域の下に Title のボタンを置くとタップを奪うので、置かない。
