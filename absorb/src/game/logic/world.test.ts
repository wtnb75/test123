import { describe, expect, it } from 'vitest';
import { RELEASE_SPEED, STOCK_MAX } from './constants';
import { createEnemy, type Enemy } from './enemy';
import type { ScreenSize } from './screen';
import { shortfall, World, type Input, type ReleaseGroup } from './world';

const S: ScreenSize = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

/** A one-bullet release group for bullets a test places by hand. */
function newGroup(): ReleaseGroup {
    return { id: 0, pending: 1, kills: [], lastX: 0, lastY: 0, lastIsBoss: false };
}

function input(overrides: Partial<Input>): Input {
    return { ...NONE, ...overrides };
}

/** A world already in the playing phase with spawning paused. */
function playingWorld(screen: ScreenSize = S, rng: () => number = () => 0.5): World {
    const w = new World(screen, rng);
    w.step(3, NONE);
    w.spawnTimer = Infinity;
    w.rammerTimer = Infinity;
    return w;
}

/**
 * Adds an enemy that holds still and never fires: a grunt or shooter put in 'dash', a state
 * those kinds never use, which their update ignores. (Heavies always move, so they can't be used.)
 */
function still(w: World, kind: 'grunt' | 'shooter', x: number, y: number, hp?: number): Enemy {
    const e = createEnemy(kind, 1000 + w.enemies.length, () => 0.5, w.screen);
    e.x = x;
    e.y = y;
    e.state = 'dash';
    if (hp !== undefined) e.hp = hp;
    w.enemies.push(e);
    return e;
}

function steps(w: World, seconds: number, i: Input = NONE): void {
    const n = Math.round(seconds / DT);
    for (let k = 0; k < n; k++) w.step(DT, i);
}

function untilBulletsGone(w: World, limit = 5): void {
    let t = 0;
    while (w.releaseBullets.length > 0) {
        if (t > limit) expect.fail('release bullets still flying');
        w.step(DT, NONE);
        t += DT;
    }
}

describe('phases', () => {
    it('counts down 3 s in ready with no enemies, only player movement', () => {
        const w = new World(S, () => 0.5);
        const x0 = w.player.x;
        w.stock = 5;
        steps(w, 2.9, input({ moveX: 1, release: true }));
        expect(w.phase).toBe('ready');
        expect(w.enemies).toHaveLength(0);
        expect(w.player.x).toBeGreaterThan(x0);
        expect(w.stock).toBe(5);
        expect(w.releaseBullets).toHaveLength(0);
        steps(w, 0.15);
        expect(w.phase).toBe('playing');
    });

    it('starts the player centered 85% down the screen', () => {
        const w = new World({ width: 768, height: 1536 });
        expect(w.player).toMatchObject({ x: 384, y: 1536 * 0.85, lives: 3 });
    });

    it('goes playing -> ending when the last life is lost, then over after 1 s', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        steps(w, 0.95);
        expect(w.phase).toBe('ending');
        steps(w, 0.1);
        expect(w.phase).toBe('over');
    });

    it('stops absorbing, hitting and spawning during ending', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        const stock = w.stock;
        w.enemyBullets.push({ x: w.player.x + 20, y: w.player.y, vx: 0, vy: 0, removed: false });
        const target = still(w, 'shooter', w.player.x, w.player.y - 30, 8);
        w.releaseBullets.push({ x: target.x, y: target.y, heading: 0, age: 0, group: newGroup(), target: null, removed: false });
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.stock).toBe(stock);
        expect(w.enemyBullets).toHaveLength(1);
        expect(target.hp).toBe(8);
        expect(w.enemies).toHaveLength(1);
    });
});

describe('spawning', () => {
    it('spawns the first enemy at 0 s and the next one a spawn interval later', () => {
        const w = new World(S, () => 0.5);
        w.step(3, NONE);
        w.step(DT, NONE);
        expect(w.enemies).toHaveLength(1);
        steps(w, 2.9);
        expect(w.enemies).toHaveLength(1);
        steps(w, 0.15);
        expect(w.enemies).toHaveLength(2);
    });

    it('sends the first rammer at 10 s', () => {
        const w = new World(S, () => 0.5);
        w.step(3, NONE);
        w.spawnTimer = Infinity;
        steps(w, 9.95);
        expect(w.enemies.filter((e) => e.kind === 'rammer')).toHaveLength(0);
        steps(w, 0.1);
        expect(w.enemies.filter((e) => e.kind === 'rammer')).toHaveLength(1);
    });

    it('skips a spawn while 6 non-rammer enemies are present, not counting rammers', () => {
        const w = playingWorld();
        for (let i = 0; i < 6; i++) still(w, 'grunt', 100 + i * 100, 100);
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.enemies).toHaveLength(6);
        expect(w.spawnTimer).toBeCloseTo(3 - DT);
        w.enemies.pop();
        const r = createEnemy('rammer', 99, () => 0.5, S);
        w.enemies.push(r);
        w.spawnTimer = 0;
        w.step(DT, NONE);
        expect(w.enemies.filter((e) => e.kind !== 'rammer')).toHaveLength(6);
    });

    const rammers = (w: World) => w.enemies.filter((e) => e.kind === 'rammer').length;

    it('sends rammers one at a time before 60 s', () => {
        const w = playingWorld();
        w.elapsed = 59.9;
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers(w)).toBe(1);
    });

    it('sends two rammers at once from 60 s and three from 120 s', () => {
        const w = playingWorld();
        w.elapsed = 60;
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers(w)).toBe(2);
        expect(w.rammerTimer).toBeCloseTo(6 - DT);
        w.elapsed = 120;
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers(w)).toBe(5);
    });

    it('keeps at most 6 rammers at once, cutting a group short at the cap', () => {
        const w = playingWorld();
        for (let i = 0; i < 5; i++) w.enemies.push(createEnemy('rammer', 90 + i, () => 0.5, S));
        w.elapsed = 120;
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers(w)).toBe(6);
        w.rammerTimer = 0;
        w.step(DT, NONE);
        expect(rammers(w)).toBe(6);
    });

    it('fires enemy bullets at the speed of the stage in effect when they are fired', () => {
        const w = playingWorld();
        w.elapsed = 60;
        const g = createEnemy('grunt', 1, () => 0.5, S);
        g.x = 500;
        g.y = 100;
        g.swayCenter = 500;
        g.state = 'sway';
        g.actionTimer = 99;
        g.fireTimer = 0;
        w.enemies.push(g);
        w.step(DT, NONE);
        expect(w.enemyBullets).toHaveLength(1);
        const b = w.enemyBullets[0];
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(230);
        w.elapsed = 200;
        w.step(DT, NONE);
        expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(230);
    });
});

