import { describe, expect, it } from 'vitest';
import { StartGate } from 'title-demo';
import { isStartKey, titleLayout } from './title';

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
  it('1024x768: name y 292, button y 476, font 48, button 200 x 64, centred at 512', () => {
    expect(titleLayout(1024, 768)).toEqual({
      centerX: 512, nameY: 292, buttonY: 476, fontSize: 48, buttonWidth: 200, buttonHeight: 64
    });
  });

  it('390x844: name y 321, button y 523, font 39, button 200 wide', () => {
    expect(titleLayout(390, 844)).toEqual({
      centerX: 195, nameY: 321, buttonY: 523, fontSize: 39, buttonWidth: 200, buttonHeight: 64
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

describe('the start gate the Title uses', () => {
  it('lets only the first of two start requests in one frame through', () => {
    const gate = new StartGate();
    expect(gate.start()).toBe(true);
    expect(gate.start()).toBe(false);
  });
});

describe('Title regression (docs/spec/title.md: no storage, no stage generation)', () => {
  const sources = import.meta.glob(['../scenes/Title.ts', './title.ts'], {
    query: '?raw',
    import: 'default',
    eager: true
  }) as Record<string, string>;

  it('reads both Title sources', () => {
    expect(Object.keys(sources).sort()).toEqual(['../scenes/Title.ts', './title.ts']);
  });

  it('uses no browser storage', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /localStorage|sessionStorage|indexedDB/i.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it('does not generate a stage (that is done when Game is created)', () => {
    const offenders = Object.entries(sources)
      .filter(([, text]) => /generateStage/.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
