import { describe, expect, it } from 'vitest';
import { AIM_MAX_BOUNCES, FIELD_LEFT, FIELD_RIGHT, FIELD_TOP, BALL_RADIUS, PADDLE_WIDTH } from '../params';
import { aimPath, arrivalX, contactY, createAimPath, dashSegments, pickAimBall } from './aim';
import type { Ball } from './physics';
import { createRun, type Run } from './run';

const HEIGHT = 792; // paddle y = 692, ball contact y = 692 - 8 - 9 = 675
const CY = 675;

const ball = (over: Partial<Ball>): Ball => ({ id: 1, x: 270, y: 400, vx: 0, vy: 240, owner: 'enemy', tier: 1, ...over });

/** A wave-1 run with the formation where it appears (centres x = 95, 165, 235, 305, 375, 445; bottom row bottom edge 248). */
const freshRun = (): Run => createRun(HEIGHT);

const path = (run: Run, paddleX: number) => {
    const out = createAimPath();
    aimPath(run, paddleX, out);
    return out;
};

describe('dashSegments (dash 8, gap 8)', () => {
    const dashes = (pts: number[]) => {
        const out: number[] = [];
        dashSegments(pts, 8, 8, out);
        return out;
    };

    it('cuts a straight line into dashes that start with a dash: 40 px -> 0-8, 16-24, 32-40', () => {
        expect(dashes([0, 0, 0, 40])).toEqual([0, 0, 0, 8, 0, 16, 0, 24, 0, 32, 0, 40]);
    });

    it('carries the pattern across a bend: 12 px, then the gap ends 4 px into the next leg', () => {
        // leg 1: dash 0-8, 4 px of gap; leg 2: 4 px of gap left, dash 4-12, gap 12-20
        expect(dashes([0, 0, 12, 0, 12, 20])).toEqual([0, 0, 8, 0, 12, 4, 12, 12]);
    });

    it('splits a dash that crosses a bend into two pieces of 5 + 3 px', () => {
        expect(dashes([0, 0, 5, 0, 5, 10])).toEqual([0, 0, 5, 0, 5, 0, 5, 3]);
    });

    it('skips a zero-length leg, gives nothing for fewer than two points, and starts over on every call', () => {
        expect(dashes([0, 0, 0, 0, 0, 10])).toEqual([0, 0, 0, 8]);
        expect(dashes([3, 4])).toEqual([]);
        const out = [9, 9, 9, 9];
        dashSegments([0, 0, 0, 8], 8, 8, out);
        expect(out).toEqual([0, 0, 0, 8]);
    });

    it('covers a long, odd-length line with dashes that never overlap and stay on the line', () => {
        const out = dashes([10, 0, 10, 1003.7]);
        for (let i = 0; i + 3 < out.length; i += 4) {
            if (out[i] !== 10 || out[i + 2] !== 10 || out[i + 3] <= out[i + 1] || out[i + 3] - out[i + 1] > 8 + 1e-9) {
                expect.fail(`dash ${i / 4}: ${out.slice(i, i + 4).join(',')}`);
            }
            if (i > 0 && out[i + 1] <= out[i - 1]) expect.fail(`dash ${i / 4} starts before the previous one ends`);
        }
        expect(out.length / 4).toBe(Math.ceil(1003.7 / 16)); // one dash per 16 px period, the last one partial
    });
});

describe('contactY', () => {
    it('is the paddle top minus the ball radius', () => {
        expect(contactY(692)).toBe(CY);
    });
});

describe('pickAimBall', () => {
    it('takes the ball that gets to the paddle first, enemy or own', () => {
        const slow = ball({ id: 1, y: 400, vy: 240 }); // (675 - 400) / 240 = 1.146 s
        const fast = ball({ id: 2, y: 500, vy: 460, owner: 'mine' }); // 175 / 460 = 0.380 s
        expect(pickAimBall([slow, fast], 692)).toBe(fast);
        expect(pickAimBall([fast, slow], 692)).toBe(fast);
    });

    it('ignores balls moving up and balls already at or below the contact height', () => {
        const up = ball({ id: 1, y: 500, vy: -460, owner: 'mine' });
        const flat = ball({ id: 2, y: 500, vy: 0 });
        const there = ball({ id: 3, y: CY });
        const past = ball({ id: 4, y: CY + 5 });
        expect(pickAimBall([up, flat, there, past], 692)).toBeUndefined();
    });

    it('breaks a tie by the lower id', () => {
        const a = ball({ id: 7, x: 100 });
        const b = ball({ id: 3, x: 400 });
        expect(pickAimBall([a, b], 692)).toBe(b);
        expect(pickAimBall([b, a], 692)).toBe(b);
    });

    it('is undefined with no balls', () => {
        expect(pickAimBall([], 692)).toBeUndefined();
    });
});

