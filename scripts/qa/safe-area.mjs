// Checks the safe-area wrapper (scaffold/vite/safe-area.mjs): loads the game in a phone viewport, then again
// with the iOS standalone insets faked (headless Chromium reports env(safe-area-inset-*) as 0, so the faked ones
// are set by overriding #app's padding with the same shape), and checks the canvas stays inside the padded area.
//   scripts/qa/up.sh <game-dir> [port] && scripts/qa/run.sh <game-dir> scripts/qa/safe-area.mjs /tmp/<game>-safe-area
import { BASE, launch, newPage, report, shot, sleep } from './lib.mjs';

const INSETS = { top: 47, right: 0, bottom: 34, left: 0 };
const browser = await launch();
let failure = null;
try {
    for (const [tag, fake] of [['plain', false], ['insets', true]]) {
        const page = await newPage(browser, tag, {
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 3,
            hasTouch: true,
            isMobile: true,
        });
        await page.goto(BASE);
        if (fake) {
            await page.addStyleTag({
                content: `#app { padding: ${INSETS.top}px ${INSETS.right}px ${INSETS.bottom}px ${INSETS.left}px !important; }`,
            });
            await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        }
        await sleep(1500);
        await shot(page, `${tag}_01_loaded`);
        const r = await page.evaluate(() => {
            const c = document.querySelector('canvas').getBoundingClientRect();
            const meta = document.querySelector('meta[name=viewport]').content;
            return { top: c.top, bottom: c.bottom, left: c.left, right: c.right, h: innerHeight, w: innerWidth, meta };
        });
        console.log(tag, JSON.stringify(r));
        if (!r.meta.includes('viewport-fit=cover')) throw new Error(`${tag}: viewport-fit=cover is missing`);
        const topLimit = fake ? INSETS.top : 0;
        const bottomLimit = r.h - (fake ? INSETS.bottom : 0);
        if (r.top < topLimit - 0.5) throw new Error(`${tag}: canvas top ${r.top} is above ${topLimit}`);
        if (r.bottom > bottomLimit + 0.5) throw new Error(`${tag}: canvas bottom ${r.bottom} is below ${bottomLimit}`);
        if (r.left < -0.5 || r.right > r.w + 0.5) throw new Error(`${tag}: canvas leaves the width`);
        await page.context().close();
    }
} catch (e) {
    failure = e;
    console.log(`FAILED: ${e.message}`);
}
await browser.close();
const errorCount = report();
process.exit(failure || errorCount > 0 ? 1 : 0);
