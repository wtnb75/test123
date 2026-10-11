import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LABS_PAGE, TOP_PAGE, pageHtml, splitArgs, tagsOf } from './build-index.mjs';

const card = (dir, tags, summary = '') => ({ dir, title: dir, summary, tags });

test('tagsOf collects distinct tags in order of first appearance', () => {
    const cards = [card('a', ['パズル', 'タッチ']), card('b', ['タッチ', 'キーボード'])];
    assert.deepEqual(tagsOf(cards), ['パズル', 'タッチ', 'キーボード']);
});

test('splitArgs lists the newest game first and separates the labs games after --labs', () => {
    assert.deepEqual(splitArgs(['a', 'b', '--labs', 'c', 'd']), { games: ['b', 'a'], labs: ['d', 'c'] });
});

test('splitArgs without --labs has no labs games', () => {
    assert.deepEqual(splitArgs(['a', 'b']), { games: ['b', 'a'], labs: [] });
});

test('pageHtml keeps the given card order and links to the other page', () => {
    const html = pageHtml([card('new', ['x']), card('old', ['x'])], TOP_PAGE);
    assert.ok(html.indexOf('href="new/"') < html.indexOf('href="old/"'));
    assert.match(html, /href="labs\.html"/);
});

test('pageHtml renders one filter chip per tag and tags every card', () => {
    const html = pageHtml([card('a', ['パズル']), card('b', ['パズル', 'タッチ'])], LABS_PAGE);
    assert.equal(html.match(/class="chip" data-tag=/g).length, 2);
    assert.match(html, /data-tags="\[&quot;パズル&quot;,&quot;タッチ&quot;\]"/);
});

test('pageHtml escapes summaries', () => {
    const html = pageHtml([card('a', [], '<b>x</b>')], TOP_PAGE);
    assert.ok(!html.includes('<b>x</b>'));
    assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('pageHtml omits the filter bar and link when there are none', () => {
    const html = pageHtml([card('a', [])], { ...TOP_PAGE, link: null });
    assert.ok(!html.includes('class="filter"'));
    assert.ok(!html.includes('class="nav"'));
});
