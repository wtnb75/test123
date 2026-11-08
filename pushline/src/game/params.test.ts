import { describe, expect, it } from 'vitest';
import { PARAMS } from './params';

describe('Title regression (docs/spec.md 完了条件: the demo must not change these)', () => {
    it('leaves the Start pulse and the scene fade as they were before the demo existed', () => {
        expect(PARAMS.startPulseMs).toBe(1200);
        expect(PARAMS.startPulseScale).toBe(1.05);
        expect(PARAMS.sceneFadeMs).toBe(150);
    });
});

describe('how-to-play hint parameters (docs/spec/effects.md パラメータ表)', () => {
    it('starts from the spec values: 6000 ms shown, 300 ms fades, 28 px text', () => {
        expect(PARAMS.howToPlayShowMs).toBe(6000);
        expect(PARAMS.howToPlayFadeMs).toBe(300);
        expect(PARAMS.howToPlayFontPx).toBe(28);
    });

    it('keeps the fade in and the fade out from overlapping (each at most half the shown time)', () => {
        expect(2 * PARAMS.howToPlayFadeMs).toBeLessThanOrEqual(PARAMS.howToPlayShowMs);
    });
});
