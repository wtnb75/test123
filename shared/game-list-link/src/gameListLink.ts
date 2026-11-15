// Must match GAME_LIST_LINK_ID in scaffold/vite/game-list-link.mjs (the plugin that injects the link).
const LINK_ID = 'game-list-link';

// Phaser listens for presses on `window`, so a press that starts on the link would also reach a game object
// that lies under it. Stopping these events at the link keeps the press away from the game.
const PRESS_EVENTS = ['mousedown', 'mouseup', 'touchstart', 'touchend', 'pointerdown', 'pointerup'] as const;

const guarded = new WeakSet<object>();

/** The part of a Phaser Scene this helper needs (kept structural so the package stays Phaser-free). */
export interface SceneLike {
    events: { once(event: 'shutdown', fn: () => void): unknown };
}

function guardPresses(link: HTMLElement): void {
    if (guarded.has(link)) return;
    guarded.add(link);
    for (const type of PRESS_EVENTS) link.addEventListener(type, (e) => e.stopPropagation());
}

/**
 * Shows the "back to the game list" link while `scene` is on screen and hides it when the scene shuts down.
 * Call it from a Title Scene's `create()`: a rebuilt Title (rotation, restart) shuts down and calls it again.
 * Does nothing when the page has no link (the dev server and tests do not inject it).
 */
export function showGameListLink(scene: SceneLike, doc: Pick<Document, 'getElementById'> = document): void {
    const link = doc.getElementById(LINK_ID);
    if (!link) return;
    guardPresses(link);
    link.setAttribute('data-visible', 'true');
    scene.events.once('shutdown', () => link.setAttribute('data-visible', 'false'));
}
