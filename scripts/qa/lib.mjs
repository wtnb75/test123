// Helpers for browser QA scripts (see scripts/qa/README.md). Runs inside the Playwright container:
//   import { BASE, launch, newPage, shot, burst, tap, setHidden, waitForQa, fps, report } from './lib.mjs';
//
// Pitfalls this library is built around (each one cost a QA run once):
//   * Do NOT install a Playwright clock (page.clock.*). It slows the page's rAF-based game time, so the game clock
//     drifts behind the wall clock and fixed sleeps stop lining up. Pick a game's date-dependent content from the
//     container's UTC date instead (up.sh prints it).
//   * Run ONE page at a time and close its context (page.context().close()) before the next scenario. Several
//     pages in one browser share the software GPU and each game runs at a fraction of the speed.
//   * Never wait a fixed time for a game state (a stage clear, a transition). Wait for the state: expose it in the
//     dev build as `window.__qa` and use waitForQa(), or check a screenshot. A tap sent during a "clear" pause is ignored.
//   * Software WebGL prints harmless warnings; they are filtered out of `errors`.
import { chromium } from 'playwright';

export const BASE = process.env.QA_BASE_URL;
export const SHOTS = '/work/shots';
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Console errors/warnings and uncaught exceptions, tagged by page. WebGL software-rendering noise is excluded. */
export const errors = [];
const NOISE = /WebGL|swiftshader|GPU stall/i;

export const launch = () => chromium.launch();

/** A new page in its own context, with error collection. `opts` are Playwright context options (viewport, hasTouch, ...). */
export async function newPage(browser, tag, opts = {}) {
    const context = await browser.newContext({ timezoneId: 'UTC', ...opts });
    const page = await context.newPage();
    page.on('console', (m) => {
        if ((m.type() === 'error' || m.type() === 'warning') && !NOISE.test(m.text())) errors.push(`[${tag}] ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`[${tag}] pageerror: ${e.message}`));
    return page;
}

/** Screenshot to /work/shots/<name>.png (run.sh copies the folder out). */
export const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

/** `count` screenshots `gapMs` apart, named <name>a, <name>b, ... — for effects and transitions. */
export async function burst(page, name, count, gapMs = 80) {
    for (let i = 0; i < count; i++) {
        await shot(page, `${name}${String.fromCharCode(97 + i)}`);
        if (i < count - 1) await sleep(gapMs);
    }
}

/**
 * Page coordinates of a point given in the game's own coordinates, for a canvas scaled to fit the page
 * (Phaser Scale.FIT). `game` = { width, height } of the game's CURRENT logical canvas.
 */
export async function gameToPage(page, game, x, y) {
    const box = await page.locator('canvas').boundingBox();
    if (!box) throw new Error('no canvas on the page');
    return { x: box.x + (x * box.width) / game.width, y: box.y + (y * box.height) / game.height };
}

/** Click (or touch-tap with { touch: true }) a point given in game coordinates. */
export async function tap(page, game, x, y, { touch = false } = {}) {
    const p = await gameToPage(page, game, x, y);
    if (touch) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
}

/** Make the page look hidden / visible (screen off, tab or app switch) and fire visibilitychange. */
export const setHidden = (page, hidden) =>
    page.evaluate((h) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
        document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

/**
 * Wait until a game-state check is true. The dev build exposes `window.__qa` (the game decides what it holds,
 * e.g. { phase, stage, timeLeft }). `pageFunction` runs in the page and reads it itself:
 *   await waitForQa(page, () => window.__qa?.phase === 'clear');
 *   await waitForQa(page, (stage) => window.__qa?.stage === stage, 3);   // second argument is passed in
 */
export const waitForQa = (page, pageFunction, arg, timeout = 10000) =>
    page.waitForFunction(pageFunction, arg, { timeout, polling: 50 });

/** requestAnimationFrame rate over `ms` — a quick check that the page is not starved (should be ~60). */
export const fps = (page, ms = 2000) =>
    page.evaluate(
        (duration) =>
            new Promise((resolve) => {
                let n = 0;
                const t0 = performance.now();
                const tick = () => {
                    n++;
                    if (performance.now() - t0 > duration) resolve((n * 1000) / duration);
                    else requestAnimationFrame(tick);
                };
                requestAnimationFrame(tick);
            }),
        ms,
    );

/** Print collected errors; returns how many there were (use as the exit code). */
export function report() {
    console.log(`ERRORS: ${JSON.stringify(errors, null, 1)}`);
    return errors.length;
}
