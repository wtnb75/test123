import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    CELL,
    COINS_START,
    FAST_SLOT,
    FLYER_CYCLE,
    FLYER_SLOT,
    GRID_COLS,
    GRID_ROWS,
    KILL_REWARD,
    KIND_CYCLE,
    LIVES_START,
    SCORE_PER_KILL,
    TANK_SLOT,
    WAVE_BONUS
} from './config';
import { type CellKind, indexOf, initialTerrain, type Terrain } from './board';
import { createFlightRoute, routePoint, showsFlightLine, visibleRoute } from './flight';
import { baseEnemyHp, computeScore, enemyCount, type EnemyKind, enemyHp, enemyKind, kindRadius, kindSpeedRate } from './wave';
import { createGame, type Enemy, type GameState, startWave, update } from './world';

// Expected values come from docs/spec/flyers.md (and enemy-kinds.md), worked by hand.
// The initial board: S centre (270, 124), G centre (270, 740); the flyer route is 616 px, the walked path 728 px.
const FLY_LEN = 616;
const PATH_LEN = 728;

const kindsOf = (wave: number): EnemyKind[] => Array.from({ length: enemyCount(wave) }, (_, i) => enemyKind(wave, i));
const indicesOf = (wave: number, kind: EnemyKind): number[] =>
    kindsOf(wave).flatMap((k, i) => (k === kind ? [i] : []));

describe('which enemies are flyers', () => {
    it('has no flyer in waves 1 to 3', () => {
        for (const wave of [1, 2, 3]) expect(indicesOf(wave, 'flyer')).toEqual([]);
    });

    it('makes spawn indices 5 and 13 flyers in waves 4 to 7 (index 21 is outside a 20-enemy wave)', () => {
        for (const wave of [4, 5, 6, 7]) expect(indicesOf(wave, 'flyer')).toEqual([5, 13]);
    });

    it('makes spawn indices 5, 13 and 21 flyers in waves 8 to 10', () => {
        for (const wave of [8, 9, 10]) expect(indicesOf(wave, 'flyer')).toEqual([5, 13, 21]);
    });

    it('starts flyers at wave 4 exactly: index 5 is normal in wave 3 and a flyer in wave 4', () => {
        expect(enemyKind(3, 5)).toBe('normal');
        expect(enemyKind(4, 5)).toBe('flyer');
    });

    it('counts floor((n + 2) / 8) flyers from wave 4 and leaves the fast and tank counts as they were', () => {
        for (let wave = 4; wave <= 10; wave++) {
            const n = enemyCount(wave);
            expect(indicesOf(wave, 'flyer')).toHaveLength(Math.floor((n + 2) / 8));
            expect(indicesOf(wave, 'fast')).toHaveLength(Math.floor((n + 1) / 4));
            expect(indicesOf(wave, 'tank')).toHaveLength(wave >= 5 ? Math.floor(n / 4) : 0);
        }
    });

    it('never puts a flyer on a fast or tank index, and the flyer slot is a normal one modulo 4', () => {
        expect(FLYER_SLOT % KIND_CYCLE).not.toBe(FAST_SLOT);
        expect(FLYER_SLOT % KIND_CYCLE).not.toBe(TANK_SLOT);
        expect(FLYER_CYCLE % KIND_CYCLE).toBe(0);
        for (let wave = 4; wave <= 10; wave++) {
            const flyers = new Set(indicesOf(wave, 'flyer'));
            for (const i of [...indicesOf(wave, 'fast'), ...indicesOf(wave, 'tank')]) expect(flyers.has(i)).toBe(false);
        }
    });

    it('replaces only normal enemies: the other positions keep the kinds they had without flyers', () => {
        // Without flyers wave 5 was N N F T N N F T N N F T N N F T.
        const before = ['normal', 'normal', 'fast', 'tank', 'normal', 'normal', 'fast', 'tank', 'normal', 'normal', 'fast', 'tank', 'normal', 'normal', 'fast', 'tank'];
        kindsOf(5).forEach((k, i) => {
            if (k !== 'flyer') expect(k).toBe(before[i]);
            else expect(before[i]).toBe('normal');
        });
    });
});

