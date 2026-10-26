import { describe, expect, it } from 'vitest';
import { BALL_RADIUS, FIELD_LEFT, FIELD_RIGHT, FIELD_TOP } from '../params';
import { reachedDanger } from './formation';
import { clampPaddle } from './paddle';
import { createRun, frameDt, scoreForKill, stepRun, type Run } from './run';
import type { Ball } from './physics';

const H = 800; // logical height used by these tests -> paddle at y = 700
const AWAY = -1000; // a paddle x no ball can reach
const never = () => 0.5;

/** A run with its fire timer pushed far out, so nothing is shot unless the test wants it. */
const quietRun = (): Run => {
    const run = createRun(H);
    run.fireTimer = 1e9;
    return run;
};

const addBall = (run: Run, over: Partial<Ball>): Ball => {
    const b: Ball = { id: run.nextId++, x: 270, y: 500, vx: 0, vy: 0, owner: 'enemy', ...over };
    run.balls.push(b);
    return b;
};

/** An enemy ball 1 px above the exit line, falling: it leaves on the next small step. */
const exitingEnemyBall = (run: Run, x = 270) => addBall(run, { x, y: H + 8, vy: 240 });

/** Keeps only the formation's first enemy and puts an own ball overlapping it from below. */
const lastEnemyAboutToFall = (run: Run) => {
    run.formation.enemies = run.formation.enemies.slice(0, 1);
    const e = run.formation.enemies[0];
    return addBall(run, { x: e.rect.x, y: e.rect.y + 15 + 9 - 2, vy: -100, owner: 'mine' });
};

describe('createRun', () => {
    it('starts wave 1 with 3 lives, score 0, 18 enemies and the wave-1 fire timer', () => {
        const run = createRun(H);
        expect(run).toMatchObject({ phase: 'playing', wave: 1, score: 0, lives: 3, fireTimer: 1.2, paddleY: 700 });
        expect(run.dangerY).toBe(620); // paddle 700 - 80
        expect(run.formation.enemies).toHaveLength(18);
        expect(run.balls).toEqual([]);
        expect(run.resultReady).toBe(false);
    });
});

describe('frameDt', () => {
    it('passes short frames through and cuts long ones to 0.05 s', () => {
        expect(frameDt(1 / 60)).toBeCloseTo(1 / 60, 12);
        expect(frameDt(0.05)).toBe(0.05);
        expect(frameDt(1)).toBe(0.05);
    });
});

describe('scoreForKill', () => {
    it('is 10 x wave', () => {
        expect(scoreForKill(1)).toBe(10);
        expect(scoreForKill(3)).toBe(30);
    });
});

describe('stepRun: lives', () => {
    it('an enemy ball leaving the bottom costs one life and is removed', () => {
        const run = quietRun();
        const b = exitingEnemyBall(run);
        stepRun(run, 0.01, AWAY, never);
        expect(run.lives).toBe(2);
        expect(run.livesLost).toBe(1);
        expect(run.balls).toEqual([]);
        expect(run.removedBallIds).toEqual([b.id]);
    });

    it('an own ball leaving the bottom costs nothing', () => {
        const run = quietRun();
        addBall(run, { y: H + 8, vy: 240, owner: 'mine' });
        stepRun(run, 0.01, AWAY, never);
        expect(run.lives).toBe(3);
        expect(run.balls).toEqual([]);
    });

    it('two enemy balls leaving in the same frame cost two lives', () => {
        const run = quietRun();
        exitingEnemyBall(run, 100);
        exitingEnemyBall(run, 400);
        stepRun(run, 0.01, AWAY, never);
        expect(run.lives).toBe(1);
        expect(run.livesLost).toBe(2);
    });

    it('with 1 life, two leaving at once stop at 0 (never negative), report 1 life lost, and start ending', () => {
        const run = quietRun();
        run.lives = 1;
        exitingEnemyBall(run, 100);
        exitingEnemyBall(run, 400);
        stepRun(run, 0.01, AWAY, never);
        expect(run.lives).toBe(0);
        expect(run.livesLost).toBe(1); // the lives actually lost, not the 2 balls that left
        expect(run.phase).toBe('ending');
        expect(run.phaseTimer).toBe(0.8);
    });

    it('a ball caught by the paddle is not lost', () => {
        const run = quietRun();
        const b = addBall(run, { x: 270, y: 690, vy: 240 });
        stepRun(run, 0.01, 270, never);
        expect(run.lives).toBe(3);
        expect(b.owner).toBe('mine');
        expect(b.vy).toBeLessThan(0);
    });
});