describe('absorbing', () => {
    function bulletAt(w: World, dx: number): void {
        w.enemyBullets.push({ x: w.player.x + dx, y: w.player.y, vx: 0, vy: 0, removed: false });
    }

    it('absorbs a bullet whose center is exactly 90 px away', () => {
        const w = playingWorld();
        bulletAt(w, 90);
        w.step(DT, NONE);
        expect(w.stock).toBe(1);
        expect(w.enemyBullets).toHaveLength(0);
    });

    it('does not absorb a bullet just outside 90 px', () => {
        const w = playingWorld();
        bulletAt(w, 90.01);
        w.step(DT, NONE);
        expect(w.stock).toBe(0);
        expect(w.enemyBullets).toHaveLength(1);
    });

    it('never takes a life from enemy bullets, even when they overflow the stock', () => {
        const w = playingWorld();
        w.stock = 49;
        for (let i = 0; i < 5; i++) bulletAt(w, 0);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(3);
    });

    it('auto-releases the moment the 50th bullet is absorbed and keeps absorbing after', () => {
        const w = playingWorld();
        still(w, 'shooter', 500, 100, 8);
        w.stock = 49;
        bulletAt(w, 0);
        bulletAt(w, 10);
        w.step(DT, NONE);
        expect(w.releaseBullets).toHaveLength(50);
        expect(w.stock).toBe(1);
    });

    it('removes enemy bullets that leave the screen', () => {
        const w = playingWorld();
        w.enemyBullets.push({ x: 0, y: 5, vx: -600, vy: 0, removed: false });
        w.step(DT, NONE);
        expect(w.enemyBullets).toHaveLength(0);
        expect(w.stock).toBe(0);
    });
});

describe('absorbed positions for the absorb effect', () => {
    function bullet(w: World, dx: number, vx = 0): void {
        w.enemyBullets.push({ x: w.player.x + dx, y: w.player.y, vx, vy: 0, removed: false });
    }

    it('lists each absorbed bullet at its position after this frame\'s move', () => {
        const w = playingWorld();
        bullet(w, 30, 60); // moves 1 px this frame
        bullet(w, -40);
        w.step(DT, NONE);
        expect(w.absorbed).toHaveLength(2);
        expect(w.absorbed[0].x).toBeCloseTo(w.player.x + 31);
        expect(w.absorbed[0].y).toBe(w.player.y);
        expect(w.absorbed[1]).toEqual({ x: w.player.x - 40, y: w.player.y });
    });

    it('does not list bullets left outside the field', () => {
        const w = playingWorld();
        bullet(w, 90.01);
        w.step(DT, NONE);
        expect(w.absorbed).toHaveLength(0);
    });

    it('forgets the previous frame\'s bullets on the next step', () => {
        const w = playingWorld();
        bullet(w, 10);
        w.step(DT, NONE);
        expect(w.absorbed).toHaveLength(1);
        w.step(DT, NONE);
        expect(w.absorbed).toHaveLength(0);
    });

    it('lists nothing for the +10 consolation stock from a ram', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.stock).toBe(10);
        expect(w.absorbed).toHaveLength(0);
    });

    it('lists every bullet absorbed in a frame that auto-releases', () => {
        const w = playingWorld();
        w.stock = 49;
        bullet(w, 0);
        bullet(w, 10);
        bullet(w, 20);
        w.step(DT, NONE);
        expect(w.stock).toBe(2);
        expect(w.absorbed).toHaveLength(3);
    });

    it('stays empty during ready, since nothing is absorbed then', () => {
        const w = new World(S, () => 0.5);
        w.enemyBullets.push({ x: w.player.x, y: w.player.y, vx: 0, vy: 0, removed: false });
        w.step(DT, NONE);
        expect(w.absorbed).toHaveLength(0);
    });

    it('stays empty during ending, since nothing is absorbed then', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        bullet(w, 10);
        w.step(DT, NONE);
        expect(w.absorbed).toHaveLength(0);
    });

    it('still lists a bullet absorbed in the frame a ram ends the run', () => {
        const w = playingWorld();
        w.player.lives = 1;
        bullet(w, 10);
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.absorbed).toHaveLength(1);
    });
});

describe('defeated enemies for the defeat effect', () => {
    /** A release bullet 5 px from (x, y) along `heading`, flying at it; it hits on the next step. */
    function shotAt(w: World, x: number, y: number, heading: number): void {
        w.releaseBullets.push({
            x: x - Math.cos(heading) * 5, y: y - Math.sin(heading) * 5, heading, age: 0,
            group: newGroup(), target: null, removed: false
        });
    }

    it('lists a regular enemy a release bullet kills, with its position, kind and the bullet heading', () => {
        const w = playingWorld();
        still(w, 'shooter', 400, 300, 1);
        shotAt(w, 400, 300, -Math.PI / 2);
        w.step(DT, NONE);
        expect(w.defeated).toEqual([{ x: 400, y: 300, kind: 'shooter', heading: -Math.PI / 2 }]);
    });

    it('lists every enemy killed in the same frame', () => {
        const w = playingWorld();
        still(w, 'grunt', 300, 300, 1);
        still(w, 'shooter', 600, 300, 1);
        shotAt(w, 300, 300, 0);
        shotAt(w, 600, 300, Math.PI);
        w.step(DT, NONE);
        expect(w.defeated.map((d) => d.kind)).toEqual(['grunt', 'shooter']);
    });

    it('records the heading after this frame\'s homing turn, not the heading it had before', () => {
        const w = playingWorld();
        const e = still(w, 'grunt', 400, 300, 1);
        e.incoming = 1;
        // Aimed 30° below the grunt; one frame turns it back by at most 360°/s × 1/60 s = 6°.
        w.releaseBullets.push({
            x: 393, y: 300, heading: Math.PI / 6, age: 0, group: newGroup(), target: e, removed: false
        });
        w.step(DT, NONE);
        expect(w.defeated).toHaveLength(1);
        expect(w.defeated[0].heading).toBeCloseTo(Math.PI / 6 - Math.PI / 30);
    });

    it('records where the enemy is after this frame\'s move', () => {
        const w = playingWorld();
        const e = createEnemy('heavy', 998, () => 0.5, w.screen);
        e.x = 300;
        e.y = 300;
        e.hp = 1;
        w.enemies.push(e);
        shotAt(w, 300, 300, 0);
        w.step(DT, NONE);
        expect(w.defeated).toHaveLength(1);
        expect(e.x !== 300 || e.y !== 300).toBe(true); // the heavy did move this frame
        expect(w.defeated[0].x).toBe(e.x);
        expect(w.defeated[0].y).toBe(e.y);
    });

    it('does not list a hit that leaves the enemy alive', () => {
        const w = playingWorld();
        const e = still(w, 'shooter', 400, 300, 2);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        expect(e.hp).toBe(1);
        expect(w.defeated).toHaveLength(0);
    });

    it('forgets the previous frame\'s kills on the next step', () => {
        const w = playingWorld();
        still(w, 'grunt', 400, 300, 1);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        expect(w.defeated).toHaveLength(1);
        w.step(DT, NONE);
        expect(w.defeated).toHaveLength(0);
    });

    it('does not list an enemy broken by ramming the player', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.defeated).toHaveLength(0);
    });

    it('does not list a rammer that dashes off the screen', () => {
        const w = playingWorld();
        const r = createEnemy('rammer', 999, () => 0.5, w.screen);
        r.state = 'dash';
        r.heading = 0;
        r.homingLeft = 0;
        r.x = S.width + r.radius - 1;
        r.y = 300;
        w.enemies.push(r);
        w.step(DT, NONE);
        expect(w.enemies).not.toContain(r);
        expect(w.defeated).toHaveLength(0);
    });

    it('still lists a kill made in the frame a ram ends the run', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'shooter', 400, 300, 1);
        shotAt(w, 400, 300, 0);
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.defeated).toHaveLength(1);
    });

    it('stays empty during ready, since nothing is hit then', () => {
        const w = new World(S, () => 0.5);
        still(w, 'grunt', 400, 300, 1);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        expect(w.phase).toBe('ready');
        expect(w.defeated).toHaveLength(0);
    });

    it('stays empty during ending, since release bullets no longer hit then', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        still(w, 'shooter', 400, 300, 1);
        shotAt(w, 400, 300, 0);
        w.step(DT, NONE);
        expect(w.defeated).toHaveLength(0);
    });

    it('leaves the rules alone right after a kill: bullets and enemies nearby behave as before', () => {
        const w = playingWorld();
        still(w, 'grunt', 400, 300, 1);
        const neighbour = still(w, 'shooter', 420, 300, 8);
        shotAt(w, 400, 300, 0);
        const bullet = { x: 405, y: 300, vx: 0, vy: 0, removed: false };
        w.enemyBullets.push(bullet);
        w.step(DT, NONE);
        expect(w.defeated).toHaveLength(1);
        w.step(DT, NONE);
        expect(neighbour.hp).toBe(8);
        expect(w.enemyBullets).toContain(bullet);
        expect(w.score).toBe(100); // the grunt alone, at single-kill value
        expect(w.player.lives).toBe(3);
    });
});