describe('arrivalX', () => {
    it('is the plain straight-line position when no wall is in the way', () => {
        expect(arrivalX(270, 100, 0.5)).toBe(320);
        expect(arrivalX(270, 0, 3)).toBe(270);
    });

    it('folds back from the right wall (centre limit 523): 500 + 60 = 560 -> 486', () => {
        expect(arrivalX(500, 120, 0.5)).toBeCloseTo(486, 9);
    });

    it('folds back from the left wall (centre limit 17): 20 - 50 = -30 -> 64', () => {
        expect(arrivalX(20, -100, 0.5)).toBeCloseTo(64, 9);
    });

    it('folds several times: 300 + 333 x 2 = 966 -> u = 949 of a 1012 period -> 80', () => {
        expect(arrivalX(300, 333, 2)).toBeCloseTo(80, 9);
    });

    it('stays inside the walls after several bounces', () => {
        for (let t = 0; t < 20; t += 0.37) {
            const x = arrivalX(300, 333, t);
            if (x < FIELD_LEFT + BALL_RADIUS - 1e-9 || x > FIELD_RIGHT - BALL_RADIUS + 1e-9) expect.fail(`t=${t} x=${x}`);
        }
    });
});

describe('aimPath: when there is a line', () => {
    it('is empty with no ball to catch', () => {
        const run = freshRun();
        expect(path(run, 270).pts).toEqual([]);
    });

    it('catches at exactly half the paddle plus a radius off-centre (64) and misses just beyond', () => {
        const run = freshRun();
        run.balls.push(ball({ x: 270 + PADDLE_WIDTH / 2 + BALL_RADIUS }));
        expect(path(run, 270).pts.length).toBeGreaterThan(0);
        run.balls[0].x = 270 + PADDLE_WIDTH / 2 + BALL_RADIUS + 0.01;
        expect(path(run, 270).pts).toEqual([]);
    });

    it('empties the previous line when it is called again with nothing to show', () => {
        const run = freshRun();
        const out = createAimPath();
        run.balls.push(ball({ x: 305 }));
        aimPath(run, 305, out);
        expect(out.pts.length).toBeGreaterThan(0);
        run.balls.length = 0;
        aimPath(run, 305, out);
        expect(out.pts).toEqual([]);
    });

    it('follows the ball that arrives first, with the wall folding of its x', () => {
        const run = freshRun();
        run.balls.push(ball({ id: 2, x: 150, y: 300, vx: 0, vy: 240 })); // arrives later (1.56 s): not this one
        run.balls.push(ball({ id: 1, x: 500, y: 600, vx: 400, vy: 240 })); // arrives in 0.3125 s at 625 -> folds to 421
        const out = path(run, 421);
        expect(out.pts[0]).toBeCloseTo(421, 6); // starts where the paddle would catch it
        expect(out.pts[1]).toBeCloseTo(CY, 9);
    });

    it('does not change the run (balls, enemies, score, ids)', () => {
        const run = freshRun();
        run.balls.push(ball({ x: 305 }), ball({ id: 2, x: 330, y: 600, owner: 'mine' }));
        const before = structuredClone(run);
        path(run, 305);
        expect(run).toEqual(before);
    });
});

