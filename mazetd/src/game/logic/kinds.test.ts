import { describe, expect, it } from 'vitest';
import { indexOf, type Terrain } from './board';
import { CELL, COINS_START, GRID_COLS, GRID_ROWS, KILL_REWARD, LIVES_START, WAVE_BONUS } from './config';
import { baseEnemyHp, enemyCount, type EnemyKind, enemyHp, enemyKind, kindRadius, kindSpeedRate } from './wave';
import { createGame, type Enemy, type GameState, startWave, update } from './world';

// Expected values below come from the spec table (docs/spec/enemy-kinds.md), not from the implementation.
// [wave, count, normal, fast, tank, flyer, base HP, fast HP, tank HP]
const TABLE: ReadonlyArray<readonly [number, number, number, number, number, number, number, number, number]> = [
    [1, 8, 8, 0, 0, 0, 3, 0, 0],
    [2, 10, 10, 0, 0, 0, 5, 0, 0],
    [3, 12, 9, 3, 0, 0, 7, 4, 0],
    [4, 14, 9, 3, 0, 2, 9, 5, 0],
    [5, 16, 6, 4, 4, 2, 11, 6, 22],
    [6, 18, 8, 4, 4, 2, 13, 7, 26],
    [7, 20, 8, 5, 5, 2, 15, 8, 30],
    [8, 22, 9, 5, 5, 3, 17, 9, 34],
    [9, 24, 9, 6, 6, 3, 19, 10, 38],
    [10, 26, 11, 6, 6, 3, 21, 11, 42]
];

const kindsOf = (wave: number): EnemyKind[] =>
    Array.from({ length: enemyCount(wave) }, (_, i) => enemyKind(wave, i));

describe('which kind each enemy of a wave is', () => {
    it.each(TABLE)('wave %i has %i enemies: %i normal, %i fast, %i tank, %i flyer', (wave, n, normal, fast, tank, flyer) => {
        const kinds = kindsOf(wave);
        expect(kinds).toHaveLength(n);
        expect(kinds.filter((k) => k === 'normal')).toHaveLength(normal);
        expect(kinds.filter((k) => k === 'fast')).toHaveLength(fast);
        expect(kinds.filter((k) => k === 'tank')).toHaveLength(tank);
        expect(kinds.filter((k) => k === 'flyer')).toHaveLength(flyer);
        // The closed forms of the spec.
        expect(fast).toBe(wave >= 3 ? Math.floor((n + 1) / 4) : 0);
        expect(tank).toBe(wave >= 5 ? Math.floor(n / 4) : 0);
    });

    it('makes every enemy of waves 1 and 2 a normal one', () => {
        expect(kindsOf(1).every((k) => k === 'normal')).toBe(true);
        expect(kindsOf(2).every((k) => k === 'normal')).toBe(true);
    });

    it('makes spawn indices 2, 6 and 10 fast in wave 3 and nobody a tank', () => {
        const N = 'normal';
        const F = 'fast';
        expect(kindsOf(3)).toEqual([N, N, F, N, N, N, F, N, N, N, F, N]);
    });

    it('makes indices 2, 6, 10, 14 fast, 3, 7, 11, 15 tank and 5, 13 flyers in wave 5', () => {
        const N = 'normal';
        const F = 'fast';
        const T = 'tank';
        const L = 'flyer';
        expect(kindsOf(5)).toEqual([N, N, F, T, N, L, F, T, N, N, F, T, N, L, F, T]);
    });

    it('starts fast at wave 3 and tank at wave 5 exactly (index 2 and 3 of the wave before stay normal)', () => {
        expect(enemyKind(2, 2)).toBe('normal');
        expect(enemyKind(3, 2)).toBe('fast');
        expect(enemyKind(4, 3)).toBe('normal');
        expect(enemyKind(5, 3)).toBe('tank');
    });

    it('repeats every 4 spawns: the same slot gives the same kind', () => {
        expect(enemyKind(7, 2)).toBe(enemyKind(7, 18));
        expect(enemyKind(7, 3)).toBe(enemyKind(7, 19));
        expect(enemyKind(7, 1)).toBe('normal');
        expect(enemyKind(7, 4)).toBe('normal');
    });
});

describe('max HP per kind', () => {
    it.each(TABLE)('wave %i: base, fast and tank max HP follow the spec table', (wave, _n, _a, fast, tank, _f, base, fastHp, tankHp) => {
        expect(baseEnemyHp(wave)).toBe(base);
        expect(enemyHp(wave)).toBe(base);
        expect(enemyHp(wave, 'normal')).toBe(base);
        if (fast > 0) expect(enemyHp(wave, 'fast')).toBe(fastHp);
        if (tank > 0) expect(enemyHp(wave, 'tank')).toBe(tankHp);
    });

    it('rounds a fast enemy up: 7 HP becomes 4, 9 becomes 5', () => {
        expect(enemyHp(3, 'fast')).toBe(4);
        expect(enemyHp(4, 'fast')).toBe(5);
    });

    it('never gives a fast enemy less than 1 HP, even from a base HP below 1 (outside the game range)', () => {
        expect(baseEnemyHp(-1)).toBe(-1);
        expect(enemyHp(-1, 'fast')).toBe(1);
    });
});