describe('releases for the release effect', () => {
    it('lists a manual release at the player\'s position with the stock it fired', () => {
        const w = playingWorld();
        w.stock = 12;
        w.step(DT, input({ release: true }));
        expect(w.releases).toEqual([{ x: w.player.x, y: w.player.y, count: 12 }]);
        // The bullets fired from that point and have already flown one frame.
        const b = w.releaseBullets[0];
        expect(Math.hypot(b.x - w.releases[0].x, b.y - w.releases[0].y)).toBeCloseTo(RELEASE_SPEED * DT);
    });

    it('records where the player is after this frame\'s move, where the bullets fire from', () => {
        const w = playingWorld();
        w.stock = 5;
        const x0 = w.player.x;
        w.step(DT, input({ moveX: 1, release: true }));
        expect(w.player.x).toBeGreaterThan(x0);
        expect(w.releases[0].x).toBe(w.player.x);
        const b = w.releaseBullets[0];
        expect(Math.hypot(b.x - w.releases[0].x, b.y - w.releases[0].y)).toBeCloseTo(RELEASE_SPEED * DT);
    });

    it('lists each release when a manual release and a full-stock auto-release share a frame', () => {
        const w = playingWorld();
        w.stock = 3;
        for (let i = 0; i < STOCK_MAX; i++) {
            w.enemyBullets.push({ x: w.player.x, y: w.player.y, vx: 0, vy: 0, removed: false });
        }
        w.step(DT, input({ release: true }));
        expect(w.releases.map((r) => r.count)).toEqual([3, STOCK_MAX]);
        expect(w.stock).toBe(0);
    });

    it('lists nothing for a release press with an empty stock', () => {
        const w = playingWorld();
        w.step(DT, input({ release: true }));
        expect(w.releases).toHaveLength(0);
    });

    it('lists the automatic release when absorbing fills the stock', () => {
        const w = playingWorld();
        w.stock = 49;
        w.enemyBullets.push({ x: w.player.x, y: w.player.y, vx: 0, vy: 0, removed: false });
        w.step(DT, NONE);
        expect(w.releases).toEqual([{ x: w.player.x, y: w.player.y, count: 50 }]);
    });

    it('lists the automatic release the ram consolation stock triggers (45 -> release -> 5)', () => {
        const w = playingWorld();
        w.stock = 45;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.stock).toBe(5);
        expect(w.releases).toEqual([{ x: w.player.x, y: w.player.y, count: 50 }]);
    });

    it('forgets the previous frame\'s releases on the next step', () => {
        const w = playingWorld();
        w.stock = 3;
        w.step(DT, input({ release: true }));
        expect(w.releases).toHaveLength(1);
        w.step(DT, NONE);
        expect(w.releases).toHaveLength(0);
    });

    it('stays empty during ready, where a release press does nothing', () => {
        const w = new World(S, () => 0.5);
        w.stock = 5;
        w.step(DT, input({ release: true }));
        expect(w.phase).toBe('ready');
        expect(w.releases).toHaveLength(0);
    });

    it('stays empty during ending, where a release press does nothing', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        w.stock = 5;
        w.step(DT, input({ release: true }));
        expect(w.releases).toHaveLength(0);
    });

    it('still lists a release made in the frame a ram ends the run', () => {
        const w = playingWorld();
        w.player.lives = 1;
        w.stock = 7;
        // A shooter with 8 HP survives the 7 bullets, so it still rams the player this frame.
        still(w, 'shooter', w.player.x, w.player.y, 8);
        w.step(DT, input({ release: true }));
        expect(w.phase).toBe('ending');
        expect(w.releases.map((r) => r.count)).toEqual([7]);
    });
});

