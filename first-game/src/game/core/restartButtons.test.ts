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