describe('stepRun: per-frame record for effects', () => {
    it('records a caught enemy ball at its position after being placed on the paddle', () => {
        const run = quietRun();
        const b = addBall(run, { x: 280, y: 690, vy: 240 });
        stepRun(run, 0.01, 270, never);
        expect(run.caught).toEqual([{ id: b.id, x: 280, y: 700 - 8 - 9 }]);
    });

    it('records a re-caught own ball too, and two catches in one frame as two', () => {
        const run = quietRun();
        const a = addBall(run, { x: 240, y: 690, vy: 460, owner: 'mine' });
        const c = addBall(run, { x: 300, y: 690, vy: 240 });
        stepRun(run, 0.01, 270, never);
        expect(run.caught.map((x) => x.id)).toEqual([a.id, c.id]);
    });

    it('is empty on a frame without a catch, and cleared on the next frame', () => {
        const run = quietRun();
        addBall(run, { x: 270, y: 690, vy: 240 });
        stepRun(run, 0.01, 270, never);
        expect(run.caught).toHaveLength(1);
        stepRun(run, 0.01, 270, never);
        expect(run.caught).toEqual([]);
    });

    it('records a kill with the enemy rectangle at that moment and the score it added (wave 3 -> 30)', () => {
        const run = quietRun();
        run.wave = 3;
        const e = run.formation.enemies[12]; // bottom row, column 0
        addBall(run, { x: e.rect.x, y: e.rect.y + 22, vy: -100, owner: 'mine' });
        stepRun(run, 0.0001, AWAY, never);
        expect(run.kills).toEqual([{ id: e.id, x: e.rect.x, y: e.rect.y, w: 56, h: 30, score: 30 }]);
    });

    it('records two kills by two balls in one frame', () => {
        const run = quietRun();
        const [e1, e2] = [run.formation.enemies[12], run.formation.enemies[15]];
        addBall(run, { x: e1.rect.x, y: e1.rect.y + 22, vy: -100, owner: 'mine' });
        addBall(run, { x: e2.rect.x, y: e2.rect.y + 22, vy: -100, owner: 'mine' });
        stepRun(run, 0.0001, AWAY, never);
        expect(run.kills.map((k) => k.id)).toEqual([e1.id, e2.id]);
        stepRun(run, 0.0001, AWAY, never);
        expect(run.kills).toEqual([]);
    });
});

describe('stepRun: formation reaching the danger line', () => {
    /** Puts the formation one drop (minus 0.01) above the line and next to the right wall: its next turn reaches it. */
    const nearTheLine = (run: Run) => {
        const f = run.formation;
        const bottom = Math.max(...f.enemies.map((e) => e.rect.y + e.rect.h / 2));
        f.enemies.forEach((e) => (e.rect.y += run.dangerY - bottom - f.drop + 0.01)); // the drop lands it 0.01 past
        f.offsetX = 58.99; // right edge 473 + 58.99 = 531.99: the next small step turns at the right wall
    };

    it('ends the game at once: all 3 lives lost in that frame, recorded as an invasion', () => {
        const run = quietRun();
        nearTheLine(run);
        stepRun(run, 0.01, AWAY, never);
        expect(run.lives).toBe(0);
        expect(run.livesLost).toBe(3);
        expect(run.phase).toBe('ending');
        expect(run.invaded).toBe(true);
        stepRun(run, 0.01, AWAY, never); // a per-step record: cleared on the next frame
        expect(run.invaded).toBe(false);
    });

    it('fires no new shot on the game-over frame, even with the fire timer run out', () => {
        const run = quietRun();
        nearTheLine(run);
        run.fireTimer = 0.001;
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('ending');
        expect(run.balls.filter((b) => b.owner === 'enemy')).toHaveLength(0);
    });

    it('does not end before the turn that reaches it', () => {
        const run = quietRun();
        nearTheLine(run);
        run.formation.offsetX = 0; // far from the wall: no turn, no drop this frame
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('playing');
        expect(run.lives).toBe(3);
    });

    it('still counts that frame\'s kill (score and kill record) and ends rather than clearing the wave', () => {
        const run = quietRun();
        const f = run.formation;
        f.enemies = f.enemies.slice(-1); // one enemy left
        f.total = 18;
        const e = f.enemies[0];
        e.rect.y += run.dangerY - (e.rect.y + 15) - f.drop + 0.01; // its turn drop reaches the line
        f.offsetX = 532 - 28 - e.baseX - 0.001; // right edge just short of the right wall
        // The ball sits where the enemy will be after this frame's turn and drop.
        addBall(run, { x: e.baseX + f.offsetX, y: e.rect.y + f.drop + 22, vy: -1, owner: 'mine' });
        stepRun(run, 0.01, AWAY, never);
        expect(run.kills.map((k) => k.id)).toEqual([e.id]);
        expect(run.score).toBe(10);
        expect(run.phase).toBe('ending');
        // The killer of the last enemy leaves nothing on the line, but the run still knows why it ended.
        expect(reachedDanger(run.formation, run.dangerY)).toBe(false);
        expect(run.invaded).toBe(true);
    });

    it('with an enemy ball leaving in the same frame, still loses exactly the 3 lives there were', () => {
        const run = quietRun();
        nearTheLine(run);
        exitingEnemyBall(run);
        stepRun(run, 0.01, AWAY, never);
        expect(run.lives).toBe(0);
        expect(run.livesLost).toBe(3);
        expect(run.phase).toBe('ending');
    });
});

