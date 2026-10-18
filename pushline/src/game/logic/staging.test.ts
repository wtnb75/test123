import { describe, expect, it } from 'vitest';
import { NEXT_EFFECT_MS, growthEndMs, spawnDelayMs, STAGING_END_MS } from './staging';
import { FIXED, MOVABLE, type MoveResult } from './types';

type Staged = Pick<MoveResult, 'spawned' | 'relocated'>;

const none: Staged = { spawned: [], relocated: [] };

describe('staging timeline (docs/spec/effects.md, hand-worked values)', () => {
    it('starts the rest 370 ms after the push: 150 ms glow + 220 ms shrink', () => {
        expect(NEXT_EFFECT_MS).toBe(370);
    });

    it('ends the last effect (thinning: 4 x 120 ms blink + 500 ms fade) at 1350 ms', () => {
        expect(STAGING_END_MS).toBe(1350);
    });

    it('pops a new block in at 370 ms', () => {
        expect(spawnDelayMs(none, { x: 1, y: 1 })).toBe(370);
    });

    it('pops a relocated fixed block in at 480 ms (110 ms after its old cell starts shrinking)', () => {
        const res: Staged = { spawned: [], relocated: [{ from: { x: 0, y: 0 }, to: { x: 3, y: 2 } }] };
        expect(spawnDelayMs(res, { x: 3, y: 2 })).toBe(480);
    });

    it('does not delay a block at another cell than the relocation target', () => {
        const res: Staged = { spawned: [], relocated: [{ from: { x: 0, y: 0 }, to: { x: 3, y: 2 } }] };
        expect(spawnDelayMs(res, { x: 2, y: 3 })).toBe(370);
        expect(spawnDelayMs(res, { x: 3, y: 3 })).toBe(370);
    });

    it('ends growing at 590 ms when only new blocks appear', () => {
        const res: Staged = { spawned: [{ x: 1, y: 1, kind: MOVABLE }, { x: 2, y: 2, kind: FIXED }], relocated: [] };
        expect(growthEndMs(res)).toBe(590);
    });

    it('ends growing at 700 ms when a relocated block appears too', () => {
        const res: Staged = {
            spawned: [{ x: 1, y: 1, kind: MOVABLE }, { x: 3, y: 2, kind: FIXED }],
            relocated: [{ from: { x: 0, y: 0 }, to: { x: 3, y: 2 } }],
        };
        expect(growthEndMs(res)).toBe(700);
    });

    it('has nothing to wait for when no block appears', () => {
        expect(growthEndMs(none)).toBe(0);
    });
});
