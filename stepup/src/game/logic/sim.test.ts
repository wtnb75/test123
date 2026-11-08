import { describe, expect, it } from 'vitest';
import { GOAL_VIEW_MARGIN, PLAYER_H } from '../params';
import type { Bullet } from './bullets';
import {
    createSim,
    isCleared,
    isLeftBehind,
    judge,
    simMeters,
    startYFor,
    stepSim,
    type Outcome,
    type Sim,
} from './sim';

const idle = () => 0;
const noBullets = (s: Sim) => {
    s.field.spawnTimer = 1e9; // keep the field quiet
    return s;
};
const bulletOn = (s: Sim): Bullet => ({ x: s.player.x, y: s.player.y - 10, vx: 0, vy: 0 });

describe('createSim', () => {
    it('puts the start ground in the middle of the screen: startY = round(H x 0.5)', () => {
        expect(startYFor(528)).toBe(264);
        expect(startYFor(779)).toBe(390); // 389.5 rounds up
        expect(startYFor(520)).toBe(260);
    });

    it('starts on the ground with the goal 2000 px above (H = 528)', () => {
        const s = createSim(528);
        expect(s).toMatchObject({ startY: 264, goalY: -1736, viewTop: 0, highestFeetY: 264, outcome: null });
        expect(s.player).toMatchObject({ x: 180, y: 264, vy: 0, onGround: true, lock: 0 });
        expect(s.platforms.map((p) => p.kind)).toEqual(['ground', 'goal']);
        expect(simMeters(s)).toBe(0);
    });
});

describe('stepSim', () => {
    it('makes the first button press a jump', () => {
        const s = noBullets(createSim(528));
        stepSim(s, 0, 1, 1 / 60, idle);
        expect(s.player.onGround).toBe(false);
        expect(s.player.vy).toBeLessThan(0);
        expect(s.player.lock).toBeGreaterThan(0.28);
    });

    it('scrolls the view up by scrollSpeed x dt (32 px/s at 0 m)', () => {
        const s = noBullets(createSim(528));
        stepSim(s, 0, 0, 0.5, idle);
        expect(s.viewTop).toBeCloseTo(-16, 10);
    });

    it('applies the actions first, then counts the lock down: after the first frame the lock is 0.3 - 1/60', () => {
        const s = noBullets(createSim(528));
        stepSim(s, 0, 1, 1 / 60, idle);
        expect(s.player.lock).toBeCloseTo(0.3 - 1 / 60, 10);
    });

    it('presses twice in one frame: a jump, then (locked) nothing', () => {
        const s = noBullets(createSim(528));
        stepSim(s, 0, 2, 1 / 60, idle);
        expect(s.platforms.filter((p) => p.kind === 'built')).toHaveLength(0);
    });

    it('scrolls by the speed of the current height (100 m -> 37 px/s)', () => {
        const s = noBullets(createSim(528));
        s.highestFeetY = s.startY - 1000; // 100 m
        s.player.y = s.highestFeetY;
        s.player.onGround = false;
        s.viewTop = s.player.y - 300;
        const before = s.viewTop;
        stepSim(s, 0, 0, 0.1, idle);
        expect(s.viewTop).toBeCloseTo(before - 3.7, 8);
    });

    it('turns a warning into a bullet at the top edge of the view it has after scrolling, unmoved that frame', () => {
        const s = noBullets(createSim(528));
        s.field.warns.push({ x: 50, vx: 0, vy: 200, t: 0.01 });
        stepSim(s, 0, 0, 1 / 60, idle);
        expect(s.field.bullets).toHaveLength(1);
        expect(s.field.bullets[0].y).toBeCloseTo(s.viewTop - 7, 10);
    });

    it('records the highest point and the height never goes down', () => {
        const s = noBullets(createSim(528));
        stepSim(s, 0, 1, 1 / 60, idle);
        for (let i = 0; i < 30; i++) stepSim(s, 0, 0, 1 / 60, idle); // past the apex (~22 frames), before landing (~45)
        const peak = simMeters(s);
        expect(peak).toBeGreaterThan(9.9); // about 100 px
        expect(peak).toBeLessThan(10.1);
        for (let i = 0; i < 60; i++) stepSim(s, 0, 0, 1 / 60, idle);
        expect(simMeters(s)).toBe(peak);
    });

    it('stops the scroll when the goal is 170 px below the top edge', () => {
        const s = noBullets(createSim(528));
        s.viewTop = s.goalY - GOAL_VIEW_MARGIN + 0.1;
        s.player.y = s.viewTop + 300;
        stepSim(s, 0, 0, 1, idle);
        expect(s.viewTop).toBe(s.goalY - 170);
        stepSim(s, 0, 0, 1, idle);
        expect(s.viewTop).toBe(s.goalY - 170);
        expect(s.viewTop).toBe(-1906); // H = 528: goalY -1736, 170 px below the top edge
    });

    it('does nothing once the run has ended', () => {
        const s = noBullets(createSim(528));
        s.outcome = 'hit';
        const before = JSON.stringify(s);
        stepSim(s, 1, 3, 0.5, idle);
        expect(JSON.stringify(s)).toBe(before);
    });

    it('ends with clear when the player lands on the goal platform', () => {
        const s = noBullets(createSim(528));
        s.viewTop = s.goalY - 170;
        s.player.y = s.goalY - 1;
        s.player.vy = 200;
        s.player.onGround = false;
        stepSim(s, 0, 0, 1 / 60, idle);
        expect(s.outcome).toBe('clear');
        expect(s.player.y).toBe(s.goalY);
        expect(simMeters(s)).toBe(200);
    });

    it('does not clear when the player only passes the goal height in the air', () => {
        const s = noBullets(createSim(528));
        s.viewTop = s.goalY - 170;
        s.player.y = s.goalY + 50;
        s.player.vy = -560;
        s.player.onGround = false;
        stepSim(s, 0, 0, 1 / 60, idle);
        expect(s.outcome).toBeNull();
    });

    it('ends with left-behind when the head drops below the bottom edge', () => {
        const s = noBullets(createSim(528));
        s.player.y = 528 + PLAYER_H + 1; // head 1 px below the bottom edge, below the ground
        stepSim(s, 0, 0, 1 / 60, idle);
        expect(s.outcome).toBe('left-behind');
    });

    it('ends with hit when a bullet touches the player', () => {
        const s = noBullets(createSim(528));
        s.field.bullets.push(bulletOn(s));
        stepSim(s, 0, 0, 1 / 60, idle);
        expect(s.outcome).toBe('hit');
    });
});

