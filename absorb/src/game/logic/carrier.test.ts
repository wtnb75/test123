import { describe, expect, it } from 'vitest';
import { emptyBreakdown } from './breakdown';
import { MAX_ENEMIES } from './constants';
import { debrisColor } from './debrisFx';
import {
    createCarrier, createDroppedEnemy, createEnemy, fireIntervalOf, setState, updateEnemy, type Enemy, type EnemyContext
} from './enemy';
import type { ScreenSize } from './screen';
import { World, type Input, type ReleaseBullet } from './world';

// Expected values are worked out by hand from spec/carrier.md: the carrier crosses at 10% of the screen
// height at 60 px/s from x = −30 (or width + 30); its drop clock starts on the first frame its centre is on
// screen, first drop 1.5 s later, then every 3 s. At 60 fps it moves exactly 1 px per frame.

const S: ScreenSize = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

function ctx(overrides: Partial<EnemyContext> = {}): EnemyContext {
    return { player: { x: 512, y: 650 }, elapsed: 80, rng: () => 0.5, screen: S, ...overrides };
}

/** Frames (counting the first update as frame 1) on which the carrier dropped, until it vanishes or `limit`. */
function dropFrames(e: Enemy, limit = 2000): number[] {
    const frames: number[] = [];
    for (let f = 1; f <= limit && !e.removed; f++) if (updateEnemy(e, DT, ctx())) frames.push(f);
    return frames;
}

describe('carrier: entering and crossing', () => {
    it('comes in from the left, fully off screen, at 10% of the height, when the rng is below 0.5', () => {
        const e = createCarrier(1, 'heavy', () => 0.49, S);
        expect(e).toMatchObject({ kind: 'carrier', hp: 12, radius: 30, x: -30, state: 'cross', cargo: 'heavy', swayDir: 1 });
        expect(e.y).toBeCloseTo(76.8);
    });

    it('comes in from the right when the rng is 0.5 or more', () => {
        const e = createCarrier(1, 'grunt', () => 0.5, S);
        expect(e.x).toBe(1054);
        expect(e.y).toBeCloseTo(76.8);
        expect(e.swayDir).toBe(-1);
    });

    it('crosses at 60 px/s without changing height, and never fires', () => {
        const e = createCarrier(1, 'grunt', () => 0.1, S);
        const y = e.y;
        for (let f = 0; f < 60; f++) updateEnemy(e, DT, ctx());
        expect(e.x).toBeCloseTo(30);
        expect(e.y).toBe(y);
        expect(fireIntervalOf('carrier')).toBe(0);
    });

    it('does not vanish while still coming in off screen, only once its centre passes the far edge', () => {
        const e = createCarrier(1, 'grunt', () => 0.1, S);
        updateEnemy(e, DT, ctx());
        expect(e.removed).toBe(false); // x = −29, still off screen on the near side
        e.x = 1023.5;
        updateEnemy(e, DT, ctx());
        expect(e.removed).toBe(true); // 1024.5 > 1024
    });

    it('moving left, vanishes once its centre goes below 0', () => {
        const e = createCarrier(1, 'grunt', () => 0.9, S);
        e.x = 0.5;
        updateEnemy(e, DT, ctx());
        expect(e.removed).toBe(true);
    });
});

describe('carrier: drop clock', () => {
    it('at 60 fps drops on frames 120, 300 and 480 after appearing from the left (centre on screen from frame 30)', () => {
        const e = createCarrier(1, 'grunt', () => 0.1, S);
        expect(dropFrames(e, 500)).toEqual([120, 300, 480]);
    });

    it('drops every 3 s across the whole screen and stops once its centre is gone', () => {
        const e = createCarrier(1, 'grunt', () => 0.1, S);
        // Centre on screen from frame 30 to frame 1054 (x = 1024): drops at 2, 5, 8, 11, 14, 17 s.
        expect(dropFrames(e)).toEqual([120, 300, 480, 660, 840, 1020]);
        expect(e.removed).toBe(true);
    });

    it('keeps the overshoot between drops instead of restarting the clock', () => {
        const e = createCarrier(1, 'grunt', () => 0.1, S);
        e.x = 100;
        updateEnemy(e, DT, ctx()); // first on-screen frame: clock set to 1.5 s, this frame's dt not counted
        expect(updateEnemy(e, 1.6, ctx())).toBe(true); // 0.1 s late
        expect(updateEnemy(e, 2.85, ctx())).toBe(false); // 2.9 s of the 3 s would be 0.05 s early
        expect(updateEnemy(e, 0.05, ctx())).toBe(true);
    });

    it('drops at most once per frame even after a long frame', () => {
        const e = createCarrier(1, 'grunt', () => 0.1, S);
        e.x = 100;
        updateEnemy(e, DT, ctx());
        expect(updateEnemy(e, 9, ctx())).toBe(true);
    });
});