describe('kill counts and settlements for the multi-kill effect', () => {
    // With the rng fixed at 0.5 every release bullet leaves straight up along the same path.
    function releaseAt(w: World, n: number): void {
        w.stock = n;
        w.step(DT, input({ release: true }));
    }

    function stepUntilSettled(w: World): { updates: { id: number; kills: number; x: number; y: number }[][]; settledAt: number } {
        const updates: { id: number; kills: number; x: number; y: number }[][] = [];
        for (let i = 0; i < 400; i++) {
            if (w.killUpdates.length > 0) updates.push(w.killUpdates.map((u) => ({ ...u })));
            if (w.settlements.length > 0) return { updates, settledAt: i };
            w.step(DT, NONE);
        }
        return expect.fail('the release never settled');
    }

    it('reports each kill in its own frame, at that enemy, with the running count', () => {
        const w = playingWorld();
        const near = still(w, 'grunt', w.player.x, w.player.y - 60, 1);
        const far = still(w, 'grunt', w.player.x, w.player.y - 200, 1);
        releaseAt(w, 2);
        const { updates } = stepUntilSettled(w);
        expect(updates.map((frame) => frame.map((u) => u.kills))).toEqual([[1], [2]]);
        expect(updates[0][0]).toMatchObject({ x: near.x, y: near.y });
        expect(updates[1][0]).toMatchObject({ x: far.x, y: far.y });
    });

    it('reports two kills in one frame as a single update with the later enemy\'s position', () => {
        const w = playingWorld();
        // Same size, 5 px apart: the two bullets flying together finish both in one frame.
        still(w, 'grunt', w.player.x, w.player.y - 60, 1);
        const second = still(w, 'grunt', w.player.x + 5, w.player.y - 60, 1);
        releaseAt(w, 2);
        const { updates } = stepUntilSettled(w);
        expect(updates).toHaveLength(1);
        expect(updates[0]).toHaveLength(1);
        expect(updates[0][0]).toMatchObject({ kills: 2, x: second.x, y: second.y });
    });

    it('settles once all bullets are gone, with the points it adds to the score (2 kills = sum × 1.5)', () => {
        const w = playingWorld();
        // Two grunts 5 px apart, finished in one frame: the second one listed is the last kill.
        const x = w.player.x + 5;
        const y = w.player.y - 60;
        still(w, 'grunt', w.player.x, y, 1);
        still(w, 'grunt', x, y, 1);
        releaseAt(w, 2);
        const id = w.releaseBullets[0].group.id;
        let before = w.score;
        for (let i = 0; i < 400 && w.settlements.length === 0; i++) {
            before = w.score;
            w.step(DT, NONE);
        }
        expect(w.settlements).toHaveLength(1);
        const s = w.settlements[0];
        expect(s.kills).toBe(2);
        expect(s.score).toBe(300); // (100 + 100) × 1.5
        expect(w.score - before).toBe(300);
        expect(s.lastIsBoss).toBe(false);
        expect(s).toMatchObject({ id, x, y });
    });

    it('settles a release that killed nothing too, with 0 kills and 0 points', () => {
        const w = playingWorld();
        releaseAt(w, 1);
        const { settledAt } = stepUntilSettled(w);
        expect(settledAt).toBeGreaterThan(0);
        expect(w.settlements[0]).toMatchObject({ kills: 0, score: 0 });
    });

    it('reports overlapping releases under distinct ids, each kill and settlement under its own release', () => {
        const w = playingWorld();
        // Both single-bullet releases fly the same path; the first takes the near grunt, the second the far one.
        still(w, 'grunt', w.player.x, w.player.y - 60, 1);
        still(w, 'grunt', w.player.x, w.player.y - 300, 1);
        releaseAt(w, 1);
        releaseAt(w, 1);
        const updates: number[] = [];
        const settled: number[] = [];
        for (let i = 0; i < 400 && settled.length < 2; i++) {
            w.step(DT, NONE);
            for (const u of w.killUpdates) updates.push(u.id);
            for (const s of w.settlements) settled.push(s.id);
        }
        expect(updates).toHaveLength(2);
        expect(updates[0]).not.toBe(updates[1]);
        expect(settled).toEqual(updates);
    });

    it('forgets the previous frame\'s updates and settlements on the next step', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y - 60, 1);
        releaseAt(w, 1);
        stepUntilSettled(w);
        // The kill and the settlement land in the same frame here: that frame's lists are not empty.
        expect(w.killUpdates.length + w.settlements.length).toBeGreaterThan(0);
        w.step(DT, NONE);
        expect(w.killUpdates).toHaveLength(0);
        expect(w.settlements).toHaveLength(0);
    });

    it('reports the releases still open when the run ends as settled at the end of ending', () => {
        const w = playingWorld();
        w.player.lives = 1;
        // Just below the player: it rams this frame, while the bullets fly up without touching it.
        still(w, 'shooter', w.player.x, w.player.y + 20, 8);
        releaseAt(w, 3);
        expect(w.phase).toBe('ending');
        let settled = 0;
        let bulletsBeforeOver = 0;
        for (let i = 0; i < 200 && w.phase !== 'over'; i++) {
            bulletsBeforeOver = w.releaseBullets.length;
            w.step(DT, NONE);
            settled += w.settlements.length;
        }
        expect(w.phase).toBe('over');
        // Still in flight when the run ended, so this settlement comes from the end-of-ending flush.
        expect(bulletsBeforeOver).toBe(3);
        expect(settled).toBe(1);
    });
});

describe('hits for the hit effect', () => {
    it('lists a hit at the player\'s position after this frame\'s move', () => {
        const w = playingWorld();
        const x0 = w.player.x;
        still(w, 'grunt', x0 + 5, w.player.y);
        w.step(DT, input({ moveX: 1 }));
        expect(w.player.lives).toBe(2);
        expect(w.player.x).toBeGreaterThan(x0);
        expect(w.hits).toEqual([{ x: w.player.x, y: w.player.y }]);
    });

    it('lists nothing for contact while invulnerable', () => {
        const w = playingWorld();
        w.player.invulnerable = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(3);
        expect(w.hits).toHaveLength(0);
    });

    it('lists the hit that costs the last life, in the frame the run starts ending', () => {
        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        expect(w.hits).toHaveLength(1);
    });

    it('lists both the hit and the release when the rescue stock fills up (45 -> release -> 5)', () => {
        const w = playingWorld();
        w.stock = 45;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.hits).toHaveLength(1);
        expect(w.releases.map((r) => r.count)).toEqual([STOCK_MAX]);
        expect(w.stock).toBe(5);
    });

    it('forgets the previous frame\'s hit on the next step', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.hits).toHaveLength(1);
        w.step(DT, NONE);
        expect(w.hits).toHaveLength(0);
    });

    it('stays empty during ready and ending, where there is no contact', () => {
        const ready = new World(S, () => 0.5);
        still(ready, 'grunt', ready.player.x, ready.player.y);
        ready.step(DT, NONE);
        expect(ready.phase).toBe('ready');
        expect(ready.hits).toHaveLength(0);

        const w = playingWorld();
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        // Drop the fresh invulnerability, so only the ending phase itself can keep contact out.
        w.player.invulnerable = 0;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.hits).toHaveLength(0);
    });
});

