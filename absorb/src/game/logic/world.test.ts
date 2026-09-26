import { describe, expect, it } from 'vitest';
import { createEnemy, type Enemy } from './enemy';
import type { ScreenSize } from './screen';
import { shortfall, World, type Input } from './world';

const S: ScreenSize = { width: 1024, height: 768 };
const DT = 1 / 60;
const NONE: Input = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

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
        w.releaseBullets.push({ x: target.x, y: target.y, heading: 0, age: 0, group: { pending: 1, kills: [] }, target: null, removed: false });
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
        w.releaseBullets.push({ x: 500, y: 300, heading: 0, age: 0, group: { pending: 1, kills: [] }, target: null, removed: false });
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
        w.releaseBullets.push({ x: 384, y: 1530, heading: -Math.PI / 2, age: 0, group: { pending: 1, kills: [] }, target: null, removed: false });
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
        const b = { x, y, heading: 0, age: 0, group: { pending: 1, kills: [] }, target: null, removed: false };
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
