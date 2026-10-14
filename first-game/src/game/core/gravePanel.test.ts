import { describe, expect, it } from 'vitest';
import {
  GRAVE_INPUT_LOCK_MS,
  centerText,
  graveArt,
  graveArtHeight,
  graveCauseOf,
  graveRowParts,
  graveLocked,
  gravePanelLayout,
  gravePlateWidth,
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
  it('variant A is the Rogue tombstone with the ground running on from its base (12 rows with a record)', () => {
    expect(texts('A', info({ record: true }))).toEqual([
      '        ________________        ',
      '       /                \\       ',
      '      /       REST       \\      ',
      '     /         IN         \\     ',
      '    /        PEACE         \\    ',
      '    |                      |    ',
      '    |       Stage 20       |    ',
      '    |     killed by a      |    ',
      '    |         mine         |    ',
      '    |  Score:19  High:19   |    ',
      '    |     New record!      |    ',
      '_____)/\\_//(\\/(/\\)/\\//\\/|_)_____'
    ]);
  });

  it('variant A has no record row when the score is not a record (11 rows)', () => {
    const rows = texts('A', info());
    expect(rows).toHaveLength(11);
    expect(rows.some((r) => r.includes('New record!'))).toBe(false);
  });

  it('variant A names the false flag on the cause rows', () => {
    const rows = texts('A', info({ cause: 'false-flag' }));
    expect(rows[7]).toBe('    |     stepped on a     |    ');
    expect(rows[8]).toBe('    |      false flag      |    ');
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

  it('pads every row to 32 characters, and widens the art when a row reaches past that', () => {
    expect(new Set(graveArt('A', info()).map((r) => r.text.length))).toEqual(new Set([32]));
    const wide = graveArt('A', info({ stageNo: 1234568, high: 1234567 }));
    expect(wide[9].text).toBe('    |Score:1234567  High:1234567|');
    expect(new Set(wide.map((r) => r.text.length))).toEqual(new Set([33]));
  });
});

describe('gravePlateWidth', () => {
  it('is the characters x one character width plus 8 px each side: 32 x 8.4 = 268.8 -> 284.8', () => {
    expect(gravePlateWidth(graveArt('A', info()), 8.4)).toBeCloseTo(284.8, 6);
  });

  it('follows a wider art: 33 characters x 8.4 = 277.2 -> 293.2', () => {
    expect(gravePlateWidth(graveArt('A', info({ stageNo: 1234568, high: 1234567 })), 8.4)).toBeCloseTo(293.2, 6);
  });

  it('is just the margins for an empty art', () => {
    expect(gravePlateWidth([], 8.4)).toBe(16);
  });
});

describe('graveArtHeight', () => {
  it('is rows x 18 px: A 198 / 216, B 144 / 162, C 90 / 108', () => {
    const h = (v: 'A' | 'B' | 'C', record: boolean): number => graveArtHeight(graveArt(v, info({ record })));
    expect([h('A', false), h('A', true)]).toEqual([198, 216]);
    expect([h('B', false), h('B', true)]).toEqual([144, 162]);
    expect([h('C', false), h('C', true)]).toEqual([90, 108]);
  });
});

describe('graveVariantFor', () => {
  it.each([
    [198, 'A'], [197, 'B'], [144, 'B'], [143, 'C'], [90, 'C'], [89, 'C']
  ] as const)('without a record, %i px available picks %s (C even when it does not fit)', (available, expected) => {
    expect(graveVariantFor(available, false)).toBe(expected);
  });

  it.each([
    [216, 'A'], [215, 'B'], [162, 'B'], [161, 'C'], [108, 'C']
  ] as const)('with a record, %i px available picks %s', (available, expected) => {
    expect(graveVariantFor(available, true)).toBe(expected);
  });
});

describe('gravePanelLayout', () => {
  it('on 1024x720 with the band ending at 72 the art is A, its bottom 12 px above the RETRY row, centred', () => {
    const layout = gravePanelLayout(1024, 720, 72, info());
    expect(layout.variant).toBe('A');
    expect(layout.bottom).toBeCloseTo(484.4, 6);
    expect(layout.height).toBe(198);
    expect(layout.top).toBeCloseTo(286.4, 6);
    expect(layout.centerX).toBe(512);
    expect(layout.rowCenterY).toHaveLength(11);
    expect(layout.rowCenterY[0]).toBeCloseTo(295.4, 6);
    expect(layout.rowCenterY[10]).toBeCloseTo(475.4, 6);
  });

  it.each([
    [390, 844, 573.68],
    [375, 550, 362],
    [667, 310, 189.2],
    [568, 320, 196.4]
  ])('puts the bottom at 0.72 H − 22 − 12 on %ix%i (%d)', (w, h, bottom) => {
    expect(gravePanelLayout(w, h, 72, info()).bottom).toBeCloseTo(bottom, 6);
  });

  it('on 667x310 with the band ending at 72 (109.2 px available) uses C, also with a record (108 fits)', () => {
    expect(gravePanelLayout(667, 310, 72, info()).variant).toBe('C');
    expect(gravePanelLayout(667, 310, 72, info({ record: true })).variant).toBe('C');
  });

  it('on 568x320 (116.4 px available) uses C', () => {
    expect(gravePanelLayout(568, 320, 72, info({ record: true })).variant).toBe('C');
  });

  it('on 375x550 with the band ending at 92 (262 px available) uses A even with a record (216)', () => {
    expect(gravePanelLayout(375, 550, 92, info({ record: true })).variant).toBe('A');
  });

  it('keeps 8 px between the band and the art: a band 1 px past the point where A fits drops to B', () => {
    // 1024x720: the art bottom is 484.4, so a band ending at 278 leaves 198.4 (A needs 198), at 279 only 197.4.
    expect(gravePanelLayout(1024, 720, 278, info()).variant).toBe('A');
    expect(gravePanelLayout(1024, 720, 279, info()).variant).toBe('B');
  });

  it('chooses again for a taller band: the same screen drops to a smaller variant', () => {
    expect(gravePanelLayout(1024, 720, 72, info()).variant).toBe('A');
    expect(gravePanelLayout(1024, 720, 300, info()).variant).toBe('B');
    expect(gravePanelLayout(1024, 720, 400, info()).variant).toBe('C');
  });

  it('keeps the bottom fixed whatever the variant, so it never reaches the buttons', () => {
    const roomy = gravePanelLayout(390, 844, 72, info({ record: true }));
    const tight = gravePanelLayout(390, 844, 560, info({ record: true }));
    expect(tight.variant).toBe('C');
    expect(tight.bottom).toBe(roomy.bottom);
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

  it('is columns 10 to 20 of the variant A row (the 11 characters), not the walls', () => {
    const row = recordRow('A');
    expect(row.accent).toEqual({ start: 10, end: 21 });
    expect(row.text.slice(10, 21)).toBe('New record!');
    expect(row.text[4]).toBe('|');
    expect(row.text[27]).toBe('|');
  });

  it('splits the row into a body line without the words and an accent line with only them, of equal length', () => {
    const parts = graveRowParts(recordRow('A'));
    expect(parts.base).toBe('    |                      |    ');
    expect(parts.accent).toBe(`${' '.repeat(10)}New record!${' '.repeat(11)}`);
    expect(parts.accent?.length).toBe(parts.base.length);
  });

  it('has no accent line for the other rows, which keep their text', () => {
    for (const row of graveArt('A', info({ record: true }))) {
      if (row.accent === null) {
        expect(graveRowParts(row)).toEqual({ base: row.text, accent: null });
      }
    }
  });

  it('puts the accent on the words in every variant', () => {
    for (const variant of ['A', 'B', 'C'] as const) {
      const row = recordRow(variant);
      expect(row.text.slice(row.accent!.start, row.accent!.end)).toBe('New record!');
    }
  });
});
