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
  it('variant A is the tall Rogue tombstone: a second blank arch row, a blank wall row under the words, 8 grass on each side (14 rows with a record, 40 characters wide)', () => {
    expect(texts('A', info({ record: true }))).toEqual([
      '            ________________            ',
      '           /                \\           ',
      '           /                \\           ',
      '          /       REST       \\          ',
      '         /         IN         \\         ',
      '        /        PEACE         \\        ',
      '        |                      |        ',
      '        |       Stage 20       |        ',
      '        |     killed by a      |        ',
      '        |         mine         |        ',
      '        |  Score:19  High:19   |        ',
      '        |     New record!      |        ',
      '        |                      |        ',
      '_________)/\\_//(\\/(/\\)/\\//\\/|_)_________'
    ]);
  });

  it('variant A has no record row when the score is not a record (13 rows, the blank wall row and the ground last)', () => {
    const rows = texts('A', info());
    expect(rows).toHaveLength(13);
    expect(rows.some((r) => r.includes('New record!'))).toBe(false);
    expect(rows[11]).toBe('        |                      |        ');
    expect(rows[12]).toBe('_________)/\\_//(\\/(/\\)/\\//\\/|_)_________');
  });

  it('variant A repeats the blank arch row once more (rows 2 and 3 are equal) and that is the only difference above REST', () => {
    const rows = texts('A', info());
    expect(rows[1]).toBe(rows[2]);
    expect(rows[3].trim()).toBe('/       REST       \\');
  });

  it('variant A names the false flag on the cause rows', () => {
    const rows = texts('A', info({ cause: 'false-flag' }));
    expect(rows[8]).toBe('        |     stepped on a     |        ');
    expect(rows[9]).toBe('        |      false flag      |        ');
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
    expect(rows.filter((r) => r.accent !== null).map((r) => r.text.trim())).toEqual(['|     New record!      |']);
  });

  it('pads every row to the variant\'s width (A 40, B and C 32), and widens the art when a row reaches past that', () => {
    expect(new Set(graveArt('A', info()).map((r) => r.text.length))).toEqual(new Set([40]));
    expect(new Set(graveArt('B', info()).map((r) => r.text.length))).toEqual(new Set([32]));
    expect(new Set(graveArt('C', info()).map((r) => r.text.length))).toEqual(new Set([32]));
    // Seven digits: variant A (margin 8) is 37 characters and still fits 40; variant B (margin 4) is 33 and widens.
    const wideA = graveArt('A', info({ stageNo: 1234568, high: 1234567 }));
    expect(wideA[10].text).toBe('        |Score:1234567  High:1234567|   ');
    expect(new Set(wideA.map((r) => r.text.length))).toEqual(new Set([40]));
    const wideB = graveArt('B', info({ stageNo: 1234568, high: 1234567 }));
    expect(wideB[6].text).toBe('    |Score:1234567  High:1234567|');
    expect(new Set(wideB.map((r) => r.text.length))).toEqual(new Set([33]));
  });
});

describe('gravePlateWidth', () => {
  it('is the characters x one character width plus 8 px each side: A 40 x 8.4 = 336 -> 352, B 32 x 8.4 = 268.8 -> 284.8', () => {
    expect(gravePlateWidth(graveArt('A', info()), 8.4)).toBeCloseTo(352, 6);
    expect(gravePlateWidth(graveArt('B', info()), 8.4)).toBeCloseTo(284.8, 6);
  });

  it('follows a wider art: 33 characters x 8.4 = 277.2 -> 293.2', () => {
    expect(gravePlateWidth(graveArt('B', info({ stageNo: 1234568, high: 1234567 })), 8.4)).toBeCloseTo(293.2, 6);
  });

  it('takes the side margin as a parameter (10 px at font 18): 336 + 20 = 356', () => {
    expect(gravePlateWidth(graveArt('A', info()), 8.4, 10)).toBeCloseTo(356, 6);
  });

  it('is just the margins for an empty art', () => {
    expect(gravePlateWidth([], 8.4)).toBe(16);
  });
});

describe('graveArtHeight', () => {
  it('is rows x the row height at scale 1: A 13 x 24 = 312 / 14 x 24 = 336, B 144 / 162, C 90 / 108 (18 px)', () => {
    const h = (v: 'A' | 'B' | 'C', record: boolean): number => graveArtHeight(graveArt(v, info({ record })), graveRowHeight(v));
    expect([h('A', false), h('A', true)]).toEqual([312, 336]);
    expect([h('B', false), h('B', true)]).toEqual([144, 162]);
    expect([h('C', false), h('C', true)]).toEqual([90, 108]);
  });

  it('uses the given row height: 13 rows of A x 30 = 390, 8 rows of B x 18 = 144', () => {
    expect(graveArtHeight(graveArt('A', info()), 30)).toBe(390);
    expect(graveArtHeight(graveArt('B', info()), graveRowHeight('B'))).toBe(144);
  });
});

