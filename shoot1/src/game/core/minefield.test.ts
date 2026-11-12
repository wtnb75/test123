import { describe, expect, it, vi } from 'vitest';
import { MINE_EXPLODE_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER } from './constants';
import { createFieldState, type BulletState, type EnemyState, type FieldState } from './field';
import {
    addMineAt, createMinefield, stepMinefield,
    type Explosion, type MineBody, type Minefield, type MinefieldHooks
} from './minefield';
import { calcChainExplosionRadius, circlesOverlap, getTargetsInExplosion } from './physics';

// Expected values are worked out by hand from docs/spec.md (技術要件・テスト観点「地雷の core」).
// The last block compares the core with a transcription of the code as it was in the Scene (the reference).

const FAR = { playerX: 20, playerY: 700 };

function enemy(id: number, x: number, y: number): EnemyState {
    return { id, kind: 'formation', x, y, vx: 0, vy: 0, phase: 'descend', holdLeft: 0, fireTimer: 0, bulletType: 'straight' };
}

function bullet(id: number, x: number, y: number): BulletState {
    return { id, x, y, vx: 0, vy: 0, type: 'straight' };
}

function minefieldOf(...mines: Array<[x: number, y: number, age: number]>): Minefield {
    const field = createMinefield();
    mines.forEach(([x, y, age], i) => field.mines.push({ id: i + 1, x, y, age }));
    field.nextId = mines.length + 1;
    return field;
}

function fieldOf(enemies: EnemyState[] = [], bullets: BulletState[] = []): FieldState {
    const f = createFieldState();
    f.enemies = enemies;
    f.bullets = bullets;
    return f;
}

type Recorder = MinefieldHooks & { bursts: Explosion[][]; asked: number };

function hooks(over: { active?: () => boolean; abort?: (burst: readonly Explosion[]) => boolean } = {}): Recorder {
    const rec: Recorder = {
        bursts: [],
        asked: 0,
        playerTouchActive: () => {
            rec.asked += 1;
            return over.active ? over.active() : true;
        },
        onTouchBurst: (burst) => {
            rec.bursts.push([...burst]);
            return over.abort ? over.abort(burst) : false;
        }
    };
    return rec;
}

const summary = (e: Explosion) => [e.mineId, e.chainCount, e.radius];

describe('addMineAt', () => {
    it('numbers the mines from 1 and keeps their positions and zero age', () => {
        const m = createMinefield();
        expect(addMineAt(m, 100, 200)).toEqual({ id: 1, x: 100, y: 200, age: 0 });
        expect(addMineAt(m, 300, 200)).toEqual({ id: 2, x: 300, y: 200, age: 0 });
        expect(m.mines.map((x) => x.id)).toEqual([1, 2]);
    });

    it('refuses a mine closer than 24 px to another (touching circles of radius 12) and allows exactly 24', () => {
        const m = createMinefield();
        addMineAt(m, 100, 200);
        expect(addMineAt(m, 123.99, 200)).toBeNull();
        expect(addMineAt(m, 124, 200)).not.toBeNull();
    });

    it('does not use up an id when the placement is refused', () => {
        const m = createMinefield();
        addMineAt(m, 100, 200);
        addMineAt(m, 100, 200);
        expect(addMineAt(m, 300, 300)?.id).toBe(2);
    });

    it('starts empty with ids from 1 again after the field is created anew', () => {
        const m = createMinefield();
        addMineAt(m, 1, 1);
        const fresh = createMinefield();
        expect(fresh.mines).toEqual([]);
        expect(addMineAt(fresh, 50, 50)?.id).toBe(1);
    });
});

describe('chain radius', () => {
    it('is 120, 180, 270, 405 for chain counts 0 to 3', () => {
        const r = [0, 1, 2, 3].map((n) => calcChainExplosionRadius(MINE_EXPLODE_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER, n));
        expect(r).toEqual([120, 180, 270, 405]);
    });
});