describe('speed and size per kind', () => {
    it('walks a normal enemy at 1x, a fast one at 1.6x and a tank at 0.6x', () => {
        expect(kindSpeedRate()).toBe(1);
        expect(kindSpeedRate('normal')).toBe(1);
        expect(kindSpeedRate('fast')).toBe(1.6);
        expect(kindSpeedRate('tank')).toBe(0.6);
    });

    it('draws radius 14 for normal, 10 for fast and 18 for tank', () => {
        expect(kindRadius()).toBe(14);
        expect(kindRadius('normal')).toBe(14);
        expect(kindRadius('fast')).toBe(10);
        expect(kindRadius('tank')).toBe(18);
    });
});

/** Runs a whole spawn phase of `wave` on a plain board and records each enemy by spawn order. */
function spawnWave(wave: number): Enemy[] {
    const s = createGame();
    s.wave = wave;
    s.lives = 1e9; // leaking enemies must not end the run
    startWave(s);
    const seen: Enemy[] = [];
    const total = enemyCount(wave);
    for (let frame = 0; frame < 1000 && s.spawned < total; frame++) {
        update(s, 0.1);
        for (const e of s.enemies) if (!seen.includes(e)) seen.push(e);
    }
    return seen;
}

describe('spawning a wave', () => {
    it.each([1, 3, 5, 10])('spawns wave %i with the kind, HP and max HP of the table, in spawn order', (wave) => {
        const seen = spawnWave(wave);
        expect(seen).toHaveLength(enemyCount(wave));
        seen.forEach((e, i) => {
            const kind = enemyKind(wave, i);
            expect(e.id).toBe(i);
            expect(e.kind).toBe(kind);
            expect(e.hp).toBe(enemyHp(wave, kind));
            expect(e.maxHp).toBe(enemyHp(wave, kind));
        });
        // Guard against a vacuous loop: later waves really contain every kind.
        const kinds = new Set(seen.map((e) => e.kind));
        expect(kinds.has('fast')).toBe(wave >= 3);
        expect(kinds.has('tank')).toBe(wave >= 5);
    });

    it('decides the kind by the index within the wave, not by the enemy id (ids keep counting across waves)', () => {
        const s = createGame();
        s.wave = 3;
        s.lives = 1e9;
        s.nextEnemyId = 7; // as if earlier waves had spawned 7 enemies
        startWave(s);
        const seen: Enemy[] = [];
        for (let frame = 0; frame < 1000 && s.spawned < enemyCount(3); frame++) {
            update(s, 0.1);
            for (const e of s.enemies) if (!seen.includes(e)) seen.push(e);
        }
        expect(seen.map((e) => e.kind)).toEqual(kindsOf(3));
        expect(seen[0].id).toBe(7);
    });

    it('keeps the kind of an enemy fixed while it walks', () => {
        const s = createGame();
        s.wave = 5;
        startWave(s);
        for (let i = 0; i < 40; i++) update(s, 0.1);
        for (const e of s.enemies) expect(e.kind).toBe(enemyKind(5, e.id));
    });
});

// A board with a single swamp at (row 3, col 4) on the straight path: cell 3, traveled 140 to <196.
function swampTerrain(): Terrain[] {
    const t = new Array<Terrain>(GRID_COLS * GRID_ROWS).fill('plain');
    t[3 * GRID_COLS + 4] = 'swamp';
    return t;
}

/** An enemy of `kind` standing on the straight path (col 4) at `traveled`, as if it had walked there. */
function walker(s: GameState, kind: EnemyKind | undefined, traveled: number, hp = 99): Enemy {
    const e: Enemy = { id: s.nextEnemyId++, hp, maxHp: hp, kind, traveled, x: 270, y: 124 + traveled };
    s.enemies.push(e);
    return e;
}

/** A started wave with nothing left to spawn, so only the test's own enemies exist. */
function quietWave(terrain?: Terrain[], build?: (s: GameState) => void): GameState {
    const s = createGame(terrain);
    build?.(s);
    startWave(s);
    s.spawned = enemyCount(s.wave);
    return s;
}

const moved = (s: GameState, e: Enemy): number => {
    const before = e.traveled;
    update(s, 0.1);
    return e.traveled - before;
};

