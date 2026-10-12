// A first look at a game's layout (AGENTS.md 4.6): for three screen sizes, load, then press and click through a
// few steps, and save one montage per size (montage_phone.png / montage_se.png / montage_pc.png), so a whole game
// can be judged from three pictures. It cannot reach every screen (a result screen, a state behind a selection);
// photograph those with a scenario of their own.
//
//   scripts/qa/up.sh <game-dir> [port]
//   scripts/qa/run.sh <game-dir> scripts/qa/look.mjs /tmp/<game>-look
import { BASE, launch, newPage, report, sleep, SHOTS } from './lib.mjs';

const VIEWPORTS = [
    ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, 330],
    ['se', { viewport: { width: 375, height: 550 }, hasTouch: true, isMobile: true }, 330],
    ['pc', { viewport: { width: 1280, height: 720 } }, 560],
];

const STEPS = [
    ['loaded', async () => {}],
    ['Enter', (page) => page.keyboard.press('Enter')],
    ['click centre', async (page, vp) => page.mouse.click(vp.width / 2, vp.height / 2)],
    ['Space', (page) => page.keyboard.press('Space')],
    ['click centre', async (page, vp) => page.mouse.click(vp.width / 2, vp.height / 2)],
    ['click lower', async (page, vp) => page.mouse.click(vp.width / 2, vp.height * 0.75)],
    ['wait', async () => {}],
];

const browser = await launch();
try {
    for (const [name, opts, imgW] of VIEWPORTS) {
        const page = await newPage(browser, name, opts);
        await page.goto(BASE);
        await page.waitForSelector('canvas', { timeout: 15000 });
        await sleep(2000);
        const shots = [];
        for (const [label, act] of STEPS) {
            try {
                await act(page, opts.viewport);
            } catch (e) {
                console.log(`${name}: ${label} failed: ${e.message}`);
            }
            await sleep(label === 'loaded' ? 300 : 3000);
            const buf = await page.screenshot({ type: 'jpeg', quality: 70 });
            shots.push({ label, data: buf.toString('base64') });
        }
        await page.context().close();

        const html = `<body style="margin:0;background:#222;color:#fff;font:14px sans-serif"><div style="display:flex;gap:8px;padding:8px">${shots
            .map(
                (s, i) =>
                    `<figure style="margin:0"><figcaption>${i}: ${s.label}</figcaption><img style="width:${imgW}px;border:1px solid #888" src="data:image/jpeg;base64,${s.data}"></figure>`,
            )
            .join('')}</div></body>`;
        const m = await newPage(browser, 'montage', { viewport: { width: (imgW + 16) * STEPS.length + 16, height: 1000 } });
        await m.setContent(html);
        await sleep(500);
        await m.screenshot({ path: `${SHOTS}/montage_${name}.png`, fullPage: true });
        await m.context().close();
    }
} finally {
    await browser.close();
}
process.exit(report() ? 1 : 0);