describe('stepMinefield: when a mine is due', () => {
    it('explodes a mine whose age reaches exactly 10 s and not one that stops at 9.99 s', () => {
        const due = minefieldOf([200, 300, 9.5]);
        const r = stepMinefield(due, fieldOf(), { dt: 0.5, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120]]);
        expect(due.mines).toEqual([]);

        const notYet = minefieldOf([200, 300, 9.5]);
        const r2 = stepMinefield(notYet, fieldOf(), { dt: 0.49, ...FAR }, hooks());
        expect(r2.explosions).toEqual([]);
        expect(notYet.mines[0].age).toBeCloseTo(9.99, 10);
    });

    it('explodes at 9.99 s plus a 0.02 s frame (10.01 s) and not at 9.98 s plus 0.01 s (9.99 s)', () => {
        const over = minefieldOf([200, 300, 9.99]);
        expect(stepMinefield(over, fieldOf(), { dt: 0.02, ...FAR }, hooks()).explosions).toHaveLength(1);

        const under = minefieldOf([200, 300, 9.98]);
        expect(stepMinefield(under, fieldOf(), { dt: 0.01, ...FAR }, hooks()).explosions).toEqual([]);
        expect(under.mines).toHaveLength(1);
    });

    it('explodes a mine an enemy touches (centers closer than 26) and leaves it when they are exactly 26 apart', () => {
        const hit = minefieldOf([200, 300, 1]);
        const r = stepMinefield(hit, fieldOf([enemy(7, 225.99, 300)]), { dt: 0, ...FAR }, hooks());
        expect(r.explosions).toHaveLength(1);
        expect(r.explosions[0].removedEnemies).toEqual([{ id: 7, x: 225.99, y: 300 }]);

        const miss = minefieldOf([200, 300, 1]);
        const r2 = stepMinefield(miss, fieldOf([enemy(7, 226, 300)]), { dt: 0, ...FAR }, hooks());
        expect(r2.explosions).toEqual([]);
        expect(miss.mines).toHaveLength(1);
    });

    it('does not react to bullets touching a mine', () => {
        const m = minefieldOf([200, 300, 1]);
        const r = stepMinefield(m, fieldOf([], [bullet(1, 200, 300)]), { dt: 0, ...FAR }, hooks());
        expect(r.explosions).toEqual([]);
    });

    it('ages every mine that stays by dt', () => {
        const m = minefieldOf([100, 100, 1], [400, 100, 2.5]);
        stepMinefield(m, fieldOf(), { dt: 0.25, ...FAR }, hooks());
        expect(m.mines.map((x) => x.age)).toEqual([1.25, 2.75]);
    });

    it('checks neither enemies nor the player for a mine that timed out, and still blasts the player standing on it', () => {
        const m = minefieldOf([200, 300, 10]);
        const h = hooks();
        const r = stepMinefield(m, fieldOf(), { dt: 0, playerX: 200, playerY: 300 }, h);
        expect(h.asked).toBe(0);
        expect(h.bursts).toEqual([]);
        expect(r.explosions).toHaveLength(1);
        expect(r.playerHit).toBe(true);
    });
});