describe('end conditions', () => {
    it('is left behind only when the head is strictly below the bottom edge (head = 528 is still fine)', () => {
        const p = { x: 180, y: 528 + PLAYER_H, vy: 0, onGround: false, lock: 0 };
        expect(isLeftBehind(p, 528)).toBe(false);
        expect(isLeftBehind({ ...p, y: p.y + 0.01 }, 528)).toBe(true);
    });

    it('clears only when on the ground at goal height (goalY + 0.5 or higher up)', () => {
        const base = { x: 180, y: -1736, vy: 0, onGround: true, lock: 0 };
        expect(isCleared(base, -1736)).toBe(true);
        expect(isCleared({ ...base, y: -1735.5 }, -1736)).toBe(true);
        expect(isCleared({ ...base, y: -1735.4 }, -1736)).toBe(false);
        expect(isCleared({ ...base, onGround: false }, -1736)).toBe(false);
    });

    it('prefers hit over clear in the same frame', () => {
        const s = createSim(528);
        s.player.y = s.goalY;
        s.player.onGround = true;
        expect(judge(s)).toBe('clear');
        s.field.bullets.push(bulletOn(s));
        expect(judge(s)).toBe('hit');
    });

    it('prefers hit over left-behind in the same frame', () => {
        const s = createSim(528);
        s.player.y = 528 + PLAYER_H + 5;
        expect(judge(s)).toBe('left-behind');
        s.field.bullets.push(bulletOn(s));
        expect(judge(s)).toBe('hit');
    });

    it('prefers left-behind over clear in the same frame', () => {
        const s = createSim(528);
        s.player.y = s.goalY;
        s.player.onGround = true;
        s.viewTop = s.goalY - 600; // the head is far below the bottom edge of the view
        expect(judge(s)).toBe('left-behind');
    });

    it('is still playing with nothing going on', () => {
        expect(judge(createSim(528))).toBeNull();
    });
});

describe('invariants over random play (seeded)', () => {
    /** A small deterministic generator (mulberry32). */
    const mulberry = (seed: number) => () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };

    it('keeps the player on screen and in bounds and the platforms at 2, and random play reaches both failures', () => {
        const ends: Record<Outcome, number> = { clear: 0, hit: 0, 'left-behind': 0 };
        for (let seed = 1; seed <= 60; seed++) {
            const rng = mulberry(seed);
            const s = createSim(528);
            let dir = 0;
            let prevTop = s.viewTop;
            for (let frame = 0; frame < 6000 && !s.outcome; frame++) {
                if (frame % 20 === 0) dir = Math.floor(rng() * 3) - 1;
                stepSim(s, dir, rng() < 0.08 ? 1 : 0, 1 / 60, rng);
                const built = s.platforms.filter((p) => p.kind === 'built').length;
                if (built > 2) expect.fail(`seed ${seed} frame ${frame}: ${built} built platforms`);
                if (s.player.x < 10 || s.player.x > 350) expect.fail(`seed ${seed} frame ${frame}: x ${s.player.x}`);
                if (s.player.y - PLAYER_H < s.viewTop - 1e-9) expect.fail(`seed ${seed} frame ${frame}: above the top`);
                if (s.viewTop > prevTop) expect.fail(`seed ${seed} frame ${frame}: the view scrolled down`);
                prevTop = s.viewTop;
            }
            if (s.outcome) ends[s.outcome]++;
        }
        // the random play must have exercised both ways to fail, otherwise the loop proved little
        expect(ends.hit).toBeGreaterThan(0);
        expect(ends['left-behind']).toBeGreaterThan(0);
    });
});