describe('how far one frame (dt 0.1) moves each kind', () => {
    it('moves a normal enemy 6.4 px, a fast one 10.24 px and a tank 3.84 px on plain ground', () => {
        const s = quietWave();
        expect(moved(s, walker(s, 'normal', 100))).toBeCloseTo(6.4, 10);
        expect(moved(s, walker(s, 'fast', 100))).toBeCloseTo(10.24, 10);
        expect(moved(s, walker(s, 'tank', 100))).toBeCloseTo(3.84, 10);
    });

    it('moves an enemy without a kind like a normal one', () => {
        const s = quietWave();
        expect(moved(s, walker(s, undefined, 100))).toBeCloseTo(6.4, 10);
    });

    it('does not move an enemy of any kind in the frame it spawns', () => {
        for (const wave of [3, 5]) {
            const s = createGame();
            s.wave = wave;
            s.lives = 1e9;
            startWave(s);
            const spawnedKinds = new Set<EnemyKind | undefined>();
            for (let frame = 0; frame < 1000 && s.spawned < enemyCount(wave); frame++) {
                const known = new Set(s.enemies);
                update(s, 0.1);
                // Anything spawned this frame stays on the start cell.
                for (const e of s.enemies) {
                    if (known.has(e)) continue;
                    expect(e.traveled).toBe(0);
                    spawnedKinds.add(e.kind);
                }
            }
            // Guard against a vacuous loop: the kinds of this wave were really seen spawning.
            expect(spawnedKinds.has('fast')).toBe(true);
            expect(spawnedKinds.has('tank')).toBe(wave >= 5);
        }
    });

    it('slows a fast enemy to 5.12 px and a tank to 1.92 px in a swamp', () => {
        const s = quietWave(swampTerrain());
        expect(moved(s, walker(s, 'fast', 168))).toBeCloseTo(5.12, 10);
        expect(moved(s, walker(s, 'tank', 168))).toBeCloseTo(1.92, 10);
    });

    it('decides a fast enemy\'s swamp factor at the start of the frame: 139.9 -> 150.14 -> 155.26', () => {
        const s = quietWave(swampTerrain());
        const e = walker(s, 'fast', 139.9);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(150.14, 10);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(155.26, 10);
    });

    // A slow tower beside the path at (row 3, col 5): centre (326, 292). Enemies at (270, 124 + traveled).
    const withSlowTower = (s: GameState): void => {
        s.board.cells[indexOf(s.board, 5, 3)] = 'slow';
    };

    it('halves a fast enemy (5.12 px) and a tank (1.92 px) inside a slow tower range, on plain ground', () => {
        const s = quietWave(swampTerrain(), withSlowTower);
        // traveled 224 is plain (cell 4) and 79 px from the tower.
        expect(moved(s, walker(s, 'fast', 224))).toBeCloseTo(5.12, 10);
        expect(moved(s, walker(s, 'tank', 224))).toBeCloseTo(1.92, 10);
    });

    it('multiplies swamp and slow tower on top of the kind: fast 0.4x (2.56 px), tank 0.15x (0.96 px)', () => {
        const s = quietWave(swampTerrain(), withSlowTower);
        expect(moved(s, walker(s, 'fast', 168))).toBeCloseTo(2.56, 10);
        expect(moved(s, walker(s, 'tank', 168))).toBeCloseTo(0.96, 10);
    });

    it('applies the slow rate once for a fast enemy covered by two slow towers (5.12 px, not 2.56)', () => {
        const s = quietWave(swampTerrain(), (g) => {
            withSlowTower(g);
            g.board.cells[indexOf(g.board, 5, 4)] = 'slow'; // a second tower at (326, 348)
        });
        expect(moved(s, walker(s, 'fast', 224))).toBeCloseTo(5.12, 10);
    });

    it('leaves a fast enemy at full kind speed outside the slow tower range', () => {
        const s = quietWave(swampTerrain(), withSlowTower);
        // traveled 0 is about 177 px from the tower (56 across, 168 down): out of range, on plain ground.
        expect(moved(s, walker(s, 'fast', 0))).toBeCloseTo(10.24, 10);
    });
});