describe('stepMinefield: the player touches a mine', () => {
    it('ignores a touch at exactly 0.5 s of age and reacts at 0.51 s', () => {
        const early = minefieldOf([200, 300, 0.5]);
        const h1 = hooks();
        const r1 = stepMinefield(early, fieldOf(), { dt: 0, playerX: 200, playerY: 300 }, h1);
        expect(h1.bursts).toEqual([]);
        expect(r1.explosions).toEqual([]);
        expect(early.mines).toHaveLength(1);

        const late = minefieldOf([200, 300, 0.51]);
        const h2 = hooks();
        stepMinefield(late, fieldOf(), { dt: 0, playerX: 200, playerY: 300 }, h2);
        expect(h2.bursts).toHaveLength(1);
        expect(h2.bursts[0].map(summary)).toEqual([[1, 0, 120]]);
        expect(late.mines).toEqual([]);
    });

    it('needs the mine and the player closer than 24 px: 23.99 touches, 24 does not', () => {
        const touch = minefieldOf([200, 300, 1]);
        const h1 = hooks();
        stepMinefield(touch, fieldOf(), { dt: 0, playerX: 223.99, playerY: 300 }, h1);
        expect(h1.bursts).toHaveLength(1);

        const near = minefieldOf([200, 300, 1]);
        const h2 = hooks();
        stepMinefield(near, fieldOf(), { dt: 0, playerX: 224, playerY: 300 }, h2);
        expect(h2.bursts).toEqual([]);
    });

    it('does nothing while the Scene answers that touching is off, and asks once per mine at that moment', () => {
        const m = minefieldOf([200, 300, 1], [200, 310, 1]);
        const h = hooks({ active: () => false });
        const r = stepMinefield(m, fieldOf(), { dt: 0, playerX: 200, playerY: 305 }, h);
        expect(h.bursts).toEqual([]);
        expect(h.asked).toBe(2);
        expect(r.explosions).toEqual([]);
        expect(m.mines).toHaveLength(2);
    });

    it('does not ask about touching for a mine still inside its 0.5 s of grace', () => {
        const m = minefieldOf([200, 300, 0.2]);
        const h = hooks();
        stepMinefield(m, fieldOf(), { dt: 0, playerX: 200, playerY: 300 }, h);
        expect(h.asked).toBe(0);
    });

    it('stops the whole update when the Scene ends the game: later mines do not age and nothing else explodes', () => {
        const m = minefieldOf([200, 300, 1], [400, 500, 9.5]);
        const r = stepMinefield(m, fieldOf(), { dt: 0.5, playerX: 200, playerY: 300 }, hooks({ abort: () => true }));
        expect(r.aborted).toBe(true);
        expect(r.explosions).toEqual([]);
        expect(r.playerHit).toBe(false);
        expect(m.mines).toEqual([{ id: 2, x: 400, y: 500, age: 9.5 }]);
    });

    it('goes on when the Scene survives it: the next mine is aged and explodes as due, and the burst is reported separately', () => {
        const m = minefieldOf([200, 300, 1], [400, 500, 9.5]);
        let first = true;
        const h = hooks({
            active: () => first, // the barrier's grace window starts after the first touch
            abort: () => { first = false; return false; }
        });
        const r = stepMinefield(m, fieldOf(), { dt: 0.5, playerX: 200, playerY: 300 }, h);
        expect(r.aborted).toBe(false);
        expect(h.bursts.map((b) => b.map(summary))).toEqual([[[1, 0, 120]]]);
        expect(r.explosions.map(summary)).toEqual([[2, 0, 120]]);
        expect(m.mines).toEqual([]);
    });

    it('applies the burst to the field before the next mine looks at the enemies: a swept enemy no longer makes a later mine due', () => {
        // mine 1 is touched; the enemy at 119 px from it is swept by its blast (radius 120) and was touching
        // mine 2 (20 px away), which is 139 px from mine 1 and so not chained
        const m = minefieldOf([200, 300, 1], [200, 439, 1]);
        const h = hooks();
        const r = stepMinefield(m, fieldOf([enemy(5, 200, 419)]), { dt: 0, playerX: 200, playerY: 300 }, h);
        expect(h.bursts[0][0].removedEnemies).toEqual([{ id: 5, x: 200, y: 419 }]);
        expect(r.explosions).toEqual([]);
        expect(m.mines.map((x) => x.id)).toEqual([2]);
    });

    it('skips, without ageing or checking it, a later mine that the burst chained away', () => {
        const m = minefieldOf([200, 300, 1], [200, 410, 1]);
        const chainedAway = m.mines[1];
        const h = hooks();
        const r = stepMinefield(m, fieldOf([enemy(5, 200, 420)]), { dt: 0.1, playerX: 200, playerY: 300 }, h);
        expect(h.bursts[0].map(summary)).toEqual([[1, 0, 120], [2, 1, 180]]);
        expect(r.explosions).toEqual([]);
        expect(m.mines).toEqual([]);
        expect(chainedAway.age).toBe(1); // not aged by this update's dt (0.1)
        expect(h.asked).toBe(1); // asked about touching for mine 1 only
    });

    it('does not explode a due mine again when the burst chained it: it is reported once, in the burst', () => {
        // mine 1 (list first) has an enemy touching it, so it is due; mine 2 is touched by the player 60 px away
        const m = minefieldOf([200, 300, 1], [260, 300, 1]);
        const h = hooks();
        const r = stepMinefield(m, fieldOf([enemy(9, 210, 300)]), { dt: 0, playerX: 260, playerY: 300 }, h);
        expect(h.bursts.map((b) => b.map(summary))).toEqual([[[2, 0, 120], [1, 1, 180]]]);
        expect(h.bursts[0][0].removedEnemies).toEqual([{ id: 9, x: 210, y: 300 }]);
        expect(r.explosions).toEqual([]);
        expect(m.mines).toEqual([]);
    });
});