describe('graveVariantFor', () => {
  it.each([
    [312, 'A'], [311, 'B'], [144, 'B'], [143, 'C'], [90, 'C'], [89, 'C']
  ] as const)('without a record, %i px available picks %s on a wide screen (C even when it does not fit)', (available, expected) => {
    expect(graveVariantFor(available, false, 1000)).toBe(expected);
  });

  it.each([
    [336, 'A'], [335, 'B'], [162, 'B'], [161, 'C'], [108, 'C']
  ] as const)('with a record, %i px available picks %s on a wide screen', (available, expected) => {
    expect(graveVariantFor(available, true, 1000)).toBe(expected);
  });

  it('variant A also needs its 352 px plate plus 8 px each side: width 368 is A, 367 is B (the height is enough)', () => {
    expect(graveVariantFor(400, false, 368)).toBe('A');
    expect(graveVariantFor(400, false, 367)).toBe('B');
    expect(graveVariantFor(400, true, 368)).toBe('A');
  });

  it('takes the character width as a parameter: 8.5 px makes the A plate 356 px, so 372 is A and 371 is B', () => {
    expect(graveVariantFor(400, false, 372, 8.5)).toBe('A');
    expect(graveVariantFor(400, false, 371, 8.5)).toBe('B');
  });

  it('a screen too narrow for A but with room in height gives B, and too little height for B gives C', () => {
    expect(graveVariantFor(346.8, false, 360)).toBe('B');
    expect(graveVariantFor(100, false, 360)).toBe('C');
  });
});