describe('flyer HP, speed and size', () => {
    it('has the base HP: 9 in wave 4 and 21 in wave 10, like a normal enemy', () => {
        expect(enemyHp(4, 'flyer')).toBe(9);
        expect(enemyHp(10, 'flyer')).toBe(21);
        for (let wave = 4; wave <= 10; wave++) expect(enemyHp(wave, 'flyer')).toBe(baseEnemyHp(wave));
    });

    it('keeps the total HP of every wave: a flyer weighs the same as the normal enemy it replaces', () => {
        // [wave, normal, fast, tank, flyer, base HP, fast HP, tank HP] from the spec table.
        const rows = [
            [4, 9, 3, 0, 2, 9, 5, 0],
            [5, 6, 4, 4, 2, 11, 6, 22],
            [8, 9, 5, 5, 3, 17, 9, 34],
            [10, 11, 6, 6, 3, 21, 11, 42]
        ];
        for (const [wave, normal, fast, tank, flyer, base, fastHp, tankHp] of rows) {
            const expected = (normal + flyer) * base + fast * fastHp + tank * tankHp;
            const actual = kindsOf(wave).reduce((sum, k) => sum + enemyHp(wave, k), 0);
            expect(actual).toBe(expected);
        }
        // Wave 5 is 200 in total, as before flyers existed; wave 10 is 612.
        expect(kindsOf(5).reduce((sum, k) => sum + enemyHp(5, k), 0)).toBe(200);
        expect(kindsOf(10).reduce((sum, k) => sum + enemyHp(10, k), 0)).toBe(612);
    });

    it('flies at 1x speed and is drawn with the diamond distance 14', () => {
        expect(kindSpeedRate('flyer')).toBe(1);
        expect(kindRadius('flyer')).toBe(14);
    });

    describe('with another HP rate', () => {
        afterEach(() => {
            vi.doUnmock('./config');
            vi.resetModules();
        });

        it('rounds a halved flyer HP up (9 -> 5) and never below 1', async () => {
            vi.resetModules();
            vi.doMock('./config', async (original) => ({ ...(await original<typeof import('./config')>()), FLYER_HP_RATE: 0.5 }));
            const wave = await import('./wave');
            expect(wave.enemyHp(4, 'flyer')).toBe(5);
            expect(wave.baseEnemyHp(-1)).toBe(-1);
            expect(wave.enemyHp(-1, 'flyer')).toBe(1);
        });
    });
});

describe('the flight route and its line', () => {
    const initial = createGame(initialTerrain());

    it('runs from the centre of S to the centre of G: 616 px straight down at x = 270', () => {
        const r = initial.route;
        expect([r.x0, r.y0, r.x1, r.y1]).toEqual([270, 124, 270, 740]);
        expect(r.len).toBe(FLY_LEN);
    });

    it('puts a flyer at S for 0, halfway for 308 and at G for 616 px flown', () => {
        const p = { x: -1, y: -1 };
        routePoint(initial.route, 0, p);
        expect([p.x, p.y]).toEqual([270, 124]);
        routePoint(initial.route, 308, p);
        expect([p.x, p.y]).toEqual([270, 432]);
        routePoint(initial.route, 616, p);
        expect([p.x, p.y]).toEqual([270, 740]);
    });

    it('measures a slanted route by its Euclidean length', () => {
        const r = createFlightRoute({ col: 0, row: 0 }, { col: 3, row: 4 });
        expect(r.len).toBe(280); // 168 across and 224 down: 3-4-5 times 56
    });

    it('draws the line from the bottom edge of S (y 152) to the top edge of G (y 712) at x 270', () => {
        expect(visibleRoute(initial.route)).toEqual({ x0: 270, y0: 152, x1: 270, y1: 712 });
    });

    it('clips a diagonal route at the square S and G cells: (0,0) to (3,3) is drawn from (74, 152) to (186, 264)', () => {
        const seg = visibleRoute(createFlightRoute({ col: 0, row: 0 }, { col: 3, row: 3 }));
        expect(seg).not.toBeNull();
        expect(seg!.x0).toBeCloseTo(74, 9);
        expect(seg!.y0).toBeCloseTo(152, 9);
        expect(seg!.x1).toBeCloseTo(186, 9);
        expect(seg!.y1).toBeCloseTo(264, 9);
    });

    it('draws nothing when S and G are next to each other (no part of the route lies outside the cells)', () => {
        expect(visibleRoute(createFlightRoute({ col: 4, row: 0 }, { col: 4, row: 1 }))).toBeNull();
    });

    it('shows the line only while preparing a wave of 4 or later', () => {
        for (const wave of [1, 2, 3]) expect(showsFlightLine('build', wave)).toBe(false);
        for (const wave of [4, 5, 10]) expect(showsFlightLine('build', wave)).toBe(true);
        for (const phase of ['wave', 'cleared', 'gameover'] as const) expect(showsFlightLine(phase, 4)).toBe(false);
    });
});

