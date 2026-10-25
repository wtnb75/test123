import { describe, expect, it } from 'vitest';
import {
  GRAVE_INPUT_LOCK_MS,
  centerText,
  graveArt,
  graveArtHeight,
  graveCauseOf,
  graveRowHeight,
  graveRowParts,
  graveLocked,
  gravePanelLayout,
  gravePlateWidth,
  graveScale,
  graveVariantFor,
  isNewRecord,
  type GraveInfo
} from './gravePanel';

const info = (over: Partial<GraveInfo> = {}): GraveInfo => ({ stageNo: 20, cause: 'mine', high: 19, record: false, ...over });
const texts = (variant: 'A' | 'B' | 'C', i: GraveInfo): string[] => graveArt(variant, i).map((r) => r.text);

describe('graveCauseOf', () => {
  it('names a false flag only for the false-flag tag; a bomb stepped on or opened by a chord is a mine', () => {
    expect(graveCauseOf('false-flag')).toBe('false-flag');
    expect(graveCauseOf('bomb-without-flag')).toBe('mine');
    expect(graveCauseOf(undefined)).toBe('mine');
  });
});

describe('isNewRecord', () => {
  it('is a record only when the score beats the high score from before the death', () => {
    expect(isNewRecord(5, 4)).toBe(true);
    expect(isNewRecord(4, 4)).toBe(false);
    expect(isNewRecord(3, 4)).toBe(false);
  });

  it('is not a record for a score of 0 against a high score of 0', () => {
    expect(isNewRecord(0, 0)).toBe(false);
  });
});

describe('graveLocked', () => {
  it('ignores input for the first 300 ms and accepts it from exactly 300 ms', () => {
    expect(GRAVE_INPUT_LOCK_MS).toBe(300);
    expect(graveLocked(1000, 1000)).toBe(true);
    expect(graveLocked(1299, 1000)).toBe(true);
    expect(graveLocked(1300, 1000)).toBe(false);
    expect(graveLocked(5000, 1000)).toBe(false);
  });
});

describe('centerText', () => {
  it('puts the text in the middle with the left blanks rounded down', () => {
    expect(centerText('REST', 18)).toBe(`${' '.repeat(7)}REST${' '.repeat(7)}`);
    expect(centerText('PEACE', 22)).toBe(`${' '.repeat(8)}PEACE${' '.repeat(9)}`);
  });

  it('leaves a text that is longer than the width as it is', () => {
    expect(centerText('Score:12345  High:12345', 22)).toBe('Score:12345  High:12345');
  });
});

