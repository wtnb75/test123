import { describe, expect, it } from 'vitest';
import { CONFETTI_COUNT } from '../params';
import {
    barMarkerY,
    confettiParticle,
    dangerAlpha,
    endingDangerAlpha,
    goalBlinkAlpha,
    moveEvents,
    platformDrawWidth,
    platformEffectAlpha,
    playerLook,
    pulsedWarnTriangle,
    puffOffsets,
    puffParams,
    warnPulseScale,
} from './effects';
import { type Platform, platformAlpha } from './physics';

// Expected values are hand-worked from docs/spec.md "テスト観点" (演出), not read back from the implementation.

const built = (age: number): Platform => ({ kind: 'built', x: 100, y: 100, w: 80, h: 10, age });

describe('dangerAlpha (bottom band: 0 at 100 px above the bottom edge, 0.5 at the edge)', () => {
    const bottom = 528;
    it('is 0 at 101 and 100 px above the bottom edge', () => {
        expect(dangerAlpha(bottom - 101, bottom)).toBe(0);
        expect(dangerAlpha(bottom - 100, bottom)).toBe(0);
    });

    it('grows in proportion: 50 px above is 0.25, the edge itself is 0.5', () => {
        expect(dangerAlpha(bottom - 50, bottom)).toBeCloseTo(0.25, 10);
        expect(dangerAlpha(bottom, bottom)).toBeCloseTo(0.5, 10);
    });

    it('stays at 0.5 below the edge', () => {
        expect(dangerAlpha(bottom + 30, bottom)).toBeCloseTo(0.5, 10);
    });
});

describe('endingDangerAlpha (left-behind: max and half in turn every 0.1 s)', () => {
    it('is 0.5, 0.25, 0.5 at the middle of the first three intervals', () => {
        expect(endingDangerAlpha(0.05)).toBe(0.5);
        expect(endingDangerAlpha(0.15)).toBe(0.25);
        expect(endingDangerAlpha(0.25)).toBe(0.5);
    });

    it('starts at the max at t = 0', () => {
        expect(endingDangerAlpha(0)).toBe(0.5);
    });
});

describe('barMarkerY (progress bar: bottom H - 16 at 0 m, top 56 at 200 m)', () => {
    it('H = 528: 0 m -> 512, 100 m -> 284, 200 m -> 56', () => {
        expect(barMarkerY(0, 528)).toBe(512);
        expect(barMarkerY(100, 528)).toBeCloseTo(284, 10);
        expect(barMarkerY(200, 528)).toBeCloseTo(56, 10);
    });

    it('clamps above the goal and below the start', () => {
        expect(barMarkerY(250, 528)).toBeCloseTo(56, 10);
        expect(barMarkerY(-5, 528)).toBe(512);
    });

    it('H = 779: 0 m -> 763, 200 m -> 56', () => {
        expect(barMarkerY(0, 779)).toBe(763);
        expect(barMarkerY(200, 779)).toBeCloseTo(56, 10);
    });
});

describe('playerLook', () => {
    it('after a hit blinks red, normal, red at the middle of each 0.1 s interval', () => {
        expect(playerLook('hit', 0.05)).toBe('red');
        expect(playerLook('hit', 0.15)).toBe('normal');
        expect(playerLook('hit', 0.25)).toBe('red');
    });

    it('starts red at t = 0 after a hit', () => {
        expect(playerLook('hit', 0)).toBe('red');
    });

    it('stays normal after a left-behind, a clear, and while playing', () => {
        expect(playerLook('left-behind', 0.05)).toBe('normal');
        expect(playerLook('clear', 0.05)).toBe('normal');
        expect(playerLook(null, 0.05)).toBe('normal');
    });
});

describe('goalBlinkAlpha', () => {
    it('is 1, 0.4, 1 at the middle of the first three intervals', () => {
        expect(goalBlinkAlpha(0.05)).toBe(1);
        expect(goalBlinkAlpha(0.15)).toBe(0.4);
        expect(goalBlinkAlpha(0.25)).toBe(1);
    });
});

