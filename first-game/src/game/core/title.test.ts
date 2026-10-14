import { describe, expect, it } from 'vitest';
import { StartGate } from 'title-demo';
import { demoLayout, isStartKey, titleLayout } from './title';

// Expected values are worked by hand from docs/spec/title.md ("パラメータ表" and "テスト観点").

describe('isStartKey', () => {
  it.each(['Enter', 'Space'])('starts on %s', (code) => {
    expect(isStartKey(code, false)).toBe(true);
  });

  it.each(['Enter', 'Space'])('ignores the auto-repeat of a held %s', (code) => {
    expect(isStartKey(code, true)).toBe(false);
  });

  it.each([
    'NumpadEnter', 'Numpad5', 'KeyS', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft', 'Escape'
  ])('does not start on %s (a Game key or an unrelated key)', (code) => {
    expect(isStartKey(code, false)).toBe(false);
  });
});

describe('titleLayout', () => {
  it('1024x768: name y 40 (16 + 48 / 2), button y 720 (768 - 16 - 32), font 48, button 200 x 64, centred at 512', () => {
    expect(titleLayout(1024, 768)).toEqual({
      centerX: 512, nameY: 40, buttonY: 720, fontSize: 48, buttonWidth: 200, buttonHeight: 64
    });
  });

  it('390x844: name y 36 (16 + 19.5 rounded), button y 796, font 39, button 200 wide', () => {
    expect(titleLayout(390, 844)).toEqual({
      centerX: 195, nameY: 36, buttonY: 796, fontSize: 39, buttonWidth: 200, buttonHeight: 64
    });
  });

  it('rounds the centre of an odd width to an integer px (x = W / 2 rounded)', () => {
    expect(titleLayout(391, 800).centerX).toBe(196);
    expect(titleLayout(390, 800).centerX).toBe(195);
  });

  it('clamps the font size: 24 at 240 and below, 48 from 480 up', () => {
    expect(titleLayout(240, 400).fontSize).toBe(24);
    expect(titleLayout(200, 400).fontSize).toBe(24);
    expect(titleLayout(100, 400).fontSize).toBe(24);
    expect(titleLayout(300, 400).fontSize).toBe(30);
    expect(titleLayout(479, 400).fontSize).toBe(47);
    expect(titleLayout(480, 400).fontSize).toBe(48);
    expect(titleLayout(2000, 400).fontSize).toBe(48);
  });

  it('shrinks the button to the width minus 16 px on each side when narrow', () => {
    expect(titleLayout(240, 400).buttonWidth).toBe(200);
    expect(titleLayout(232, 400).buttonWidth).toBe(200);
    expect(titleLayout(231, 400).buttonWidth).toBe(199);
    expect(titleLayout(200, 400).buttonWidth).toBe(168);
  });

  it('never gives a negative button width on a tiny canvas', () => {
    expect(titleLayout(20, 400).buttonWidth).toBe(0);
  });

  it('keeps the name and the button on the canvas and apart (every width from 240, height from 320)', () => {
    for (const width of [240, 320, 390, 768, 1024, 1920]) {
      for (const height of [320, 480, 768, 1080]) {
        const l = titleLayout(width, height);
        const nameBottom = l.nameY + l.fontSize / 2;
        const nameWidth = 15 * 0.6 * l.fontSize;
        const buttonTop = l.buttonY - l.buttonHeight / 2;
        if (l.nameY - l.fontSize / 2 < 0 || l.buttonY + l.buttonHeight / 2 > height) {
          expect.fail(`off the canvas at ${width}x${height}`);
        }
        if (!(nameBottom < buttonTop)) {
          expect.fail(`name and button touch at ${width}x${height}`);
        }
        if (nameWidth > width || l.buttonWidth > width) {
          expect.fail(`too wide at ${width}x${height}`);
        }
      }
    }
  });
});