describe('graveArt', () => {
  it('variant A is the tall Rogue tombstone with grass growing wild on both sides of its last three rows (13 rows with a record, 48 characters wide)', () => {
    expect(texts('A', info({ record: true }))).toEqual([
      '                ________________                ',
      '               /                \\               ',
      '              /       REST       \\              ',
      '             /         IN         \\             ',
      '            /        PEACE         \\            ',
      '            |                      |            ',
      '            |       Stage 20       |            ',
      '            |     killed by a      |            ',
      '            |         mine         |            ',
      '   \\|/ \\ |/ |  Score:19  High:19   | \\|/ / \\|/  ',
      ' \\\\|/|/\\|\\|/|     New record!      |/|\\|//\\|\\/|\\',
      '\\|/\\|/|/\\|//|                      |\\\\/|\\|/|\\/|/',
      '_____________._,_._.,_._,_._._,_._,_____________'
    ]);
  });

  it('variant A without a record has 12 rows: the grass sits on the cause row, the score row and the blank wall row', () => {
    expect(texts('A', info())).toEqual([
      '                ________________                ',
      '               /                \\               ',
      '              /       REST       \\              ',
      '             /         IN         \\             ',
      '            /        PEACE         \\            ',
      '            |                      |            ',
      '            |       Stage 20       |            ',
      '            |     killed by a      |            ',
      '   \\|/ \\ |/ |         mine         | \\|/ / \\|/  ',
      ' \\\\|/|/\\|\\|/|  Score:19  High:19   |/|\\|//\\|\\/|\\',
      '\\|/\\|/|/\\|//|                      |\\\\/|\\|/|\\/|/',
      '_____________._,_._.,_._,_._._,_._,_____________'
    ]);
  });

  it('variant A has one blank arch row above REST (not two), a blank wall row under the words and a modest ground under the stone', () => {
    const rows = texts('A', info());
    expect(rows[1].trim()).toBe('/                \\');
    expect(rows[2].trim()).toBe('/       REST       \\');
    expect(rows[10].slice(12, 36)).toBe('|                      |');
    expect(rows[11]).toBe('_'.repeat(12) + '_._,_._.,_._,_._._,_._,_' + '_'.repeat(12));
  });

  it('variant A names the false flag on the two cause rows (with a record, both sit between plain walls)', () => {
    const rows = texts('A', info({ cause: 'false-flag', record: true }));
    expect(rows[7]).toBe('            |     stepped on a     |            ');
    expect(rows[8]).toBe('            |      false flag      |            ');
  });

  it('the false-flag cause row without a record is the first row with grass: the tuft, the wall text and the right tuft', () => {
    const rows = texts('A', info({ cause: 'false-flag' }));
    expect(rows[8]).toBe('   \\|/ \\ |/ |      false flag      | \\|/ / \\|/  ');
    expect(rows[7]).toBe('            |     stepped on a     |            ');
  });

  it('puts three tufts on each side, top to bottom, on the three rows above the ground, and none higher up', () => {
    const left = ['   \\|/ \\ |/ ', ' \\\\|/|/\\|\\|/', '\\|/\\|/|/\\|//'];
    const right = [' \\|/ / \\|/  ', '/|\\|//\\|\\/|\\', '\\\\/|\\|/|\\/|/'];
    const withRecord = texts('A', info({ record: true }));
    const without = texts('A', info());
    [withRecord, without].forEach((rows) => {
      const first = rows.length - 4;
      for (let k = 0; k < 3; k += 1) {
        expect(rows[first + k].slice(0, 12)).toBe(left[k]);
        expect(rows[first + k].slice(36)).toBe(right[k]);
      }
      // Every row higher up keeps a plain margin on both sides.
      rows.slice(0, first).forEach((row) => {
        expect(row.slice(0, 12).trim()).toBe('');
        expect(row.slice(36).trim()).toBe('');
      });
      expect(first).toBeGreaterThanOrEqual(8);
    });
  });

  it('variant B puts R.I.P. on one row and keeps the ground (9 rows with a record)', () => {
    expect(texts('B', info({ stageNo: 5, high: 4, record: true }))).toEqual([
      '        ________________        ',
      '       /                \\       ',
      '      /      R.I.P.      \\      ',
      '     /      Stage 5       \\     ',
      '    /     killed by a      \\    ',
      '    |         mine         |    ',
      '    |   Score:4  High:4    |    ',
      '    |     New record!      |    ',
      '_____)/\\_//(\\/(/\\)/\\//\\/|_)_____'
    ]);
  });

  it('variant C is the small stone whose bottom edge runs on as ground (5 rows)', () => {
    expect(texts('C', info({ stageNo: 100, cause: 'false-flag', high: 99 }))).toEqual([
      '      ____________________      ',
      '     /  R.I.P. Stage 100  \\     ',
      '    |stepped on false flag |    ',
      '    |  Score:99  High:99   |    ',
      '____|______________________|____'
    ]);
  });

  it('marks only the New record! row, and only the words in it, for the accent colour', () => {
    const rows = graveArt('A', info({ record: true }));
    const marked = rows.filter((r) => r.accent !== null);
    expect(marked).toHaveLength(1);
    expect(marked[0].text.slice(marked[0].accent!.start, marked[0].accent!.end)).toBe('New record!');
  });

  it('pads every row to the variant\'s width (A 48, B and C 32), and widens the art when a row reaches past that', () => {
    expect(new Set(graveArt('A', info()).map((r) => r.text.length))).toEqual(new Set([48]));
    expect(new Set(graveArt('B', info()).map((r) => r.text.length))).toEqual(new Set([32]));
    expect(new Set(graveArt('C', info()).map((r) => r.text.length))).toEqual(new Set([32]));
    // Seven digits: variant B (margin 4) is 33 characters and widens.
    const wideB = graveArt('B', info({ stageNo: 1234568, high: 1234567 }));
    expect(wideB[6].text).toBe('    |Score:1234567  High:1234567|');
    expect(new Set(wideB.map((r) => r.text.length))).toEqual(new Set([33]));
  });

  it('variant A with seven-digit scores: the wall row is 29 characters, the right tuft follows it and the art is 53 characters wide', () => {
    const rows = graveArt('A', info({ stageNo: 1234568, high: 1234567 }));
    expect(rows[9].text).toBe(' \\\\|/|/\\|\\|/|Score:1234567  High:1234567|/|\\|//\\|\\/|\\');
    expect(new Set(rows.map((r) => r.text.length))).toEqual(new Set([53]));
  });
});

