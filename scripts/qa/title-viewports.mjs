// Title screen across the screen sizes that matter on a phone: does the demo (and everything else) fit?
// Works for any game whose Title publishes the dev-only `window.__qa` shape described in
// shared/title-demo/README.md ("__qa の形"): `{ scene: 'Title', demoVisible, ... }`.
//
//   scripts/qa/up.sh <game-dir> [port]
//   scripts/qa/run.sh <game-dir> scripts/qa/title-viewports.mjs /tmp/<game>-title [title-cases.json]
//
// Without a cases file every default size is only photographed and its `__qa` printed (look at the pictures).
// A cases file asserts the demo per size: [{ "name": "se_portrait", "w": 375, "h": 550, "demo": true }, ...]
// (`demo: false` = the demo must be hidden, `null`/missing = only photograph). Sizes with no entry use the defaults.
import { existsSync, readFileSync } from 'node:fs';
import { BASE, launch, newPage, report, shot, sleep, waitForQa } from './lib.mjs';

/** Visible viewport sizes (CSS px). The Safari ones are below the screen size because of its bars. */
const DEFAULTS = [
    { name: 'se_portrait_375x550', w: 375, h: 550, demo: null },
    { name: 'se_landscape_667x310', w: 667, h: 310, demo: null },
    { name: 'phone_portrait_390x664', w: 390, h: 664, demo: null },
    { name: 'phone_portrait_390x844', w: 390, h: 844, demo: null },
    { name: 'phone_landscape_844x390', w: 844, h: 390, demo: null },
    { name: 'laptop_1280x720', w: 1280, h: 720, demo: null }
];

const CASES_FILE = 'title-cases.json';
const cases = existsSync(CASES_FILE) ? JSON.parse(readFileSync(CASES_FILE, 'utf8')) : DEFAULTS;
const failures = [];

const browser = await launch();
try {
    const first = cases[0];
    const page = await newPage(browser, 'title', { viewport: { width: first.w, height: first.h }, hasTouch: true });
    await page.goto(BASE);
    await page.waitForSelector('canvas');
    await waitForQa(page, () => window.__qa?.scene === 'Title', undefined, 15000);

    for (const c of cases) {
        await page.setViewportSize({ width: c.w, height: c.h });
        await sleep(2500);
        const qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__qa ?? null)));
        await shot(page, c.name);
        const shown = qa?.demoVisible;
        let verdict = 'photographed';

        if (c.demo === true || c.demo === false) {
            verdict = shown === c.demo ? 'PASS' : 'FAIL';
            if (verdict === 'FAIL') failures.push(c.name);
        }

        console.log(`${verdict} ${c.name} (${c.w}x${c.h}) demoVisible=${shown} ${JSON.stringify(qa)}`);
    }

    await page.context().close();
} finally {
    await browser.close();
}

const n = report();
console.log(failures.length > 0 ? `DEMO VISIBILITY MISMATCH: ${failures.join(', ')}` : 'DONE');
process.exit(n || failures.length > 0 ? 1 : 0);