describe('releasing', () => {
    it('does nothing with an empty stock', () => {
        const w = playingWorld();
        w.step(DT, input({ release: true }));
        expect(w.releaseBullets).toHaveLength(0);
        expect(w.openGroups).toHaveLength(0);
    });

    it('fires the whole stock from the player upward within ±30°', () => {
        const w = playingWorld(S, () => 0);
        w.stock = 3;
        w.release();
        expect(w.stock).toBe(0);
        expect(w.releaseBullets).toHaveLength(3);
        for (const b of w.releaseBullets) {
            expect(b.heading).toBeCloseTo(-Math.PI / 2 - Math.PI / 6);
            expect([b.x, b.y]).toEqual([w.player.x, w.player.y]);
        }
    });

    it('damages one enemy per bullet and removes the bullet', () => {
        const w = playingWorld();
        const h = still(w, 'shooter', w.player.x, w.player.y - 200, 8);
        w.stock = 3;
        w.release();
        untilBulletsGone(w);
        expect(h.hp).toBe(5);
        expect(w.score).toBe(0);
    });

    it('lets a bullet damage only one of two overlapping enemies', () => {
        const w = playingWorld();
        const a = still(w, 'shooter', 500, 300, 8);
        const b = still(w, 'shooter', 500, 300, 8);
        w.releaseBullets.push({ x: 500, y: 300, heading: 0, age: 0, group: newGroup(), target: null, removed: false });
        w.step(DT, NONE);
        expect(a.hp + b.hp).toBe(15);
    });

    it('scores two kills from one release with the ×1.5 bonus', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x - 150, 300);
        still(w, 'grunt', w.player.x + 150, 300);
        w.stock = 4;
        w.release();
        untilBulletsGone(w);
        expect(w.enemies).toHaveLength(0);
        expect(w.score).toBe(300);
    });

    it('scores overlapping releases separately, crediting each kill to the finishing release', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x - 150, 300, 1);
        still(w, 'grunt', w.player.x + 150, 300, 1);
        w.stock = 1;
        w.release();
        w.stock = 1;
        w.release();
        expect(w.openGroups).toHaveLength(2);
        untilBulletsGone(w);
        expect(w.enemies).toHaveLength(0);
        // One kill each: 100 + 100, not (100 + 100) × 1.5.
        expect(w.score).toBe(200);
    });

    it('settles a release only after its last bullet is gone', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y - 100, 1);
        w.stock = 2;
        w.release();
        steps(w, 0.4);
        expect(w.enemies).toHaveLength(0);
        expect(w.releaseBullets.length).toBe(1);
        expect(w.score).toBe(0);
        untilBulletsGone(w);
        expect(w.score).toBe(100);
    });

    it('expires a bullet 2.5 s after firing even if it never leaves the screen', () => {
        // On a 1536 px tall screen a bullet flying straight up from the bottom needs 2.55 s to leave,
        // so only the lifetime can end it at 2.5 s.
        const w = playingWorld({ width: 768, height: 1536 });
        w.releaseBullets.push({ x: 384, y: 1530, heading: -Math.PI / 2, age: 0, group: newGroup(), target: null, removed: false });
        steps(w, 2.45);
        expect(w.releaseBullets).toHaveLength(1);
        steps(w, 0.1);
        expect(w.releaseBullets).toHaveLength(0);
    });

    it('scores releases still in flight when the run ends', () => {
        const w = playingWorld({ width: 1024, height: 1536 });
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y - 100, 1);
        w.stock = 2;
        w.release();
        steps(w, 0.3);
        expect(w.enemies).toHaveLength(0);
        expect(w.releaseBullets).toHaveLength(1);
        still(w, 'shooter', w.player.x, w.player.y, 8);
        steps(w, 1.1);
        expect(w.phase).toBe('over');
        expect(w.score).toBe(100);
    });
});

describe('target assignment', () => {
    it('gives each enemy exactly its HP, nearest first, then hands out the surplus round-robin', () => {
        const w = playingWorld();
        const p = w.player;
        const g = still(w, 'grunt', p.x, p.y - 100);
        const h1 = still(w, 'shooter', p.x, p.y - 300, 8);
        const h2 = still(w, 'shooter', p.x, p.y - 400, 8);
        const count = (targets: Enemy[], e: Enemy) => targets.filter((t) => t === e).length;
        const t = w.assignTargets(21);
        expect([count(t, g), count(t, h1), count(t, h2)]).toEqual([3, 9, 9]);
    });

    it('fills the nearest enemies first when there are not enough bullets', () => {
        const w = playingWorld();
        const p = w.player;
        const far = still(w, 'shooter', p.x, p.y - 400, 8);
        const near = still(w, 'grunt', p.x, p.y - 100);
        const t = w.assignTargets(5);
        expect(t.filter((e) => e === near)).toHaveLength(2);
        expect(t.filter((e) => e === far)).toHaveLength(3);
    });

    it('subtracts bullets already homing on an enemy from earlier releases', () => {
        const w = playingWorld();
        const p = w.player;
        const g = still(w, 'grunt', p.x, p.y - 100);
        const h = still(w, 'shooter', p.x, p.y - 300, 8);
        g.incoming = 2;
        expect(shortfall(g)).toBe(0);
        const t = w.assignTargets(8);
        expect(t.every((e) => e === h)).toBe(true);
    });

    it('never targets enemies off screen', () => {
        const w = playingWorld();
        still(w, 'grunt', 500, -20);
        expect(w.assignTargets(5)).toEqual([]);
    });

    it('keeps incoming counts equal to the bullets actually homing on each enemy', () => {
        const w = playingWorld();
        const a = still(w, 'grunt', 300, 200);
        const b = still(w, 'shooter', 700, 200);
        w.stock = 10;
        w.release();
        const homing = (e: Enemy) => w.releaseBullets.filter((x) => x.target === e).length;
        expect(a.incoming).toBe(homing(a));
        expect(b.incoming).toBe(homing(b));
        expect(a.incoming + b.incoming).toBe(10);
        untilBulletsGone(w);
        expect(a.incoming).toBe(0);
        expect(b.incoming).toBe(0);
    });

    it('obeys the assignment rules for random enemy layouts (property check)', () => {
        let seed = 4242;
        const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
        let withSurplus = 0;
        let withShortage = 0;
        let withPriorIncoming = 0;
        for (let trial = 0; trial < 400; trial++) {
            const w = playingWorld();
            const p = w.player;
            const enemyCount = 1 + Math.floor(rng() * 6);
            for (let i = 0; i < enemyCount; i++) {
                const kinds = ['grunt', 'shooter'] as const;
                const e = still(w, kinds[Math.floor(rng() * 2)], 40 + rng() * 944, 60 + rng() * 700, 1 + Math.floor(rng() * 8));
                if (rng() < 0.3) e.incoming = Math.floor(rng() * (e.hp + 2));
                if (e.incoming > 0) withPriorIncoming++;
            }
            const n = 1 + Math.floor(rng() * 50);
            const need = new Map(w.enemies.map((e) => [e, shortfall(e)]));
            const totalNeed = [...need.values()].reduce((s, v) => s + v, 0);
            const targets = w.assignTargets(n);
            const got = new Map(w.enemies.map((e) => [e, targets.filter((t) => t === e).length]));
            const byDist = [...w.enemies].sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));

            // Every bullet gets a target when any enemy is on screen.
            if (targets.length !== n) expect.fail(`trial ${trial}: ${targets.length} targets for ${n} bullets`);
            if (n <= totalNeed) {
                withShortage++;
                // No enemy gets more than it needs, and a farther enemy only gets bullets once every nearer one is full.
                let sawUnfilled = false;
                for (const e of byDist) {
                    const g = got.get(e)!;
                    if (g > need.get(e)!) expect.fail(`trial ${trial}: overfilled while short`);
                    if (sawUnfilled && g > 0) expect.fail(`trial ${trial}: farther enemy served before nearer one filled`);
                    if (g < need.get(e)!) sawUnfilled = true;
                }
            } else {
                withSurplus++;
                // Everyone is filled; the extras differ by at most one and never favour a farther enemy.
                const extras = byDist.map((e) => got.get(e)! - need.get(e)!);
                if (extras.some((x) => x < 0)) expect.fail(`trial ${trial}: someone left short despite surplus`);
                if (Math.max(...extras) - Math.min(...extras) > 1) expect.fail(`trial ${trial}: uneven surplus ${extras}`);
                for (let i = 1; i < extras.length; i++) {
                    if (extras[i] > extras[i - 1]) expect.fail(`trial ${trial}: farther enemy got more surplus ${extras}`);
                }
            }
        }
        expect(withSurplus).toBeGreaterThan(20);
        expect(withShortage).toBeGreaterThan(20);
        expect(withPriorIncoming).toBeGreaterThan(20);
    });
});