describe('gravePlateWidth', () => {
  it('is the characters x one character width plus 8 px each side: A 48 x 8.4 = 403.2 -> 419.2, B 32 x 8.4 = 268.8 -> 284.8', () => {
    expect(gravePlateWidth(graveArt('A', info()), 8.4)).toBeCloseTo(419.2, 6);
    expect(gravePlateWidth(graveArt('B', info()), 8.4)).toBeCloseTo(284.8, 6);
  });

  it('follows a wider art: 33 characters x 8.4 = 277.2 -> 293.2', () => {
    expect(gravePlateWidth(graveArt('B', info({ stageNo: 1234568, high: 1234567 })), 8.4)).toBeCloseTo(293.2, 6);
  });

  it('takes the side margin as a parameter (10 px at font 19): 403.2 + 20 = 423.2', () => {
    expect(gravePlateWidth(graveArt('A', info()), 8.4, 10)).toBeCloseTo(423.2, 6);
  });

  it('is just the margins for an empty art', () => {
    expect(gravePlateWidth([], 8.4)).toBe(16);
  });
});

describe('graveArtHeight', () => {
  it('is rows x the row height at scale 1: A 12 x 24 = 288 / 13 x 24 = 312, B 144 / 162, C 90 / 108 (18 px)', () => {
    const h = (v: 'A' | 'B' | 'C', record: boolean): number => graveArtHeight(graveArt(v, info({ record })), graveRowHeight(v));
    expect([h('A', false), h('A', true)]).toEqual([288, 312]);
    expect([h('B', false), h('B', true)]).toEqual([144, 162]);
    expect([h('C', false), h('C', true)]).toEqual([90, 108]);
  });

  it('uses the given row height: 12 rows of A x 30 = 360, 8 rows of B x 18 = 144', () => {
    expect(graveArtHeight(graveArt('A', info()), 30)).toBe(360);
    expect(graveArtHeight(graveArt('B', info()), graveRowHeight('B'))).toBe(144);
  });
});

describe('graveVariantFor', () => {
  it.each([
    [288, 'A'], [287, 'B'], [144, 'B'], [143, 'C'], [90, 'C'], [89, 'C']
  ] as const)('without a record, %i px available picks %s on a wide screen (C even when it does not fit)', (available, expected) => {
    expect(graveVariantFor(available, false, 1000)).toBe(expected);
  });

  it.each([
    [312, 'A'], [311, 'B'], [162, 'B'], [161, 'C'], [108, 'C']
  ] as const)('with a record, %i px available picks %s on a wide screen', (available, expected) => {
    expect(graveVariantFor(available, true, 1000)).toBe(expected);
  });

  it('variant A also needs its 419.2 px plate plus 8 px each side: width 436 is A, 435 is B (the height is enough)', () => {
    expect(graveVariantFor(400, false, 436)).toBe('A');
    expect(graveVariantFor(400, false, 435)).toBe('B');
    expect(graveVariantFor(400, true, 436)).toBe('A');
  });

  it('takes the character width as a parameter: 8.5 px makes the A plate 424 px, so 440 is A and 439 is B', () => {
    expect(graveVariantFor(400, false, 440, 8.5)).toBe('A');
    expect(graveVariantFor(400, false, 439, 8.5)).toBe('B');
  });

  it('a phone-wide screen with room in height gives B, and too little height for B gives C', () => {
    expect(graveVariantFor(346.8, false, 360)).toBe('B');
    expect(graveVariantFor(493.68, false, 390)).toBe('B');
    expect(graveVariantFor(100, false, 360)).toBe('C');
  });
});

