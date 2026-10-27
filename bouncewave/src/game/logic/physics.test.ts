import { describe, expect, it } from 'vitest';
import { bounceOffRect, catchBall, hitsPaddle, isOut, keepInsideWalls, paddleBounce, stepBall, type Ball } from './physics';

const ball = (over: Partial<Ball>): Ball => ({ id: 1, x: 270, y: 400, vx: 0, vy: 0, owner: 'enemy', tier: 1, ...over });
const SIN60 = Math.sqrt(3) / 2;

describe('stepBall', () => {
    it('moves by velocity times dt', () => {
        const b = ball({ x: 100, y: 200, vx: 50, vy: -100, owner: 'mine' });
        stepBall(b, 0.1);
        expect(b.x).toBeCloseTo(105, 10);
        expect(b.y).toBeCloseTo(190, 10);
    });

    it('bounces either ball off the left wall inner face: back to x = 8 + radius = 17, moving right', () => {
        for (const owner of ['enemy', 'mine'] as const) {
            const b = ball({ x: 18, vx: -200, owner });
            stepBall(b, 0.01); // x = 16 < 17
            expect(b.x).toBe(17);
            expect(b.vx).toBe(200);
        }
    });

    it('bounces either ball off the right wall inner face: back to x = 532 - radius = 523, moving left', () => {
        for (const owner of ['enemy', 'mine'] as const) {
            const b = ball({ x: 522, vx: 200, owner });
            stepBall(b, 0.01); // x = 524 > 523
            expect(b.x).toBe(523);
            expect(b.vx).toBe(-200);
        }
    });

    it('leaves a ball exactly touching a side wall (x = 17 / 523) alone', () => {
        const left = ball({ x: 17, vx: -200 });
        stepBall(left, 0);
        expect(left.x).toBe(17);
        expect(left.vx).toBe(-200);
        const right = ball({ x: 523, vx: 200 });
        stepBall(right, 0);
        expect(right.x).toBe(523);
        expect(right.vx).toBe(200);
    });

    it('bounces only the player ball off the top wall below the HUD (y = 64 + radius = 73)', () => {
        const mine = ball({ y: 74, vy: -200, owner: 'mine' });
        stepBall(mine, 0.01); // y = 72
        expect(mine.y).toBe(73);
        expect(mine.vy).toBe(200);

        const enemy = ball({ y: 74, vy: -200, owner: 'enemy' });
        stepBall(enemy, 0.01);
        expect(enemy.y).toBeCloseTo(72, 10);
        expect(enemy.vy).toBe(-200);
    });

    it('leaves a player ball exactly at y = 73 alone', () => {
        const mine = ball({ y: 73, vy: -200, owner: 'mine' });
        stepBall(mine, 0);
        expect(mine.y).toBe(73);
        expect(mine.vy).toBe(-200);
    });
});

describe('keepInsideWalls', () => {
    it('puts a ball pushed into a side wall back against its inner face (17 / 523) without touching its velocity', () => {
        const left = ball({ x: -1, vx: -50 });
        keepInsideWalls(left);
        expect(left.x).toBe(17);
        expect(left.vx).toBe(-50);
        const right = ball({ x: 545, vx: 50 });
        keepInsideWalls(right);
        expect(right.x).toBe(523);
        const inside = ball({ x: 200 });
        keepInsideWalls(inside);
        expect(inside.x).toBe(200);
    });
});

describe('isOut', () => {
    it('keeps a ball whose center is exactly at height + radius, removes one just past it', () => {
        expect(isOut(ball({ y: 809 }), 800)).toBe(false);
        expect(isOut(ball({ y: 809.001 }), 800)).toBe(true);
    });
});

describe('bounceOffRect', () => {
    const rect = { x: 100, y: 100, w: 56, h: 30 };

    it('misses a ball that only touches the side (penetration 0)', () => {
        const b = ball({ x: 100 - 28 - 9, y: 100, vx: 100 });
        expect(bounceOffRect(b, rect)).toBe(false);
        expect(b.vx).toBe(100);
    });

    it('misses a ball that only touches the bottom', () => {
        expect(bounceOffRect(ball({ x: 100, y: 100 + 15 + 9, vy: -100 }), rect)).toBe(false);
    });

    it('misses a ball that is clear of the rectangle', () => {
        expect(bounceOffRect(ball({ x: 300, y: 300 }), rect)).toBe(false);
    });

    it('a hit from the left pushes the ball out to the left and turns vx away', () => {
        const b = ball({ x: 65, y: 100, vx: 100, vy: 30 }); // px = 2, py = 24
        expect(bounceOffRect(b, rect)).toBe(true);
        expect(b.x).toBeCloseTo(63, 10);
        expect(b.vx).toBe(-100);
        expect(b.vy).toBe(30);
    });

    it('a hit from the right turns vx to the right', () => {
        const b = ball({ x: 135, y: 100, vx: -100 }); // px = 2
        expect(bounceOffRect(b, rect)).toBe(true);
        expect(b.x).toBeCloseTo(137, 10);
        expect(b.vx).toBe(100);
    });

    it('a hit from below pushes the ball down and turns vy downward', () => {
        const b = ball({ x: 100, y: 121, vx: 40, vy: -100 }); // py = 3, px = 37
        expect(bounceOffRect(b, rect)).toBe(true);
        expect(b.y).toBeCloseTo(124, 10);
        expect(b.vy).toBe(100);
        expect(b.vx).toBe(40);
    });

    it('a hit from above turns vy upward', () => {
        const b = ball({ x: 100, y: 79, vy: 100 }); // py = 3
        expect(bounceOffRect(b, rect)).toBe(true);
        expect(b.y).toBeCloseTo(76, 10);
        expect(b.vy).toBe(-100);
    });

    it('bounces on y when both penetrations are equal', () => {
        // dx = 20 -> px = 37 - 20 = 17; dy = 7 -> py = 24 - 7 = 17
        const b = ball({ x: 120, y: 107, vx: -50, vy: -80 });
        expect(bounceOffRect(b, rect)).toBe(true);
        expect(b.vy).toBe(80);
        expect(b.vx).toBe(-50);
        expect(b.y).toBeCloseTo(124, 10);
        expect(b.x).toBe(120);
    });

    it('keeps the speed unchanged', () => {
        const b = ball({ x: 65, y: 100, vx: 120, vy: -160 });
        bounceOffRect(b, rect);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(200, 10);
    });
});