describe('retargeting in flight', () => {
    function bullet(w: World, x: number, y: number) {
        const b = { x, y, heading: 0, age: 0, group: newGroup(), target: null, removed: false };
        w.releaseBullets.push(b);
        return b;
    }

    it('prefers an enemy still short of bullets over a nearer one that is covered', () => {
        const w = playingWorld();
        const near = still(w, 'grunt', 500, 300);
        const far = still(w, 'grunt', 900, 300);
        near.incoming = 2;
        expect(w.retarget(bullet(w, 480, 300))).toBe(far);
    });

    it('falls back to the nearest enemy when everyone is covered', () => {
        const w = playingWorld();
        const near = still(w, 'grunt', 500, 300);
        const far = still(w, 'grunt', 900, 300);
        near.incoming = 2;
        far.incoming = 2;
        expect(w.retarget(bullet(w, 480, 300))).toBe(near);
    });

    it('returns null when no enemy is on screen', () => {
        const w = playingWorld();
        still(w, 'grunt', 500, -50);
        expect(w.retarget(bullet(w, 480, 300))).toBeNull();
    });

    it('moves bullets to another enemy once their target dies', () => {
        const w = playingWorld();
        const first = still(w, 'grunt', w.player.x, w.player.y - 80, 1);
        w.stock = 4;
        w.release();
        // With only one enemy around, the surplus also homes on it.
        expect(w.releaseBullets.filter((b) => b.target === first)).toHaveLength(4);
        const second = still(w, 'shooter', w.player.x + 300, 150, 8);
        untilBulletsGone(w);
        expect(first.removed).toBe(true);
        expect(second.hp).toBe(5);
    });

    it('lets bullets fired with no enemy around pick up an enemy that appears later', () => {
        const w = playingWorld();
        w.stock = 3;
        w.release();
        expect(w.releaseBullets.every((b) => b.target === null)).toBe(true);
        const late = still(w, 'shooter', w.player.x + 200, w.player.y - 250, 8);
        untilBulletsGone(w);
        expect(late.hp).toBe(5);
    });
});

describe('heavies working together', () => {
    function chasingHeavy(w: World, x: number, y: number): Enemy {
        const e = createEnemy('heavy', 2000 + w.enemies.length, () => 0.5, w.screen);
        e.x = x;
        e.y = y;
        e.state = 'chase';
        e.fireTimer = Infinity;
        w.enemies.push(e);
        return e;
    }

    it('spread out to opposite sides of the player, then charge in together', () => {
        const w = playingWorld({ width: 1365, height: 768 });
        w.player.x = 680;
        w.player.y = 400;
        // The oldest (a) is on the left, so b's post is on the right of the player.
        const a = chasingHeavy(w, 420, 390);
        const b = chasingHeavy(w, 950, 420);
        // Hold the player still on its own; stay in the surround window (0–3 s of the cycle).
        steps(w, 2.9);
        const da = Math.hypot(a.x - 680, a.y - 400);
        const db = Math.hypot(b.x - 680, b.y - 400);
        expect(da).toBeCloseTo(180, 0);
        expect(db).toBeCloseTo(180, 0);
        // Opposite sides: the player sits between them.
        expect(Math.sign(a.x - 680)).not.toBe(Math.sign(b.x - 680));
        w.player.invulnerable = 99; // watch the charge without contact ending it
        steps(w, 1.0); // into the charge window
        expect(Math.hypot(a.x - 680, a.y - 400)).toBeLessThan(da - 50);
        expect(Math.hypot(b.x - 680, b.y - 400)).toBeLessThan(db - 50);
    });
});

describe('contact with enemies', () => {
    it('costs a life, breaks the enemy without scoring, and starts 1.5 s of invulnerability', () => {
        const w = playingWorld();
        const e = still(w, 'shooter', w.player.x, w.player.y, 8);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.player.invulnerable).toBeCloseTo(1.5);
        expect(w.enemies).not.toContain(e);
        expect(w.score).toBe(0);
    });

    it('treats circles that just touch as contact', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x + 24, w.player.y); // 10 + 14
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
    });

    it('breaks only one enemy per contact', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y);
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(2);
        expect(w.enemies).toHaveLength(1);
    });

    it('ignores contact entirely while invulnerable', () => {
        const w = playingWorld();
        w.player.invulnerable = 1;
        const e = still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.player.lives).toBe(3);
        expect(w.enemies).toContain(e);
        expect(w.stock).toBe(0);
    });

    it('allows contact again once invulnerability runs out', () => {
        const w = playingWorld();
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        still(w, 'grunt', w.player.x, w.player.y);
        steps(w, 1.45);
        expect(w.player.lives).toBe(2);
        steps(w, 0.1);
        expect(w.player.lives).toBe(1);
    });

    it('grants 10 stock on a hit', () => {
        const w = playingWorld();
        w.stock = 7;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.stock).toBe(17);
    });

    it('auto-releases at 50 during the hit bonus and carries the rest (45 -> 5)', () => {
        const w = playingWorld();
        w.stock = 45;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.stock).toBe(5);
        expect(w.releaseBullets).toHaveLength(50);
    });
});

describe('movement', () => {
    it('moves at 320 px/s with the keys and normalizes diagonals', () => {
        const w = playingWorld();
        const { x, y } = w.player;
        w.step(0.1, input({ moveX: 1 }));
        expect(w.player.x - x).toBeCloseTo(32);
        const x1 = w.player.x;
        w.step(0.1, input({ moveX: 1, moveY: -1 }));
        expect(Math.hypot(w.player.x - x1, w.player.y - y)).toBeCloseTo(32);
    });

    it('clamps to the screen below the 48 px HUD band', () => {
        const w = playingWorld();
        steps(w, 5, input({ moveX: -1, moveY: -1 }));
        expect([w.player.x, w.player.y]).toEqual([10, 58]);
        steps(w, 5, input({ moveX: 1, moveY: 1 }));
        expect([w.player.x, w.player.y]).toEqual([1014, 758]);
    });

    it('chases a drag target at no more than 320 px/s and stops on it', () => {
        const w = playingWorld();
        const x0 = w.player.x;
        w.step(DT, input({ dragX: 300 }));
        expect(w.player.x - x0).toBeCloseTo(320 * DT);
        expect(w.dragTargetX).toBe(x0 + 300);
        steps(w, 0.9);
        expect(w.hasDragTarget).toBe(true);
        steps(w, 0.1);
        expect(w.player.x).toBe(x0 + 300);
        expect(w.hasDragTarget).toBe(false);
    });

    it('snaps onto a drag target that is within one frame of movement', () => {
        const w = playingWorld();
        const x0 = w.player.x;
        w.step(DT, input({ dragX: 2 }));
        expect(w.player.x).toBe(x0 + 2);
        expect(w.hasDragTarget).toBe(false);
    });

    it('accumulates drags onto the existing target', () => {
        const w = playingWorld();
        const x0 = w.player.x;
        w.step(DT, input({ dragX: 100 }));
        w.step(DT, input({ dragX: 100 }));
        expect(w.dragTargetX).toBe(x0 + 200);
    });

    it('clamps the drag target to the movement area so reversing responds at once', () => {
        const w = playingWorld();
        w.step(DT, input({ dragX: 5000, dragY: -5000 }));
        expect([w.dragTargetX, w.dragTargetY]).toEqual([1014, 58]);
        w.step(DT, input({ dragX: -100 }));
        expect(w.dragTargetX).toBe(914);
    });

    it('drops the drag target while a movement key is held', () => {
        const w = playingWorld();
        const x0 = w.player.x;
        w.step(DT, input({ dragX: 300 }));
        w.step(0.1, input({ moveX: -1, dragX: 500 }));
        expect(w.hasDragTarget).toBe(false);
        w.step(DT, NONE);
        expect(w.player.x).toBeLessThan(x0);
    });
});

