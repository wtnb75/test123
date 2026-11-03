import { describe, expect, it } from 'vitest';
import { createBoss } from './boss';
import { assignHeavySlots, createCarrier, createEnemy, createLeech, leechOrbitPoint, updateLeech, type Enemy } from './enemy';
import type { ScreenSize } from './screen';
import { World, type EnemyBullet, type Input, type ReleaseBullet, type ReleaseGroup } from './world';

// Expected values are worked out by hand from docs/spec/leech.md (initial values: spawn at 40 s then every 25 s, at
// most 2, orbit 60 px at 90 deg/s, speed 100 px/s, drain 6 × (1 − d/90) per second, HP 4, score 400).

const S: ScreenSize = { width: 1024, height: 768 };
const PORTRAIT: ScreenSize = { width: 768, height: 1024 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

/** A world in the playing phase with every spawn (regular, rammer, boss, carrier, leech) paused. */
function quietWorld(rng: () => number = () => 0.5, screen: ScreenSize = S): World {
    const w = new World(screen, rng);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    w.nextBossAt = Infinity;
    w.nextCarrierAt = Infinity;
    w.nextLeechAt = Infinity;
    return w;
}

/** A rng that answers with the given values in turn, then 0.5. */
function sequence(...values: number[]): () => number {
    let i = 0;
    return () => (i < values.length ? values[i++] : 0.5);
}

const leeches = (w: World): Enemy[] => w.enemies.filter((e) => e.kind === 'leech');

/** A leech `d` px from the player at `angle` (radians), whose orbit starts at that angle, going clockwise (+). */
function leechAt(w: World, d: number, angle = 0, dir = 1): Enemy {
    const e = createLeech(5000 + w.enemies.length, w.player, () => 0.5, w.screen);
    e.x = w.player.x + Math.cos(angle) * d;
    e.y = w.player.y + Math.sin(angle) * d;
    e.orbitAngle = angle;
    e.orbitDir = dir;
    w.enemies.push(e);
    return e;
}

function run(w: World, frames: number): void {
    for (let i = 0; i < frames; i++) w.step(DT, NONE);
}

function newGroup(pending: number): ReleaseGroup {
    return { id: 0, pending, kills: [], lastX: 0, lastY: 0, lastIsBoss: false };
}

describe('leech spawning', () => {
    it('does not appear just before 40 s and appears at exactly 40 s', () => {
        const w = quietWorld();
        w.nextLeechAt = 40;
        w.elapsed = 40 - 1e-9;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(0);
        w.elapsed = 40;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(1);
    });

    it('is first due at 40 s on a fresh world', () => {
        expect(new World(S).nextLeechAt).toBe(40);
    });

    it('schedules the next one 25 s after the one that appeared', () => {
        const w = quietWorld();
        w.nextLeechAt = 40;
        w.elapsed = 40;
        w.step(DT, NONE);
        expect(w.nextLeechAt).toBe(65);
        w.elapsed = 65 - 1e-9;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(1);
        w.elapsed = 65;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(2);
    });

    it('sends only one per appearance, however long it is overdue', () => {
        const w = quietWorld();
        w.nextLeechAt = 10;
        w.elapsed = 100;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(1);
        expect(w.nextLeechAt).toBe(125);
    });

    it('waits while two are on the field and comes on the first frame one is gone, rescheduling from then', () => {
        const w = quietWorld();
        const a = leechAt(w, 60, 0);
        leechAt(w, 60, Math.PI);
        w.nextLeechAt = 40;
        w.elapsed = 50;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(2);
        expect(w.nextLeechAt).toBe(40);
        a.removed = true; // e.g. it rammed the player
        w.elapsed = 51;
        w.step(DT, NONE);
        expect(leeches(w).filter((e) => !e.removed)).toHaveLength(2);
        expect(w.nextLeechAt).toBe(76);
    });

    it('does not appear during the countdown or the ending', () => {
        const ready = new World(S, () => 0.5);
        ready.nextLeechAt = 0;
        ready.elapsed = 100;
        ready.step(1, NONE);
        expect(leeches(ready)).toHaveLength(0);

        const ending = quietWorld();
        ending.nextLeechAt = 0;
        ending.elapsed = 100;
        ending.phase = 'ending';
        ending.step(DT, NONE);
        expect(leeches(ending)).toHaveLength(0);
    });

    it('appears with a boss and a carrier on the field', () => {
        const w = quietWorld();
        const boss = createBoss(1, 9001, S);
        w.boss = boss;
        w.enemies.push(boss);
        const carrier = createCarrier(9002, 'grunt', () => 0.9, S);
        w.carrier = carrier;
        w.enemies.push(carrier);
        w.nextLeechAt = 0;
        w.step(DT, NONE);
        expect(leeches(w)).toHaveLength(1);
    });

    it('is in neither the 6-enemy cap nor the 6-rammer cap, and does not stop regular spawns', () => {
        const w = quietWorld();
        w.elapsed = 100;
        for (let i = 0; i < 5; i++) {
            const g = createEnemy('grunt', 100 + i, () => 0.5, S);
            g.state = 'dash';
            g.x = 100 + i * 60;
            g.y = 300;
            w.enemies.push(g);
        }
        leechAt(w, 200, 0);
        leechAt(w, 200, Math.PI);
        w.spawnTimer = 0;
        w.step(DT, NONE);
        const regulars = w.enemies.filter((e) => e.kind !== 'leech' && e.kind !== 'rammer');
        expect(regulars).toHaveLength(6); // 5 grunts + the new one: the two leeches were not counted
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.enemies.filter((e) => e.kind !== 'leech' && e.kind !== 'rammer')).toHaveLength(6); // now capped
    });
});