describe('stepRun: ending', () => {
    it('signals Result on the frame the ending timer reaches 0, not before; nothing fires meanwhile', () => {
        const run = createRun(H);
        run.lives = 1;
        run.fireTimer = 0.02;
        exitingEnemyBall(run);
        stepRun(run, 0.01, AWAY, never); // ends this frame; fire timer 0.01 left, nothing shot
        expect(run.phase).toBe('ending');
        expect(run.balls).toHaveLength(0);
        run.phaseTimer = 0.02;
        stepRun(run, 0.01, AWAY, never);
        expect(run.resultReady).toBe(false);
        stepRun(run, 0.01, AWAY, never);
        expect(run.resultReady).toBe(true);
        expect(run.fireTimer).toBeCloseTo(0.01, 10);
        expect(run.balls).toHaveLength(0);
    });

    it('freezes balls and formation, then signals Result after 0.8 s', () => {
        const run = quietRun();
        run.lives = 1;
        exitingEnemyBall(run);
        const mine = addBall(run, { x: 200, y: 400, vx: 100, vy: -100, owner: 'mine' });
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('ending');
        const offset = run.formation.offsetX;
        for (let i = 0; i < 15; i++) stepRun(run, 0.05, AWAY, never); // 0.75 s
        expect(run.resultReady).toBe(false);
        expect(mine.x).toBeCloseTo(201, 10); // moved only in the frame that started ending
        expect(run.formation.offsetX).toBe(offset);
        stepRun(run, 0.05, AWAY, never); // 0.8 s (float may leave a hair above 0)
        stepRun(run, 0.05, AWAY, never);
        expect(run.resultReady).toBe(true);
    });
});