// Helpers: a started wave with nothing left to spawn, and enemies placed by hand on the straight line x = 270.
function quietWave(terrain?: Terrain[], build?: (s: GameState) => void): GameState {
    const s = createGame(terrain);
    build?.(s);
    startWave(s);
    s.spawned = enemyCount(s.wave);
    return s;
}

function flyer(s: GameState, traveled: number, hp = 99): Enemy {
    const e: Enemy = { id: s.nextEnemyId++, hp, maxHp: hp, kind: 'flyer', traveled, x: 270, y: 124 + traveled };
    s.enemies.push(e);
    return e;
}

function walker(s: GameState, traveled: number, hp = 99, kind: EnemyKind = 'normal'): Enemy {
    const e: Enemy = { id: s.nextEnemyId++, hp, maxHp: hp, kind, traveled, x: 270, y: 124 + traveled };
    s.enemies.push(e);
    return e;
}

function plainWithSwamp(): Terrain[] {
    const t = new Array<Terrain>(GRID_COLS * GRID_ROWS).fill('plain');
    t[3 * GRID_COLS + 4] = 'swamp';
    return t;
}

const place = (kind: CellKind, col: number, row: number) => (s: GameState) => {
    s.board.cells[indexOf(s.board, col, row)] = kind;
};

const moved = (s: GameState, e: Enemy): number => {
    const before = e.traveled;
    update(s, 0.1);
    return e.traveled - before;
};