describe('confettiParticle (start point (0, 0), y grows downward)', () => {
    it('piece 0 (angle -3.0762 rad, speed 160) is at (-79.83, 44.77) at t = 0.5', () => {
        const c = confettiParticle(0, 0.5);
        expect(c.x).toBeCloseTo(-79.83, 2);
        expect(c.y).toBeCloseTo(44.77, 2);
    });

    it('piece 12 (angle -1.5053 rad, speed 160) is at (4.19, -31.86) at t = 0.4', () => {
        const c = confettiParticle(12, 0.4);
        expect(c.x).toBeCloseTo(4.19, 2);
        expect(c.y).toBeCloseTo(-31.86, 2);
    });

    it('piece 1 is faster (200 px/s): (-19.62, -1.90) at t = 0.1', () => {
        const c = confettiParticle(1, 0.1);
        expect(c.x).toBeCloseTo(-19.62, 2);
        expect(c.y).toBeCloseTo(-1.9, 2);
    });

    it('piece 2 is the fastest of the three speeds (240 px/s): (-22.73, -5.71) at t = 0.1', () => {
        // angle -2.8143 rad: cos -0.94693, sin -0.32144; y = 240 x -0.32144 x 0.1 + 0.5 x 400 x 0.01
        const c = confettiParticle(2, 0.1);
        expect(c.x).toBeCloseTo(-22.73, 2);
        expect(c.y).toBeCloseTo(-5.71, 2);
    });

    it('repeats the three speeds every three pieces: piece 3 flies at 160 again', () => {
        // piece 3: angle -2.6836 rad, sin -0.44228; y = 160 x -0.44228 x 0.1 + 2 = -5.0765
        expect(confettiParticle(3, 0.1).y).toBeCloseTo(-5.08, 2);
    });

    it('fades from 1 at t = 0, to 0.5 at 0.4 s, to 0 at 0.8 s and stays 0 after', () => {
        expect(confettiParticle(0, 0).alpha).toBe(1);
        expect(confettiParticle(0, 0.4).alpha).toBeCloseTo(0.5, 10);
        expect(confettiParticle(0, 0.8).alpha).toBeCloseTo(0, 10);
        expect(confettiParticle(0, 0.9).alpha).toBe(0);
    });

    it('starts at the origin, and all 24 pieces fly upward at first (upper half)', () => {
        expect(CONFETTI_COUNT).toBe(24);
        for (let i = 0; i < CONFETTI_COUNT; i++) {
            const start = confettiParticle(i, 0);
            if (start.x !== 0 || start.y !== 0) expect.fail(`piece ${i} does not start at the origin`);
            if (confettiParticle(i, 0.001).y >= 0) expect.fail(`piece ${i} does not go up`);
        }
    });

    it('spreads left to right: the first piece goes left, the last goes right', () => {
        expect(confettiParticle(0, 0.1).x).toBeLessThan(0);
        expect(confettiParticle(CONFETTI_COUNT - 1, 0.1).x).toBeGreaterThan(0);
    });
});

describe('moveEvents (jump and landing from the player before and after a frame)', () => {
    it('is a jump: on the ground before, in the air going up after (vy -535)', () => {
        expect(moveEvents({ onGround: true, vy: 0 }, { onGround: false, vy: -535 })).toBe('jump');
    });

    it('is a landing after a fall of 200 px/s', () => {
        expect(moveEvents({ onGround: false, vy: 200 }, { onGround: true, vy: 0 })).toBe('land');
    });

    it('needs a fall of 150 px/s: 149.9 is nothing, 150 is a landing', () => {
        expect(moveEvents({ onGround: false, vy: 149.9 }, { onGround: true, vy: 0 })).toBeNull();
        expect(moveEvents({ onGround: false, vy: 150 }, { onGround: true, vy: 0 })).toBe('land');
    });

    it('is nothing when walking off a platform edge (on the ground, then falling at +25)', () => {
        expect(moveEvents({ onGround: true, vy: 0 }, { onGround: false, vy: 25 })).toBeNull();
    });

    it('is nothing while on the ground or in the air throughout', () => {
        expect(moveEvents({ onGround: true, vy: 0 }, { onGround: true, vy: 0 })).toBeNull();
        expect(moveEvents({ onGround: false, vy: 300 }, { onGround: false, vy: 325 })).toBeNull();
    });
});

describe('puffParams (dust circle: radius 3 -> 8, opacity 0.6 -> 0 over 0.25 s)', () => {
    it('starts with radius 3 and opacity 0.6', () => {
        expect(puffParams(0)).toEqual({ radius: 3, alpha: 0.6 });
    });

    it('is radius 5.5 and opacity 0.3 at the middle (0.125 s)', () => {
        const p = puffParams(0.125);
        expect(p?.radius).toBeCloseTo(5.5, 10);
        expect(p?.alpha).toBeCloseTo(0.3, 10);
    });

    it('is nearly gone just before 0.25 s (radius 7.98, opacity 0.0024) and gone from 0.25 s', () => {
        const p = puffParams(0.249);
        expect(p?.radius).toBeCloseTo(7.98, 2);
        expect(p?.alpha).toBeCloseTo(0.0024, 4);
        expect(puffParams(0.25)).toBeNull();
        expect(puffParams(1)).toBeNull();
    });

    it('does not go below the start for a negative time', () => {
        expect(puffParams(-0.1)).toEqual({ radius: 3, alpha: 0.6 });
    });

    it('places four circles at -12, -4, +4, +12 from the feet', () => {
        expect(puffOffsets()).toEqual([-12, -4, 4, 12]);
    });
});