describe('stepRun: killing enemies and wave flow', () => {
    /** Bottom-row enemy of column 0 (nothing below it, so a ball under it touches only it). */
    const bottomLeft = (run: Run) => run.formation.enemies[12];

    it('an own ball kills one enemy, bounces, and scores 10 x wave', () => {
        const run = quietRun();
        const target = bottomLeft(run);
        const b = addBall(run, { x: target.rect.x, y: target.rect.y + 22, vy: -100, owner: 'mine' });
        stepRun(run, 0.01, AWAY, never);
        expect(run.killedEnemyIds).toEqual([target.id]);
        expect(run.formation.enemies).toHaveLength(17);
        expect(run.score).toBe(10);
        expect(b.vy).toBe(100);
    });

    it('an own ball pushed out of an enemy at the left wall stays inside the wall', () => {
        const run = quietRun();
        const f = run.formation;
        f.enemies = f.enemies.filter((e) => e.col === 0).slice(-1); // one enemy, bottom of column 0
        // Its left edge sits on the left wall's inner face (8): center x 36. Moving away from the wall, so this
        // frame neither turns nor drops (it moves only ~0.014 px at the lone survivor's ~144 px/s).
        f.dir = 1;
        f.offsetX = -59;
        const e = f.enemies[0];
        // A ball against the wall (x = 8 + 9 = 17) moving left: the wall turns it right, and it overlaps the
        // enemy (center 36) by 37 - 19 = 18 px in x. Pushing it out to the left alone would land it at x = -1.
        const b = addBall(run, { x: 17, y: e.rect.y, vx: -50, vy: 0, owner: 'mine' });
        stepRun(run, 0.0001, AWAY, never);
        expect(run.killedEnemyIds).toEqual([e.id]);
        expect(b.x).toBe(17); // back against the wall's inner face
        expect(b.vx).toBe(-50); // velocity left as the push-out set it (away from the enemy)
    });

    it('an enemy ball passes through enemies', () => {
        const run = quietRun();
        const target = run.formation.enemies[0];
        addBall(run, { x: target.rect.x, y: target.rect.y, vy: 240 });
        stepRun(run, 0.01, AWAY, never);
        expect(run.formation.enemies).toHaveLength(18);
    });

    it('one own ball touching two enemies kills only one in a frame', () => {
        const run = quietRun();
        const [top] = run.formation.enemies; // row 0 col 0 (center y 145); row 1 col 0 is at y 189
        // y = 167 is 22 from both centers: overlaps each by 2 px.
        addBall(run, { x: top.rect.x, y: 167, vy: -1, owner: 'mine' });
        stepRun(run, 0.0001, AWAY, never);
        expect(run.killedEnemyIds).toHaveLength(1);
        expect(run.score).toBe(10);
    });

    it('two own balls on the same enemy: the first kills it, the second flies on', () => {
        const run = quietRun();
        const target = bottomLeft(run);
        addBall(run, { x: target.rect.x, y: target.rect.y + 22, vy: -100, owner: 'mine' });
        const second = addBall(run, { x: target.rect.x, y: target.rect.y + 22, vy: -100, owner: 'mine' });
        stepRun(run, 0.01, AWAY, never);
        expect(run.killedEnemyIds).toEqual([target.id]);
        expect(second.vy).toBe(-100);
    });

    it('killing the last enemy enters waveClear for 1.0 s, without firing', () => {
        const run = createRun(H);
        lastEnemyAboutToFall(run);
        run.fireTimer = 0.02;
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('waveClear');
        expect(run.phaseTimer).toBe(1.0);
        const timer = run.fireTimer;
        stepRun(run, 0.05, AWAY, never);
        expect(run.fireTimer).toBe(timer);
        expect(run.balls.filter((b) => b.owner === 'enemy')).toHaveLength(0);
    });

    it('during waveClear balls keep moving and a missed enemy ball still costs a life', () => {
        const run = quietRun();
        lastEnemyAboutToFall(run);
        stepRun(run, 0.01, AWAY, never);
        const mine = run.balls[0];
        const y = mine.y;
        exitingEnemyBall(run);
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('waveClear');
        expect(run.lives).toBe(2);
        expect(mine.y).not.toBe(y);
    });

    it('after WAVE_DELAY: wave 2, enemy balls cleared, own balls kept, new formation and fire timer', () => {
        const run = quietRun();
        lastEnemyAboutToFall(run);
        stepRun(run, 0.01, AWAY, never);
        const enemyBall = addBall(run, { x: 100, y: 300, vy: 240 });
        const mine = run.balls.find((b) => b.owner === 'mine')!;
        let steps = 0;
        while (run.phase === 'waveClear' && steps < 100) {
            stepRun(run, 0.05, AWAY, never);
            steps++;
        }
        expect(steps).toBeGreaterThanOrEqual(20); // 1.0 s at 0.05 s per frame
        expect(steps).toBeLessThanOrEqual(21);
        expect(run.phase).toBe('playing');
        expect(run.wave).toBe(2);
        expect(run.formationSpawned).toBe(true);
        expect(run.removedBallIds).toContain(enemyBall.id);
        expect(run.balls).toContain(mine);
        expect(run.balls.some((b) => b.owner === 'enemy')).toBe(false);
        expect(run.fireTimer).toBeCloseTo(1.02, 10);
        expect(run.formation.enemies).toHaveLength(18);
        expect(run.formation.offsetX).toBe(0);
        expect(run.formation.dir).toBe(1);
        const ids = new Set(run.formation.enemies.map((e) => e.id));
        expect(ids.has(mine.id)).toBe(false);
    });

    it('wiping the formation and losing the last life in the same frame ends the run', () => {
        const run = quietRun();
        run.lives = 1;
        lastEnemyAboutToFall(run);
        exitingEnemyBall(run);
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('ending');
    });

    it('losing the last life midway through waveClear ends the run', () => {
        const run = quietRun();
        lastEnemyAboutToFall(run);
        stepRun(run, 0.01, AWAY, never);
        run.lives = 1;
        run.phaseTimer = 0.5;
        exitingEnemyBall(run);
        stepRun(run, 0.01, AWAY, never);
        expect(run.phase).toBe('ending');
        expect(run.wave).toBe(1);
    });

    it('losing the last life in the frame WAVE_DELAY runs out ends the run; no next wave', () => {
        const run = quietRun();
        lastEnemyAboutToFall(run);
        stepRun(run, 0.01, AWAY, never);
        run.lives = 1;
        run.phaseTimer = 0.01;
        exitingEnemyBall(run);
        stepRun(run, 0.02, AWAY, never);
        expect(run.phase).toBe('ending');
        expect(run.wave).toBe(1);
        expect(run.formationSpawned).toBe(false);
    });
});