describe('aimPath: the line', () => {
    it('goes straight up from the middle of the paddle and ends where the ball touches the first enemy (y = 248 + 9)', () => {
        const run = freshRun();
        run.balls.push(ball({ x: 305 }));
        const out = path(run, 305);
        expect(out.pts).toHaveLength(4);
        expect(out.pts[0]).toBeCloseTo(305, 9);
        expect(out.pts[1]).toBeCloseTo(CY, 9);
        expect(out.pts[2]).toBeCloseTo(305, 6);
        expect(Math.abs(out.pts[3] - 257)).toBeLessThan(1);
    });

    it('bends at the walls and ends on the first enemy it meets (offset 1 -> 60 degrees to the right)', () => {
        const run = freshRun();
        run.balls.push(ball({ x: 325 })); // 55 right of the paddle at 270: offset 1
        const out = path(run, 270);
        // start, right wall, left wall, then the touch on the bottom-left enemy
        expect(out.pts).toHaveLength(8);
        expect(out.pts[2]).toBeCloseTo(FIELD_RIGHT - BALL_RADIUS, 6);
        expect(out.pts[3]).toBeCloseTo(675 - 198 * Math.tan(Math.PI / 6), 4); // 560.68
        expect(out.pts[4]).toBeCloseTo(FIELD_LEFT + BALL_RADIUS, 6);
        expect(out.pts[5]).toBeCloseTo(675 - (198 + 506) * Math.tan(Math.PI / 6), 4); // 268.53
        expect(Math.abs(out.pts[6] - 58)).toBeLessThan(1);
        expect(Math.abs(out.pts[7] - 244.86)).toBeLessThan(1);
    });

    it('mirrors to the left for a ball left of the paddle centre', () => {
        const run = freshRun();
        run.balls.push(ball({ x: 215 })); // offset -1
        const out = path(run, 270);
        expect(out.pts[2]).toBeCloseTo(FIELD_LEFT + BALL_RADIUS, 6);
    });

    it('with no enemies goes up to the top wall and stops when it is back at the paddle height', () => {
        const run = freshRun();
        run.formation.enemies = [];
        run.balls.push(ball({ x: 270 }));
        const out = path(run, 270);
        expect(out.pts).toHaveLength(6);
        expect(out.pts[3]).toBeCloseTo(FIELD_TOP + BALL_RADIUS, 9); // the top wall's face plus a radius
        expect(out.pts[4]).toBeCloseTo(270, 9);
        expect(out.pts[5]).toBeCloseTo(CY, 9);
    });

    it('stops at the bounce after AIM_MAX_BOUNCES (the 5th) even when no enemy is met', () => {
        const run = freshRun();
        run.formation.enemies = [];
        run.balls.push(ball({ x: 325 })); // offset 1 from paddle x 270
        const out = path(run, 270);
        // right wall, left wall, top wall, right wall, left wall: bounce number AIM_MAX_BOUNCES + 1 = 5
        expect(AIM_MAX_BOUNCES).toBe(4);
        expect(out.pts).toHaveLength(2 * (1 + AIM_MAX_BOUNCES + 1));
        expect(out.pts[10]).toBeCloseTo(FIELD_LEFT + BALL_RADIUS, 6);
        expect(out.pts[11]).toBeCloseTo(461.8, 0);
    });

    it('ends on the enemy touched first when two neighbours are overlapped within one coarse step', () => {
        const run = freshRun();
        const [a, b] = run.formation.enemies; // reuse two real enemies, then place them by hand
        a.rect.x = 330;
        a.rect.y = 146; // bottom edge 161: one pixel higher than b's, so the rising ball touches it a hair later
        b.rect.x = 305;
        b.rect.y = 147; // bottom edge 162: touched first (centre y 171); at the next 3 px step both overlap
        run.formation.enemies = [a, b];
        run.balls.push(ball({ x: 305 }));
        const out = path(run, 305);
        expect(Math.abs(out.pts[3] - 171)).toBeLessThan(0.5); // b's bottom 162 + radius 9
    });

    it('stops for an enemy only when the ball would overlap it: just inside one radius of its side stops, just outside passes', () => {
        const run = freshRun();
        run.formation.enemies = run.formation.enemies.filter((e) => e.col === 3 && e.rect.y === 233); // one enemy, x 277..333
        const edge = 333 + BALL_RADIUS; // ball centre x at which the circle just touches the side
        run.balls.push(ball({ x: edge - 0.01 }));
        expect(path(run, edge - 0.01).pts[3]).toBeGreaterThan(200); // meets it (ends near its bottom)
        run.balls[0].x = edge + 0.01;
        expect(path(run, edge + 0.01).pts[3]).toBeCloseTo(FIELD_TOP + BALL_RADIUS, 9); // goes by to the top wall
    });

    it('treats an enemy as hit only when the ball would overlap it: passes through a gap wider than the ball', () => {
        const run = freshRun();
        // remove the whole column 3 so a straight shot at x = 305 meets nothing, then check it reaches the top wall
        run.formation.enemies = run.formation.enemies.filter((e) => e.col !== 3);
        run.balls.push(ball({ x: 305 }));
        const out = path(run, 305);
        expect(out.pts[3]).toBeCloseTo(FIELD_TOP + BALL_RADIUS, 9);
    });
});
