import { describe, expect, it } from 'vitest';
import { ballText, chargeColor, ghostBall, scoreBumpScale, scoreText, stageText } from './hud';

describe('HUD texts', () => {
    it('writes SCORE n', () => {
        expect(scoreText(0)).toBe('SCORE 0');
        expect(scoreText(12340)).toBe('SCORE 12340');
    });

    it('writes one ● per remaining ball', () => {
        expect(ballText(3)).toBe('BALL ●●●');
        expect(ballText(1)).toBe('BALL ●');
    });

    it('writes BALL alone with no balls, and never fails on a negative count', () => {
        expect(ballText(0)).toBe('BALL ');
        expect(ballText(-1)).toBe('BALL ');
    });

    it('shows the lost ball\'s dot while it blinks: ballText(remaining, ghost)', () => {
        expect(ballText(3, 0)).toBe('BALL ●●●');
        expect(ballText(2, 1)).toBe('BALL ●●●');
        expect(ballText(2, 0)).toBe('BALL ●●');
        expect(ballText(1, 1)).toBe('BALL ●●');
        expect(ballText(0, 1)).toBe('BALL ●');
    });

    it('writes the stage as n/5', () => {
        expect(stageText(1)).toBe('STAGE 1/5');
        expect(stageText(5)).toBe('STAGE 5/5');
    });
});

describe('ghostBall (the lost ball\'s dot blinking: shown, hidden, shown, ... ending hidden at 0.6 s)', () => {
    it.each([
        [0, 1],
        [0.0999, 1],
        [0.1, 0],
        [0.2, 1],
        [0.3, 0], // 0.3 / 0.1 is 2.9999999999999996 in floating point: still the 4th interval
        [0.4, 1],
        [0.5, 0],
        [0.6, 0],
        [1.0, 0],
        [-0.1, 0],
    ])('at %f s the dot is %i', (t, shown) => {
        expect(ghostBall(t)).toBe(shown);
    });

    it('puts a boundary reached by adding up small float steps on the right side (0.1 s as 0.09999999999999999, 0.3 s as 0.30000000000000004)', () => {
        let t = 0;
        for (let i = 0; i < 10; i++) t += 0.01;
        expect(t).toBeLessThan(0.1); // 0.09999999999999999: just below the boundary, as the Scene would accumulate it
        expect(ghostBall(t)).toBe(0);
        let u = 0;
        for (let i = 0; i < 30; i++) u += 0.01;
        expect(ghostBall(u)).toBe(0);
        let v = 0;
        for (let i = 0; i < 20; i++) v += 0.01;
        expect(ghostBall(v)).toBe(1);
    });

    it('alternates every 100 ms over the whole blink (checked at the middle of each interval)', () => {
        const shown = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55].map(ghostBall);
        expect(shown).toEqual([1, 0, 1, 0, 1, 0]);
    });
});

describe('scoreBumpScale', () => {
    it('shrinks linearly from 1.25 to 1.0 over 0.15 s', () => {
        expect(scoreBumpScale(0)).toBe(1.25);
        expect(scoreBumpScale(0.075)).toBeCloseTo(1.125, 9);
        expect(scoreBumpScale(0.15)).toBe(1);
    });

    it('stays at 1.0 afterwards and clamps a negative time to 1.25', () => {
        expect(scoreBumpScale(0.3)).toBe(1);
        expect(scoreBumpScale(-1)).toBe(1.25);
    });
});

describe('chargeColor', () => {
    it.each([
        [0, 'green', 0x4dffb0],
        [0.4999, 'green', 0x4dffb0],
        [0.5, 'yellow', 0xffe14d],
        [0.7999, 'yellow', 0xffe14d],
        [0.8, 'orange', 0xff9f43],
        [1, 'orange', 0xff9f43],
    ])('colours a charge of %f %s', (charge, _name, color) => {
        expect(chargeColor(charge)).toBe(color);
    });
});
