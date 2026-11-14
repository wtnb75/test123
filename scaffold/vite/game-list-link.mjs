// Shared Vite plugin: injects a small "back to the game list" link into the production HTML of every game.
//
// The link starts hidden. A Title Scene shows it with `showGameListLink(this)` (shared/game-list-link), and
// it is hidden again when that Scene shuts down, so it only appears on the Title screen.
// It is a fixed overlay (never part of the layout), so #app / #game-container keep their size and no Phaser
// resize is triggered. The target is always `../`: in the published site every game lives in
// `<site>/<game>/` next to `<site>/index.html`. It is not injected in dev (the dev server has no list page).

export const GAME_LIST_LINK_ID = 'game-list-link';
export const GAME_LIST_LINK_TEXT = '← ゲーム一覧';

export const GAME_LIST_LINK_CSS = `
#${GAME_LIST_LINK_ID} {
    display: none;
    position: fixed;
    z-index: 10;
    top: env(safe-area-inset-top);
    left: env(safe-area-inset-left);
    box-sizing: border-box;
    min-height: 44px;
    padding: 0 12px;
    align-items: center;
    font-family: sans-serif;
    font-size: 12px;
    line-height: 1;
    color: #fff;
    background: rgba(0, 0, 0, 0.5);
    text-decoration: none;
    border-bottom-right-radius: 8px;
}
#${GAME_LIST_LINK_ID}[data-visible="true"] {
    display: flex;
}
`;

export const gameListLink = () => ({
    name: 'game-list-link',
    transformIndexHtml: {
        order: 'post',
        handler: (html) => ({
            html,
            tags: [
                { tag: 'style', attrs: { 'data-game-list-link': '' }, children: GAME_LIST_LINK_CSS, injectTo: 'head' },
                {
                    tag: 'a',
                    attrs: { id: GAME_LIST_LINK_ID, href: '../', 'data-visible': 'false' },
                    children: GAME_LIST_LINK_TEXT,
                    injectTo: 'body'
                }
            ]
        })
    }
});