describe('stepRun: firing', () => {
    it('fires once when the timer reaches 0, from the chosen shooter, and resets the timer', () => {
        const run = createRun(H);
        run.fireTimer = 0.02;
        const draws: number[] = [0, 0.5];
        let calls = 0;
        const rng = () => {
            calls++;
            return draws.shift()!;
        };
        stepRun(run, 0.02, AWAY, rng);
        expect(calls).toBe(2); // shooter and direction are independent draws
        expect(run.fireTimer).toBeCloseTo(1.2, 10);
        const shots = run.balls.filter((b) => b.owner === 'enemy');
        expect(shots).toHaveLength(1);
        // Leftmost bottom enemy: center x 95 moved 1 px (50 px/s x 0.02 s); bottom 233 + 15, ball 9 below,
        // then the shot itself moves 240 x 0.02 = 4.8 px down in the same frame.
        expect(shots[0].x).toBeCloseTo(96, 10);
        expect(shots[0].y).toBeCloseTo(233 + 15 + 9 + 4.8, 10);
        expect(shots[0].vx).toBeCloseTo(0, 10);
        expect(shots[0].vy).toBeCloseTo(240, 10);
    });

    it('does not fire before the timer runs out', () => {
        const run = createRun(H);
        run.fireTimer = 0.05;
        stepRun(run, 0.02, AWAY, never);
        expect(run.balls).toHaveLength(0);
        expect(run.fireTimer).toBeCloseTo(0.03, 10);
    });

    it('clamps a long frame to 0.05 s', () => {
        const run = quietRun();
        const b = addBall(run, { x: 270, y: 300, vy: 100, owner: 'mine' });
        stepRun(run, 1, AWAY, never);
        expect(b.y).toBeCloseTo(305, 10);
        expect(run.formation.offsetX).toBeCloseTo(2.5, 10);
    });
});

/** Deterministic PRNG (mulberry32). */
const mulberry32 = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('stepRun: a whole run left alone', () => {
    it('ends by invasion after about 58 s at 60 fps, with all lives lost at once', () => {
        const run = quietRun(); // no shots, nobody touches anything
        let frames = 0;
        let livesBefore = run.lives;
        while (run.phase === 'playing' && frames < 60 * 120) {
            livesBefore = run.lives;
            stepRun(run, 1 / 60, AWAY, never);
            frames++;
        }
        expect(run.phase).toBe('ending');
        expect(run.invaded).toBe(true); // recorded on the frame that ended the run
        expect(reachedDanger(run.formation, run.dangerY)).toBe(true);
        expect(livesBefore).toBe(3);
        expect(run.livesLost).toBe(3);
        // 59 / 50 + 24 x 118 / 50 = 57.82 s of travel. Each of the first 24 turns can waste up to one 1/60 s
        // frame (the overshoot is taken back), and the 25th turn ends in a frame that may be partly unused:
        // at most 57.82 + 25 / 60 = 58.24 s.
        expect(frames / 60).toBeGreaterThan(57.5);
        expect(frames / 60).toBeLessThan(58.3);
    });
});

