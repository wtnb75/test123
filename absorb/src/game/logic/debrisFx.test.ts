import { describe, expect, it } from 'vitest';
import {
    DebrisEffects, debrisAngle, debrisColor, debrisDistance, debrisPieceX, debrisPieceY, debrisProgress, debrisRadius,
    whiten, type DebrisBurst
} from './debrisFx';
import type { Defeat } from './world';

// Expected values below are worked out by hand from the spec's parameters: 8 pieces, launched at
// 240 px/s and slowing linearly to a stop over 0.4 s (distance 240 * 0.4 * (u - u² / 2), so 36 px
// halfway and 48 px at the end), radius 4 px shrinking to 0.

describe('a debris burst over time', () => {
    it('shows from t = 0 up to, but not including, 0.4 s', () => {
        expect(debrisProgress(0)).toBe(0);
        expect(debrisProgress(0.2)).toBe(0.5);
        expect(debrisProgress(0.3999)).toBeGreaterThan(0.99);
        expect(debrisProgress(0.4)).toBe(-1);
        expect(debrisProgress(-0.01)).toBe(-1);
    });

    it('flies out from the kill point, 36 px halfway and approaching 48 px as it stops', () => {
        expect(debrisDistance(0)).toBe(0);
        expect(debrisDistance(0.5)).toBeCloseTo(36);
        expect(debrisDistance(0.9999)).toBeCloseTo(48, 3);
    });

    it('slows down: the second half covers a third of the first half', () => {
        const first = debrisDistance(0.5) - debrisDistance(0);
        // u = 1 is never drawn; it is only the limit the distance approaches.
        const second = debrisDistance(1) - debrisDistance(0.5);
        expect(second / first).toBeCloseTo(1 / 3);
    });

    it('shrinks from 4 px toward zero', () => {
        expect(debrisRadius(0)).toBe(4);
        expect(debrisRadius(0.5)).toBe(2);
    });
});

describe('debris directions', () => {
    it('sends piece 0 along the killing bullet heading', () => {
        expect(debrisAngle(1.25, 0)).toBe(1.25);
    });

    it('spaces the 8 pieces 45° apart, clockwise on screen', () => {
        expect(debrisAngle(0, 1)).toBeCloseTo(Math.PI / 4);
        expect(debrisAngle(-Math.PI / 2, 2)).toBeCloseTo(0);
        expect(debrisAngle(0, 4)).toBeCloseTo(Math.PI);
        expect(debrisAngle(0.3, 7)).toBeCloseTo(0.3 + (Math.PI * 7) / 4);
    });
});

describe('debris colors', () => {
    // Rammer body 0xef5350 = (239, 83, 80). Pushed toward 255 by w: c + (255 - c) × w, rounded.
    const RAMMER = 0xef5350;

    it('keeps the body color at 0 and gives white at 1', () => {
        expect(whiten(RAMMER, 0)).toBe(RAMMER);
        expect(whiten(RAMMER, 1)).toBe(0xffffff);
    });

    it('moves a quarter of the way to white at 0.25', () => {
        // (239 + 16 × 0.25, 83 + 172 × 0.25, 80 + 175 × 0.25) = (243, 126, 123.75 -> 124)
        expect(whiten(RAMMER, 0.25)).toBe(0xf37e7c);
    });

    it('lightens rammer debris halfway to white by default, rounding halves up', () => {
        // (247, 169, 167.5 -> 168)
        expect(debrisColor('rammer', RAMMER)).toBe(0xf7a9a8);
    });

    it('lightens rammer debris by the given amount, a quarter at 0.25', () => {
        expect(debrisColor('rammer', RAMMER, 0.25)).toBe(0xf37e7c);
    });

    it('leaves grunt, shooter and heavy debris in their body color whatever the amount', () => {
        expect(debrisColor('grunt', 0x66bb6a)).toBe(0x66bb6a);
        expect(debrisColor('shooter', 0xffa726, 1)).toBe(0xffa726);
        expect(debrisColor('heavy', 0xab47bc, 1)).toBe(0xab47bc);
    });

    // 0xff5252 is COLORS.enemyBullet in Game.ts; this records why rammer debris is lightened.
    it('never makes rammer debris the enemy bullet red', () => {
        expect(debrisColor('rammer', RAMMER)).not.toBe(0xff5252);
    });
});

describe('where each debris piece is', () => {
    const burst: DebrisBurst = { x: 100, y: 50, kind: 'grunt', heading: 0, age: 0 };

    it('starts every piece at the kill point', () => {
        for (let i = 0; i < 8; i++) {
            expect(debrisPieceX(burst, i, 0)).toBeCloseTo(100);
            expect(debrisPieceY(burst, i, 0)).toBeCloseTo(50);
        }
    });

    it('puts pieces 36 px out halfway, piece 2 straight down the screen and piece 4 opposite piece 0', () => {
        expect(debrisPieceX(burst, 0, 0.5)).toBeCloseTo(136);
        expect(debrisPieceY(burst, 0, 0.5)).toBeCloseTo(50);
        expect(debrisPieceX(burst, 2, 0.5)).toBeCloseTo(100);
        expect(debrisPieceY(burst, 2, 0.5)).toBeCloseTo(86);
        expect(debrisPieceX(burst, 4, 0.5)).toBeCloseTo(64);
        expect(debrisPieceY(burst, 4, 0.5)).toBeCloseTo(50);
    });

    it('follows the killing bullet heading for piece 0', () => {
        const up: DebrisBurst = { ...burst, heading: -Math.PI / 2 };
        expect(debrisPieceX(up, 0, 0.5)).toBeCloseTo(100);
        expect(debrisPieceY(up, 0, 0.5)).toBeCloseTo(14);
    });
});

describe('tracking debris bursts', () => {
    const kill = (x: number, kind: Defeat['kind'] = 'grunt'): Defeat => ({ x, y: 10, kind, heading: 0.5 });

    it('starts with nothing playing', () => {
        expect(new DebrisEffects().bursts).toHaveLength(0);
    });

    it('starts one burst per killed enemy at t = 0 in the frame of the kill', () => {
        const fx = new DebrisEffects();
        fx.update(0.016, [kill(1, 'heavy'), kill(2, 'rammer')]);
        expect(fx.bursts).toEqual([
            { x: 1, y: 10, kind: 'heavy', heading: 0.5, age: 0 },
            { x: 2, y: 10, kind: 'rammer', heading: 0.5, age: 0 }
        ]);
    });

    it('ages each burst on its own and drops it exactly at 0.4 s', () => {
        const fx = new DebrisEffects();
        fx.update(0.016, [kill(1)]);
        fx.update(0.2, [kill(2)]);
        expect(fx.bursts.map((b) => b.age)).toEqual([0.2, 0]);
        fx.update(0.2, []);
        expect(fx.bursts.map((b) => b.x)).toEqual([2]);
        fx.update(0.1999, []);
        expect(fx.bursts).toHaveLength(1);
        fx.update(0.0001, []);
        expect(fx.bursts).toHaveLength(0);
    });

    it('clears everything on demand, as a restart does', () => {
        const fx = new DebrisEffects();
        fx.update(0.016, [kill(1)]);
        fx.clear();
        expect(fx.bursts).toHaveLength(0);
    });
});