describe('graveScale (docs/spec/game-over.md "墓石の大きさ（画面に合わせる）")', () => {
  const scaleOf = (v: 'A' | 'B' | 'C', i: GraveInfo, available: number, width: number) =>
    graveScale(v, graveArt(v, i), available, width);
  const pick = (s: ReturnType<typeof graveScale>) => [s.fontPx, s.rowHeight, s.platePadX];

  it('1280x720 (404.4 px, A): without a record K = 404.4 / 288 = 1.404 -> font 19, row 32, pad 10; with a record 404.4 / 312 = 1.296 -> 18, 30, 10', () => {
    const none = scaleOf('A', info(), 404.4, 1280);
    expect(none.k).toBeCloseTo(1.4042, 3);
    expect(pick(none)).toEqual([19, 32, 10]);
    const rec = scaleOf('A', info({ record: true }), 404.4, 1280);
    expect(rec.k).toBeCloseTo(1.2962, 3);
    expect(pick(rec)).toEqual([18, 30, 10]);
  });

  it('390x844 (493.68 px) is B (A needs a screen 436 wide): K = 374 / 284.8 = 1.313 -> font 18, row 23, pad 10; heights 184 / 207', () => {
    const s = scaleOf('B', info(), 493.68, 390);
    expect(s.k).toBeCloseTo(1.3132, 3);
    expect(pick(s)).toEqual([18, 23, 10]);
    expect([8 * s.rowHeight, 9 * s.rowHeight]).toEqual([184, 207]);
  });

  it('375x550 (282 px, B): K = 359 / 284.8 = 1.2605 -> font 17, row 21, pad 9; a record gives heights 168 / 189', () => {
    const s = scaleOf('B', info(), 282, 375);
    expect(s.k).toBeCloseTo(1.2605, 3);
    expect(pick(s)).toEqual([17, 21, 9]);
    expect([8 * s.rowHeight, 9 * s.rowHeight]).toEqual([168, 189]);
  });

  it('667x310 (109.2 px, C): the height gives K = 109.2 / 90 = 1.213 -> font 16, row 20; with a record 109.2 / 108 = 1.011 -> 14, 18', () => {
    expect(pick(scaleOf('C', info(), 109.2, 667))).toEqual([16, 20, 9]);
    expect(pick(scaleOf('C', info({ record: true }), 109.2, 667))).toEqual([14, 18, 8]);
  });

  it('768x1024 (623.28 px, A): the width gives K = 752 / 419.2 = 1.794 (the height 2.164 allows more) -> font 25, row 42, pad 14', () => {
    const s = scaleOf('A', info(), 623.28, 768);
    expect(s.k).toBeCloseTo(1.7939, 3);
    expect(pick(s)).toEqual([25, 42, 14]);
  });

  it('1920x1080 (663.6 px, A): K = 2.304 -> font 32, row 54; with a record 2.127 -> 29, 49', () => {
    expect(pick(scaleOf('A', info(), 663.6, 1920))).toEqual([32, 54, 18]);
    expect(pick(scaleOf('A', info({ record: true }), 663.6, 1920))).toEqual([29, 49, 16]);
  });

  it('a 320 px wide screen (B, 295 px): K = 304 / 284.8 = 1.067 -> font 14, row 18 (the size it has always had)', () => {
    expect(pick(scaleOf('B', info(), 295, 320))).toEqual([14, 18, 8]);
  });

  it('is never under 1: an A exactly 288 px high stays 14 / 24, and a B on a 300 px wide screen (kw 0.997) stays 14 / 18', () => {
    expect(scaleOf('A', info(), 288, 1000).k).toBe(1);
    expect(pick(scaleOf('A', info(), 288, 1000))).toEqual([14, 24, 8]);
    expect(scaleOf('B', info(), 295, 300).k).toBe(1);
    expect(pick(scaleOf('B', info(), 295, 300))).toEqual([14, 18, 8]);
  });

  it('is capped at 3 (font 42, row 72) from 864 px for the 12 rows of A; 863 px gives 41 / 70; 2560x1440 (922.8 px) is at the cap', () => {
    const edge = scaleOf('A', info(), 864, 3000);
    expect(edge.k).toBe(3);
    expect(pick(edge)).toEqual([42, 72, 24]);
    expect(pick(scaleOf('A', info(), 922.8, 2560))).toEqual([42, 72, 24]);
    expect(pick(scaleOf('A', info(), 863, 3000))).toEqual([41, 70, 23]);
  });

  it('keeps float noise out of the floors: 576 px for the 12 rows (624 for the 13) of A is exactly K = 2 -> font 28, row 48, pad 16', () => {
    const none = scaleOf('A', info(), 576, 3000);
    expect(none.k).toBe(2);
    expect(pick(none)).toEqual([28, 48, 16]);
    expect(pick(scaleOf('A', info({ record: true }), 624, 3000))).toEqual([28, 48, 16]);
  });

  it('keeps float noise out where it really drops a result: 534.857… px for the 13 rows of A is K = 24 / 14, font 24 (not 23), row 41', () => {
    // 534.8571428571428 / 312 * 14 = 23.999999999999996 without the guard.
    const a = scaleOf('A', info({ record: true }), 534.8571428571428, 3000);
    expect(pick(a)).toEqual([24, 41, 13]);
    const b = scaleOf('B', info({ record: true }), 266.1428571428571, 3000);
    expect(b.fontPx).toBe(23);
  });

  it('seven-digit scores: variant B on 375 px is 33 characters (293.2 px), K = 359 / 293.2 = 1.224 -> font 17', () => {
    const s = scaleOf('B', info({ stageNo: 1234568, high: 1234567 }), 282, 375);
    expect(s.k).toBeCloseTo(1.2244, 3);
    expect(s.fontPx).toBe(17);
  });

  it('a larger art never overruns the usable height or the width (the scaled rows x row height, the scaled plate)', () => {
    let checked = 0;
    let scaledUp = 0;
    for (const [v, available, width] of [['A', 404.4, 1280], ['A', 663.6, 1920], ['B', 282, 375], ['C', 109.2, 667], ['B', 493.68, 390], ['A', 623.28, 768]] as const) {
      for (const record of [false, true]) {
        const rows = graveArt(v, info({ record }));
        const s = graveScale(v, rows, available, width);
        if (s.k > 1) {
          expect(rows.length * s.rowHeight).toBeLessThanOrEqual(available);
          scaledUp += 1;
        }
        // One character is 0.6 of the font size.
        expect(gravePlateWidth(rows, 0.6 * s.fontPx, s.platePadX)).toBeLessThanOrEqual(width - 16 + 1e-9);
        checked += 1;
      }
    }
    expect(checked).toBe(12);
    expect(scaledUp).toBe(12);
  });

  it('seven-digit scores widen variant A to 53 characters and the scale follows the real width (kw = 752 / 461.2)', () => {
    // 53 x 8.4 = 445.2 + 16 = 461.2
    const rows = graveArt('A', info({ stageNo: 1234568, high: 1234567 }));
    const s = graveScale('A', rows, 623.28, 768);
    expect(s.k).toBeCloseTo(752 / 461.2, 4);
    expect(s.fontPx).toBe(22);
  });
});

