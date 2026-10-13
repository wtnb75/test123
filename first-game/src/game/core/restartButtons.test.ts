import { describe, expect, it } from 'vitest';
import { restartButtonAt, restartButtonLayout } from './restartButtons';

// Hand-worked from docs/spec.md ("ボタン（RETRY / NEW GAME）", "ボタン（TITLE）" and the テスト観点
// "ゲームオーバーのボタンの配置と当たり").

describe('restartButtonLayout', () => {
  it('1024x720: RETRY (434, 518.4), NEW GAME (590, 518.4), TITLE (512, 578.4), all 140 x 44', () => {
    const l = restartButtonLayout(1024, 720);
    expect(l.retry.x).toBe(434);
    expect(l.newGame.x).toBe(590);
    expect(l.title.x).toBe(512);
    expect(l.retry.y).toBeCloseTo(518.4, 9);
    expect(l.newGame.y).toBeCloseTo(518.4, 9);
    expect(l.title.y).toBeCloseTo(578.4, 9);
    for (const b of [l.retry, l.newGame, l.title]) {
      expect(b.width).toBe(140);
      expect(b.height).toBe(44);
    }
  });

  it('390x844: RETRY x 117, NEW GAME x 273, TITLE x 195, row y 607.68, TITLE y 667.68', () => {
    const l = restartButtonLayout(390, 844);
    expect([l.retry.x, l.newGame.x, l.title.x]).toEqual([117, 273, 195]);
    expect(l.retry.y).toBeCloseTo(607.68, 9);
    expect(l.newGame.y).toBeCloseTo(607.68, 9);
    expect(l.title.y).toBeCloseTo(667.68, 9);
  });

  it('leaves 16 px between RETRY and NEW GAME, and 16 px between that row and TITLE', () => {
    const l = restartButtonLayout(800, 600);
    expect(l.newGame.x - l.newGame.width / 2 - (l.retry.x + l.retry.width / 2)).toBe(16);
    expect(l.title.y - l.title.height / 2 - (l.retry.y + l.retry.height / 2)).toBeCloseTo(16, 9);
  });

  it('keeps the three buttons on the canvas from 320 x 320 up', () => {
    for (const width of [320, 390, 768, 1280]) {
      for (const height of [320, 480, 844]) {
        const l = restartButtonLayout(width, height);
        for (const b of [l.retry, l.newGame, l.title]) {
          if (b.x - b.width / 2 < 0 || b.x + b.width / 2 > width || b.y + b.height / 2 > height) {
            expect.fail(`a button is off the canvas at ${width}x${height}`);
          }
        }
      }
    }
  });
});

// Hand-worked: after a resize the buttons are the same function of the new size (docs/spec.md, same テスト観点).
describe('restartButtonLayout after a resize', () => {
  it('390x844 -> 844x390: RETRY (344, 280.8), NEW GAME (500, 280.8), TITLE (422, 340.8) with the bottom at 362.8', () => {
    const l = restartButtonLayout(844, 390);
    expect([l.retry.x, l.newGame.x, l.title.x]).toEqual([344, 500, 422]);
    expect(l.retry.y).toBeCloseTo(280.8, 9);
    expect(l.newGame.y).toBeCloseTo(280.8, 9);
    expect(l.title.y).toBeCloseTo(340.8, 9);
    expect(l.title.y + l.title.height / 2).toBeCloseTo(362.8, 9);
    expect(l.title.y + l.title.height / 2).toBeLessThan(390);
  });

  it('320x568 -> 568x320: the TITLE bottom is 0.72 * 320 + 60 + 22 = 312.4, still under 320', () => {
    const l = restartButtonLayout(568, 320);
    expect(l.title.y + l.title.height / 2).toBeCloseTo(312.4, 9);
    expect(l.title.y + l.title.height / 2).toBeLessThan(320);
    expect(l.retry.x - l.retry.width / 2).toBeGreaterThanOrEqual(0);
  });

  it('keeps size and gaps through a resize, and the old layout is not mutated', () => {
    const before = restartButtonLayout(390, 844);
    const snapshot = JSON.parse(JSON.stringify(before));
    const after = restartButtonLayout(844, 390);
    expect(before).toEqual(snapshot);
    for (const b of [after.retry, after.newGame, after.title]) {
      expect([b.width, b.height]).toEqual([140, 44]);
    }
    expect(after.newGame.x - after.retry.x).toBe(156);
    expect(after.title.y - after.retry.y).toBeCloseTo(60, 9);
  });

  it('judges a release against the layout of the new size: (422, 340.8) is TITLE after the turn, a new game before it', () => {
    const portrait = restartButtonLayout(390, 844);
    const landscape = restartButtonLayout(844, 390);
    expect(restartButtonAt(landscape, 422, 340.8)).toBe('title');
    expect(restartButtonAt(portrait, 422, 340.8)).toBe('new');
    // the old TITLE / RETRY spots are outside every landscape box, so they fall through to a new game
    expect(restartButtonAt(portrait, 195, 667.68)).toBe('title');
    expect(restartButtonAt(landscape, 195, 667.68)).toBe('new');
    expect(restartButtonAt(portrait, 117, 607.68)).toBe('retry');
    expect(restartButtonAt(landscape, 117, 607.68)).toBe('new');
    expect(restartButtonAt(landscape, 344, 280.8)).toBe('retry');
  });
});

describe('restartButtonAt', () => {
  const l = restartButtonLayout(1024, 720);

  it('TITLE: at the centre and exactly on the +-70 / +-22 edges', () => {
    expect(restartButtonAt(l, 512, 578.4)).toBe('title');
    expect(restartButtonAt(l, 512 + 70, 578.4 + 22)).toBe('title');
    expect(restartButtonAt(l, 512 - 70, 578.4 - 22)).toBe('title');
  });

  it('is not TITLE one unit outside the edges (x +71, y +23): that is a new game', () => {
    expect(restartButtonAt(l, 512 + 71, 578.4)).toBe('new');
    expect(restartButtonAt(l, 512, 578.4 + 23)).toBe('new');
    expect(restartButtonAt(l, 512 - 71, 578.4)).toBe('new');
    expect(restartButtonAt(l, 512, 578.4 - 23)).toBe('new');
  });

  it('RETRY inside its rectangle, new game on NEW GAME and anywhere else', () => {
    expect(restartButtonAt(l, 434, 518.4)).toBe('retry');
    expect(restartButtonAt(l, 434 + 70, 518.4 + 22)).toBe('retry');
    expect(restartButtonAt(l, 590, 518.4)).toBe('new');
    expect(restartButtonAt(l, 10, 10)).toBe('new');
  });

  it('keeps the rectangles apart: the TITLE top (row + 38) is under the row bottom (row + 22)', () => {
    expect(restartButtonAt(l, 434, 518.4 + 30)).toBe('new');
    expect(restartButtonAt(l, 512, 518.4 + 30)).toBe('new');
  });
});