describe('reaching G', () => {
    // The plain straight path has 11 steps: G at traveled 11 * CELL = 616.
    const GOAL = 11 * CELL;

    it('lets a tank reach G only once traveled reaches 616: 612 + 3.84 stays, 613 + 3.84 arrives', () => {
        const stays = quietWave();
        const a = walker(stays, 'tank', 612);
        update(stays, 0.1);
        expect(stays.enemies).toContain(a);
        expect(stays.lives).toBe(LIVES_START);

        const arrives = quietWave();
        const b = walker(arrives, 'tank', 613);
        update(arrives, 0.1);
        expect(arrives.enemies).not.toContain(b);
        expect(arrives.lives).toBe(LIVES_START - 1);
        expect(GOAL).toBe(616);
    });

    it('lets a fast enemy reach G at 606 + 10.24 but not at 605.7 + 10.24 (= 615.94)', () => {
        const arrives = quietWave();
        const a = walker(arrives, 'fast', 606);
        update(arrives, 0.1);
        expect(arrives.enemies).not.toContain(a);
        expect(arrives.lives).toBe(LIVES_START - 1);

        const stays = quietWave();
        const b = walker(stays, 'fast', 605.7);
        update(stays, 0.1);
        expect(stays.enemies).toContain(b);
        expect(stays.lives).toBe(LIVES_START);
    });

    it('does not reward or count an enemy that leaks, whatever its kind', () => {
        const s = quietWave();
        walker(s, 'tank', 613);
        walker(s, 'fast', 610);
        update(s, 0.1);
        expect(s.lives).toBe(LIVES_START - 2);
        expect(s.kills).toBe(0);
        // No kill coins; the only coins are the bonus for the wave ending with nobody left.
        expect(s.coins).toBe(COINS_START + WAVE_BONUS);
        expect(s.events.leaks).toBe(2);
    });
});

describe('shooting mixed kinds', () => {
    // A turret beside the path at (row 2, col 5): centre (326, 236); both enemies below are within its range 112.
    const withTurret = (s: GameState): void => {
        s.board.cells[indexOf(s.board, 5, 2)] = 'turret';
    };

    it('targets the enemy furthest along even when it is a fast one that overtook an older tank', () => {
        const s = quietWave(undefined, withTurret);
        const tank = walker(s, 'tank', 100);
        const fast = walker(s, 'fast', 150);
        update(s, 0.1);
        expect(fast.hp).toBe(98);
        expect(tank.hp).toBe(99);
    });

    it('hits the older enemy when a tank and a fast enemy are exactly level, whichever kind it is', () => {
        // Same `traveled` after moving is impossible for different speeds, so set it up with the enemies' positions
        // equal and both HP equal, and check the older one (smaller id) takes the shot by lowering only its HP.
        for (const olderKind of ['tank', 'fast'] as const) {
            const s = quietWave(undefined, withTurret);
            const younger = olderKind === 'tank' ? 'fast' : 'tank';
            // After one frame: tank 100 + 3.84 = 103.84; fast 93.6 + 10.24 = 103.84 -> level.
            const older = walker(s, olderKind, olderKind === 'tank' ? 100 : 93.6);
            const other = walker(s, younger, younger === 'tank' ? 100 : 93.6);
            update(s, 0.1);
            // Exactly level (the targeting compares with a strict >); if a constant changes and this fails, re-derive the start values.
            expect(older.traveled).toBe(other.traveled);
            expect(older.hp).toBe(98);
            expect(other.hp).toBe(99);
        }
    });

    it('does not let a turret kill a fast enemy or a tank that reaches G in the same frame', () => {
        for (const [kind, traveled] of [['fast', 606], ['tank', 613]] as const) {
            // A turret beside the last stretch of the path, at (row 10, col 5): centre (326, 684), about 72 px from the enemy.
            const s = quietWave(undefined, (g) => {
                g.board.cells[indexOf(g.board, 5, 10)] = 'turret';
            });
            walker(s, kind, traveled, 1);
            update(s, 0.1);
            expect(s.lives).toBe(LIVES_START - 1);
            expect(s.kills).toBe(0);
        }
    });

    it('targets the tank once it is the one furthest along', () => {
        const s = quietWave(undefined, withTurret);
        const tank = walker(s, 'tank', 150);
        const fast = walker(s, 'fast', 100);
        update(s, 0.1);
        expect(tank.hp).toBe(98);
        expect(fast.hp).toBe(99);
    });

    it('pays the normal reward for killing a fast enemy and a tank', () => {
        for (const kind of ['fast', 'tank'] as const) {
            const s = quietWave(undefined, withTurret);
            walker(s, kind, 150, 1);
            update(s, 0.1);
            expect(s.kills).toBe(1);
            // The kill coins plus the bonus for the wave ending (it was the last enemy).
            expect(s.coins).toBe(COINS_START + KILL_REWARD + WAVE_BONUS);
            expect(s.events.killX).toHaveLength(1);
            expect(s.enemies).toHaveLength(0);
        }
    });

    it('does not end the wave while a tank is still walking, then ends it once it is gone', () => {
        const s = quietWave();
        const tank = walker(s, 'tank', 100);
        for (let i = 0; i < 20; i++) update(s, 0.1);
        expect(s.phase).toBe('wave');
        expect(s.enemies).toContain(tank);
        tank.traveled = 613;
        update(s, 0.1);
        expect(s.enemies).toHaveLength(0);
        expect(s.phase).toBe('build');
    });
});