describe('graveScale (docs/spec/game-over.md "墓石の大きさ（画面に合わせる）")', () => {
  const scaleOf = (v: 'A' | 'B' | 'C', i: GraveInfo, available: number, width: number) =>
    graveScale(v, graveArt(v, i), available, width);
  const pick = (s: ReturnType<typeof graveScale>) => [s.fontPx, s.rowHeight, s.platePadX];

  it('1280x720 (404.4 px, A): without a record K = 404.4 / 312 = 1.296 -> font 18, row 30, pad 10; with a record 404.4 / 336 = 1.204 -> 16, 27, 9', () => {
    const none = scaleOf('A', info(), 404.4, 1280);
    expect(none.k).toBeCloseTo(1.2962, 3);
    expect(pick(none)).toEqual([18, 30, 10]);
    const rec = scaleOf('A', info({ record: true }), 404.4, 1280);
    expect(rec.k).toBeCloseTo(1.2036, 3);
    expect(pick(rec)).toEqual([16, 27, 9]);
  });

  it('390x844 (493.68 px, A): the width gives K = 374 / 352 = 1.0625 -> font 14, row 24, pad 8', () => {
    const s = scaleOf('A', info(), 493.68, 390);
    expect(s.k).toBeCloseTo(1.0625, 4);
    expect(pick(s)).toEqual([14, 24, 8]);
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

  it('1920x1080 (663.6 px, A): K = 2.127 -> font 29, row 49; with a record 1.975 -> 27, 46', () => {
    expect(pick(scaleOf('A', info(), 663.6, 1920))).toEqual([29, 49, 16]);
    expect(pick(scaleOf('A', info({ record: true }), 663.6, 1920))).toEqual([27, 46, 15]);
  });

  it('a 320 px wide screen (B, 295 px): K = 304 / 284.8 = 1.067 -> font 14, row 18 (the size it has always had)', () => {
    expect(pick(scaleOf('B', info(), 295, 320))).toEqual([14, 18, 8]);
  });

  it('is never under 1: an A exactly 312 px high stays 14 / 24, and a B on a 300 px wide screen (kw 0.997) stays 14 / 18', () => {
    expect(scaleOf('A', info(), 312, 1000).k).toBe(1);
    expect(pick(scaleOf('A', info(), 312, 1000))).toEqual([14, 24, 8]);
    expect(scaleOf('B', info(), 295, 300).k).toBe(1);
    expect(pick(scaleOf('B', info(), 295, 300))).toEqual([14, 18, 8]);
  });

  it('is capped at 3 (font 42, row 72) when the height allows more, and 2560x1440 (922.8 px) is still below it: font 41, row 70', () => {
    const big = scaleOf('A', info(), 966, 3000);
    expect(big.k).toBe(3);
    expect(pick(big)).toEqual([42, 72, 24]);
    expect(pick(scaleOf('A', info(), 922.8, 2560))).toEqual([41, 70, 23]);
  });

  it('keeps float noise out of the floors: 624 px for the 13 rows of A is exactly K = 2 -> font 28, row 48, pad 16', () => {
    const s = scaleOf('A', info(), 624, 3000);
    expect(s.k).toBe(2);
    expect(pick(s)).toEqual([28, 48, 16]);
  });

  it('keeps float noise out where it really drops a result: 534.857… px for the 13 rows of A is K = 24 / 14, font 24 (not 23), row 41', () => {
    // 534.8571428571428 / 312 * 14 = 23.999999999999996 without the guard.
    const a = scaleOf('A', info(), 534.8571428571428, 3000);
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
    for (const [v, available, width] of [['A', 404.4, 1280], ['A', 663.6, 1920], ['B', 282, 375], ['C', 109.2, 667], ['A', 493.68, 390]] as const) {
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
    expect(checked).toBe(10);
    // Every case has K above 1 (the 390x844 pair only 1.06, which still draws the base font 14), so every height was checked.
    expect(scaledUp).toBe(10);
  });
});

describe('gravePanelLayout', () => {
  it('on 1024x720 with the band ending at 72 the art is A at font 18 / row 30 (13 rows = 390 px), its bottom 12 px above the RETRY row, centred', () => {
    const layout = gravePanelLayout(1024, 720, 72, info());
    expect(layout.variant).toBe('A');
    expect([layout.fontPx, layout.rowHeight, layout.platePadX]).toEqual([18, 30, 10]);
    expect(layout.bottom).toBeCloseTo(484.4, 6);
    expect(layout.height).toBe(390);
    expect(layout.top).toBeCloseTo(94.4, 6);
    expect(layout.centerX).toBe(512);
    expect(layout.rowCenterY).toHaveLength(13);
    expect(layout.rowCenterY[0]).toBeCloseTo(109.4, 6);
    expect(layout.rowCenterY[12]).toBeCloseTo(469.4, 6);
  });

  it('with a record the art has 14 rows at font 16 / row 27 (378 px) and the same bottom', () => {
    const layout = gravePanelLayout(1024, 720, 72, info({ record: true }));
    expect(layout.rows).toHaveLength(14);
    expect([layout.fontPx, layout.rowHeight]).toEqual([16, 27]);
    expect(layout.height).toBe(378);
    expect(layout.bottom).toBeCloseTo(484.4, 6);
    expect(layout.top).toBeCloseTo(106.4, 6);
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

  it('on 375x550 (282 px available) is B, not A (A needs 312), at font 17 / row 21; with the band at 92 (262 px) still B', () => {
    const layout = gravePanelLayout(375, 550, 72, info());
    expect([layout.variant, layout.fontPx, layout.rowHeight, layout.height]).toEqual(['B', 17, 21, 168]);
    expect(gravePanelLayout(375, 550, 92, info({ record: true })).variant).toBe('B');
  });

  it('on 390x844 it is A at the size it has at scale 1 (font 14 / row 24 = 312 px; the width allows only 1.06)', () => {
    const layout = gravePanelLayout(390, 844, 72, info());
    expect([layout.variant, layout.fontPx, layout.rowHeight, layout.height]).toEqual(['A', 14, 24, 312]);
  });

  it('on 1920x1080 it is A at font 29 / row 49 (637 px); on 320x568 B at 14 / 18; on 375x667 A; on 360x640 B (too narrow for A)', () => {
    const big = gravePanelLayout(1920, 1080, 72, info());
    expect([big.variant, big.fontPx, big.rowHeight, big.height]).toEqual(['A', 29, 49, 637]);
    expect(gravePanelLayout(320, 568, 72, info()).variant).toBe('B');
    expect(gravePanelLayout(375, 667, 72, info()).variant).toBe('A');
    expect(gravePanelLayout(360, 640, 72, info()).variant).toBe('B');
  });

  it('keeps 8 px between the band and the art: a band 4 px past the point where A fits drops to B', () => {
    // 1024x720: the art bottom is 484.4, so a band ending at 164 leaves 312.4 (A needs 312), at 168 only 308.4.
    expect(gravePanelLayout(1024, 720, 164, info()).variant).toBe('A');
    expect(gravePanelLayout(1024, 720, 168, info()).variant).toBe('B');
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
    expect(gaps).toHaveLength(12);
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

  it('is columns 14 to 24 of the variant A row (the 11 characters), not the walls; columns 10 to 20 in B and C', () => {
    const row = recordRow('A');
    expect(row.accent).toEqual({ start: 14, end: 25 });
    expect(row.text.slice(14, 25)).toBe('New record!');
    expect(row.text[8]).toBe('|');
    expect(row.text[31]).toBe('|');
    expect(recordRow('B').accent).toEqual({ start: 10, end: 21 });
    expect(recordRow('C').accent).toEqual({ start: 10, end: 21 });
  });

  it('splits the row into a body line without the words and an accent line with only them, of equal length', () => {
    const parts = graveRowParts(recordRow('A'));
    expect(parts.base).toBe('        |                      |        ');
    expect(parts.accent).toBe(`${' '.repeat(14)}New record!${' '.repeat(15)}`);
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
    // 14 rows with a record, only the record row has an accent.
    expect(others).toBe(13);
  });

  it('puts the accent on the words in every variant', () => {
    for (const variant of ['A', 'B', 'C'] as const) {
      const row = recordRow(variant);
      expect(row.text.slice(row.accent!.start, row.accent!.end)).toBe('New record!');
    }
  });
});