describe('where a leech appears', () => {
    // Landscape odds: top below 70 %, left below 85 %, right otherwise. rng draws: edge, position, then the turn direction.
    it('enters above the screen at a random x within the edge margins, turning clockwise on a low coin', () => {
        const w = quietWorld();
        const e = createLeech(1, w.player, sequence(0.0, 0.5, 0.2), S);
        expect(e.entry).toBe('top');
        expect(e.x).toBeCloseTo(40 + 0.5 * (1024 - 80), 9);
        expect(e.y).toBe(-14);
        expect(e.orbitDir).toBe(1);
        expect(e.orbitAngle).toBeCloseTo(Math.atan2(e.y - w.player.y, e.x - w.player.x), 9);
    });

    it('enters left of the screen at 15..45 % of the height, turning counter-clockwise on a high coin', () => {
        const w = quietWorld();
        const e = createLeech(1, w.player, sequence(0.8, 0.5, 0.7), S);
        expect(e.entry).toBe('left');
        expect(e.x).toBe(-14);
        expect(e.y).toBeCloseTo(768 * 0.3, 9);
        expect(e.orbitDir).toBe(-1);
    });

    it('enters right of the screen at the same heights', () => {
        const w = quietWorld();
        const e = createLeech(1, w.player, sequence(0.9, 0, 0.5), S);
        expect(e.entry).toBe('right');
        expect(e.x).toBe(1024 + 14);
        expect(e.y).toBeCloseTo(768 * 0.15, 9);
        expect(e.orbitDir).toBe(-1); // exactly 0.5 is not below 0.5
    });

    it('uses the portrait odds: 60 % is a left entry there (50/25/25) though a top entry on a landscape screen', () => {
        const player = { x: 384, y: 870 };
        expect(createLeech(1, player, sequence(0.6, 0.5, 0.5), PORTRAIT).entry).toBe('left');
        expect(createLeech(1, player, sequence(0.6, 0.5, 0.5), S).entry).toBe('top');
    });

    it('has the leech spec: 4 HP, 14 px radius, starts unspent', () => {
        const e = createLeech(1, { x: 0, y: 0 }, () => 0.5, S);
        expect(e).toMatchObject({ kind: 'leech', hp: 4, maxHp: 4, radius: 14, removed: false });
    });
});

