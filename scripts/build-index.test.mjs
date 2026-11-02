import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LABS_PAGE, TOP_PAGE, formatBest, pageHtml, readBest, splitArgs, tagsOf } from './build-index.mjs';

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

test('readBest returns the label and date of a best-store value', () => {
    assert.deepEqual(readBest(getter('{"score":8,"label":"WAVE 8","date":"2026-11-03"}'), 'a.best'), {
        label: 'WAVE 8',
        date: '2026-11-03',
    });
});

test('readBest returns a null date for a record saved before the date existed', () => {
    assert.deepEqual(readBest(getter('{"score":8,"label":"WAVE 8"}'), 'a.best'), { label: 'WAVE 8', date: null });
});

test('readBest drops a malformed date but keeps the record', () => {
    for (const date of ['20261103', '"yesterday"', '"2026-11-03T10:00"', 'null']) {
        const raw = `{"score":8,"label":"WAVE 8","date":${date}}`;
        assert.deepEqual(readBest(getter(raw), 'a.best'), { label: 'WAVE 8', date: null }, date);
    }
});

test('readBest passes the key to the getter', () => {
    const seen = [];
    readBest((k) => (seen.push(k), null), 'a.best');
    assert.deepEqual(seen, ['a.best']);
});

test('readBest treats a missing, broken or wrongly shaped value as no record', () => {
    for (const raw of [null, '', 'x{', '5', 'null', '{"score":"8","label":"x"}', '{"score":null,"label":"x"}', '{"score":1}', '{"score":1,"label":3}', '{"score":1,"label":""}']) {
        assert.equal(readBest(getter(raw), 'a.best'), null, String(raw));
    }
});

test('readBest returns null when reading throws', () => {
    const boom = () => {
        throw new Error('denied');
    };
    assert.equal(readBest(boom, 'a.best'), null);
});

test('formatBest shows the label alone when there is no date', () => {
    assert.equal(formatBest({ label: 'WAVE 8', date: null }, 2026), 'WAVE 8');
});

test('formatBest shows month/day without leading zeros for this year', () => {
    assert.equal(formatBest({ label: 'WAVE 8', date: '2026-01-05' }, 2026), 'WAVE 8 · 1/5');
    assert.equal(formatBest({ label: 'WAVE 8', date: '2026-11-03' }, 2026), 'WAVE 8 · 11/3');
});

test('formatBest adds the year when the record is from another year', () => {
    assert.equal(formatBest({ label: 'WAVE 8', date: '2025-12-31' }, 2026), 'WAVE 8 · 2025/12/31');
});

test('pageHtml gives every card its best key and an empty hidden badge, and embeds the reader', () => {
    const html = pageHtml([card('bouncewave', [])], TOP_PAGE);
    assert.match(html, /data-best-key="bouncewave\.best"/);
    assert.match(html, /<span class="best" hidden><\/span>/);
    assert.match(html, /const readBest = /);
    assert.match(html, /const formatBest = /);
});

test('pageHtml omits the filter bar and link when there are none', () => {
    const html = pageHtml([card('a', [])], { ...TOP_PAGE, link: null });
    assert.ok(!html.includes('class="filter"'));
    assert.ok(!html.includes('class="nav"'));
});
