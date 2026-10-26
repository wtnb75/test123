import { describe, expect, it } from 'vitest';
import { blinkCount, lifeText, shouldHideHint } from './hud';

describe('shouldHideHint', () => {
    it('keeps the hint at 2.99 s while the paddle has not moved', () => {
        expect(shouldHideHint(2.99, false)).toBe(false);
    });

    it('hides it at exactly 3.0 s', () => {
        expect(shouldHideHint(3.0, false)).toBe(true);
    });

    it('hides it as soon as the paddle moves, even at 0 s', () => {
        expect(shouldHideHint(0, true)).toBe(true);
    });
});

describe('blinkCount', () => {
    it('blinks just the newly lost heart when no blink is running', () => {
        expect(blinkCount(false, 0, 1)).toBe(1);
    });

    it('a loss during a blink adds to the hearts already blinking (3->2, then 2->1 -> 2)', () => {
        expect(blinkCount(true, 1, 1)).toBe(2);
    });

    it('a loss after the blink ended counts again from the new loss (the earlier 1 is not carried)', () => {
        expect(blinkCount(false, 1, 1)).toBe(1);
    });

    it('two lives lost in one frame blink together', () => {
        expect(blinkCount(false, 0, 2)).toBe(2);
    });
});

describe('lifeText', () => {
    it('shows the remaining hearts', () => {
        expect(lifeText(2, 0)).toBe('LIFE ♥♥');
    });

    it('adds the blinking lost hearts during the "on" half of a blink', () => {
        expect(lifeText(2, 1)).toBe('LIFE ♥♥♥');
    });

    it('shows just LIFE with no hearts left', () => {
        expect(lifeText(0, 0)).toBe('LIFE');
    });

    it('still shows the last lost heart blinking at 0 lives', () => {
        expect(lifeText(0, 1)).toBe('LIFE ♥');
    });
});
