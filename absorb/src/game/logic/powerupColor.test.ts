import { describe, expect, it } from 'vitest';
import { KIND_COLORS } from '../scenes/colors';
import { POWERUP_COLOR } from './constants';

// docs/spec/powerup.md: the item, the boosted edge and the pickup ring must be told apart from every enemy kind's colour
// (the boss's amber 0xffd54f was the close one).

const channels = (c: number): [number, number, number] => [(c >> 16) & 0xff, (c >> 8) & 0xff, c & 0xff];
const distance = (a: number, b: number): number => {
    const [ar, ag, ab] = channels(a);
    const [br, bg, bb] = channels(b);
    return Math.hypot(ar - br, ag - bg, ab - bb);
};

describe('the reward colour', () => {
    it.each(Object.entries(KIND_COLORS))('is at least 60 apart (RGB distance) from the %s colour', (_kind, colour) => {
        expect(distance(POWERUP_COLOR, colour)).toBeGreaterThanOrEqual(60);
    });
});
