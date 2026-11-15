// Run with: node --test scaffold/vite/safe-area.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BLUR_FIX_ID, SAFE_AREA_CSS, SAFE_AREA_SCRIPT, safeArea, withViewportFitCover } from './safe-area.mjs';

const META = '<meta name="viewport" content="width=device-width, initial-scale=1.0" />';

test('adds viewport-fit=cover to the viewport meta', () => {
    assert.equal(
        withViewportFitCover(META),
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />'
    );
});

test('keeps other viewport settings such as user-scalable=no', () => {
    const html = '<meta name="viewport" content="width=device-width, maximum-scale=1.0, user-scalable=no" />';
    assert.match(withViewportFitCover(html), /maximum-scale=1\.0, user-scalable=no, viewport-fit=cover"/);
});

test('leaves a viewport that already sets viewport-fit untouched', () => {
    const html = '<meta name="viewport" content="width=device-width, viewport-fit=contain" />';
    assert.equal(withViewportFitCover(html), html);
});

test('leaves a page without a viewport meta untouched', () => {
    assert.equal(withViewportFitCover('<head></head>'), '<head></head>');
});

test('injects the safe-area style once into the head', () => {
    const { html, tags } = safeArea().transformIndexHtml.handler(`<head>${META}</head>`);
    assert.match(html, /viewport-fit=cover/);
    assert.equal(tags.length, 3);
    assert.equal(tags[0].tag, 'style');
    assert.equal(tags[0].injectTo, 'head');
    assert.equal(tags[0].children, SAFE_AREA_CSS);
    assert.equal(tags[1].tag, 'script');
    assert.equal(tags[1].injectTo, 'head');
    assert.equal(tags[1].children, SAFE_AREA_SCRIPT);
    assert.equal(tags[2].tag, 'div');
    assert.equal(tags[2].attrs.id, BLUR_FIX_ID);
    assert.equal(tags[2].injectTo, 'body-prepend');
});

test('pads #app by all four safe-area insets and uses the dynamic viewport height', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
        assert.ok(SAFE_AREA_CSS.includes(`env(safe-area-inset-${side})`), side);
    }
    assert.ok(SAFE_AREA_CSS.includes('100dvh'));
});

test('the blur-fix element is hidden except in iOS standalone', () => {
    assert.match(SAFE_AREA_CSS, new RegExp(`#${BLUR_FIX_ID}\\s*{\\s*display:\\s*none;`));
    const rule = SAFE_AREA_CSS.match(new RegExp(`:root\\[data-ios-standalone\\] #${BLUR_FIX_ID}\\s*{[^}]*}`));
    assert.ok(rule, 'rule for the iOS standalone marker');
    assert.match(rule[0], /display:\s*block/);
});

test('the blur-fix element is fixed to the top, over 10px tall, click-through, and invisible without opacity tricks', () => {
    const rule = SAFE_AREA_CSS.match(new RegExp(`:root\\[data-ios-standalone\\] #${BLUR_FIX_ID}\\s*{([^}]*)}`))[1];
    assert.match(rule, /position:\s*fixed/);
    assert.match(rule, /top:\s*0/);
    assert.ok(Number(rule.match(/height:\s*(\d+)px/)[1]) > 10, 'WebKit needs more than 10px');
    assert.match(rule, /pointer-events:\s*none/);
    assert.match(rule, /background-clip:\s*text/);
    assert.doesNotMatch(rule, /opacity|visibility/, 'those would stop WebKit counting it');
});

test('the script marks the page only when navigator.standalone is true', () => {
    const run = (nav, search = '') => {
        const attrs = new Set();
        const root = { setAttribute: (k) => attrs.add(k), hasAttribute: (k) => attrs.has(k) };
        new Function('document', 'navigator', 'location', 'addEventListener', SAFE_AREA_SCRIPT)(
            { documentElement: root },
            nav,
            { search },
            () => {}
        );
        return attrs.has('data-ios-standalone');
    };
    assert.equal(run({ standalone: true }), true);
    assert.equal(run({ standalone: false }), false);
    assert.equal(run({}), false, 'not iOS Safari');
});

