// Shared Vite plugin: keeps the game out of the OS-drawn areas (status bar, notch, home indicator).
//
// Why: a game added to the iOS home screen runs without browser chrome, and iOS draws things over the top of
// the page (the status bar, a notch, and a blur gradient, see below). Anything the game puts at the very top (the
// HUD) can be covered by them. The fix has three parts, all injected here so every game (existing and new) gets
// them without touching its own index.html / public/style.css (which `task scaffold:update-base-template`
// overwrites):
//  - `viewport-fit=cover` makes the safe-area insets (env(safe-area-inset-*)) report real values;
//  - #app is padded by those insets and sized to the dynamic viewport, so the game's parent (and therefore
//    Phaser's Scale.FIT / RESIZE) only sees the area the OS leaves free. The body background fills the rest.
//    (A phone without a notch reports an inset of 0 even in standalone mode: the page then starts below the bar.)
//  - the blur-fix element below.
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
//
// Blur fix: a home-screen web app on iOS puts a system blur/dim gradient over the top of the page (about 35pt
// below the status bar) when WebKit decides nothing is fixed to the top edge: it then treats the page as scroll
// content that slides under the status bar. A fixed element at the top edge, taller than 10px, turns that off.
// `background-clip: text` on an element without text paints nothing, so it is invisible yet still counts
// (opacity:0 / visibility:hidden / display:none would not). It only exists in iOS standalone mode so a normal tab's
// toolbar colour is untouched. Source: https://qiita.com/na-trium-144/items/0add98a80ca2391e3f17
export const BLUR_FIX_ID = 'ios-blur-fix';

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
#${BLUR_FIX_ID} {
    display: none;
}
:root[data-ios-standalone] #${BLUR_FIX_ID} {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 11px;
    z-index: 2147483647;
    pointer-events: none;
    background-color: var(--ios-blur-fix-color, #000);
    -webkit-background-clip: text;
    background-clip: text;
}
`;

// A classic inline script (runs before the first paint). `navigator.standalone` exists only on iOS Safari and is
// true only for a home-screen web app; `@media (display-mode: standalone)` did not match there (no manifest).
// The fix element's colour is the status bar area's colour, so it takes the page's own background.
export const SAFE_AREA_SCRIPT = `(function () {
    var root = document.documentElement;
    try { if (navigator.standalone === true) root.setAttribute('data-ios-standalone', ''); } catch (e) { /* ignore */ }
    addEventListener('DOMContentLoaded', function () {
        var bg = getComputedStyle(document.body).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') root.style.setProperty('--ios-blur-fix-color', bg);
    });
})();`;

export const safeArea = () => ({
    name: 'safe-area',
    transformIndexHtml: {
        order: 'post',
        handler: (html) => ({
            html: withViewportFitCover(html),
            tags: [
                { tag: 'style', attrs: { 'data-safe-area': '' }, children: SAFE_AREA_CSS, injectTo: 'head' },
                { tag: 'script', children: SAFE_AREA_SCRIPT, injectTo: 'head' },
                { tag: 'div', attrs: { id: BLUR_FIX_ID, 'aria-hidden': 'true' }, injectTo: 'body-prepend' }
            ]
        })
    }
});
