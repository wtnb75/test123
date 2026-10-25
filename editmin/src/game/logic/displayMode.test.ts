import { describe, expect, it } from 'vitest';
import {
    DISPLAY_MODE_DEFAULT,
    DISPLAY_MODE_LABEL,
    displayModeButtonLabel,
    isDisplayModeKey,
    isPaleCell,
    nextDisplayMode,
    paintMines,
    showMineLabel,
    showNumbers,
    type DisplayMode,
    type DisplayModeKeyEvent
} from './displayMode';

const MODES: readonly DisplayMode[] = ['picture', 'numbers', 'both'];

describe('display mode parameters of the spec', () => {
    it('starts in 数字 and shows the labels 絵, 数字, 両方', () => {
        expect(DISPLAY_MODE_DEFAULT).toBe('numbers');
        expect(DISPLAY_MODE_LABEL).toEqual({ picture: '絵', numbers: '数字', both: '両方' });
    });
});

describe('displayModeButtonLabel', () => {
    it('shows the current mode on the sidebar button, e.g. 表示: 数字', () => {
        expect(displayModeButtonLabel('picture')).toBe('表示: 絵');
        expect(displayModeButtonLabel('numbers')).toBe('表示: 数字');
        expect(displayModeButtonLabel('both')).toBe('表示: 両方');
    });
});

describe('nextDisplayMode', () => {
    it('cycles 絵 → 数字 → 両方 → 絵', () => {
        expect(nextDisplayMode('picture')).toBe('numbers');
        expect(nextDisplayMode('numbers')).toBe('both');
        expect(nextDisplayMode('both')).toBe('picture');
    });

    it('comes back to the start after three presses from any mode', () => {
        for (const mode of MODES) {
            expect(nextDisplayMode(nextDisplayMode(nextDisplayMode(mode)))).toBe(mode);
        }
    });
});

describe('showNumbers', () => {
    it.each([
        // [mode, cell side, expected] — the 20 px boundary: 19 hides, 20 shows
        ['picture', 6, false],
        ['picture', 20, false],
        ['picture', 64, false],
        ['numbers', 19, false],
        ['numbers', 20, true],
        ['numbers', 32, true],
        ['both', 19, false],
        ['both', 20, true],
        ['both', 64, true]
    ] as const)('in %s at %i px gives %s', (mode, side, expected) => {
        expect(showNumbers(mode, side)).toBe(expected);
    });
});

describe('showMineLabel', () => {
    it.each([
        ['picture', 32, false],
        ['numbers', 19, false],
        ['numbers', 20, true],
        ['numbers', 64, true],
        ['both', 20, false],
        ['both', 64, false]
    ] as const)('in %s at %i px gives %s', (mode, side, expected) => {
        expect(showMineLabel(mode, side)).toBe(expected);
    });
});

describe('paintMines', () => {
    it.each([
        ['picture', 6, true],
        ['picture', 32, true],
        ['numbers', 19, true],
        ['numbers', 20, false],
        ['both', 6, true],
        ['both', 64, true]
    ] as const)('in %s at %i px gives %s', (mode, side, expected) => {
        expect(paintMines(mode, side)).toBe(expected);
    });
});

describe('isPaleCell', () => {
    const plain = { hasMine: false, isStart: false, isForbidden: false };

    it('makes a plain non-mine cell pale only in 絵', () => {
        expect(isPaleCell('picture', plain)).toBe(true);
        expect(isPaleCell('numbers', plain)).toBe(false);
        expect(isPaleCell('both', plain)).toBe(false);
    });

    it('never makes a mine, the start cell or a forbidden cell pale', () => {
        for (const mode of MODES) {
            expect(isPaleCell(mode, { ...plain, hasMine: true })).toBe(false);
            expect(isPaleCell(mode, { ...plain, isStart: true })).toBe(false);
            expect(isPaleCell(mode, { ...plain, isForbidden: true })).toBe(false);
        }
    });
});

describe('isDisplayModeKey', () => {
    const key = (k: string, mods: Partial<DisplayModeKeyEvent> = {}): DisplayModeKeyEvent => ({
        key: k,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        ...mods
    });

    it('accepts M and m', () => {
        expect(isDisplayModeKey(key('m'), false)).toBe(true);
        expect(isDisplayModeKey(key('M'), false)).toBe(true);
    });

    it('ignores other keys', () => {
        expect(isDisplayModeKey(key('n'), false)).toBe(false);
        expect(isDisplayModeKey(key(' '), false)).toBe(false);
    });

    it('does nothing while typing in an input (W or H)', () => {
        expect(isDisplayModeKey(key('m'), true)).toBe(false);
    });

    it('does nothing with ctrl, meta or alt held', () => {
        expect(isDisplayModeKey(key('m', { ctrlKey: true }), false)).toBe(false);
        expect(isDisplayModeKey(key('m', { metaKey: true }), false)).toBe(false);
        expect(isDisplayModeKey(key('m', { altKey: true }), false)).toBe(false);
    });
});