describe('stepMinefield: chains', () => {
    it('sets off a mine exactly one blast radius away, but not 0.01 px beyond', () => {
        const inside = minefieldOf([200, 300, 10], [200, 420, 0]);
        expect(stepMinefield(inside, fieldOf(), { dt: 0, ...FAR }, hooks()).explosions.map(summary))
            .toEqual([[1, 0, 120], [2, 1, 180]]);

        const outside = minefieldOf([200, 300, 10], [200, 420.01, 0]);
        const r = stepMinefield(outside, fieldOf(), { dt: 0, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120]]);
        expect(outside.mines.map((x) => x.id)).toEqual([2]);
    });

    it('widens the radius with the depth: A, B, C in a column explode with chain counts 0, 1, 2', () => {
        const m = minefieldOf([200, 300, 10], [200, 400, 0], [200, 500, 0]);
        const r = stepMinefield(m, fieldOf(), { dt: 0, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120], [2, 1, 180], [3, 2, 270]]);
        expect(m.mines).toEqual([]);
    });

    it('explodes a mine reached by an earlier chain once, with the chain count of that chain (2, not 1)', () => {
        const m = minefieldOf([200, 300, 10], [260, 300, 0], [140, 300, 0]);
        const r = stepMinefield(m, fieldOf(), { dt: 0, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120], [2, 1, 180], [3, 2, 270]]);
    });

    it('explodes once two due mines reach each other: the second is chained, not exploded again', () => {
        const m = minefieldOf([200, 300, 10], [200, 400, 10]);
        const r = stepMinefield(m, fieldOf(), { dt: 0, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120], [2, 1, 180]]);
    });

    it('explodes independent due mines in the order they became due, each as chain count 0', () => {
        const m = minefieldOf([100, 300, 10], [400, 300, 10], [250, 600, 10]);
        const r = stepMinefield(m, fieldOf(), { dt: 0, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120], [2, 0, 120], [3, 0, 120]]);
    });
});

describe('stepMinefield: randomness', () => {
    it('never calls Math.random, through chains, sweeps, a touch burst and a timeout', () => {
        const spy = vi.spyOn(Math, 'random');
        try {
            const m = minefieldOf([200, 300, 1], [200, 380, 10], [200, 460, 0], [400, 300, 10]);
            stepMinefield(
                m,
                fieldOf([enemy(1, 200, 340), enemy(2, 400, 310)], [bullet(5, 210, 320)]),
                { dt: 0.1, playerX: 200, playerY: 300 },
                hooks()
            );
            expect(spy).not.toHaveBeenCalled();
        } finally {
            spy.mockRestore();
        }
    });
});