describe('platformDrawWidth (a built platform grows to 80 px over 0.1 s)', () => {
    it('is 0 at age 0, 40 at 0.05 s, 80 at 0.1 s and after', () => {
        expect(platformDrawWidth(0)).toBe(0);
        expect(platformDrawWidth(0.05)).toBeCloseTo(40, 10);
        expect(platformDrawWidth(0.1)).toBe(80);
        expect(platformDrawWidth(2)).toBe(80);
    });

    it('is 0 for a negative age', () => {
        expect(platformDrawWidth(-1)).toBe(0);
    });

    it('is 13.3 px on the frame a platform is built (age = dt = 1/60 s)', () => {
        expect(platformDrawWidth(1 / 60)).toBeCloseTo(13.33, 2);
    });
});

describe('platformEffectAlpha (the last 0.5 s of a built platform blinks)', () => {
    it('follows the life fade before 2.5 s', () => {
        expect(platformEffectAlpha(built(2.45))).toBeCloseTo(platformAlpha(built(2.45)), 10);
        expect(platformEffectAlpha(built(0))).toBe(1);
    });

    it('blinks normal, 0.15, normal, 0.15, normal at the middle of the intervals from 2.5 s', () => {
        expect(platformEffectAlpha(built(2.55))).toBeCloseTo(0.405, 3);
        expect(platformEffectAlpha(built(2.65))).toBe(0.15);
        expect(platformEffectAlpha(built(2.75))).toBeCloseTo(0.3583, 3); // 1 - 0.7 x 2.75 / 3
        expect(platformEffectAlpha(built(2.85))).toBe(0.15);
        expect(platformEffectAlpha(built(2.95))).toBeCloseTo(0.3117, 3); // 1 - 0.7 x 2.95 / 3
    });

    it('never blinks the start ground and the goal', () => {
        for (const kind of ['ground', 'goal'] as const) {
            expect(platformEffectAlpha({ ...built(2.65), kind })).toBe(1);
        }
    });
});

describe('warnPulseScale (the last 0.3 s: 1.0 -> 1.25 -> 1.0 every 0.15 s)', () => {
    it.each([
        [0.5, 1],
        [0.3, 1],
        [0.225, 1.25],
        [0.15, 1],
        [0.075, 1.25],
        [0, 1],
    ])('with %f s left the scale is %f', (remaining, scale) => {
        expect(warnPulseScale(remaining)).toBeCloseTo(scale, 10);
    });

    it('does not pulse below 0 remaining (clamped)', () => {
        expect(warnPulseScale(-0.1)).toBeCloseTo(1, 10);
    });
});

describe('pulsedWarnTriangle (scaled about the centre, shifted to stay inside the screen)', () => {
    const tilt = Math.atan2(110, 200); // 28.8 deg
    const minX = (pts: [number, number][]) => Math.min(...pts.map((p) => p[0]));
    const maxX = (pts: [number, number][]) => Math.max(...pts.map((p) => p[0]));

    it('scales the vertical triangle: tip 11 x 1.25 below the centre line, no shift at x = 14', () => {
        const pts = pulsedWarnTriangle(14, 0, 1.25);
        expect(pts[2][0]).toBeCloseTo(14, 10);
        expect(pts[2][1]).toBeCloseTo(57.75, 10); // 44 + 11 x 1.25
        expect(minX(pts)).toBeCloseTo(2.75, 10); // 14 - 9 x 1.25: inside, so not moved
    });

    it('shifts a tilted triangle at x = 14, scale 1.25, right by 1.28 so its left edge is at 0', () => {
        const pts = pulsedWarnTriangle(14, tilt, 1.25);
        expect(minX(pts)).toBeCloseTo(0, 6);
        expect(pts[2][0]).toBeCloseTo(21.9, 1); // 14 + 13.75 x sin(28.8 deg) + 1.28
    });

    it('shifts left at the right edge: x = 346, mirrored tilt, scale 1.25 -> right edge at 360', () => {
        const pts = pulsedWarnTriangle(346, -tilt, 1.25);
        expect(maxX(pts)).toBeCloseTo(360, 6);
    });

    it('does not move a triangle that fits at scale 1 (x = 14, left edge 1.78)', () => {
        const pts = pulsedWarnTriangle(14, tilt, 1);
        expect(minX(pts)).toBeCloseTo(14 - 12.22, 1);
        expect(pts[2][0]).toBeCloseTo(19.3, 1); // 14 + 11 x sin(28.8 deg)
    });
});
