// The standard Title scenario: what a player does with it, whatever the game.
//
//   scripts/qa/up.sh <game-dir> [port]
//   scripts/qa/run.sh <game-dir> scripts/qa/title-start.mjs /tmp/<game>-start [title-start.json]
//
// 1. START by each of Enter, Space and a click, after the Title has been idle for `idleMs` (the first one waits
//    long: a Game that counts time from the Scene's `time.now` starts late or loses its time after a Title).
//    After START, `window.__qa.scene` must have left 'Title'; its value 1 s later is printed (look at the
//    phase/time there: the game must begin from its start, not from where the clock ran to).
// 2. The demo's cycle (when `cycle` is set): waits for `demoPhase` to go 'fading-out' and back to 'waiting',
//    photographs the curtain on its way down and prints `__qa` before and after (the demo's own numbers must
//    start over).
//
// The optional JSON file (all keys optional):
//   { "w": 1024, "h": 768, "idleMs": 12000, "clickX": 512, "clickY": 461, "cycle": true, "cycleTimeoutMs": 90000 }
// `clickX` / `clickY` are page coordinates of the START button (the default is the middle of the page).
import { existsSync, readFileSync } from 'node:fs';
import { BASE, launch, newPage, report, shot, sleep, waitForQa } from './lib.mjs';

const CONFIG_FILE = 'title-start.json';
const config = {
    w: 1024, h: 768, idleMs: 12000, clickX: null, clickY: null, cycle: false, cycleTimeoutMs: 90000,
    ...(existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {})
};
const failures = [];

async function openTitle(browser, tag) {
    const page = await newPage(browser, tag, { viewport: { width: config.w, height: config.h }, hasTouch: false });
    await page.goto(BASE);
    await page.waitForSelector('canvas');
    await waitForQa(page, () => window.__qa?.scene === 'Title', undefined, 15000);
    return page;
}

const browser = await launch();
try {
    for (const [how, idle] of [['Enter', config.idleMs], ['Space', 1500], ['click', 1500]]) {
        const page = await openTitle(browser, `start_${how}`);
        await sleep(idle);
        await shot(page, `start_${how}_before`);
        if (how === 'click') {
            await page.mouse.click(config.clickX ?? config.w / 2, config.clickY ?? config.h / 2);
        } else {
            await page.keyboard.press(how);
        }
        let left = true;
        try {
            await waitForQa(page, () => window.__qa?.scene !== 'Title', undefined, 5000);
        } catch {
            left = false;
            failures.push(`${how}: still on the Title 5 s after START`);
        }
        await sleep(1000);
        await shot(page, `start_${how}_after`);
        const qa = await page.evaluate(() => JSON.parse(JSON.stringify(window.__qa ?? null)));
        console.log(`${left ? 'PASS' : 'FAIL'} start by ${how} after ${idle} ms idle: __qa 1 s later = ${JSON.stringify(qa)}`);
        await page.context().close();
    }

    if (config.cycle) {
        const page = await openTitle(browser, 'cycle');
        try {
            await waitForQa(page, () => window.__qa?.demoPhase === 'fading-out', undefined, config.cycleTimeoutMs);
            await sleep(250);
            await shot(page, 'cycle_fading_out');
            console.log('cycle: curtain going down', JSON.stringify(await page.evaluate(() => window.__qa)));
            await waitForQa(page, () => window.__qa?.demoPhase === 'waiting' && window.__qa?.demoRounds === 0, undefined, 10000);
            await sleep(500);
            await shot(page, 'cycle_after');
            console.log('cycle: after the rebuild', JSON.stringify(await page.evaluate(() => window.__qa)));
        } catch (e) {
            failures.push(`cycle: ${e.message}`);
        }
        await page.context().close();
    }
} finally {
    await browser.close();
}

const n = report();
console.log(failures.length > 0 ? `FAILED: ${failures.join('; ')}` : 'DONE');
process.exit(n || failures.length > 0 ? 1 : 0);
