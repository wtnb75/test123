import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LABS_PAGE, TOP_PAGE, pageHtml, readBestLabel, splitArgs, tagsOf } from './build-index.mjs';

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

const getter = (value) => () => value;

test('readBestLabel returns the label of a best-store value', () => {
    assert.equal(readBestLabel(getter('{"score":8,"label":"WAVE 8"}'), 'a.best'), 'WAVE 8');
});

test('readBestLabel passes the key to the getter', () => {
    const seen = [];
    readBestLabel((k) => (seen.push(k), null), 'a.best');
    assert.deepEqual(seen, ['a.best']);
});

test('readBestLabel treats a missing, broken or wrongly shaped value as no record', () => {
    for (const raw of [null, '', 'x{', '5', 'null', '{"score":"8","label":"x"}', '{"score":null,"label":"x"}', '{"score":1}', '{"score":1,"label":3}', '{"score":1,"label":""}']) {
        assert.equal(readBestLabel(getter(raw), 'a.best'), null, String(raw));
    }
});

test('readBestLabel returns null when reading throws', () => {
    const boom = () => {
        throw new Error('denied');
    };
    assert.equal(readBestLabel(boom, 'a.best'), null);
});

test('pageHtml gives every card its best key and an empty hidden badge, and embeds the reader', () => {
    const html = pageHtml([card('bouncewave', [])], TOP_PAGE);
    assert.match(html, /data-best-key="bouncewave\.best"/);
    assert.match(html, /<span class="best" hidden><\/span>/);
    assert.match(html, /const readBestLabel = /);
});

test('pageHtml omits the filter bar and link when there are none', () => {
    const html = pageHtml([card('a', [])], { ...TOP_PAGE, link: null });
    assert.ok(!html.includes('class="filter"'));
    assert.ok(!html.includes('class="nav"'));
});