describe('stepMinefield: what a blast sweeps', () => {
    it('removes enemies and bullets at exactly the radius and keeps those 0.01 px further, in their original order', () => {
        const f = fieldOf(
            [enemy(1, 200, 420), enemy(2, 200, 420.01), enemy(3, 90, 300), enemy(4, 500, 300)],
            [bullet(10, 200, 180), bullet(11, 200, 179.99), bullet(12, 320, 300)]
        );
        const m = minefieldOf([200, 300, 10]);
        const r = stepMinefield(m, f, { dt: 0, ...FAR }, hooks());
        expect(r.explosions[0].removedEnemies).toEqual([{ id: 1, x: 200, y: 420 }, { id: 3, x: 90, y: 300 }]);
        expect(r.explosions[0].removedBulletIds).toEqual([10, 12]);
        expect(f.enemies.map((e) => e.id)).toEqual([2, 4]);
        expect(f.bullets.map((b) => b.id)).toEqual([11]);
    });

    it('does not sweep what an earlier explosion of the same update already removed', () => {
        const f = fieldOf([enemy(1, 200, 380)]);
        const m = minefieldOf([200, 300, 10], [200, 420, 0]);
        const r = stepMinefield(m, f, { dt: 0, ...FAR }, hooks());
        expect(r.explosions[0].removedEnemies.map((e) => e.id)).toEqual([1]);
        expect(r.explosions[1].removedEnemies).toEqual([]);
    });

    it('collects the chain from the mines still on the field before it sweeps, so a sweep never changes who is chained', () => {
        const f = fieldOf([enemy(1, 200, 340)]);
        const m = minefieldOf([200, 300, 10], [200, 400, 0]);
        const r = stepMinefield(m, f, { dt: 0, ...FAR }, hooks());
        expect(r.explosions.map(summary)).toEqual([[1, 0, 120], [2, 1, 180]]);
    });
});

describe('stepMinefield: the blast on the player', () => {
    it('reaches the player closer than 132 px (radius 120 + 12) and not at exactly 132', () => {
        const near = stepMinefield(minefieldOf([200, 300, 10]), fieldOf(), { dt: 0, playerX: 200, playerY: 431.99 }, hooks());
        expect(near.playerHit).toBe(true);
        expect(near.explosions[0].hitsPlayer).toBe(true);

        const edge = stepMinefield(minefieldOf([200, 300, 10]), fieldOf(), { dt: 0, playerX: 200, playerY: 432 }, hooks());
        expect(edge.playerHit).toBe(false);
        expect(edge.explosions[0].hitsPlayer).toBe(false);
    });

    it('uses the chain radius for a chained mine: 191.99 px reaches (radius 180 + 12), 192 does not', () => {
        const hit = stepMinefield(minefieldOf([200, 300, 10], [200, 420, 0]), fieldOf(), { dt: 0, playerX: 200, playerY: 611.99 }, hooks());
        expect(hit.explosions.map((e) => e.hitsPlayer)).toEqual([false, true]);
        expect(hit.playerHit).toBe(true);

        const miss = stepMinefield(minefieldOf([200, 300, 10], [200, 420, 0]), fieldOf(), { dt: 0, playerX: 200, playerY: 612 }, hooks());
        expect(miss.explosions.map((e) => e.hitsPlayer)).toEqual([false, false]);
        expect(miss.playerHit).toBe(false);
    });
});

// ---------------------------------------------------------------------------------------------------------------
// Reference: the update as the Scene did it before it moved (triggerExplosion and the mine loop), kept on plain data.

type RPoint = { id: number; x: number; y: number };
type RWorld = { mines: MineBody[]; enemies: RPoint[]; bullets: RPoint[] };

function refTrigger(
    w: RWorld, mine: MineBody, visited: Set<MineBody>, chainCount: number,
    player: { x: number; y: number }, log: Explosion[]
): boolean {
    if (visited.has(mine)) return false;
    visited.add(mine);
    const radius = calcChainExplosionRadius(MINE_EXPLODE_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER, chainCount);
    const at = w.mines.indexOf(mine);
    if (at !== -1) w.mines.splice(at, 1);

    const chainMines: MineBody[] = [];
    for (const other of w.mines) {
        if (!visited.has(other)) {
            const dx = mine.x - other.x;
            const dy = mine.y - other.y;
            if (dx * dx + dy * dy <= radius * radius) chainMines.push(other);
        }
    }

    const hitEnemies = getTargetsInExplosion(mine.x, mine.y, radius, w.enemies.map((e) => ({ x: e.x, y: e.y })));
    const removedEnemies = hitEnemies.map((i) => ({ ...w.enemies[i] }));
    const dropE = new Set(hitEnemies);
    w.enemies = w.enemies.filter((_, i) => !dropE.has(i));

    const hitBullets = getTargetsInExplosion(mine.x, mine.y, radius, w.bullets.map((b) => ({ x: b.x, y: b.y })));
    const removedBulletIds = hitBullets.map((i) => w.bullets[i].id);
    const dropB = new Set(hitBullets);
    w.bullets = w.bullets.filter((_, i) => !dropB.has(i));

    const hitsPlayer = circlesOverlap(mine.x, mine.y, radius, player.x, player.y, 12);
    log.push({ mineId: mine.id, x: mine.x, y: mine.y, radius, chainCount, removedEnemies, removedBulletIds, hitsPlayer });

    let chainHit = false;
    for (const cm of chainMines) {
        if (refTrigger(w, cm, visited, chainCount + 1, player, log)) chainHit = true;
    }
    return hitsPlayer || chainHit;
}

