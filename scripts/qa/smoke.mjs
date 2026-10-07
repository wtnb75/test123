// Generic smoke test for any game: loads it in a desktop and a phone viewport, checks the frame rate, taps the
// middle of the canvas, and fails on console errors or uncaught exceptions.
//   scripts/qa/up.sh <game-dir> && scripts/qa/run.sh <game-dir> scripts/qa/smoke.mjs /tmp/<game>-smoke
import { BASE, burst, fps, launch, newPage, report, shot, sleep, tap } from './lib.mjs';

const browser = await launch();
for (const [tag, opts, touch] of [
    ['desktop', { viewport: { width: 1280, height: 800 } }, false],
    ['phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, true],
]) {
    const page = await newPage(browser, tag, opts);
    await page.goto(BASE);
    await sleep(1500);
    await shot(page, `${tag}_01_loaded`);
    console.log(`${tag}: ${(await fps(page)).toFixed(0)} fps`);
    const size = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        return c ? { width: c.width, height: c.height } : null;
    });
    if (!size) throw new Error(`${tag}: no canvas`);
    await tap(page, size, size.width / 2, size.height / 2, { touch });
    await burst(page, `${tag}_02_after_tap_`, 3, 300);
    await page.context().close();
}
await browser.close();
process.exit(report() === 0 ? 0 : 1);