describe('dropped enemies', () => {
    it('start at the carrier position and drop straight down to their kind\'s station height', () => {
        const h = createDroppedEnemy('heavy', 5, { x: 500, y: 76.8 }, () => 0.5, S);
        expect(h).toMatchObject({ kind: 'heavy', hp: 8, x: 500, y: 76.8, entry: 'top', state: 'enter', stationX: 500 });
        expect(h.stationY).toBeCloseTo(768 * 0.15);
        for (let f = 0; f < 60 && h.state === 'enter'; f++) updateEnemy(h, DT, ctx());
        expect(h.x).toBe(500);
        expect(h.state).toBe('chase');
    });

    it('become normal splitters and grunts once at their station', () => {
        const s = createDroppedEnemy('splitter', 5, { x: 500, y: 76.8 }, () => 0.5, S);
        for (let f = 0; f < 60 && s.state === 'enter'; f++) updateEnemy(s, DT, ctx());
        expect(s.state).toBe('drift');
        const g = createDroppedEnemy('grunt', 6, { x: 500, y: 76.8 }, () => 0, S);
        expect(g.stationY).toBeCloseTo(768 * 0.15);
        for (let f = 0; f < 60 && g.state === 'enter'; f++) updateEnemy(g, DT, ctx());
        expect(g.state).toBe('sway');
    });

    it('are kept within the 40 px edge margins when dropped near a screen edge', () => {
        expect(createDroppedEnemy('grunt', 1, { x: 10, y: 76.8 }, () => 0.5, S).x).toBe(40);
        expect(createDroppedEnemy('grunt', 1, { x: 1020, y: 76.8 }, () => 0.5, S).x).toBe(984);
        expect(createDroppedEnemy('grunt', 1, { x: 40, y: 76.8 }, () => 0.5, S).x).toBe(40);
    });

    it('leave debris in the plain hull colour', () => {
        expect(debrisColor('carrier', 0x90a4ae)).toBe(0x90a4ae);
    });
});

/** A world in the playing phase with regular, rammer, boss and carrier spawns all paused. */
function quietWorld(rng: () => number = () => 0.5): World {
    const w = new World(S, rng);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    w.nextBossAt = Infinity;
    w.nextCarrierAt = Infinity;
    return w;
}

const carriers = (w: World) => w.enemies.filter((e) => e.kind === 'carrier');

function stillGrunt(w: World, x: number, y: number, hp = 2): Enemy {
    const e = createEnemy('grunt', 3000 + w.enemies.length, () => 0.5, S);
    e.x = x;
    e.y = y;
    e.hp = hp;
    e.state = 'dash'; // a state grunts never use: holds still, never fires
    w.enemies.push(e);
    return e;
}