type RefOutcome = { aborted: boolean; explosions: Explosion[]; playerHit: boolean };

function refStep(
    w: RWorld, player: { x: number; y: number }, dt: number,
    h: { active: () => boolean; burst: (b: readonly Explosion[]) => boolean }
): RefOutcome {
    const due: MineBody[] = [];
    for (const mine of [...w.mines]) {
        if (!w.mines.includes(mine)) continue;
        mine.age += dt;
        if (mine.age >= 10) {
            due.push(mine);
            continue;
        }
        for (const e of w.enemies) {
            if (circlesOverlap(mine.x, mine.y, 12, e.x, e.y, 14)) {
                due.push(mine);
                break;
            }
        }
        if (mine.age > 0.5 && h.active()) {
            if (circlesOverlap(mine.x, mine.y, 12, player.x, player.y, 12)) {
                const burst: Explosion[] = [];
                refTrigger(w, mine, new Set(), 0, player, burst);
                if (h.burst(burst)) return { aborted: true, explosions: [], playerHit: false };
            }
        }
    }
    const visited = new Set<MineBody>();
    const explosions: Explosion[] = [];
    let playerHit = false;
    for (const mine of due) {
        if (!w.mines.includes(mine)) continue;
        if (!visited.has(mine)) {
            if (refTrigger(w, mine, visited, 0, player, explosions)) playerHit = true;
        }
    }
    return { aborted: false, explosions, playerHit };
}

// seeded random numbers, so the cases are the same every run
function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

type Case = {
    mines: Array<[number, number, number]>;
    enemies: Array<[number, number]>;
    bullets: Array<[number, number]>;
    player: { x: number; y: number };
    dt: number;
};

const AGES = [0.2, 0.45, 0.5, 0.6, 3, 9, 9.9, 9.99, 10.5];
const DTS = [0, 0.01, 0.1];

function makeCase(rand: () => number): Case {
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
    const mines: Case['mines'] = [];
    const count = 3 + Math.floor(rand() * 6);
    // half the layouts are tight (the mines reach each other), half spread out (several independent due mines)
    const wide = rand() < 0.5;
    for (let i = 0; i < count; i += 1) {
        mines.push(wide
            ? [60 + rand() * 360, 250 + rand() * 300, pick(AGES)]
            : [160 + rand() * 140, 300 + rand() * 140, pick(AGES)]);
    }
    const enemies: Case['enemies'] = [];
    const enemyCount = Math.floor(rand() * 7);
    for (let i = 0; i < enemyCount; i += 1) {
        if (rand() < 0.3) {
            const [mx, my] = pick(mines);
            enemies.push([mx + (rand() - 0.5) * 40, my + (rand() - 0.5) * 40]);
        } else {
            enemies.push([120 + rand() * 220, 260 + rand() * 220]);
        }
    }
    const bullets: Case['bullets'] = [];
    const bulletCount = Math.floor(rand() * 11);
    for (let i = 0; i < bulletCount; i += 1) bullets.push([80 + rand() * 320, 220 + rand() * 300]);
    const player = rand() < 0.5
        ? (() => { const [mx, my] = pick(mines); return { x: mx + (rand() - 0.5) * 20, y: my + (rand() - 0.5) * 20 }; })()
        : { x: 100 + rand() * 260, y: 280 + rand() * 260 };
    return { mines, enemies, bullets, player, dt: pick(DTS) };
}

type Policy = 'always' | 'never' | 'abort' | 'absorb';
const POLICIES: Policy[] = ['always', 'never', 'abort', 'absorb'];