describe('stepRun: seeded plays keep the rules invariant', () => {
    it('lives, score, ids and positions stay consistent over whole plays', () => {
        let wavesCleared = 0;
        let ballLivesLost = 0;
        let ballEndings = 0;
        let invasionEndings = 0;
        let endings = 0;
        let catches = 0;
        let topWallHits = 0;
        for (let seed = 1; seed <= 40; seed++) {
            const rng = mulberry32(seed);
            const run = createRun(seed % 2 ? 756 : 1169);
            let paddle = 270;
            let expectedScore = 0;
            for (let frame = 0; frame < 60 * 90 && !run.resultReady; frame++) {
                // A simple bot: slide toward the lowest falling ball at a seed-dependent speed (slow ones miss).
                const target = run.balls
                    .filter((b) => b.vy > 0)
                    .reduce<Ball | undefined>((a, b) => (!a || b.y > a.y ? b : a), undefined);
                if (target) {
                    const step = (100 + 15 * seed) / 60;
                    paddle += Math.max(-step, Math.min(step, target.x - paddle));
                    paddle = clampPaddle(paddle);
                }
                const wave = run.wave;
                const enemyIds = new Set(run.balls.filter((b) => b.owner === 'enemy').map((b) => b.id));
                const risingIds = new Set(run.balls.filter((b) => b.owner === 'mine' && b.vy < 0).map((b) => b.id));
                const phaseBefore = run.phase;
                stepRun(run, 1 / 60, paddle, rng);
                expectedScore += run.killedEnemyIds.length * 10 * wave;
                catches += run.balls.filter((b) => b.owner === 'mine' && enemyIds.has(b.id)).length;
                if (run.formationSpawned && phaseBefore === 'waveClear') wavesCleared++;
                if (run.phase === 'playing' && reachedDanger(run.formation, run.dangerY)) {
                    expect.fail(`seed ${seed}: playing on the danger line`);
                }
                // The run records why this frame ended; lives lost to escaped enemy balls are counted apart.
                if (!run.invaded) ballLivesLost += run.livesLost;
                if (phaseBefore !== 'ending' && run.phase === 'ending') {
                    endings++;
                    if (run.invaded) invasionEndings++;
                    else ballEndings++;
                }
                if (run.lives < 0 || run.lives > 3) expect.fail(`seed ${seed}: lives ${run.lives}`);
                if (run.score !== expectedScore) expect.fail(`seed ${seed}: score ${run.score} != ${expectedScore}`);
                const ids = new Set(run.balls.map((b) => b.id));
                if (ids.size !== run.balls.length) expect.fail(`seed ${seed}: duplicate ball id`);
                for (const b of run.balls) {
                    if (b.x < FIELD_LEFT + BALL_RADIUS || b.x > FIELD_RIGHT - BALL_RADIUS) {
                        expect.fail(`seed ${seed}: ball x ${b.x} inside a wall`);
                    }
                    if (b.owner === 'mine' && b.y < FIELD_TOP + BALL_RADIUS) expect.fail(`seed ${seed}: own ball above the top wall`);
                    // A real bounce: rising before the step, on the wall line and falling after it.
                    if (risingIds.has(b.id) && b.y === FIELD_TOP + BALL_RADIUS && b.vy > 0) topWallHits++;
                    if (b.y > run.height + 9) expect.fail(`seed ${seed}: ball kept past the bottom`);
                }
                if (run.phase === 'ending' && run.lives !== 0) expect.fail(`seed ${seed}: ending with lives`);
            }
        }
        // Not vacuous: the plays reached each outcome. Losing by escaped balls is counted apart from invasions,
        // so a broken ball-loss path can't hide behind invasion endings, and every ending is one or the other.
        // (With these numbers the bot runs out of lives to escaped balls before any invasion; the invasion path
        // is covered by the whole-run test above.)
        expect(wavesCleared).toBeGreaterThan(0);
        expect(ballLivesLost).toBeGreaterThan(0);
        expect(ballEndings).toBeGreaterThan(0);
        expect(ballEndings + invasionEndings).toBe(endings);
        expect(catches).toBeGreaterThan(0);
        expect(topWallHits).toBeGreaterThan(0);
    });
});