describe('carrier schedule', () => {
    it('first appears exactly at 70 s of playing time, not a frame before', () => {
        const w = quietWorld();
        w.nextCarrierAt = 70;
        w.elapsed = 70 - 1e-6;
        w.step(DT, NONE);
        expect(carriers(w)).toHaveLength(0);
        w.elapsed = 70;
        w.step(DT, NONE);
        expect(carriers(w)).toHaveLength(1);
        expect(w.carrier).toBe(carriers(w)[0]);
        expect(w.nextCarrierAt).toBe(105);
    });

    it('starts at 70 s in a fresh world', () => {
        expect(new World(S).nextCarrierAt).toBe(70);
    });

    it('moves in the frame it appears', () => {
        const w = quietWorld(() => 0.1);
        w.nextCarrierAt = 0;
        w.step(DT, NONE);
        expect(w.carrier!.x).toBeCloseTo(-29);
    });

    it('never has two at once, and a late one resets the schedule from when it actually appears', () => {
        const w = quietWorld(() => 0.1);
        w.nextCarrierAt = 0;
        w.step(DT, NONE);
        const first = w.carrier!;
        w.nextCarrierAt = 0;
        w.step(DT, NONE);
        expect(carriers(w)).toEqual([first]);
        first.removed = true;
        w.elapsed = 50;
        w.step(DT, NONE); // removed at the end of this step
        expect(w.carrier).toBeNull();
        w.step(DT, NONE);
        expect(w.carrier).not.toBeNull();
        expect(w.nextCarrierAt).toBeCloseTo(50 + DT + 35);
    });

    it('waits while a boss is on the field and comes the step after the boss is killed', () => {
        const w = quietWorld();
        w.nextBossAt = 0;
        w.step(DT, NONE);
        const boss = w.boss!;
        w.nextCarrierAt = 0;
        w.step(DT, NONE);
        expect(carriers(w)).toHaveLength(0);
        // Kill the boss with a release bullet this step: the spawn check already ran, so no carrier yet.
        boss.hp = 1;
        w.releaseBullets.push({
            x: boss.x - 5, y: boss.y, heading: 0, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        } satisfies ReleaseBullet);
        w.step(DT, NONE);
        expect(w.boss).toBeNull();
        expect(carriers(w)).toHaveLength(0);
        w.step(DT, NONE);
        expect(carriers(w)).toHaveLength(1);
    });

    it('lets the boss go first when both are due in the same step', () => {
        const w = quietWorld();
        w.nextBossAt = 0;
        w.nextCarrierAt = 0;
        w.step(DT, NONE);
        expect(w.boss).not.toBeNull();
        expect(carriers(w)).toHaveLength(0);
    });

    it('does not appear during ready or ending', () => {
        const ready = new World(S, () => 0.5);
        ready.nextCarrierAt = 0;
        ready.step(DT, NONE);
        expect(carriers(ready)).toHaveLength(0);
        const w = quietWorld();
        w.player.lives = 1;
        stillGrunt(w, w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        w.nextCarrierAt = 0;
        w.step(DT, NONE);
        expect(carriers(w)).toHaveLength(0);
    });

    it('carries the kind the current spawn ratios pick (60–120 s: 30 / 30 / 25 / 15)', () => {
        for (const [r, kind] of [[0.29, 'grunt'], [0.3, 'shooter'], [0.6, 'heavy'], [0.85, 'splitter']] as const) {
            const w = quietWorld(() => r);
            w.elapsed = 80;
            w.nextCarrierAt = 0;
            w.step(DT, NONE);
            expect(w.carrier!.cargo).toBe(kind);
        }
    });

    it('uses the ratios of the stage it appears in (120 s and later: 20 / 30 / 35 / 15)', () => {
        // 0.19 and 0.2 are both grunts at 60–120 s (grunt below 0.3), but split grunt / shooter from 120 s.
        for (const [r, kind] of [[0.19, 'grunt'], [0.2, 'shooter']] as const) {
            const w = quietWorld(() => r);
            w.elapsed = 130;
            w.nextCarrierAt = 0;
            w.step(DT, NONE);
            expect(w.carrier!.cargo).toBe(kind);
        }
    });
});

/** Puts a carrier on screen at x with its first drop due on the next step. */
function carrierAboutToDrop(w: World, x: number, cargo: 'grunt' | 'heavy' = 'grunt'): Enemy {
    const c = createCarrier(4000, cargo, () => 0.1, S);
    c.x = x;
    c.dropTimer = DT / 2;
    w.enemies.push(c);
    w.carrier = c;
    return c;
}

describe('carrier drops in the world', () => {
    it('adds the dropped enemy at the end of the step, and it moves from the next step', () => {
        const w = quietWorld();
        const c = carrierAboutToDrop(w, 500);
        w.step(DT, NONE);
        const dropped = w.enemies.filter((e) => e.kind === 'grunt');
        expect(dropped).toHaveLength(1);
        expect(dropped[0].x).toBeCloseTo(c.x);
        expect(dropped[0].y).toBeCloseTo(c.y);
        expect(dropped[0].stateTime).toBe(0);
        w.step(DT, NONE);
        expect(dropped[0].y).toBeGreaterThan(c.y);
    });

    it('drops even past the cap of 6, and regular spawns stay paused while over it', () => {
        const w = quietWorld();
        for (let i = 0; i < MAX_ENEMIES; i++) stillGrunt(w, 100 + i * 120, 300);
        const c = carrierAboutToDrop(w, 500);
        w.spawnTimer = 0;
        w.step(DT, NONE);
        const regulars = () => w.enemies.filter((e) => e.kind !== 'carrier');
        expect(regulars()).toHaveLength(MAX_ENEMIES + 1);
        // Now over the cap: a regular spawn falling due is skipped.
        c.dropTimer = 100;
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(regulars()).toHaveLength(MAX_ENEMIES + 1);
    });

    it('drops only its own cargo kind, drop after drop, whatever a fresh spawn pick would say', () => {
        const w = quietWorld(() => 0.1); // a fresh pick at this rng would be a grunt
        w.elapsed = 80;
        const c = carrierAboutToDrop(w, 500, 'heavy');
        w.step(DT, NONE);
        c.dropTimer = DT / 2;
        w.step(DT, NONE);
        const dropped = w.enemies.filter((e) => e.kind !== 'carrier');
        expect(dropped.map((e) => e.kind)).toEqual(['heavy', 'heavy']);
    });

    it('keeps a fresh drop out of that step\'s release-bullet hits and targeting', () => {
        const w = quietWorld();
        // Moving left at x = 5: the drop is clamped to x = 40, 36 px from the hull.
        const c = createCarrier(4000, 'grunt', () => 0.9, S);
        c.x = 5;
        c.dropTimer = DT / 2;
        w.enemies.push(c);
        w.carrier = c;
        const shot: ReleaseBullet = {
            x: 50, y: c.y, heading: Math.PI, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        };
        w.releaseBullets.push(shot);
        w.step(DT, NONE);
        const drop = w.enemies.find((e) => e.kind === 'grunt')!;
        expect(drop.x).toBe(40);
        expect(Math.hypot(shot.x - drop.x, shot.y - drop.y)).toBeLessThan(18); // it would overlap the drop now
        expect(drop.hp).toBe(2);
        expect(shot.removed).toBe(false);
        expect(shot.target).toBe(c);
    });

    it('keeps a fresh drop out of that step\'s contact check', () => {
        const w = quietWorld();
        const c = createCarrier(4000, 'grunt', () => 0.9, S);
        c.x = 5;
        c.dropTimer = DT / 2;
        w.enemies.push(c);
        w.carrier = c;
        // Just under the drop point (40, 76.8): overlapping the drop, clear of the hull at x = 4.
        w.player.x = 40;
        w.player.y = c.y + 20;
        w.step(DT, NONE);
        expect(w.enemies.some((e) => e.kind === 'grunt')).toBe(true);
        expect(w.player.lives).toBe(3);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
    });

    it('does not count the carrier itself toward the cap', () => {
        const w = quietWorld();
        for (let i = 0; i < MAX_ENEMIES - 1; i++) stillGrunt(w, 100 + i * 120, 300);
        const c = createCarrier(4000, 'grunt', () => 0.1, S);
        c.x = 500;
        w.enemies.push(c);
        w.carrier = c;
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.enemies.filter((e) => e.kind !== 'carrier')).toHaveLength(MAX_ENEMIES);
    });

    it('still adds a drop due in the step a ram ends the run, and drops nothing during ending', () => {
        const w = quietWorld();
        w.player.lives = 1;
        const c = carrierAboutToDrop(w, 500);
        stillGrunt(w, w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.enemies.filter((e) => e.kind === 'grunt')).toHaveLength(1); // the rammed grunt is gone, the drop is in
        c.dropTimer = DT / 2;
        const x0 = c.x;
        w.step(DT, NONE);
        expect(c.x).toBeGreaterThan(x0); // keeps crossing
        expect(w.enemies.filter((e) => e.kind === 'grunt')).toHaveLength(1);
    });

    it('still drops in the step the carrier is shot down', () => {
        const w = quietWorld();
        const c = carrierAboutToDrop(w, 500);
        c.hp = 1;
        w.releaseBullets.push({
            x: c.x - 5, y: c.y, heading: 0, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        });
        w.step(DT, NONE);
        expect(w.carrier).toBeNull();
        expect(w.enemies.filter((e) => e.kind === 'grunt')).toHaveLength(1);
    });
});

