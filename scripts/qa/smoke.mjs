// Generic smoke test for any game: loads it in a desktop and a phone viewport, checks the frame rate, taps the
// middle of the canvas, and fails on console errors, uncaught exceptions or failed requests (a 404 for an asset or
// for the shared Phaser file is the typical way a shared build breaks).
//   scripts/qa/up.sh <game-dir> [port] [--shared] && scripts/qa/run.sh <game-dir> scripts/qa/smoke.mjs /tmp/<game>-smoke
import { BASE, burst, fps, launch, newPage, report, shot, sleep, tap } from './lib.mjs';

const browser = await launch();
let failure = null;
try {
    for (const [tag, opts, touch] of [
        ['desktop', { viewport: { width: 1280, height: 800 } }, false],
        ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, true],
    ]) {
        const page = await newPage(browser, tag, opts);
        await page.goto(BASE);
        await sleep(1500);
        await shot(page, `${tag}_01_loaded`);
        const size = await page.evaluate(() => {
            const c = document.querySelector('canvas');
            return c ? { width: c.width, height: c.height } : null;
        });
        if (!size) throw new Error(`${tag}: no canvas on ${BASE}`);
        console.log(`${tag}: ${(await fps(page)).toFixed(0)} fps`);
        await tap(page, size, size.width / 2, size.height / 2, { touch });
        await burst(page, `${tag}_02_after_tap_`, 3, 300);
        await page.context().close();
    }
} catch (e) {
    failure = e;
    console.log(`FAILED: ${e.message}`);
}
await browser.close();
const errorCount = report();
process.exit(failure || errorCount > 0 ? 1 : 0);
