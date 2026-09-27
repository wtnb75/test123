import { describe, expect, it } from 'vitest';
import { emptyBreakdown } from './breakdown';
import { MAX_ENEMIES, SPLITTER_CHILD_COUNT } from './constants';
import { debrisColor } from './debrisFx';
import {
    createEnemy, createSplitterChildren, fireIntervalOf, setState, updateEnemy, type Enemy, type EnemyContext
} from './enemy';
import { aimAt, volleyAngles } from './patterns';
import type { ScreenSize } from './screen';
import { World, type Input, type ReleaseBullet, type ReleaseGroup } from './world';

const S: ScreenSize = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

function ctx(overrides: Partial<EnemyContext> = {}): EnemyContext {
    return { player: { x: 512, y: 650 }, elapsed: 40, rng: () => 0.5, screen: S, ...overrides };
}

/** Steps an enemy for `seconds`, returning how many volleys it fired. */
function run(e: Enemy, seconds: number, c: EnemyContext = ctx()): number {
    let fired = 0;
    const frames = Math.round(seconds / DT);
    for (let i = 0; i < frames; i++) if (updateEnemy(e, DT, c)) fired++;
    return fired;
}

/** A splitter parent already drifting at (x, y), its first shot due as if it had just arrived. */
function drifting(x: number, y: number): Enemy {
    const e = createEnemy('splitter', 1, () => 0.1, S);
    e.x = x;
    e.y = y;
    e.fireTimer = fireIntervalOf('splitter') / 2;
    setState(e, 'drift');
    return e;
}