describe('gravePanelLayout', () => {
  it('on 1024x720 with the band ending at 72 the art is A at font 19 / row 32 (12 rows = 384 px), its bottom 12 px above the RETRY row, centred', () => {
    const layout = gravePanelLayout(1024, 720, 72, info());
    expect(layout.variant).toBe('A');
    expect([layout.fontPx, layout.rowHeight, layout.platePadX]).toEqual([19, 32, 10]);
    expect(layout.bottom).toBeCloseTo(484.4, 6);
    expect(layout.height).toBe(384);
    expect(layout.top).toBeCloseTo(100.4, 6);
    expect(layout.centerX).toBe(512);
    expect(layout.rowCenterY).toHaveLength(12);
    expect(layout.rowCenterY[0]).toBeCloseTo(116.4, 6);
    expect(layout.rowCenterY[11]).toBeCloseTo(468.4, 6);
  });

  it('with a record the art has 13 rows at font 18 / row 30 (390 px) and the same bottom', () => {
    const layout = gravePanelLayout(1024, 720, 72, info({ record: true }));
    expect(layout.rows).toHaveLength(13);
    expect([layout.fontPx, layout.rowHeight]).toEqual([18, 30]);
    expect(layout.height).toBe(390);
    expect(layout.bottom).toBeCloseTo(484.4, 6);
    expect(layout.top).toBeCloseTo(94.4, 6);
  });

  it.each([
    [390, 844, 573.68],
    [375, 550, 362],
    [667, 310, 189.2],
    [568, 320, 196.4]
  ])('puts the bottom at 0.72 H − 22 − 12 on %ix%i (%d)', (w, h, bottom) => {
    expect(gravePanelLayout(w, h, 72, info()).bottom).toBeCloseTo(bottom, 6);
  });

  it('on 667x310 with the band ending at 72 (109.2 px available) uses C at font 16 / row 20 (100 px); with a record 14 / 18 (108 px)', () => {
    const none = gravePanelLayout(667, 310, 72, info());
    expect([none.variant, none.fontPx, none.rowHeight, none.height]).toEqual(['C', 16, 20, 100]);
    const rec = gravePanelLayout(667, 310, 72, info({ record: true }));
    expect([rec.variant, rec.fontPx, rec.rowHeight, rec.height]).toEqual(['C', 14, 18, 108]);
  });

  it('on 568x320 (116.4 px available) uses C at font 18 / row 23 (115 px)', () => {
    const layout = gravePanelLayout(568, 320, 72, info());
    expect([layout.variant, layout.fontPx, layout.rowHeight, layout.height]).toEqual(['C', 18, 23, 115]);
  });

  it('on 375x550 (282 px available) is B at font 17 / row 21 (168 px); with the band at 92 (262 px) still B', () => {
    const layout = gravePanelLayout(375, 550, 72, info());
    expect([layout.variant, layout.fontPx, layout.rowHeight, layout.height]).toEqual(['B', 17, 21, 168]);
    expect(gravePanelLayout(375, 550, 92, info({ record: true })).variant).toBe('B');
  });

  it('on 390x844 it is B at font 18 / row 23 (184 px): tall enough for A, but the screen is under 436 px wide', () => {
    const layout = gravePanelLayout(390, 844, 72, info());
    expect([layout.variant, layout.fontPx, layout.rowHeight, layout.height]).toEqual(['B', 18, 23, 184]);
  });

  it('on 1920x1080 it is A at font 32 / row 54 (648 px); on 768x1024 A at 25 / 42 (504 px); phones 375x667, 360x640 and 320x568 are B', () => {
    const big = gravePanelLayout(1920, 1080, 72, info());
    expect([big.variant, big.fontPx, big.rowHeight, big.height]).toEqual(['A', 32, 54, 648]);
    const tablet = gravePanelLayout(768, 1024, 72, info());
    expect([tablet.variant, tablet.fontPx, tablet.rowHeight, tablet.height]).toEqual(['A', 25, 42, 504]);
    expect(gravePanelLayout(375, 667, 72, info()).variant).toBe('B');
    expect(gravePanelLayout(360, 640, 72, info()).variant).toBe('B');
    expect(gravePanelLayout(320, 568, 72, info()).variant).toBe('B');
  });

  it('keeps 8 px between the band and the art: a band 1 px past the point where A fits drops to B', () => {
    // 1024x720: the art bottom is 484.4, so a band ending at 188 leaves 288.4 (A needs 288), at 189 only 287.4.
    expect(gravePanelLayout(1024, 720, 188, info()).variant).toBe('A');
    expect(gravePanelLayout(1024, 720, 189, info()).variant).toBe('B');
  });

  it('chooses again for a taller band: the same screen drops to a smaller variant', () => {
    expect(gravePanelLayout(1024, 720, 72, info()).variant).toBe('A');
    expect(gravePanelLayout(1024, 720, 300, info()).variant).toBe('B');
    expect(gravePanelLayout(1024, 720, 400, info()).variant).toBe('C');
  });

  it('keeps the bottom fixed whatever the variant or scale, so it never reaches the buttons', () => {
    const roomy = gravePanelLayout(390, 844, 72, info({ record: true }));
    const tight = gravePanelLayout(390, 844, 560, info({ record: true }));
    expect(tight.variant).toBe('C');
    expect(tight.bottom).toBe(roomy.bottom);
    expect(gravePanelLayout(1920, 1080, 72, info()).bottom).toBeCloseTo(1080 * 0.72 - 34, 6);
  });

  it('puts the rows one row height apart (row centres) from the top, whatever the scale', () => {
    const layout = gravePanelLayout(1280, 720, 72, info());
    const gaps = layout.rowCenterY.slice(1).map((y, i) => y - layout.rowCenterY[i]);
    expect(new Set(gaps.map((g) => Math.round(g * 1e6)))).toEqual(new Set([layout.rowHeight * 1e6]));
    expect(gaps).toHaveLength(11);
  });
});

