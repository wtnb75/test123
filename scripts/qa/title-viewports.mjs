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
//
// By default one page is resized through every size (what a rotating or resizing player sees; the game
// lays itself out again). A game that decides its screen size when the Title starts (absorb) must be
// looked at as it opens at that size: add `"fresh": true` to the case, and it gets a new page, loaded at
// that size.
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

/** A page opened at the given size, on the Title. */
async function openTitle(browser, tag, c) {
    const page = await newPage(browser, tag, { viewport: { width: c.w, height: c.h }, hasTouch: true });
    await page.goto(BASE);
    await page.waitForSelector('canvas');
    await waitForQa(page, () => window.__qa?.scene === 'Title', undefined, 15000);
    return page;
}

const browser = await launch();
try {
    let page = await openTitle(browser, 'title', cases[0]);

    for (const c of cases) {
        let own = null;
        if (c.fresh) {
            own = await openTitle(browser, `title_${c.name}`, c);
        } else {
            await page.setViewportSize({ width: c.w, height: c.h });
        }
        const current = own ?? page;
        await sleep(2500);
        const qa = await current.evaluate(() => JSON.parse(JSON.stringify(window.__qa ?? null)));
        await shot(current, c.name);
        const shown = qa?.demoVisible;
        let verdict = 'photographed';

        if (c.demo === true || c.demo === false) {
            verdict = shown === c.demo ? 'PASS' : 'FAIL';
            if (verdict === 'FAIL') failures.push(c.name);
        }

        console.log(`${verdict} ${c.name} (${c.w}x${c.h}) demoVisible=${shown} ${JSON.stringify(qa)}`);
        if (own) await own.context().close();
    }

    await page.context().close();
} finally {
    await browser.close();
}

const n = report();
console.log(failures.length > 0 ? `DEMO VISIBILITY MISMATCH: ${failures.join(', ')}` : 'DONE');
process.exit(n || failures.length > 0 ? 1 : 0);