describe('boss', () => {
    /** Spawns the first boss right away and returns it. */
    function spawnBoss(w: World): Enemy {
        w.elapsed = w.nextBossAt;
        w.step(DT, NONE);
        if (!w.boss) expect.fail('boss did not spawn');
        return w.boss;
    }

    /** Parks the boss at (x, y) swaying, with its fire and charge clocks stopped. */
    function hold(boss: Enemy, x: number, y: number): Enemy {
        boss.x = x;
        boss.y = y;
        boss.stationY = y;
        boss.state = 'sway';
        boss.fireTimer = Infinity;
        boss.actionTimer = Infinity;
        return boss;
    }

    describe('spawning', () => {
        it('appears exactly when playing time reaches 45 s, not before', () => {
            const w = playingWorld();
            expect(w.nextBossAt).toBe(45);
            w.elapsed = 45 - 1e-9;
            w.step(DT, NONE);
            expect(w.boss).toBeNull();
            w.elapsed = 45;
            w.step(DT, NONE);
            expect(w.boss).not.toBeNull();
            expect(w.enemies).toContain(w.boss);
            expect(w.boss).toMatchObject({ kind: 'boss', hp: 60, maxHp: 60 });
        });

        it('announces itself for 1.5 s', () => {
            const w = playingWorld();
            spawnBoss(w);
            expect(w.bossAnnounce).toBeCloseTo(1.5);
            steps(w, 1.4);
            expect(w.bossAnnounce).toBeGreaterThan(0);
            steps(w, 0.15);
            expect(w.bossAnnounce).toBe(0);
        });

        it('never has two bosses at once', () => {
            const w = playingWorld();
            const boss = spawnBoss(w);
            w.elapsed = 1000;
            steps(w, 0.5);
            expect(w.enemies.filter((e) => e.kind === 'boss')).toEqual([boss]);
            expect(w.bossCount).toBe(1);
        });

        it('does not appear during ready or ending', () => {
            const ready = new World(S, () => 0.5);
            ready.nextBossAt = 0;
            ready.step(1, NONE);
            expect(ready.boss).toBeNull();

            const w = playingWorld();
            w.player.lives = 1;
            still(w, 'grunt', w.player.x, w.player.y);
            w.step(DT, NONE);
            expect(w.phase).toBe('ending');
            w.nextBossAt = 0;
            steps(w, 0.5);
            expect(w.boss).toBeNull();
        });

        it('comes back 60 s after a defeat with 30 more HP', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y);
            boss.hp = 10;
            w.elapsed = 100;
            w.step(DT, NONE); // rammed to death at 100 s
            expect(w.boss).toBeNull();
            expect(w.nextBossAt).toBe(160);
            w.elapsed = 160 - 1e-9;
            w.step(DT, NONE);
            expect(w.boss).toBeNull();
            w.elapsed = 160;
            w.step(DT, NONE);
            expect(w.boss).toMatchObject({ hp: 90, maxHp: 90 });
            expect(w.bossCount).toBe(2);
        });
    });

    describe('alongside regular enemies', () => {
        const regulars = (w: World) => w.enemies.filter((e) => e.kind !== 'boss' && e.kind !== 'rammer');

        it('is not counted toward the 6-enemy cap', () => {
            const w = playingWorld();
            spawnBoss(w);
            for (let i = 0; i < 5; i++) still(w, 'grunt', 100 + i * 60, 200);
            w.spawnTimer = 0;
            w.step(DT, NONE);
            expect(regulars(w)).toHaveLength(6);
            w.spawnTimer = 0;
            w.step(DT, NONE);
            expect(regulars(w)).toHaveLength(6);
        });

        it('is not counted toward the 6-rammer cap', () => {
            const w = playingWorld();
            spawnBoss(w);
            for (let i = 0; i < 5; i++) {
                const r = createEnemy('rammer', 3000 + i, () => 0.5, w.screen);
                r.state = 'warn';
                r.x = 100 + i * 60;
                r.y = 200;
                w.enemies.push(r);
            }
            w.rammerTimer = 0;
            w.step(DT, NONE);
            expect(w.enemies.filter((e) => e.kind === 'rammer')).toHaveLength(6);
        });

        it('leaves the spawn and rammer intervals of the current stage unchanged', () => {
            const w = playingWorld();
            spawnBoss(w); // at 45 s: the 30–60 s stage
            w.spawnTimer = 0;
            w.rammerTimer = 0;
            w.step(DT, NONE);
            expect(w.spawnTimer).toBeCloseTo(2.5 - DT);
            expect(w.rammerTimer).toBeCloseTo(8 - DT);
        });

        it('is left out of the heavies\' ring posts', () => {
            const w = playingWorld();
            hold(spawnBoss(w), 100, 300); // on screen and older than the heavy
            const heavy = createEnemy('heavy', 2000, () => 0.5, w.screen);
            heavy.state = 'chase';
            heavy.fireTimer = Infinity;
            heavy.x = 900;
            heavy.y = w.player.y;
            w.enemies.push(heavy);
            w.step(DT, NONE);
            // Alone on the ring, the heavy is the oldest one: its post points straight at it (φ = 0°),
            // one post of one, not the far side of a two-post ring anchored on the boss.
            expect(heavy.slotAngle).toBeCloseTo(0);
        });
    });

    describe('release bullets', () => {
        it('are not aimed at the boss while its center is still above the screen', () => {
            const w = playingWorld();
            const boss = spawnBoss(w);
            expect(boss.y).toBeLessThan(0);
            w.stock = 3;
            w.release();
            expect(boss.incoming).toBe(0);
            expect(w.releaseBullets.every((b) => b.target === null)).toBe(true);
        });

        it('pick up the boss in flight once it is on screen, but not while it is above the top', () => {
            const w = playingWorld();
            const boss = spawnBoss(w);
            w.stock = 1;
            w.release();
            const b = w.releaseBullets[0];
            expect(w.retarget(b)).toBeNull();
            hold(boss, 512, 200);
            expect(w.retarget(b)).toBe(boss);
        });

        it('take 1 HP per hit and leave a boss with HP to spare alive, unscored', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), 512, 300);
            boss.hp = 5;
            w.stock = 1;
            w.release();
            untilBulletsGone(w);
            expect(boss.hp).toBe(4);
            expect(w.boss).toBe(boss);
            expect(w.score).toBe(0);
        });

        it('get the boss\'s remaining HP as its shortfall', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), 512, 200);
            boss.hp = 30;
            w.stock = 40;
            w.release();
            // 30 to cover its HP, then the 10 surplus round-robin to the only enemy.
            expect(boss.incoming).toBe(40);
            expect(shortfall(boss)).toBe(0);
        });

        it('count the boss as one kill for the multi-kill bonus', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), 512, 300);
            boss.hp = 1;
            still(w, 'grunt', 512, 500, 1);
            w.stock = 2;
            w.release();
            untilBulletsGone(w);
            expect(w.boss).toBeNull();
            expect(w.score).toBe(11400); // (7500 + 100) × 1.5
        });

        it('mark a release whose last kill was the boss, but not one that killed a grunt after it', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y - 120);
            boss.hp = 1;
            w.stock = 1;
            w.release();
            let lastIsBoss: boolean | null = null;
            for (let i = 0; i < 400 && lastIsBoss === null; i++) {
                w.step(DT, NONE);
                if (w.settlements.length > 0) lastIsBoss = w.settlements[0].lastIsBoss;
            }
            expect(lastIsBoss).toBe(true);

            const w2 = playingWorld();
            const boss2 = hold(spawnBoss(w2), w2.player.x, w2.player.y - 120);
            boss2.hp = 1;
            still(w2, 'grunt', w2.player.x, w2.player.y - 300, 1);
            w2.stock = 2;
            w2.release();
            let settlement = null;
            for (let i = 0; i < 400 && !settlement; i++) {
                w2.step(DT, NONE);
                if (w2.settlements.length > 0) settlement = w2.settlements[0];
            }
            expect(settlement).toMatchObject({ kills: 2, lastIsBoss: false });
        });

        it('record a hit when the boss rams the player, like any other enemy', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y);
            boss.hp = 50;
            w.step(DT, NONE);
            expect(w.player.lives).toBe(2);
            expect(w.hits).toEqual([{ x: w.player.x, y: w.player.y }]);
        });

        it('are never listed among the defeated enemies that get regular debris', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), 512, 300);
            boss.hp = 1;
            w.stock = 1;
            w.release();
            for (let t = 0; w.releaseBullets.length > 0; t += DT) {
                if (t > 5) expect.fail('release bullets still flying');
                w.step(DT, NONE);
                if (w.defeated.length > 0) expect.fail('the boss was listed as a regular defeat');
            }
            // Killed by the release bullet, not by ramming the player.
            expect(w.boss).toBeNull();
            expect(w.score).toBe(7500);
            expect(w.player.lives).toBe(3);
        });

        it('schedule the next boss 60 s after the killing hit', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), 512, 400);
            boss.hp = 1;
            w.elapsed = 70;
            w.stock = 1;
            w.release();
            let killedAt = -1;
            for (let t = 0; t < 2 && killedAt < 0; t += DT) {
                const before = w.elapsed;
                w.step(DT, NONE);
                if (!w.boss) killedAt = before;
            }
            expect(killedAt).toBeGreaterThan(70);
            expect(w.nextBossAt).toBeCloseTo(killedAt + 60);
        });
    });

    describe('contact', () => {
        it('costs the player as usual but only damages the boss by 10', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y);
            w.step(DT, NONE);
            expect(w.player.lives).toBe(2);
            expect(w.player.invulnerable).toBeCloseTo(1.5);
            expect(w.stock).toBe(10);
            expect(boss.hp).toBe(50);
            expect(boss.removed).toBe(false);
            expect(w.boss).toBe(boss);
            expect(w.score).toBe(0);
        });

        it('kills a boss rammed down to 0 HP, scoring it straight away with no release bonus', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y);
            boss.hp = 10;
            w.step(DT, NONE);
            expect(w.boss).toBeNull();
            expect(w.enemies).not.toContain(boss);
            expect(w.score).toBe(7500);
            expect(w.openGroups).toHaveLength(0);
        });

        it('keeps a ram kill out of a release still in flight, so it gets no multi-kill bonus', () => {
            const w = playingWorld();
            const boss = spawnBoss(w); // still above the screen, so the release goes to the grunt
            still(w, 'grunt', 512, 400, 1);
            w.stock = 1;
            w.release();
            // Let the bullet get clear of the player (80 px) so it can't hit the boss placed there.
            for (let i = 0; i < 8; i++) w.step(DT, NONE);
            hold(boss, w.player.x, w.player.y);
            boss.hp = 10;
            w.step(DT, NONE); // rammed to death while the release is pending
            expect(w.boss).toBeNull();
            expect(w.openGroups).toHaveLength(1);
            untilBulletsGone(w);
            expect(w.score).toBe(7600); // 7500 + 100, not (7500 + 100) × 1.5
        });

        it('does not take the boss below 0 HP', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y);
            boss.hp = 4;
            w.step(DT, NONE);
            expect(boss.hp).toBe(0);
            expect(w.score).toBe(7500);
        });

        it('resolves against the boss first when another enemy overlaps too', () => {
            const w = playingWorld();
            const boss = spawnBoss(w);
            const grunt = still(w, 'grunt', w.player.x, w.player.y);
            // List the grunt before the boss, so "first overlap found" alone would pick it.
            w.enemies.splice(w.enemies.indexOf(grunt), 1);
            w.enemies.unshift(grunt);
            hold(boss, w.player.x, w.player.y);
            w.step(DT, NONE);
            expect(boss.hp).toBe(50);
            expect(grunt.removed).toBe(false);
            expect(w.enemies).toContain(grunt);
            expect(w.player.lives).toBe(2);
        });

        it('is ignored while invulnerable', () => {
            const w = playingWorld();
            const boss = hold(spawnBoss(w), w.player.x, w.player.y);
            w.player.invulnerable = 1;
            w.step(DT, NONE);
            expect(boss.hp).toBe(60);
            expect(w.player.lives).toBe(3);
        });
    });

    it('keeps moving but stops firing during ending', () => {
        const w = playingWorld();
        const boss = hold(spawnBoss(w), 512, 200);
        w.player.lives = 1;
        still(w, 'grunt', w.player.x, w.player.y);
        w.step(DT, NONE);
        expect(w.phase).toBe('ending');
        boss.fireTimer = 0.01;
        const x0 = boss.x;
        steps(w, 0.5);
        expect(w.enemyBullets).toHaveLength(0);
        expect(boss.x).not.toBe(x0);
    });

    it('fires its volleys as enemy bullets at the current stage speed', () => {
        const w = playingWorld();
        const boss = hold(spawnBoss(w), 512, 200);
        boss.fireTimer = 0.01;
        w.step(DT, NONE);
        expect(w.enemyBullets).toHaveLength(16);
        // 45 s is in the 30–60 s stage: 200 px/s.
        expect(Math.hypot(w.enemyBullets[0].vx, w.enemyBullets[0].vy)).toBeCloseTo(200);
    });
});