describe('the accent colour covers only the words "New record!"', () => {
  const recordRow = (variant: 'A' | 'B' | 'C'): ReturnType<typeof graveArt>[number] => {
    const row = graveArt(variant, info({ record: true })).find((r) => r.accent !== null);
    if (!row) {
      throw new Error('no record row');
    }
    return row;
  };

  it('is columns 18 to 28 of the variant A row (the 11 characters), not the walls or the grass; columns 10 to 20 in B and C', () => {
    const row = recordRow('A');
    expect(row.accent).toEqual({ start: 18, end: 29 });
    expect(row.text.slice(18, 29)).toBe('New record!');
    expect(row.text[12]).toBe('|');
    expect(row.text[35]).toBe('|');
    expect(recordRow('B').accent).toEqual({ start: 10, end: 21 });
    expect(recordRow('C').accent).toEqual({ start: 10, end: 21 });
  });

  it('splits the row into a body line without the words and an accent line with only them, of equal length (the grass stays in the body colour)', () => {
    const parts = graveRowParts(recordRow('A'));
    expect(parts.base).toBe(' \\\\|/|/\\|\\|/|                      |/|\\|//\\|\\/|\\');
    expect(parts.accent).toBe('                  New record!                   ');
    expect(parts.accent?.length).toBe(parts.base.length);
  });

  it('has no accent line for the other rows, which keep their text', () => {
    let others = 0;
    for (const row of graveArt('A', info({ record: true }))) {
      if (row.accent === null) {
        expect(graveRowParts(row)).toEqual({ base: row.text, accent: null });
        others += 1;
      }
    }
    // 13 rows with a record, only the record row has an accent.
    expect(others).toBe(12);
  });

  it('puts the accent on the words in every variant', () => {
    for (const variant of ['A', 'B', 'C'] as const) {
      const row = recordRow(variant);
      expect(row.text.slice(row.accent!.start, row.accent!.end)).toBe('New record!');
    }
  });
});