describe('how a leech moves', () => {
    const player = { x: 500, y: 400 };
    // Starts on its orbit point at angle 0 (60 px to the right), so it can keep up with the point as it turns.
    const onOrbit = (dir: number): Enemy => {
        const e = createLeech(1, player, () => 0.5, S);
        e.x = 560;
        e.y = 400;
        e.orbitAngle = 0;
        e.orbitDir = dir;
        return e;
    };

    it('stays put on the frame it appears when it is already on the point, which is at second 0', () => {
        const e = onOrbit(1);
        updateLeech(e, 0.5, player);
        expect(e.state).toBe('orbit');
        expect(e.stateTime).toBe(0);
        expect(e.x).toBe(560);
        expect(e.y).toBe(400);
    });

    it('follows the point clockwise: 45 degrees after 0.5 s, 90 degrees after 1 s', () => {
        const e = onOrbit(1);
        updateLeech(e, 0.5, player);
        updateLeech(e, 0.5, player); // second 0.5
        expect(e.x).toBeCloseTo(500 + 60 * Math.SQRT1_2, 6);
        expect(e.y).toBeCloseTo(400 + 60 * Math.SQRT1_2, 6);
        updateLeech(e, 0.5, player); // second 1
        expect(e.x).toBeCloseTo(500, 6);
        expect(e.y).toBeCloseTo(460, 6);
    });

    it('follows the point counter-clockwise the other way', () => {
        const e = onOrbit(-1);
        updateLeech(e, 0.5, player);
        updateLeech(e, 0.5, player);
        expect(e.x).toBeCloseTo(500 + 60 * Math.SQRT1_2, 6);
        expect(e.y).toBeCloseTo(400 - 60 * Math.SQRT1_2, 6);
    });

    it('describes the orbit point by its angle: angle 0 is to the right of the player, 90 degrees is below', () => {
        expect(leechOrbitPoint({ orbitAngle: 0, orbitDir: 1 }, 0, player)).toEqual({ x: 560, y: 400 });
        const quarter = leechOrbitPoint({ orbitAngle: 0, orbitDir: 1 }, 1, player);
        expect(quarter.x).toBeCloseTo(500, 9);
        expect(quarter.y).toBeCloseTo(460, 9);
    });

    it('closes in at no more than 100 px/s', () => {
        const e = createLeech(1, player, () => 0.5, S);
        e.x = 800;
        e.y = 400;
        e.orbitAngle = 0;
        updateLeech(e, 0.1, player);
        expect(e.x).toBeCloseTo(790, 9);
        expect(e.y).toBeCloseTo(400, 9);
    });

    it('stops on the point instead of overshooting it', () => {
        const e = createLeech(1, player, () => 0.5, S);
        e.x = 565; // 5 px from the point at 560
        e.y = 400;
        e.orbitAngle = 0;
        updateLeech(e, 0.5, player); // would travel 50 px
        expect(e.x).toBe(560);
        expect(e.y).toBe(400);
    });

    it('chases the player where they are now: the point is recomputed from the current position', () => {
        const e = onOrbit(1);
        updateLeech(e, 0.1, player);
        const moved = { x: 500, y: 100 };
        updateLeech(e, 0.1, moved); // second 0.1; the point is now near (560, 100); the leech can only go 10 px
        expect(e.y).toBeCloseTo(390, 3);
        expect(e.y).toBeLessThan(400);
    });

    it('never comes closer than the 60 px orbit while closing in on a player standing still, from any edge and either way round', () => {
        // Seeded spawns from the real entry rules; without the "stay outside" rule about 4 in 10 of these cut across the player.
        let seed = 12345;
        const rng = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };
        const stand = { x: 512, y: 652.8 };
        let closest = Infinity;
        for (let i = 0; i < 300; i++) {
            const e = createLeech(1, stand, rng, S);
            for (let f = 0; f < 60 * 20; f++) {
                updateLeech(e, DT, stand);
                closest = Math.min(closest, Math.hypot(e.x - stand.x, e.y - stand.y));
            }
        }
        expect(closest).toBeGreaterThan(60 - 1e-5);
    });

    it('slides round the orbit edge instead of crossing it: 61 px out with its point on the far side ends the step exactly 60 px out', () => {
        const e = createLeech(1, player, () => 0.5, S);
        e.x = player.x + 61;
        e.y = player.y;
        e.orbitAngle = Math.PI; // the point is 60 px to the left of the player
        updateLeech(e, 0.5, player); // the first step would carry it 50 px left, through the player
        expect(Math.hypot(e.x - player.x, e.y - player.y)).toBeCloseTo(60, 9);
        expect(e.y).toBeCloseTo(player.y, 9); // pushed straight back out along the line from the player
    });

    it('does not push a leech back out when the player has walked into the orbit', () => {
        const e = createLeech(1, player, () => 0.5, S);
        e.x = player.x + 40;
        e.y = player.y;
        e.orbitAngle = Math.PI;
        updateLeech(e, 0.1, player); // moves 10 px toward the point on the far side: 40 -> 30 px from the player
        expect(Math.hypot(e.x - player.x, e.y - player.y)).toBeCloseTo(30, 9);
    });

    it('lags behind a player running away at 320 px/s and falls out of the drain range', () => {
        const w = quietWorld();
        w.player.x = 500;
        w.player.y = 100;
        const e = leechAt(w, 60, 0);
        for (let i = 0; i < 60; i++) w.step(DT, { ...NONE, moveY: 1 }); // 1 s straight down: 320 px, 100..420
        expect(w.player.y).toBeCloseTo(420, 6);
        // The player covered 320 px, the leech at most 100 px: it is left far behind, outside the 90 px field.
        expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeGreaterThan(90);
    });
});

