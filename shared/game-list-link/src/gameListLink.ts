// Must match GAME_LIST_LINK_ID in scaffold/vite/game-list-link.mjs (the plugin that injects the link).
const LINK_ID = 'game-list-link';

/** The part of a Phaser Scene this helper needs (kept structural so the package stays Phaser-free). */
export interface SceneLike {
    events: { once(event: 'shutdown', fn: () => void): unknown };
}

/**
 * Shows the "back to the game list" link while `scene` is on screen and hides it when the scene shuts down.
 * Call it from a Title Scene's `create()`: a rebuilt Title (rotation, restart) shuts down and calls it again.
 * Does nothing when the page has no link (the dev server and tests do not inject it).
 */
export function showGameListLink(scene: SceneLike, doc: Pick<Document, 'getElementById'> = document): void {
    const link = doc.getElementById(LINK_ID);
    if (!link) return;
    link.setAttribute('data-visible', 'true');
    scene.events.once('shutdown', () => link.setAttribute('data-visible', 'false'));
}