describe('how a flyer moves', () => {
    it('flies 6.4 px per 0.1 s frame on plain ground', () => {
        const s = quietWave();
        expect(moved(s, flyer(s, 100))).toBeCloseTo(6.4, 10);
    });

    it('flies over a swamp at full speed (6.4 px) while a walker in the same swamp does 3.2 px', () => {
        const s = quietWave(plainWithSwamp());
        // Cell 3 of the straight route is the swamp (traveled 140 to <196).
        expect(moved(s, flyer(s, 168))).toBeCloseTo(6.4, 10);
        expect(moved(s, walker(s, 168))).toBeCloseTo(3.2, 10);
    });

    it('flies over a rock at full speed: (row 5, col 4) is a rock of the initial terrain at traveled 280', () => {
        const s = quietWave(initialTerrain());
        expect(moved(s, flyer(s, 280))).toBeCloseTo(6.4, 10);
    });

    it('is not slowed or lengthened by walls in its column or anywhere else', () => {
        const s = quietWave(initialTerrain(), (g) => {
            for (const row of [3, 4, 6, 7]) place('wall', 4, row)(g);
        });
        expect(s.route.len).toBe(FLY_LEN);
        const e = flyer(s, 200);
        expect(moved(s, e)).toBeCloseTo(6.4, 10);
        expect(e.x).toBe(270);
        expect(e.y).toBeCloseTo(124 + e.traveled, 9);
    });

    it('halves inside a slow tower range (3.2 px) and flies at full speed outside it (6.4 px)', () => {
        // Slow tower at (row 3, col 5): centre (326, 292).
        const s = quietWave(undefined, place('slow', 5, 3));
        // traveled 224 is at (270, 348): 79 px from the tower. traveled 0 is at (270, 124): 177 px away.
        const inside = flyer(s, 224);
        const outside = flyer(s, 0);
        expect(moved(s, inside)).toBeCloseTo(3.2, 10);
        expect(inside.slowed).toBe(true);
        expect(moved(s, outside)).toBeCloseTo(6.4, 10);
        expect(outside.slowed).toBe(false);
    });

    it('is slowed exactly 100 px from a slow tower (boundary included) but not 101 px away', () => {
        // Slow tower on the route column at (row 5, col 4): centre (270, 404). Flyer y = 124 + traveled.
        const at = quietWave(undefined, place('slow', 4, 5));
        const onEdge = flyer(at, 180); // y 304: exactly 100 px above the tower
        expect(moved(at, onEdge)).toBeCloseTo(3.2, 10);
        expect(onEdge.slowed).toBe(true);

        const beyond = quietWave(undefined, place('slow', 4, 5));
        const outside = flyer(beyond, 179); // y 303: 101 px away
        expect(moved(beyond, outside)).toBeCloseTo(6.4, 10);
        expect(outside.slowed).toBe(false);
    });

    it('follows the straight line: x stays 270 and y is 124 + traveled', () => {
        const s = quietWave();
        const e = flyer(s, 0);
        for (let i = 0; i < 20; i++) {
            update(s, 0.1);
            expect(e.x).toBe(270);
            expect(e.y).toBeCloseTo(124 + e.traveled, 9);
        }
    });

    it('does not move in the frame it spawns and appears at the centre of S', () => {
        const s = createGame(initialTerrain());
        s.wave = 4;
        s.lives = 1e9;
        startWave(s);
        const seenFlyers: Enemy[] = [];
        const seenWalkerXs = new Set<number>();
        for (let frame = 0; frame < 1000 && s.spawned < enemyCount(4); frame++) {
            const known = new Set(s.enemies);
            update(s, 0.1);
            for (const e of s.enemies) {
                if (e.kind !== 'flyer') {
                    seenWalkerXs.add(Math.round(e.x));
                    continue;
                }
                if (!known.has(e)) {
                    expect(e.traveled).toBe(0);
                    expect([e.x, e.y]).toEqual([270, 124]);
                    seenFlyers.push(e);
                }
            }
        }
        // The loop saw both flyers of wave 4, and the walkers left the column while flyers stayed in it.
        expect(seenFlyers).toHaveLength(2);
        expect([...seenWalkerXs].some((x) => x !== 270)).toBe(true);
    });
});

describe('a flyer reaching G', () => {
    it('stays after 96 frames of 0.1 s (614.4 px) and arrives on the 97th (620.8 px), costing one life and no coin', () => {
        const s = quietWave();
        const e = flyer(s, 0);
        for (let i = 0; i < 96; i++) update(s, 0.1);
        expect(e.traveled).toBeCloseTo(614.4, 6);
        expect(s.enemies).toContain(e);
        expect(s.lives).toBe(LIVES_START);
        update(s, 0.1);
        expect(s.enemies).not.toContain(e);
        expect(s.lives).toBe(LIVES_START - 1);
        expect(s.kills).toBe(0);
        expect(s.events.leaks).toBe(1);
        // The only coins are the bonus for the wave ending with nobody left.
        expect(s.coins).toBe(COINS_START + WAVE_BONUS);
    });

    it('arrives from 610 + 6.4 = 616.4 but not from 609.5 + 6.4 = 615.9', () => {
        const arrives = quietWave();
        const a = flyer(arrives, 610);
        update(arrives, 0.1);
        expect(arrives.enemies).not.toContain(a);
        expect(arrives.lives).toBe(LIVES_START - 1);

        const stays = quietWave();
        const b = flyer(stays, 609.5);
        update(stays, 0.1);
        expect(stays.enemies).toContain(b);
        expect(stays.lives).toBe(LIVES_START);
    });

    it('arrives in the frame traveled lands exactly on 616 (609.6 + 6.4), the comparison being >=', () => {
        const s = quietWave();
        const step = 64 * 0.1;
        const e = flyer(s, FLY_LEN - step);
        // Precondition of this test: the float sum is exactly 616.
        expect(e.traveled + step).toBe(FLY_LEN);
        update(s, 0.1);
        expect(s.enemies).not.toContain(e);
        expect(s.lives).toBe(LIVES_START - 1);
    });

    it('gets to G in 616 px, not the 728 px a walker needs', () => {
        // A walker at the same distance flown is still walking.
        const s = quietWave(initialTerrain());
        const f = flyer(s, 610);
        const w = walker(s, 610);
        update(s, 0.1);
        expect(s.enemies).not.toContain(f);
        expect(s.enemies).toContain(w);
        expect(PATH_LEN - w.traveled).toBeGreaterThan(100);
    });

    it('is not killed by a turret in the frame it arrives, and the lives stop at 0', () => {
        const s = quietWave(undefined, place('turret', 5, 10));
        flyer(s, 610, 1);
        update(s, 0.1);
        expect(s.lives).toBe(LIVES_START - 1);
        expect(s.kills).toBe(0);

        const last = quietWave();
        last.lives = 1;
        flyer(last, 610);
        flyer(last, 612);
        update(last, 0.1);
        expect(last.lives).toBe(0);
        expect(last.phase).toBe('gameover');
    });
});

