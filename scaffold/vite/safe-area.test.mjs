// Run with: node --test scaffold/vite/safe-area.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SAFE_AREA_CSS, safeArea, withViewportFitCover } from './safe-area.mjs';

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
    assert.equal(tags.length, 1);
    assert.equal(tags[0].tag, 'style');
    assert.equal(tags[0].injectTo, 'head');
    assert.equal(tags[0].children, SAFE_AREA_CSS);
});

test('pads #app by all four safe-area insets and uses the dynamic viewport height', () => {
    for (const side of ['top', 'right', 'bottom', 'left']) {
        assert.ok(SAFE_AREA_CSS.includes(`env(safe-area-inset-${side})`), side);
    }
    assert.ok(SAFE_AREA_CSS.includes('100dvh'));
});
