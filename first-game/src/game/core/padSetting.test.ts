import { describe, expect, it } from 'vitest';
import { LONG_PRESS_MS, PAD_SETTING_KEY, isLongPress, padSettingLabel, readPadHidden, writePadHidden } from './padSetting';

const memoryStore = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (key: string): string | null => (key in data ? data[key] : null),
    setItem: (key: string, value: string): void => {
      data[key] = value;
    }
  };
};

const brokenStore = {
  getItem: (): string | null => {
    throw new Error('blocked');
  },
  setItem: (): void => {
    throw new Error('blocked');
  }
};

describe('pad setting', () => {
  it('shows the controls when nothing is saved, and hides them only for the value hidden', () => {
    expect(readPadHidden(memoryStore())).toBe(false);
    expect(readPadHidden(memoryStore({ [PAD_SETTING_KEY]: 'hidden' }))).toBe(true);
    expect(readPadHidden(memoryStore({ [PAD_SETTING_KEY]: 'shown' }))).toBe(false);
    expect(readPadHidden(memoryStore({ [PAD_SETTING_KEY]: 'yes' }))).toBe(false);
  });

  it('saves hidden and shown under the setting key', () => {
    const store = memoryStore();

    expect(writePadHidden(store, true)).toBe(true);
    expect(store.data[PAD_SETTING_KEY]).toBe('hidden');
    expect(writePadHidden(store, false)).toBe(true);
    expect(store.data[PAD_SETTING_KEY]).toBe('shown');
  });

  it('shows the controls when storage is blocked, and reports a failed save', () => {
    expect(readPadHidden(brokenStore)).toBe(false);
    expect(writePadHidden(brokenStore, true)).toBe(false);
    expect(readPadHidden(null)).toBe(false);
  });

  it('labels the button with the current state', () => {
    expect(padSettingLabel(false)).toBe('パッド: 表示');
    expect(padSettingLabel(true)).toBe('パッド: 隠す');
  });
});

describe('long press', () => {
  it('is 400 ms: 399 ms is a tap, 400 ms is a long press', () => {
    expect(LONG_PRESS_MS).toBe(400);
    expect(isLongPress(399)).toBe(false);
    expect(isLongPress(400)).toBe(true);
    expect(isLongPress(0)).toBe(false);
  });
});