/** One child scattering along `heading` from (x, y). */
function scatteringChild(x: number, y: number, heading: number): Enemy {
    // createSplitterChildren turns the killing heading by +90°, so pass heading − 90° to get `heading`.
    return createSplitterChildren({ x, y }, heading - Math.PI / 2, 1, S)[0];
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('splitter parent: entering and drifting', () => {
    it('comes in from the top to 15% of the screen height, neither drifting nor firing on the way', () => {
        const e = createEnemy('splitter', 1, () => 0.1, S); // 0.1 picks the top edge
        expect(e.entry).toBe('top');
        const x0 = e.x;
        const c = ctx({ player: { x: 1000, y: 650 } }); // off to the side, so any drift would show in x
        let fired = 0;
        let t = 0;
        while (e.state === 'enter') {
            if (updateEnemy(e, DT, c)) fired++;
            t += DT;
            if (t > 5) expect.fail('never arrived');
        }
        expect(fired).toBe(0);
        expect(e.x).toBe(x0);
        expect(e.y).toBeCloseTo(115.2); // 768 × 0.15
        expect(e.state).toBe('drift');
    });

    it('fires its first shot 0.75 s after really arriving at its station', () => {
        const e = createEnemy('splitter', 1, () => 0.1, S);
        const c = ctx({ player: { x: 1000, y: 650 } });
        while (e.state === 'enter') updateEnemy(e, DT, c);
        expect(run(e, 0.73, c)).toBe(0);
        expect(run(e, 0.04, c)).toBe(1);
    });

    it('comes in from a side to the shared side station', () => {
        const e = createEnemy('splitter', 1, () => 0.8, S); // 0.8 picks the left edge on a landscape screen
        expect(e.entry).toBe('left');
        const y0 = e.y;
        // rng 0.8: height 15% + 30% × 0.8 = 39% of 768, station 20% + 15% × 0.8 = 32% of 1024 in from the left.
        expect(y0).toBeCloseTo(768 * 0.39);
        const c = ctx({ player: { x: 512, y: 700 } });
        let fired = 0;
        let t = 0;
        while (e.state === 'enter') {
            if (updateEnemy(e, DT, c)) fired++;
            t += DT;
            if (t > 5) expect.fail('never arrived');
        }
        expect(fired).toBe(0);
        expect(e.state).toBe('drift');
        expect(e.x).toBeCloseTo(1024 * 0.32);
        expect(e.y).toBe(y0);
    });

    it('drifts 40 px per second straight at the player', () => {
        const e = drifting(512, 150);
        const player = { x: 512, y: 650 };
        run(e, 1, ctx({ player }));
        expect(e.x).toBeCloseTo(512);
        expect(e.y).toBeCloseTo(190);
    });

    it('turns to follow the player when the player moves', () => {
        const e = drifting(512, 300);
        const player = { x: 512, y: 650 };
        run(e, 0.5, ctx({ player }));
        player.x = 912;
        player.y = 300 + 20;
        const before = { x: e.x, y: e.y };
        run(e, 0.5, ctx({ player }));
        expect(e.x - before.x).toBeGreaterThan(15); // now heading mostly right
        expect(dist(e, before)).toBeCloseTo(20);
    });

    it('stops on the player\'s center instead of overshooting', () => {
        const e = drifting(512, 649.5);
        run(e, 0.1, ctx({ player: { x: 512, y: 650 } }));
        expect(e.x).toBe(512);
        expect(e.y).toBe(650);
    });

    it('fires its first shot 0.75 s after arriving, then every 1.5 s', () => {
        const e = drifting(512, 150);
        const c = ctx({ player: { x: 512, y: 650 } });
        expect(run(e, 0.73, c)).toBe(0);
        expect(run(e, 0.04, c)).toBe(1);
        expect(run(e, 1.46, c)).toBe(0);
        expect(run(e, 0.04, c)).toBe(1);
    });

    it('does not fire while off screen', () => {
        const e = drifting(512, -40);
        expect(run(e, 1, ctx())).toBe(0);
    });

    it('aims one bullet at the player, straight down when it sits on the player', () => {
        expect(volleyAngles('splitter', { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual([0]);
        expect(volleyAngles('splitter', { x: 5, y: 5 }, { x: 5, y: 5 })).toEqual([Math.PI / 2]);
        expect(aimAt({ x: 0, y: 0 }, { x: 0, y: -3 })).toBeCloseTo(-Math.PI / 2);
    });
});

describe('splitter children', () => {
    it('are two, at the parent\'s position, scattering to both sides of the killing bullet', () => {
        const kids = createSplitterChildren({ x: 300, y: 200 }, 0, 10, S);
        expect(kids).toHaveLength(2);
        expect(kids.map((k) => [k.x, k.y])).toEqual([[300, 200], [300, 200]]);
        // A bullet flying right (θ = 0°) sends them straight down (90°) and straight up (270°).
        expect(kids[0].heading).toBeCloseTo(Math.PI / 2);
        expect(kids[1].heading).toBeCloseTo((3 * Math.PI) / 2);
        expect(kids.map((k) => k.id)).toEqual([10, 11]);
        expect(kids.every((k) => k.kind === 'splitterChild' && k.hp === 1 && k.radius === 8 && k.state === 'scatter')).toBe(true);
    });

    it('start inside the screen even when the parent died past its edge', () => {
        const [k] = createSplitterChildren({ x: -5, y: 800 }, 0, 1, S);
        expect(k.x).toBe(8);
        expect(k.y).toBe(768 - 8);
    });

    it('scatter at 120 px/s, 24 px in 0.2 s', () => {
        const k = scatteringChild(500, 300, 0);
        run(k, 0.2);
        expect(k.x).toBeCloseTo(524);
        expect(k.y).toBeCloseTo(300);
        expect(k.state).toBe('scatter');
    });

    it('are held inside the screen while scattering, and the scatter clock keeps running', () => {
        const k = scatteringChild(1010, 300, 0);
        run(k, 0.3);
        expect(k.x).toBe(1024 - 8);
        run(k, 0.1);
        expect(k.state).toBe('dash');
    });

    it('switch to the dash on the 24th 60 fps frame, though 24 × 1/60 sums to just under 0.4', () => {
        const k = scatteringChild(500, 300, 0);
        run(k, 23 * DT);
        expect(k.state).toBe('scatter');
        run(k, DT);
        expect(k.state).toBe('dash');
    });

    it('lock on to the player exactly when 0.4 s of scattering is up', () => {
        const k = scatteringChild(500, 300, 0);
        const c = ctx({ player: { x: 500, y: 650 } });
        updateEnemy(k, 0.399, c);
        expect(k.state).toBe('scatter');
        updateEnemy(k, 0.001, c);
        expect(k.state).toBe('dash');
        expect(k.heading).toBeCloseTo(Math.atan2(650 - k.y, 500 - k.x));
    });

    it('dash straight at 260 px/s, ignoring where the player goes afterwards', () => {
        const k = scatteringChild(500, 300, 0);
        const player = { x: 548, y: 650 };
        updateEnemy(k, 0.4, ctx({ player }));
        expect(k.state).toBe('dash');
        const heading = k.heading;
        const start = { x: k.x, y: k.y };
        player.x = 100;
        run(k, 0.5, ctx({ player }));
        expect(k.heading).toBe(heading);
        expect(dist(k, start)).toBeCloseTo(130);
    });

    it('dash straight down when they lock on sitting on the player\'s center', () => {
        const k = scatteringChild(500, 300, 0);
        // Scattering right at 120 px/s, it ends 0.4 s later at x = 548, right on the player.
        updateEnemy(k, 0.4, ctx({ player: { x: 548, y: 300 } }));
        expect(k.state).toBe('dash');
        expect(k.heading).toBe(Math.PI / 2);
    });

    it('vanish once their center leaves the screen', () => {
        const k = scatteringChild(500, 300, 0);
        setState(k, 'dash');
        k.heading = 0;
        k.x = 1019;
        run(k, DT); // 1019 + 260/60 ≈ 1023.3: center still on screen, though the body pokes out
        expect(k.removed).toBe(false);
        run(k, DT); // ≈ 1027.7: center past the right edge
        expect(k.removed).toBe(true);
    });

    it('never fire', () => {
        const k = scatteringChild(500, 300, 0);
        expect(fireIntervalOf('splitterChild')).toBe(0);
        expect(run(k, 0.35)).toBe(0);
    });

    it('leave debris in the plain body color, where a rammer of the same body color is lightened', () => {
        const body = 0x406080;
        expect(debrisColor('rammer', body)).toBe(0xa0b0c0); // each channel halfway to 255
        expect(debrisColor('splitter', body)).toBe(body);
    });
});

/** A world already in the playing phase with spawning paused. */
function playingWorld(): World {
    const w = new World(S, () => 0.5);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    return w;
}

function group(id = 0, pending = 1): ReleaseGroup {
    return { id, pending, kills: [], lastX: 0, lastY: 0, lastIsBoss: false };
}

/** Adds a splitter parent to the world, drifting at (x, y) with the given HP. */
function addParent(w: World, x: number, y: number, hp = 4): Enemy {
    const e = drifting(x, y);
    e.id = 500 + w.enemies.length;
    e.hp = hp;
    w.enemies.push(e);
    return e;
}

/** A release bullet 5 px from (x, y) along `heading`, flying at it; it hits on the next step. */
function shotAt(w: World, x: number, y: number, heading: number, g: ReleaseGroup = group()) {
    const b: ReleaseBullet = {
        x: x - Math.cos(heading) * 5, y: y - Math.sin(heading) * 5, heading, age: 0,
        group: g, target: null, removed: false
    };
    w.releaseBullets.push(b);
    return b;
}

const children = (w: World) => w.enemies.filter((e) => e.kind === 'splitterChild');

describe('splitting in the world', () => {
    it('splits a parent killed by a release bullet into two children where it died', () => {
        const w = playingWorld();
        const p = addParent(w, 400, 300, 1);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        expect(w.enemies).not.toContain(p);
        expect(w.defeated.map((d) => d.kind)).toEqual(['splitter']);
        const kids = children(w);
        expect(kids).toHaveLength(SPLITTER_CHILD_COUNT);
        expect(kids.every((k) => k.x === p.x && k.y === p.y && k.stateTime === 0)).toBe(true);
        // θ is the killing bullet's heading after this step's homing turn, as reported for the debris.
        const theta = w.defeated[0].heading;
        expect(kids[0].heading).toBeCloseTo(theta + Math.PI / 2);
        expect(kids[1].heading).toBeCloseTo(theta + (3 * Math.PI) / 2);
    });

    it('lets children move only from the next step', () => {
        const w = playingWorld();
        const p = addParent(w, 400, 300, 1);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        const [k] = children(w);
        w.step(DT, NONE);
        expect(k.stateTime).toBeCloseTo(DT);
        expect(dist(k, p)).toBeCloseTo(120 * DT); // one step of scattering from where the parent died
    });

    it('keeps the kill step\'s later bullets and the player off the new children', () => {
        const w = playingWorld();
        addParent(w, w.player.x, w.player.y - 200, 1);
        shotAt(w, w.player.x, w.player.y - 200, 0);
        // A second bullet right on the same spot, handled after the kill: no child to hit or target yet.
        const late = shotAt(w, w.player.x, w.player.y - 200, 0);
        w.step(DT, NONE);
        expect(children(w)).toHaveLength(2);
        expect(w.releaseBullets).toContain(late);
        expect(late.target).toBeNull();
        // From the next step it homes on a child.
        w.step(DT, NONE);
        expect(late.target?.kind).toBe('splitterChild');
    });

    it('does not let children born on top of the player ram it in the kill step, only from the next one', () => {
        const w = playingWorld();
        const { x, y } = w.player;
        // 10 px away: inside the 10 + 8 px contact range of a child born there.
        addParent(w, x, y - 10, 1);
        shotAt(w, x, y - 10, 0);
        w.step(DT, NONE);
        expect(children(w)).toHaveLength(2);
        expect(w.player.lives).toBe(3);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
    });

    it('has a bullet retargeting in the kill step pick another on-screen enemy and stay on it', () => {
        const w = playingWorld();
        const p = addParent(w, 400, 300, 1);
        const grunt = createEnemy('grunt', 900, () => 0.5, S);
        grunt.x = 900;
        grunt.y = 200;
        grunt.state = 'dash'; // holds still, never fires
        w.enemies.push(grunt);
        shotAt(w, 400, 300, 0);
        // Far enough behind that it can't run into a child on the next step.
        const late = { x: 300, y: 300, heading: 0, age: 0, group: group(), target: p as Enemy | null, removed: false };
        p.incoming++;
        w.releaseBullets.push(late);
        w.step(DT, NONE);
        expect(late.target).toBe(grunt);
        w.step(DT, NONE);
        expect(late.target).toBe(grunt);
    });

    it('does not split a parent that is only damaged', () => {
        const w = playingWorld();
        const p = addParent(w, 400, 300, 2);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        expect(p.hp).toBe(1);
        expect(children(w)).toHaveLength(0);
    });

    it('does not split a parent broken by ramming the player', () => {
        const w = playingWorld();
        const p = addParent(w, w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.player.invulnerable).toBeGreaterThan(0);
        expect(w.stock).toBe(10);
        expect(w.enemies).not.toContain(p);
        expect(children(w)).toHaveLength(0);
        expect(w.score).toBe(0);
        expect(w.breakdown).toEqual(emptyBreakdown());
    });

    it('still splits in the step a ram ends the run, and the children keep moving through ending', () => {
        const w = playingWorld();
        w.player.lives = 1;
        addParent(w, 400, 300, 1);
        shotAt(w, 400, 300, 0);
        const grunt = createEnemy('grunt', 900, () => 0.5, S);
        grunt.x = w.player.x;
        grunt.y = w.player.y;
        grunt.state = 'dash';
        w.enemies.push(grunt);
        // A second parent whose shot falls due during ending: it keeps drifting but holds its fire.
        const other = addParent(w, 800, 150);
        other.fireTimer = 2 * DT;
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        const [k] = children(w);
        const y0 = k.y;
        const otherY = other.y;
        for (let i = 0; i < 5; i++) w.step(DT, NONE);
        expect(k.y).not.toBe(y0);
        expect(other.y).toBeGreaterThan(otherY);
        expect(w.enemyBullets).toHaveLength(0);
    });

    it('does not count children toward the cap of 6 regular enemies', () => {
        const w = playingWorld();
        for (let i = 0; i < 3; i++) w.enemies.push(...createSplitterChildren({ x: 200 + i * 100, y: 300 }, 0, 700 + i * 2, S));
        for (let i = 0; i < MAX_ENEMIES - 1; i++) addParent(w, 100 + i * 150, 150);
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.enemies.filter((e) => e.kind !== 'splitterChild')).toHaveLength(MAX_ENEMIES);
    });

    it('counts a splitter parent toward the cap of 6', () => {
        const w = playingWorld();
        for (let i = 0; i < MAX_ENEMIES; i++) addParent(w, 100 + i * 150, 150);
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.enemies).toHaveLength(MAX_ENEMIES);
    });
});

describe('splitter scoring', () => {
    it('clears parent and both children with a 6-bullet release when the parent is alone: 3 kills, (400 + 100 + 100) × 2.0', () => {
        const w = playingWorld();
        const p = addParent(w, w.player.x, 250);
        w.stock = 6;
        w.step(DT, { ...NONE, release: true });
        // At release the children don't exist yet: 4 bullets finish the parent and, with no other
        // enemy on screen, the 2 surplus go round-robin to the parent too.
        expect(w.releaseBullets.filter((b) => b.target === p)).toHaveLength(6);
        let t = 0;
        while (w.releaseBullets.length > 0) {
            if (t > 5) expect.fail('release bullets still flying');
            w.step(DT, NONE);
            t += DT;
        }
        expect(w.enemies).toHaveLength(0);
        expect(w.breakdown.splitter).toEqual({ count: 3, points: 600 });
        expect(w.score).toBe(1200);
    });

    it('counts a child toward the release whose bullet finished it, not the one that killed the parent', () => {
        const w = playingWorld();
        const a = group(1, 1);
        const b = group(2, 1);
        w.openGroups.push(a, b);
        addParent(w, 400, 300, 1);
        shotAt(w, 400, 300, 0, a);
        w.step(DT, NONE);
        const [k] = children(w);
        shotAt(w, k.x, k.y + 120 * DT, Math.PI / 2, b);
        w.step(DT, NONE);
        expect(a.kills).toEqual([400]);
        expect(b.kills).toEqual([100]);
    });

    it('lists killed children as splitters for the debris effect', () => {
        const w = playingWorld();
        const [k] = createSplitterChildren({ x: 400, y: 300 }, 0, 700, S);
        w.enemies.push(k);
        shotAt(w, 400, 300 + 120 * DT, Math.PI / 2);
        w.step(DT, NONE);
        expect(w.defeated.map((d) => d.kind)).toEqual(['splitter']);
        expect(w.breakdown.splitter).toEqual({ count: 1, points: 100 });
    });

    it('scores nothing for a child that dashes off the screen', () => {
        const w = playingWorld();
        const [k] = createSplitterChildren({ x: 1020, y: 300 }, 0, 700, S);
        setState(k, 'dash');
        k.heading = 0;
        k.x = 1023;
        w.enemies.push(k);
        w.step(DT, NONE);
        expect(w.enemies).not.toContain(k);
        expect(w.defeated).toHaveLength(0);
        expect(w.breakdown).toEqual(emptyBreakdown());
    });

    it('treats a child ramming the player like any rammed enemy: a life, +10 stock, no score', () => {
        const w = playingWorld();
        const [k] = createSplitterChildren(w.player, 0, 700, S);
        w.enemies.push(k);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.player.invulnerable).toBeGreaterThan(0);
        expect(w.stock).toBe(10);
        expect(w.enemies).not.toContain(k);
        expect(w.score).toBe(0);
        expect(w.breakdown).toEqual(emptyBreakdown());
    });
});
