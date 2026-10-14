import { describe, expect, it } from 'vitest';
import {
  GRAVE_INPUT_LOCK_MS,
  graveCauseOf,
  graveLocked,
  gravePanelHeight,
  gravePanelLayout,
  graveRows,
  graveVariantFor,
  isNewRecord,
  type GraveInfo
} from './gravePanel';

const info = (over: Partial<GraveInfo> = {}): GraveInfo => ({ stageNo: 5, cause: 'mine', high: 9, record: false, ...over });

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

describe('graveRows', () => {
  it('variant A has the tombstone, the heading, the cause, the score and the record', () => {
    const rows = graveRows('A', info({ record: true }));
    expect(rows.map((r) => r.text)).toEqual(['†', 'R.I.P. Stage 5', 'Killed by a mine.', 'Score:4  High:9', 'New record!']);
    expect(rows.map((r) => r.height)).toEqual([32, 24, 20, 20, 20]);
    expect(rows.map((r) => r.fontSize)).toEqual([28, 18, 14, 14, 14]);
    expect(rows.map((r) => r.highlight)).toEqual([false, false, false, false, true]);
  });

  it('variant A has no record row when the score is not a record', () => {
    expect(graveRows('A', info()).map((r) => r.text)).toEqual(['†', 'R.I.P. Stage 5', 'Killed by a mine.', 'Score:4  High:9']);
  });

  it('variant B leaves the tombstone out and keeps the record row', () => {
    expect(graveRows('B', info({ record: true })).map((r) => r.text)).toEqual([
      'R.I.P. Stage 5', 'Killed by a mine.', 'Score:4  High:9', 'New record!'
    ]);
  });

  it('variant C folds the record into the score row', () => {
    const rows = graveRows('C', info({ record: true }));
    expect(rows.map((r) => r.text)).toEqual(['R.I.P. Stage 5', 'Killed by a mine.', 'Score:4  High:9  New record!']);
    expect(rows[2].highlight).toBe(true);
    expect(graveRows('C', info()).map((r) => r.text)).toEqual(['R.I.P. Stage 5', 'Killed by a mine.', 'Score:4  High:9']);
  });

  it('names the false flag, and counts the stage 1 death as score 0', () => {
    const rows = graveRows('B', info({ stageNo: 1, cause: 'false-flag', high: 0 }));
    expect(rows.map((r) => r.text)).toEqual(['R.I.P. Stage 1', 'Stepped on a false flag.', 'Score:0  High:0']);
  });
});

describe('gravePanelHeight', () => {
  it('adds the row heights, the gaps between rows and the padding above and below', () => {
    expect(gravePanelHeight(graveRows('A', info()))).toBe(132);
    expect(gravePanelHeight(graveRows('A', info({ record: true })))).toBe(156);
    expect(gravePanelHeight(graveRows('B', info()))).toBe(96);
    expect(gravePanelHeight(graveRows('B', info({ record: true })))).toBe(120);
    expect(gravePanelHeight(graveRows('C', info({ record: true })))).toBe(96);
  });
});

describe('graveVariantFor', () => {
  it.each([
    [132, 'A'], [131, 'B'], [96, 'B'], [95, 'C'], [0, 'C']
  ] as const)('without a record, %i px available picks %s', (available, expected) => {
    expect(graveVariantFor(available, false)).toBe(expected);
  });

  it.each([
    [156, 'A'], [155, 'B'], [120, 'B'], [119, 'C'], [50, 'C']
  ] as const)('with a record, %i px available picks %s (C even when it does not fit)', (available, expected) => {
    expect(graveVariantFor(available, true)).toBe(expected);
  });
});

describe('gravePanelLayout', () => {
  it('on 1024x720 with the band ending at 72, A sits 12 px above the RETRY row, centred, 280 wide', () => {
    const layout = gravePanelLayout(1024, 720, 72, info());
    expect(layout.variant).toBe('A');
    expect(layout.bottom).toBeCloseTo(484.4, 6);
    expect(layout.height).toBe(132);
    expect(layout.top).toBeCloseTo(352.4, 6);
    expect(layout.centerX).toBe(512);
    expect(layout.width).toBe(280);
    const expected = [380.4, 412.4, 438.4, 462.4];
    layout.rowCenterY.forEach((y, i) => expect(y).toBeCloseTo(expected[i], 6));
  });

  it.each([
    [390, 844, 573.68],
    [375, 550, 362],
    [667, 310, 189.2],
    [568, 320, 196.4]
  ])('puts the bottom at 0.72 H − 22 − 12 on %ix%i (%d)', (w, h, bottom) => {
    expect(gravePanelLayout(w, h, 72, info()).bottom).toBeCloseTo(bottom, 6);
  });

  it('on 667x310 with the band ending at 72 (109.2 px available) uses B, and C when there is a record', () => {
    expect(gravePanelLayout(667, 310, 72, info()).variant).toBe('B');
    expect(gravePanelLayout(667, 310, 72, info({ record: true })).variant).toBe('C');
  });

  it('on 568x320 (116.4 px available) uses B without a record and C with one', () => {
    expect(gravePanelLayout(568, 320, 72, info()).variant).toBe('B');
    expect(gravePanelLayout(568, 320, 72, info({ record: true })).variant).toBe('C');
  });

  it('chooses again for a taller band: the same screen drops to a smaller variant', () => {
    expect(gravePanelLayout(1024, 720, 72, info()).variant).toBe('A');
    expect(gravePanelLayout(1024, 720, 400, info()).variant).toBe('C');
  });

  it('keeps the bottom fixed whatever the variant, so it never reaches the buttons', () => {
    const tall = gravePanelLayout(390, 844, 72, info({ record: true }));
    const tight = gravePanelLayout(390, 844, 560, info({ record: true }));
    expect(tight.variant).toBe('C');
    expect(tight.bottom).toBe(tall.bottom);
  });
});