describe('targeting between walkers and flyers (initial terrain: the walked path is 728 px)', () => {
    // A turret at (row 8, col 3), centre (214, 572), off the walked path. All enemies are within its range 112.
    // dt = 0 keeps every `traveled` exactly as set while the shot is still fired.
    const setup = (): GameState => {
        const s = quietWave(initialTerrain(), place('turret', 3, 8));
        // The premise of the numbers below: the walked path is 13 steps = 728 px.
        expect((s.path.length - 1) * CELL).toBe(PATH_LEN);
        return s;
    };

    it('shoots the walker at 620 (108 px left) rather than the flyer at 500 (116 px left)', () => {
        const s = setup();
        const w = walker(s, 620);
        const f = flyer(s, 500);
        update(s, 0);
        expect(w.hp).toBe(98);
        expect(f.hp).toBe(99);
    });

    it('shoots the flyer at 520 (96 px left) rather than the walker at 620 (108 px left)', () => {
        const s = setup();
        const w = walker(s, 620);
        const f = flyer(s, 520);
        update(s, 0);
        expect(f.hp).toBe(98);
        expect(w.hp).toBe(99);
    });

    it('shoots the older enemy when the flyer at 508 and the walker at 620 are both 108 px from G', () => {
        for (const flyerFirst of [true, false]) {
            const s = setup();
            const first = flyerFirst ? flyer(s, 508) : walker(s, 620);
            const second = flyerFirst ? walker(s, 620) : flyer(s, 508);
            update(s, 0);
            expect(first.hp).toBe(98);
            expect(second.hp).toBe(99);
        }
    });

    it('shoots the flyer that has flown further when two flyers are in range', () => {
        const s = setup();
        const near = flyer(s, 450);
        const far = flyer(s, 500);
        update(s, 0);
        expect(far.hp).toBe(98);
        expect(near.hp).toBe(99);
    });

    it('still shoots the walker that went further among walkers only (the old rule)', () => {
        const s = setup();
        const far = walker(s, 600, 99, 'tank');
        const near = walker(s, 560, 99, 'fast');
        update(s, 0);
        expect(far.hp).toBe(98);
        expect(near.hp).toBe(99);
    });

    it('pays the normal reward for a flyer kill and reports its position', () => {
        const s = setup();
        const f = flyer(s, 500, 1);
        update(s, 0);
        expect(s.kills).toBe(1);
        expect(computeScore(s.kills, 0, false)).toBe(SCORE_PER_KILL);
        expect(s.coins).toBe(COINS_START + KILL_REWARD + WAVE_BONUS);
        expect(s.events.killX).toEqual([270]);
        expect(s.events.killY).toEqual([f.y]);
        expect(f.y).toBeCloseTo(624, 9);
    });
});

