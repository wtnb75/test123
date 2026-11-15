// Run with: node --test scaffold/vite/game-list-link.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAME_LIST_LINK_CSS, GAME_LIST_LINK_ID, gameListLink } from './game-list-link.mjs';

const run = () => gameListLink().transformIndexHtml.handler('<head></head><body></body>');
const linkTag = () => run().tags.find((t) => t.tag === 'a');

test('injects a link with id game-list-link that points at ../', () => {
    const tag = linkTag();
    assert.equal(GAME_LIST_LINK_ID, 'game-list-link');
    assert.equal(tag.attrs.id, GAME_LIST_LINK_ID);
    assert.equal(tag.attrs.href, '../');
    assert.equal(tag.injectTo, 'body');
});

test('the link starts hidden', () => {
    assert.equal(linkTag().attrs['data-visible'], 'false');
});

test('the style is injected into the head', () => {
    const style = run().tags.find((t) => t.tag === 'style');
    assert.equal(style.injectTo, 'head');
    assert.equal(style.children, GAME_LIST_LINK_CSS);
});

test('the link is shown only while data-visible is true', () => {
    assert.match(GAME_LIST_LINK_CSS, /display:\s*none/);
    assert.match(GAME_LIST_LINK_CSS, /\[data-visible=["']true["']\]\s*\{[^}]*display:\s*(flex|block|inline-flex)/);
});

test('the link is fixed and stays inside the safe area', () => {
    assert.match(GAME_LIST_LINK_CSS, /position:\s*fixed/);
    assert.ok(GAME_LIST_LINK_CSS.includes('env(safe-area-inset-top) + var(--standalone-top-extra, 0px)'));
    assert.ok(GAME_LIST_LINK_CSS.includes('env(safe-area-inset-left)'));
});

test('the text is at least 11px and the visible pill is compact (at most 28px tall)', () => {
    const size = /font-size:\s*(\d+)px/.exec(GAME_LIST_LINK_CSS);
    assert.ok(size && Number(size[1]) >= 11);
    const pill = /#game-list-link\s*\{[^}]*\bheight:\s*(\d+)px/.exec(GAME_LIST_LINK_CSS);
    assert.ok(pill && Number(pill[1]) <= 28);
});

test('the tap target is extended to 44px by an invisible ::after, not by a taller pill', () => {
    const hit = /#game-list-link::after\s*\{([^}]*)\}/.exec(GAME_LIST_LINK_CSS);
    assert.ok(hit, '::after rule');
    assert.match(hit[1], /content:\s*['"]{2}/);
    assert.match(hit[1], /position:\s*absolute/);
    assert.match(hit[1], /\bheight:\s*44px/);
});

test('does not touch the page HTML itself', () => {
    assert.equal(run().html, '<head></head><body></body>');
});
