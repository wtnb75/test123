// Shared Vite plugin: keeps the game out of the OS-drawn areas (status bar, notch, home indicator).
//
// Why: a game added to the iOS home screen runs without browser chrome, and iOS draws a translucent, blurred
// status bar over the page. Anything the game puts at the very top (the HUD) is covered by it and looks blurry.
// The fix has two halves, both injected here so every game (existing and new) gets them without touching its
// own index.html / public/style.css (which `task scaffold:update-base-template` overwrites):
//  - `viewport-fit=cover` makes the safe-area insets (env(safe-area-inset-*)) report real values;
//  - #app is padded by those insets and sized to the dynamic viewport, so the game's parent (and therefore
//    Phaser's Scale.FIT / RESIZE) only sees the area the OS leaves free. The body background fills the rest.
// In a normal browser tab the insets are 0 and 100dvh equals the visible height, so nothing changes there.

const VIEWPORT_META = /(<meta\s+name=["']viewport["']\s+content=["'])([^"']*)(["'])/i;

/** Appends `viewport-fit=cover` to the viewport meta's content (once). Exported for tests. */
export function withViewportFitCover(html) {
    return html.replace(VIEWPORT_META, (whole, head, content, tail) =>
        /viewport-fit\s*=/.test(content) ? whole : `${head}${content}, viewport-fit=cover${tail}`
    );
}

// `#app` is the shared page wrapper of every game template. The `max-*` limits keep a game that sizes
// #game-container in vw/vh from overflowing the padded wrapper.
export const SAFE_AREA_CSS = `
#app {
    box-sizing: border-box;
    height: 100vh;
    height: 100dvh;
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
}
#game-container {
    max-width: 100%;
    max-height: 100%;
}
`;

export const safeArea = () => ({
    name: 'safe-area',
    transformIndexHtml: {
        order: 'post',
        handler: (html) => ({
            html: withViewportFitCover(html),
            tags: [{ tag: 'style', attrs: { 'data-safe-area': '' }, children: SAFE_AREA_CSS, injectTo: 'head' }]
        })
    }
});
