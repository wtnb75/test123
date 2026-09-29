import { describe, expect, it } from 'vitest';
import {
    BUTTON_COLOR, BUTTON_EMPTY_COLOR, ButtonEffects, buttonColor, buttonFillAlpha, buttonPressKind, buttonRadius,
    buttonRestFillAlpha, buttonRestStrokeAlpha, buttonStrokeAlpha
} from './buttonFx';

// Expected values are worked out by hand from docs/spec/effects.md "演出・UI（解放ボタン）": 0.12 s long;
// a press shrinks the 56 px circle to 0.85x (47.6 px) and starts at fill 0.7; an empty press starts red
// (#ff5252) at fill 0.6 / outline 1 and blends back to the button colour 0x4dd0e1 (mid: (166, 145, 154)).
// Resting look: fill 0.35 / outline 0.9 with stock, 0.12 / 0.4 without.

describe('which feedback a release finger gets', () => {
    it.each([
        ['playing', 1, 'press'],
        ['playing', 50, 'press'],
        ['playing', 0, 'empty'],
        ['ready', 0, 'empty'],
        ['ready', 20, 'empty'],
        ['ending', 10, null],
        ['ending', 0, null],
        ['over', 10, null]
    ] as const)('in %s with stock %i is %s', (phase, stock, expected) => {
        expect(buttonPressKind(phase, stock)).toBe(expected);
    });
});

describe('resting look', () => {
    it('is brighter with something to release', () => {
        expect(buttonRestFillAlpha(1)).toBe(0.35);
        expect(buttonRestStrokeAlpha(1)).toBe(0.9);
        expect(buttonRestFillAlpha(0)).toBe(0.12);
        expect(buttonRestStrokeAlpha(0)).toBe(0.4);
    });

    it('is drawn when no feedback is playing', () => {
        expect(buttonRadius(Infinity, 'press')).toBe(56);
        expect(buttonColor(Infinity, 'empty')).toBe(BUTTON_COLOR);
        expect(buttonFillAlpha(Infinity, 'press', 5)).toBe(0.35);
        expect(buttonStrokeAlpha(Infinity, 'empty', 0)).toBe(0.4);
    });
});

describe('press feedback', () => {
    it('starts at 47.6 px and fill 0.7, keeping the colour and outline', () => {
        expect(buttonRadius(0, 'press')).toBeCloseTo(47.6);
        expect(buttonFillAlpha(0, 'press', 0)).toBeCloseTo(0.7);
        expect(buttonColor(0, 'press')).toBe(BUTTON_COLOR);
        expect(buttonStrokeAlpha(0, 'press', 0)).toBe(0.4);
    });

    it('is halfway at 0.06 s: 51.8 px, fill 0.41 with no stock and 0.525 with stock', () => {
        expect(buttonRadius(0.06, 'press')).toBeCloseTo(51.8);
        expect(buttonFillAlpha(0.06, 'press', 0)).toBeCloseTo(0.41);
        expect(buttonFillAlpha(0.06, 'press', 5)).toBeCloseTo(0.525);
    });

    it('is still visible just before 0.12 s and back to rest at exactly 0.12 s', () => {
        expect(buttonRadius(0.1199, 'press')).toBeLessThan(56);
        expect(buttonFillAlpha(0.1199, 'press', 0)).toBeGreaterThan(0.12);
        expect(buttonRadius(0.12, 'press')).toBe(56);
        expect(buttonFillAlpha(0.12, 'press', 0)).toBe(0.12);
    });

    it('keeps the outline at its resting value for the whole press, with or without stock', () => {
        expect(buttonStrokeAlpha(0.06, 'press', 5)).toBe(0.9);
        expect(buttonStrokeAlpha(0.1199, 'press', 5)).toBe(0.9);
        expect(buttonStrokeAlpha(0.06, 'press', 0)).toBe(0.4);
    });

    it('follows the current stock as it grows during the feedback', () => {
        expect(buttonFillAlpha(0.12 - 1e-9, 'press', 3)).toBeCloseTo(0.35, 6);
    });
});

describe('empty feedback', () => {
    it('starts red with fill 0.6 and outline 1, without changing the size', () => {
        expect(buttonColor(0, 'empty')).toBe(BUTTON_EMPTY_COLOR);
        expect(buttonColor(0, 'empty')).toBe(0xff5252);
        expect(buttonFillAlpha(0, 'empty', 0)).toBeCloseTo(0.6);
        expect(buttonStrokeAlpha(0, 'empty', 0)).toBeCloseTo(1);
        expect(buttonRadius(0, 'empty')).toBe(56);
        expect(buttonRadius(0.06, 'empty')).toBe(56);
    });

    it('is halfway at 0.06 s: colour (166, 145, 154), fill 0.36 and outline 0.7 with no stock', () => {
        expect(buttonColor(0.06, 'empty')).toBe(0xa6919a);
        expect(buttonFillAlpha(0.06, 'empty', 0)).toBeCloseTo(0.36);
        expect(buttonStrokeAlpha(0.06, 'empty', 0)).toBeCloseTo(0.7);
    });

    it('blends toward the resting look of the current stock: fill 0.475 and outline 0.95 at 0.06 s with stock', () => {
        expect(buttonFillAlpha(0.06, 'empty', 5)).toBeCloseTo(0.475);
        expect(buttonStrokeAlpha(0.06, 'empty', 5)).toBeCloseTo(0.95);
    });

    it('is back to the button colour and resting look at exactly 0.12 s', () => {
        expect(buttonColor(0.12, 'empty')).toBe(0x4dd0e1);
        expect(buttonFillAlpha(0.12, 'empty', 0)).toBe(0.12);
        expect(buttonStrokeAlpha(0.12, 'empty', 0)).toBe(0.4);
        expect(buttonColor(0.11, 'empty')).not.toBe(0x4dd0e1);
    });
});

describe('button effect state', () => {
    it('starts a press at age 0 on the frame it is given, then counts up', () => {
        const fx = new ButtonEffects();
        expect(fx.playing).toBe(false);
        fx.update(0.05, 'press');
        expect(fx.age).toBe(0);
        expect(fx.kind).toBe('press');
        expect(fx.playing).toBe(true);
        fx.update(0.05, null);
        expect(fx.age).toBeCloseTo(0.05);
        expect(fx.playing).toBe(true);
    });

    it('stops playing at exactly 0.12 s', () => {
        const fx = new ButtonEffects();
        fx.update(0.016, 'empty');
        fx.update(0.119, null);
        expect(fx.playing).toBe(true);
        fx.update(0.001, null);
        expect(fx.playing).toBe(false);
    });

    it('restarts from 0 with the new kind when pressed again mid-way', () => {
        const fx = new ButtonEffects();
        fx.update(0.016, 'press');
        fx.update(0.06, null);
        fx.update(0.016, 'empty');
        expect(fx.age).toBe(0);
        expect(fx.kind).toBe('empty');
    });

    it('does not start anything without a press, and clear() stops it', () => {
        const fx = new ButtonEffects();
        fx.update(1, null);
        expect(fx.playing).toBe(false);
        fx.update(0.016, 'press');
        fx.clear();
        expect(fx.playing).toBe(false);
        expect(fx.age).toBe(Infinity);
    });

    it('does not move when no time passes (a paused frame gives dt 0)', () => {
        const fx = new ButtonEffects();
        fx.update(0.016, 'press');
        fx.update(0.05, null);
        const age = fx.age;
        fx.update(0, null);
        expect(fx.age).toBe(age);
    });
});