describe('hitsPaddle', () => {
    const px = 270;
    const py = 700;

    it('catches a falling ball whose x difference is exactly half width + radius', () => {
        expect(hitsPaddle(ball({ x: 270 + 55 + 9, y: 700, vy: 100 }), px, py)).toBe(true);
        expect(hitsPaddle(ball({ x: 270 - 55 - 9, y: 700, vy: 100 }), px, py)).toBe(true);
    });

    it('misses a falling ball just beyond the paddle side', () => {
        expect(hitsPaddle(ball({ x: 270 + 64.01, y: 700, vy: 100 }), px, py)).toBe(false);
    });

    it('catches at exactly half height + radius above, misses just above it', () => {
        expect(hitsPaddle(ball({ x: 270, y: 700 - 17, vy: 100 }), px, py)).toBe(true);
        expect(hitsPaddle(ball({ x: 270, y: 700 - 17.01, vy: 100 }), px, py)).toBe(false);
    });

    it('lets an upward or horizontal ball pass through', () => {
        expect(hitsPaddle(ball({ x: 270, y: 700, vy: -100 }), px, py)).toBe(false);
        expect(hitsPaddle(ball({ x: 270, y: 700, vy: 0 }), px, py)).toBe(false);
    });
});

describe('paddleBounce', () => {
    it('sends the ball straight up at 460 from the center', () => {
        const v = paddleBounce(0);
        expect(v.vx).toBeCloseTo(0, 10);
        expect(v.vy).toBeCloseTo(-460, 10);
    });

    it('tilts 60 degrees to the right at the right edge', () => {
        const v = paddleBounce(1);
        expect(v.vx).toBeCloseTo(460 * SIN60, 6);
        expect(v.vy).toBeCloseTo(-230, 6);
    });

    it('tilts 60 degrees to the left at the left edge', () => {
        const v = paddleBounce(-1);
        expect(v.vx).toBeCloseTo(-460 * SIN60, 6);
        expect(v.vy).toBeCloseTo(-230, 6);
    });

    it('clamps an offset beyond the edge to the edge angle', () => {
        expect(paddleBounce(1.5)).toEqual(paddleBounce(1));
        expect(paddleBounce(-3)).toEqual(paddleBounce(-1));
    });
});

describe('catchBall', () => {
    it('turns an enemy ball into the player ball, resting on the paddle top, at the offset angle', () => {
        const b = ball({ x: 270 + 27.5, y: 690, vx: 30, vy: 240, owner: 'enemy' }); // offset 0.5 -> 30 degrees
        catchBall(b, 270, 700);
        expect(b.owner).toBe('mine');
        expect(b.y).toBe(700 - 8 - 9);
        expect(b.vx).toBeCloseTo(230, 6);
        expect(b.vy).toBeCloseTo(-460 * SIN60, 6);
        expect(b.x).toBe(297.5);
    });

    it('re-catches a player ball the same way', () => {
        const b = ball({ x: 270, y: 695, vy: 460, owner: 'mine' });
        catchBall(b, 270, 700);
        expect(b.owner).toBe('mine');
        expect(b.vy).toBeCloseTo(-460, 10);
    });

    it('gives a caught enemy ball tier 1 whatever tier field it carried', () => {
        const b = ball({ x: 270, y: 695, vy: 240, owner: 'enemy', tier: 3 });
        catchBall(b, 270, 700);
        expect(b.tier).toBe(1);
    });

    it('raises a caught player ball one tier at a time: 1 -> 2 -> 3 -> 4, and stays at 4', () => {
        const b = ball({ x: 270, y: 695, vy: 460, owner: 'mine', tier: 1 });
        const seen: number[] = [];
        for (let i = 0; i < 5; i++) {
            b.vy = 460; // falling again
            catchBall(b, 270, 700);
            seen.push(b.tier);
        }
        expect(seen).toEqual([2, 3, 4, 4, 4]);
    });

    it('launches with the same speed and direction at tier 1 and tier 4', () => {
        const a = ball({ x: 270 + 27.5, y: 695, vy: 460, owner: 'mine', tier: 1 });
        const c = ball({ x: 270 + 27.5, y: 695, vy: 460, owner: 'mine', tier: 4 });
        catchBall(a, 270, 700);
        catchBall(c, 270, 700);
        expect([c.vx, c.vy, c.x, c.y]).toEqual([a.vx, a.vy, a.x, a.y]);
    });
});

describe('tier does not affect movement or collisions', () => {
    it('bounces off a wall and a rectangle the same at tier 1 and tier 4', () => {
        const run = (tier: number) => {
            const b = ball({ x: 20, y: 300, vx: -200, vy: -300, owner: 'mine', tier });
            stepBall(b, 0.1);
            const hit = bounceOffRect(b, { x: b.x, y: b.y - 20, w: 56, h: 30 });
            return { x: b.x, y: b.y, vx: b.vx, vy: b.vy, hit };
        };
        expect(run(4)).toEqual(run(1));
    });
});