describe('what a leech drains', () => {
    it('takes 1 stock on the 30th frame at the 60 px orbit (2 per second), then 1 more every 30 frames', () => {
        const w = quietWorld();
        w.stock = 10;
        leechAt(w, 60, 0);
        run(w, 29);
        expect(w.stock).toBe(10);
        expect(w.stockDrained).toBe(0);
        run(w, 1);
        expect(w.stock).toBe(9);
        expect(w.stockDrained).toBe(1);
        run(w, 1);
        expect(w.stockDrained).toBe(0);
        run(w, 29);
        expect(w.stock).toBe(8);
    });

    it('adds up two leeches: 4 per second takes 1 on the 15th frame', () => {
        const w = quietWorld();
        w.stock = 10;
        leechAt(w, 60, 0);
        leechAt(w, 60, Math.PI);
        run(w, 14);
        expect(w.stock).toBe(10);
        run(w, 1);
        expect(w.stock).toBe(9);
    });

    it('takes nothing from a leech outside the field (still closing in from 200 px)', () => {
        const w = quietWorld();
        w.stock = 10;
        leechAt(w, 200, 0);
        run(w, 30); // 0.5 s: it has come in by 50 px at most, to 150 px
        expect(w.stock).toBe(10);
        expect(w.drainCarry).toBe(0);
    });

    it('does not take from an empty stock, and what built up meanwhile does not eat the stock absorbed later', () => {
        const w = quietWorld();
        leechAt(w, 60, 0);
        run(w, 100);
        expect(w.stock).toBe(0);
        expect(w.drainCarry).toBe(0);
        w.stock = 5;
        run(w, 29);
        expect(w.stock).toBe(5);
        run(w, 1);
        expect(w.stock).toBe(4);
    });

    it('also drains while the player is invulnerable', () => {
        const w = quietWorld();
        w.stock = 10;
        w.player.invulnerable = 5;
        leechAt(w, 60, 0);
        run(w, 30);
        expect(w.stock).toBe(9);
    });

    it('does not drain, or build up anything, during the countdown', () => {
        const w = new World(S, () => 0.5);
        w.stock = 10;
        leechAt(w, 60, 0);
        for (let i = 0; i < 100; i++) w.step(DT, NONE); // still ready (3 s)
        expect(w.phase).toBe('ready');
        expect(w.stock).toBe(10);
        expect(w.drainCarry).toBe(0);
    });

    it('does not drain, or build up anything, during the ending, though the leech keeps moving', () => {
        const w = quietWorld();
        w.stock = 10;
        const e = leechAt(w, 60, 0);
        w.phase = 'ending';
        w.phaseTime = 0;
        const x0 = e.x;
        run(w, 40);
        expect(w.stock).toBe(10);
        expect(w.drainCarry).toBe(0);
        expect(w.stockDrained).toBe(0);
        expect(e.x).not.toBe(x0);
    });

    it('drains from the stock left after an automatic release in the same frame, not before it', () => {
        const w = quietWorld();
        w.stock = 49;
        w.drainCarry = 0.99; // the leech would take 1 this frame
        leechAt(w, 60, 0);
        const bullet: EnemyBullet = { x: w.player.x, y: w.player.y - 50, vx: 0, vy: 0, removed: false };
        w.enemyBullets.push(bullet);
        w.step(DT, NONE);
        expect(bullet.removed).toBe(true); // absorbed: 49 -> 50 -> auto release -> 0
        expect(w.stock).toBe(0);
        expect(w.stockDrained).toBe(0); // nothing left to take, so the leech got nothing
        expect(w.drainCarry).toBe(0);
    });

    it('does not give anything back when the leech dies', () => {
        const w = quietWorld();
        w.stock = 10;
        const e = leechAt(w, 60, 0);
        run(w, 30);
        expect(w.stock).toBe(9);
        e.removed = true;
        run(w, 5);
        expect(w.stock).toBe(9);
    });
});

