import { describe, expect, it } from 'vitest';
import { isBlockedViKey, isRepeatedPress, viKeyDirection } from './moveKeys';

// docs/spec.md "移動キーの対応": the hjklyubn keys by physical position (KeyboardEvent.code).
describe('viKeyDirection', () => {
  it.each([
    ['KeyH', { x: -1, y: 0 }],
    ['KeyJ', { x: 0, y: 1 }],
    ['KeyK', { x: 0, y: -1 }],
    ['KeyL', { x: 1, y: 0 }],
    ['KeyY', { x: -1, y: -1 }],
    ['KeyU', { x: 1, y: -1 }],
    ['KeyB', { x: -1, y: 1 }],
    ['KeyN', { x: 1, y: 1 }]
  ])('%s moves by the spec direction', (code, delta) => {
    expect(viKeyDirection(code)).toEqual(delta);
  });

  it('gives no direction to the other letter keys, the arrows, the numpad, S and M (no change to the existing keys)', () => {
    for (const code of ['KeyG', 'KeyI', 'KeyM', 'KeyO', 'KeyS', 'KeyR', 'KeyT', 'KeyW', 'KeyA', 'KeyQ', 'ArrowUp', 'Numpad5', 'Enter', 'Space', 'h', '']) {
      expect(viKeyDirection(code)).toBeNull();
    }
  });

  it('a code that differs only in case is not a movement key (the code is the physical key name)', () => {
    expect(viKeyDirection('keyh')).toBeNull();
  });
});

describe('isBlockedViKey', () => {
  const none = { ctrlKey: false, altKey: false, metaKey: false };

  it('blocks a hjklyubn key with Ctrl, Alt or Meta, each on its own and together', () => {
    for (const code of ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyY', 'KeyU', 'KeyB', 'KeyN']) {
      expect(isBlockedViKey(code, { ...none, ctrlKey: true })).toBe(true);
      expect(isBlockedViKey(code, { ...none, altKey: true })).toBe(true);
      expect(isBlockedViKey(code, { ...none, metaKey: true })).toBe(true);
      expect(isBlockedViKey(code, { ctrlKey: true, altKey: true, metaKey: true })).toBe(true);
    }
  });

  it('does not block a hjklyubn key by itself or with Shift (Shift alone toggles the flag, as before)', () => {
    expect(isBlockedViKey('KeyH', none)).toBe(false);
    // Shift alone is not blocked: it toggles the flag. Passed as a variable, so the extra field is not an excess-property error.
    const shifted = { ctrlKey: false, altKey: false, metaKey: false, shiftKey: true };
    expect(isBlockedViKey('KeyN', shifted)).toBe(false);
  });

  it('does not block the other keys, with a modifier or without (the existing keys are unchanged)', () => {
    expect(isBlockedViKey('KeyM', { ...none, ctrlKey: true })).toBe(false);
    expect(isBlockedViKey('ArrowUp', { ...none, ctrlKey: true })).toBe(false);
    expect(isBlockedViKey('KeyQ', { ...none, altKey: true })).toBe(false);
  });
});

describe('isRepeatedPress', () => {
  const press = (code: string, timeStamp: number) => ({ code, timeStamp });

  it('is false before any press was handled', () => {
    expect(isRepeatedPress(undefined, press('KeyH', 100))).toBe(false);
  });

  it('is true for a second report of the same press (the same code at the same time stamp)', () => {
    expect(isRepeatedPress(press('KeyH', 100), press('KeyH', 100))).toBe(true);
  });

  it('is false for a new press of the same key at a later time stamp (a fast repeat of a tap is not dropped)', () => {
    expect(isRepeatedPress(press('KeyH', 100), press('KeyH', 120))).toBe(false);
  });

  it('is false for another key at the same time stamp', () => {
    expect(isRepeatedPress(press('KeyH', 100), press('KeyJ', 100))).toBe(false);
  });

  it('is false for another key in between, so A then B then A handles the second A', () => {
    const a = press('KeyH', 100);
    const b = press('KeyJ', 120);
    const a2 = press('KeyH', 140);
    expect(isRepeatedPress(a, b)).toBe(false);
    expect(isRepeatedPress(b, a2)).toBe(false);
    expect(isRepeatedPress(a2, a2)).toBe(true);
  });
});