function policyHooks(policy: Policy) {
    let bursts = 0;
    const log: unknown[] = [];
    return {
        log,
        active: () => {
            const on = policy === 'never' ? false : policy === 'absorb' ? bursts === 0 : true;
            log.push(['active', on]);
            return on;
        },
        burst: (b: readonly Explosion[]) => {
            bursts += 1;
            log.push(['burst', b]);
            return policy === 'abort';
        }
    };
}

describe('stepMinefield against the code it replaced', () => {
    it('gives the same explosions, order, hook calls and leftovers on seeded random layouts', () => {
        const rand = mulberry32(20240607);
        const seen = { chain2: 0, playerHit: 0, burst: 0, severalDue: 0, aborted: 0, swept: 0, chainedDue: 0, total: 0 };
        for (let n = 0; n < 3000; n += 1) {
            const c = makeCase(rand);
            const policy = POLICIES[n % POLICIES.length];

            const ref: RWorld = {
                mines: c.mines.map(([x, y, age], i) => ({ id: i + 1, x, y, age })),
                enemies: c.enemies.map(([x, y], i) => ({ id: i + 1, x, y })),
                bullets: c.bullets.map(([x, y], i) => ({ id: 1000 + i, x, y }))
            };
            const rh = policyHooks(policy);
            const expected = refStep(ref, c.player, c.dt, rh);

            const mines = createMinefield();
            mines.mines = c.mines.map(([x, y, age], i) => ({ id: i + 1, x, y, age }));
            const field = fieldOf(
                c.enemies.map(([x, y], i) => enemy(i + 1, x, y)),
                c.bullets.map(([x, y], i) => bullet(1000 + i, x, y))
            );
            const nh = policyHooks(policy);
            const actual = stepMinefield(mines, field, { dt: c.dt, playerX: c.player.x, playerY: c.player.y }, {
                playerTouchActive: nh.active,
                onTouchBurst: nh.burst
            });

            const a = JSON.stringify({
                r: actual, log: nh.log,
                mines: mines.mines.map((m) => [m.id, m.age]),
                enemies: field.enemies.map((e) => [e.id, e.x, e.y]),
                bullets: field.bullets.map((b) => [b.id, b.x, b.y])
            });
            const e = JSON.stringify({
                r: expected, log: rh.log,
                mines: ref.mines.map((m) => [m.id, m.age]),
                enemies: ref.enemies.map((x) => [x.id, x.x, x.y]),
                bullets: ref.bullets.map((b) => [b.id, b.x, b.y])
            });
            if (a !== e) expect.fail(`case ${n} (${policy}) differs\n actual:   ${a}\n expected: ${e}`);

            seen.total += 1;
            const all = [...expected.explosions, ...rh.log.flatMap((l) => (l as [string, Explosion[]])[0] === 'burst' ? (l as [string, Explosion[]])[1] : [])];
            if (all.some((x) => x.chainCount >= 2)) seen.chain2 += 1;
            if (expected.playerHit || all.some((x) => x.hitsPlayer)) seen.playerHit += 1;
            if (rh.log.some((l) => (l as [string])[0] === 'burst')) seen.burst += 1;
            if (expected.explosions.filter((x) => x.chainCount === 0).length >= 2) seen.severalDue += 1;
            if (expected.aborted) seen.aborted += 1;
            if (all.some((x) => x.removedEnemies.length > 0 || x.removedBulletIds.length > 0)) seen.swept += 1;
            if (rh.log.some((l) => (l as [string])[0] === 'burst') && !expected.aborted && expected.explosions.length > 0) seen.chainedDue += 1;
        }
        // the layouts must really reach the cases worth comparing, not just agree on empty ones
        expect(seen.chain2).toBeGreaterThan(100);
        expect(seen.playerHit).toBeGreaterThan(100);
        expect(seen.burst).toBeGreaterThan(100);
        expect(seen.severalDue).toBeGreaterThan(30);
        expect(seen.aborted).toBeGreaterThan(20);
        expect(seen.swept).toBeGreaterThan(100);
        expect(seen.chainedDue).toBeGreaterThan(10);
    });
});