describe('fighting a leech', () => {
    it('is a normal target: a 4-bullet release homes on the nearest leech on screen', () => {
        const w = quietWorld();
        const e = leechAt(w, 60, 0);
        w.stock = 4;
        w.release();
        expect(w.releaseBullets).toHaveLength(4);
        for (const b of w.releaseBullets) expect(b.target).toBe(e);
        expect(e.incoming).toBe(4);
    });

    it('is not a target while its centre is off the screen', () => {
        const w = quietWorld();
        const e = leechAt(w, 60, 0);
        e.x = -14;
        e.y = 100;
        w.stock = 4;
        w.release();
        for (const b of w.releaseBullets) expect(b.target).toBeNull();
    });

    it('dies to 4 hits for 400 points, counted as a leech in the breakdown, and shows up in the defeat list', () => {
        const w = quietWorld();
        const e = leechAt(w, 60, 0);
        const group = newGroup(4);
        for (let i = 0; i < 4; i++) {
            const b: ReleaseBullet = { x: e.x, y: e.y, heading: 0, age: 0, group, target: null, removed: false };
            w.releaseBullets.push(b);
        }
        w.step(DT, NONE);
        expect(e.hp).toBe(0);
        expect(e.removed).toBe(true);
        expect(w.score).toBe(400);
        expect(w.breakdown.leech).toEqual({ count: 1, points: 400 });
        expect(w.defeated.map((d) => d.kind)).toEqual(['leech']);
    });

    it('survives 3 hits', () => {
        const w = quietWorld();
        const e = leechAt(w, 60, 0);
        const group = newGroup(3);
        for (let i = 0; i < 3; i++) {
            w.releaseBullets.push({ x: e.x, y: e.y, heading: 0, age: 0, group, target: null, removed: false });
        }
        w.step(DT, NONE);
        expect(e.hp).toBe(1);
        expect(e.removed).toBe(false);
        expect(w.score).toBe(0);
    });

    it('breaks on ramming the player like any enemy: -1 life, +10 stock, no score, not in the breakdown', () => {
        const w = quietWorld();
        const e = leechAt(w, 20, 0);
        w.step(DT, NONE);
        expect(e.removed).toBe(true);
        expect(w.player.lives).toBe(2);
        expect(w.stock).toBe(10);
        expect(w.score).toBe(0);
        expect(w.breakdown.leech).toEqual({ count: 0, points: 0 });
        expect(w.defeated).toHaveLength(0);
    });

    it('does not ram the player just by circling at 60 px', () => {
        const w = quietWorld();
        leechAt(w, 60, 0);
        run(w, 120);
        expect(w.player.lives).toBe(3);
    });

    it('counts as one kill in the multi-kill bonus: a grunt (100) and a leech (400) in one release score 500 × 1.5 = 750', () => {
        const w = quietWorld();
        const leech = leechAt(w, 60, 0);
        const grunt = createEnemy('grunt', 777, () => 0.5, S);
        grunt.state = 'dash'; // a state grunts never use: it holds still
        grunt.x = 200;
        grunt.y = 300;
        grunt.hp = 1;
        w.enemies.push(grunt);
        const group = newGroup(5);
        w.releaseBullets.push({ x: grunt.x, y: grunt.y, heading: 0, age: 0, group, target: null, removed: false });
        for (let i = 0; i < 4; i++) {
            w.releaseBullets.push({ x: leech.x, y: leech.y, heading: 0, age: 0, group, target: null, removed: false });
        }
        w.step(DT, NONE);
        expect(grunt.removed).toBe(true);
        expect(leech.removed).toBe(true);
        expect(w.killUpdates).toEqual([expect.objectContaining({ kills: 2 })]);
        expect(w.score).toBe(750);
    });

    it('scores a lone leech kill with no multiplier: 400', () => {
        const w = quietWorld();
        const leech = leechAt(w, 60, 0);
        const group = newGroup(4);
        for (let i = 0; i < 4; i++) {
            w.releaseBullets.push({ x: leech.x, y: leech.y, heading: 0, age: 0, group, target: null, removed: false });
        }
        w.step(DT, NONE);
        expect(w.killUpdates).toEqual([expect.objectContaining({ kills: 1 })]);
        expect(w.score).toBe(400);
    });
});