// Hand-worked from docs/spec/title-demo.md ("レイアウト" and "テスト観点"): W x H -> demo area and 1 cell size.
describe('demoLayout', () => {
  it('1024x768: region 76..676 (600 high, 992 wide), cell 30, board centre y 376', () => {
    expect(demoLayout(1024, 768)).toEqual({
      visible: true, cell: 30, centerX: 512, centerY: 376, regionTop: 76, regionBottom: 676, regionWidth: 992, regionHeight: 600
    });
  });

  it('390x844: region 67..752 (685 high, 358 wide), cell 30, board centre y 410 (409.5 rounded)', () => {
    expect(demoLayout(390, 844)).toMatchObject({
      visible: true, cell: 30, centerX: 195, centerY: 410, regionTop: 67, regionBottom: 752, regionWidth: 358, regionHeight: 685
    });
  });

  it('240x400: cell 20 (the width limits it), region 52..308, board centre y 180', () => {
    expect(demoLayout(240, 400)).toMatchObject({
      visible: true, cell: 20, centerY: 180, regionTop: 52, regionBottom: 308, regionWidth: 208, regionHeight: 256
    });
  });

  it('200x400: cell 16 (floor of 168 / 10)', () => {
    expect(demoLayout(200, 400)).toMatchObject({ visible: true, cell: 16, regionWidth: 168 });
  });

  it('rounds the board centre of an odd width up (391 -> 196)', () => {
    expect(demoLayout(391, 800).centerX).toBe(196);
    expect(demoLayout(390, 800).centerX).toBe(195);
  });

  it('844x390: cell 22 (the height limits it), region 76..298, board centre y 187', () => {
    expect(demoLayout(844, 390)).toMatchObject({
      visible: true, cell: 22, centerY: 187, regionTop: 76, regionBottom: 298, regionHeight: 222
    });
  });

  it('320x240: cell 8 is under the minimum of 10, so the demo is not shown', () => {
    expect(demoLayout(320, 240)).toMatchObject({ visible: false, cell: 8, regionHeight: 88 });
  });

  it('shows the demo exactly from a cell size of 10', () => {
    // 320 wide: font 32, regionTop 16 + 32 + 12 = 60; regionBottom = H - 16 - 64 - 12 = H - 92; cell = floor((H - 152) / 10)
    expect(demoLayout(320, 252)).toMatchObject({ visible: true, cell: 10, regionHeight: 100 });
    expect(demoLayout(320, 251)).toMatchObject({ visible: false, cell: 9, regionHeight: 99 });
  });

  it('never gives a negative region on a tiny canvas', () => {
    const l = demoLayout(100, 100);
    expect(l.regionHeight).toBe(0);
    expect(l.visible).toBe(false);
  });

  it('keeps the board (10 x 10 cells) on the canvas and clear of the name and button', () => {
    for (const width of [240, 320, 390, 768, 1024, 1920]) {
      for (const height of [320, 480, 768, 1080]) {
        const d = demoLayout(width, height);
        const t = titleLayout(width, height);
        if (!d.visible) {
          continue;
        }
        const half = (10 * d.cell) / 2;
        const nameBottom = t.nameY + t.fontSize / 2;
        const buttonTop = t.buttonY - t.buttonHeight / 2;
        if (d.centerY - half < nameBottom || d.centerY + half > buttonTop) {
          expect.fail(`demo touches the name or the button at ${width}x${height}`);
        }
        if (d.centerX - half < 0 || d.centerX + half > width) {
          expect.fail(`demo is cut off at ${width}x${height}`);
        }
      }
    }
  });
});

describe('the start gate the Title uses', () => {
  it('lets only the first of two start requests in one frame through', () => {
    const gate = new StartGate();
    expect(gate.start()).toBe(true);
    expect(gate.start()).toBe(false);
  });
});

describe('Title regression (docs/spec/title.md, title-demo.md: no storage, demo stages only)', () => {
  const sources = import.meta.glob(
    ['../scenes/Title.ts', '../scenes/boardView.ts', './cellAppearance.ts', './title.ts', './titleDemo.ts', './demoBot.ts'],
    { query: '?raw', import: 'default', eager: true }
  ) as Record<string, string>;

  it('reads every file the Title loads', () => {
    expect(Object.keys(sources).sort()).toEqual([
      '../scenes/Title.ts', '../scenes/boardView.ts', './cellAppearance.ts', './demoBot.ts', './title.ts', './titleDemo.ts'
    ]);
  });

  it('uses no browser storage', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /localStorage|sessionStorage|indexedDB/i.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it('generates stages only in the demo adapter (never the start stage)', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /generateStage/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual(['./titleDemo.ts']);
  });

  it('never reads the start stage or the query', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /URLSearchParams|location\.search|START_STAGE|minefield-rogue/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