describe('carrier scoring, targeting and contact', () => {
    it('is only targeted while its centre is on screen', () => {
        const w = quietWorld();
        const c = createCarrier(4000, 'grunt', () => 0.1, S);
        w.enemies.push(c);
        expect(w.assignTargets(3)).toEqual([]);
        c.x = 0;
        expect(w.assignTargets(3)).toEqual([c, c, c]);
    });

    it('scores 1500 when shot down, counts in the CARRIER row and is listed for debris as a carrier', () => {
        const w = quietWorld();
        const c = carrierAboutToDrop(w, 500);
        c.dropTimer = 10;
        c.hp = 1;
        w.releaseBullets.push({
            x: c.x - 5, y: c.y, heading: 0, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        });
        w.openGroups.push(w.releaseBullets[0].group);
        w.step(DT, NONE);
        expect(w.defeated.map((d) => d.kind)).toEqual(['carrier']);
        expect(w.breakdown.carrier).toEqual({ count: 1, points: 1500 });
        expect(w.score).toBe(1500);
    });

    it('counts a dropped enemy in its own kind\'s row, not the carrier\'s', () => {
        const w = quietWorld();
        const c = carrierAboutToDrop(w, 500);
        w.step(DT, NONE);
        c.x = 900; // out of the way, so the shot below reaches the dropped grunt rather than the hull
        const g = w.enemies.find((e) => e.kind === 'grunt')!;
        g.hp = 1;
        w.releaseBullets.push({
            x: g.x, y: g.y - 5, heading: Math.PI / 2, age: 0,
            group: { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false }, target: null, removed: false
        });
        w.step(DT, NONE);
        expect(w.breakdown.grunt.count).toBe(1);
        expect(w.breakdown.carrier.count).toBe(0);
    });

    it('breaks on contact like any rammed enemy: a life, +10 stock, no score, and the schedule is free again', () => {
        const w = quietWorld();
        const c = createCarrier(4000, 'grunt', () => 0.1, S);
        c.x = w.player.x;
        c.y = w.player.y;
        setState(c, 'cross');
        w.enemies.push(c);
        w.carrier = c;
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.stock).toBe(10);
        expect(w.carrier).toBeNull();
        expect(w.score).toBe(0);
        expect(w.breakdown).toEqual(emptyBreakdown());
        expect(w.defeated).toHaveLength(0);
    });

    it('frees the schedule and scores nothing when it flies off the far edge', () => {
        const w = quietWorld();
        const c = createCarrier(4000, 'grunt', () => 0.1, S);
        c.x = 1023.5;
        w.enemies.push(c);
        w.carrier = c;
        w.step(DT, NONE);
        expect(w.carrier).toBeNull();
        expect(w.defeated).toHaveLength(0);
        expect(w.score).toBe(0);
        expect(w.breakdown).toEqual(emptyBreakdown());
    });

    it('counts as one kill in a multi-kill: carrier + grunt in one release score (1500 + 100) × 1.5', () => {
        const w = quietWorld();
        const c = carrierAboutToDrop(w, 500);
        c.dropTimer = 10;
        c.hp = 1;
        const g = stillGrunt(w, 800, 400, 1);
        const group = { id: 7, pending: 2, kills: [] as number[], lastX: 0, lastY: 0, lastIsBoss: false };
        w.openGroups.push(group);
        for (const e of [c, g]) {
            w.releaseBullets.push({ x: e.x - 5, y: e.y, heading: 0, age: 0, group, target: null, removed: false });
        }
        w.step(DT, NONE);
        expect(w.settlements).toEqual([expect.objectContaining({ id: 7, kills: 2, score: 2400 })]);
        expect(w.score).toBe(2400);
    });
});