describe('range and splash boundaries for flyers', () => {
    // Towers on the route column (row 5, col 4): centre (270, 404). A flyer's y is 124 + traveled, so distances are exact.
    // dt = 0 keeps positions as set.
    it('lets a turret shoot a flyer exactly 112 px away but not one 113 px away', () => {
        const hit = quietWave(undefined, place('turret', 4, 5));
        const edge = flyer(hit, 168); // y 292: 112 px above
        update(hit, 0);
        expect(edge.hp).toBe(98);

        const miss = quietWave(undefined, place('turret', 4, 5));
        const far = flyer(miss, 167); // y 291: 113 px
        update(miss, 0);
        expect(far.hp).toBe(99);
    });

    it('lets a splash tower pick a flyer exactly 90 px away but not one 91 px away', () => {
        const hit = quietWave(undefined, place('splash', 4, 5));
        const edge = flyer(hit, 190); // y 314: 90 px
        update(hit, 0);
        expect(edge.hp).toBe(98);

        const miss = quietWave(undefined, place('splash', 4, 5));
        const far = flyer(miss, 189); // y 313: 91 px
        update(miss, 0);
        expect(far.hp).toBe(99);
    });

    it('splashes a flyer exactly 40 px from the impact but not one 41 px away, even outside the tower range', () => {
        const s = quietWave(undefined, place('splash', 4, 5));
        const target = flyer(s, 190); // y 314, in range (90 px); the impact point
        const edge = flyer(s, 150); // y 274: 40 px from the impact, 130 px from the tower
        const beyond = flyer(s, 149); // y 273: 41 px from the impact
        update(s, 0);
        // Only the first flyer is within the tower's range, so it is the impact point.
        expect(target.hp).toBe(98);
        expect(edge.hp).toBe(98);
        expect(beyond.hp).toBe(99);
    });

    it('splashes a walker and a flyer together, whichever one is the target', () => {
        // Splash tower at (row 5, col 5), centre (326, 404), beside the straight walked path of a plain board.
        const walkerTarget = quietWave(undefined, place('splash', 5, 5));
        const w1 = walker(walkerTarget, 220); // (270, 344): 82 px from the tower, closest to G
        const f1 = flyer(walkerTarget, 200); // (270, 324): out of range but 20 px from the impact
        update(walkerTarget, 0);
        expect(w1.hp).toBe(98);
        expect(f1.hp).toBe(98);

        const flyerTarget = quietWave(undefined, place('splash', 5, 5));
        const f2 = flyer(flyerTarget, 230); // (270, 354): 75 px from the tower, closest to G
        const w2 = walker(flyerTarget, 200); // (270, 324): out of range but 30 px from the impact
        update(flyerTarget, 0);
        expect(f2.hp).toBe(98);
        expect(w2.hp).toBe(98);
    });
});

describe('splash damage and the end of a wave with flyers', () => {
    it('hits flyers within the splash radius of the target and spares one farther than 40 px', () => {
        // Splash tower at (row 9, col 3), centre (214, 628); flyers at y = 124 + traveled.
        const s = quietWave(initialTerrain(), place('splash', 3, 9));
        const a = flyer(s, 450); // y 574: 90 px above the impact, outside the radius (within range, but not the target)
        const b = flyer(s, 530); // y 654
        const c = flyer(s, 540); // y 664: the target, closest to G
        update(s, 0);
        expect(c.hp).toBe(98);
        expect(b.hp).toBe(98);
        expect(a.hp).toBe(99);
    });

    it('does not end the wave while a flyer is still in the air, then ends it once it has arrived', () => {
        const s = quietWave();
        const e = flyer(s, 100);
        for (let i = 0; i < 20; i++) update(s, 0.1);
        expect(s.phase).toBe('wave');
        expect(s.enemies).toContain(e);
        e.traveled = 610;
        update(s, 0.1);
        expect(s.enemies).toHaveLength(0);
        expect(s.phase).toBe('build');
    });
});