describe('leeches alongside other rules', () => {
    it('is left out of the heavies\' ring: two chasing heavies still sit opposite each other, whatever leeches stand first in the list', () => {
        const player = { x: 512, y: 652.8 };
        const leech = createLeech(1, player, () => 0.5, S);
        const h1 = createEnemy('heavy', 2, () => 0.5, S);
        const h2 = createEnemy('heavy', 3, () => 0.5, S);
        h1.state = h2.state = 'chase';
        h1.x = 300;
        h1.y = 200;
        h2.x = 700;
        h2.y = 200;
        assignHeavySlots([leech, h1, h2], player);
        const phi = Math.atan2(200 - 652.8, 300 - 512); // from the player to the oldest heavy
        expect(h1.slotAngle).toBeCloseTo(phi, 9);
        expect(h2.slotAngle).toBeCloseTo(phi + Math.PI, 9);
        expect(leech.slotAngle).toBe(0);
    });

    it('is not counted against the 6-rammer cap: with two leeches out, rammers still come up to 6 and no more', () => {
        const w = quietWorld();
        w.elapsed = 130; // three rammers per wave
        leechAt(w, 200, 0);
        leechAt(w, 200, Math.PI);
        const rammers = () => w.enemies.filter((e) => e.kind === 'rammer').length;
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers()).toBe(3);
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers()).toBe(6);
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers()).toBe(6);
    });

    it('moves on the frame it appears: one step after its spawn it is 100 × dt closer to the player', () => {
        const w = quietWorld(sequence(0.0, 0.5, 0.2)); // top edge, middle x, clockwise
        w.nextLeechAt = 0;
        w.step(DT, NONE);
        const [e] = leeches(w);
        expect(e.state).toBe('orbit');
        expect(e.x).toBeCloseTo(512, 9);
        expect(e.y).toBeCloseTo(-14 + 100 * DT, 9);
    });

    it('drains from a leech whose centre is off the screen when it is inside the field', () => {
        const w = quietWorld();
        w.player.x = 30;
        w.player.y = 400;
        w.stock = 10;
        const e = leechAt(w, 60, Math.PI); // x = -30: outside the screen
        expect(e.x).toBeLessThan(0);
        run(w, 30);
        expect(w.stock).toBe(9);
    });

    it('adds the ram relief after the drain: relief stock is never drained in the frame it arrives', () => {
        const w = quietWorld();
        w.drainCarry = 0.99; // a leech would take 1 this frame, if there were stock to take
        leechAt(w, 20, 0); // rams the player and breaks
        leechAt(w, 60, Math.PI); // circles on and keeps draining
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.stock).toBe(10);
        expect(w.stockDrained).toBe(0);
    });

    it('catches up with a player standing still and settles into the 60 px orbit without ramming', () => {
        const w = quietWorld();
        leechAt(w, 100, 0);
        run(w, 300); // 5 s
        const e = leeches(w)[0];
        expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeCloseTo(60, 0);
        expect(w.player.lives).toBe(3);
    });
});

describe('the edge a leech comes from, at the odds boundaries', () => {
    const player = { x: 500, y: 600 };
    it.each([
        [S, 0.699, 'top'], [S, 0.701, 'left'], [S, 0.849, 'left'], [S, 0.851, 'right'],
        [PORTRAIT, 0.499, 'top'], [PORTRAIT, 0.501, 'left'], [PORTRAIT, 0.749, 'left'], [PORTRAIT, 0.751, 'right']
    ] as const)('on %j a roll of %d enters from the %s', (screen, roll, edge) => {
        expect(createLeech(1, player, sequence(roll, 0.5, 0.5), screen).entry).toBe(edge);
    });

    it('spans the edge margins when entering from above: x from 40 to width - 40', () => {
        expect(createLeech(1, player, sequence(0, 0, 0.5), S).x).toBe(40);
        expect(createLeech(1, player, sequence(0, 1, 0.5), S).x).toBe(1024 - 40);
    });

    it('spans 15..45 % of the height when entering from a side', () => {
        expect(createLeech(1, player, sequence(0.8, 0, 0.5), S).y).toBeCloseTo(768 * 0.15, 9);
        expect(createLeech(1, player, sequence(0.8, 1, 0.5), S).y).toBeCloseTo(768 * 0.45, 9);
    });
});
