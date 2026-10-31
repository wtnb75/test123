import { describe, expect, it } from 'vitest';
import { type CellKind, getCell, setCell, type Terrain } from './board';
import { createGame, type GameState, isSlowed, MSG_BLOCKED, MSG_NO_COINS, selectTool, startWave, tapCell, update } from './world';

// Hand-derived geometry (spec: 盤面, 砲台, 減速塔, 範囲砲). The board starts at x 18 and y 96 with 56 px cells, so
// the centre of cell (col, row) is (46 + 56 col, 124 + 56 row). Without terrain the shortest path is the straight
// column 4 from S (270, 124) to G (270, 740): an enemy `traveled` px along it stands at (270, 124 + traveled).
const PATH_X = 270;
const PATH_Y0 = 124;
const SLOW_CENTRE = { x: 326, y: 404 }; // cell (5, 5)

/** A wave 1 with the given buildings and no automatic spawning, so enemies are placed by hand. */
function waveWith(cells: [number, number, CellKind][] = [], terrain?: Terrain[]): GameState {
    const s = createGame(terrain);
    for (const [col, row, kind] of cells) setCell(s.board, col, row, kind);
    startWave(s);
    s.spawned = 8;
    return s;
}

/** An enemy `traveled` px along the straight path (the position the game would give it). */
function enemyAt(s: GameState, traveled: number, hp = 100) {
    const e = { id: s.nextEnemyId++, hp, maxHp: hp, traveled, x: PATH_X, y: PATH_Y0 + traveled };
    s.enemies.push(e);
    return e;
}

/** Terrain with the given cells changed from plain; index = row × 9 + col. */
function terrainWith(entries: [number, number, Terrain][]): Terrain[] {
    const terrain: Terrain[] = new Array<Terrain>(9 * 12).fill('plain');
    for (const [col, row, kind] of entries) terrain[row * 9 + col] = kind;
    return terrain;
}

describe('slow tower placement and sale (減速塔: 費用 20、売却 10)', () => {
    it('costs 20 coins, and selling it returns floor(20 × 0.5) = 10 coins', () => {
        const s = createGame();
        selectTool(s, 'slow');
        expect(tapCell(s, 0, 0)).toBe('placed');
        expect(s.coins).toBe(40);
        expect(getCell(s.board, 0, 0)).toBe('slow');
        selectTool(s, 'sell');
        expect(tapCell(s, 0, 0)).toBe('sold');
        expect(s.coins).toBe(50);
        expect(getCell(s.board, 0, 0)).toBe('empty');
    });

    it('is placed with exactly 20 coins', () => {
        const s = createGame();
        s.coins = 20;
        selectTool(s, 'slow');
        expect(tapCell(s, 0, 0)).toBe('placed');
        expect(s.coins).toBe(0);
    });

    it('is refused with 19 coins, with the coins message, and the cell stays empty', () => {
        const s = createGame();
        s.coins = 19;
        selectTool(s, 'slow');
        expect(tapCell(s, 0, 0)).toBe('failed');
        expect(s.message).toBe(MSG_NO_COINS);
        expect(getCell(s.board, 0, 0)).toBe('empty');
        expect(s.coins).toBe(19);
    });

    it('is refused when it would cut the route from S to G, with the blocked message and no coins spent', () => {
        // Rocks fill row 5 except column 8, so the gap at (8, 5) is the only way through.
        const rocks = terrainWith([0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c, 5, 'rock'] as [number, number, Terrain]));
        const s = createGame(rocks);
        selectTool(s, 'slow');
        expect(tapCell(s, 8, 5)).toBe('failed');
        expect(s.message).toBe(MSG_BLOCKED);
        expect(getCell(s.board, 8, 5)).toBe('empty');
        expect(s.coins).toBe(60);
    });

    it('can be placed on a swamp cell', () => {
        const s = createGame(terrainWith([[5, 5, 'swamp']]));
        selectTool(s, 'slow');
        expect(tapCell(s, 5, 5)).toBe('placed');
        expect(getCell(s.board, 5, 5)).toBe('slow');
    });
});

describe('slow tower effect (減速塔: 射程内の敵の速さを SLOW_RATE 倍、重ならない)', () => {
    it('includes the boundary of SLOW_RANGE (100 px) and excludes 1 px beyond it', () => {
        const s = waveWith([[5, 5, 'slow']]);
        expect(isSlowed(s, SLOW_CENTRE.x + 100, SLOW_CENTRE.y)).toBe(true);
        expect(isSlowed(s, SLOW_CENTRE.x + 101, SLOW_CENTRE.y)).toBe(false);
        expect(isSlowed(s, SLOW_CENTRE.x, SLOW_CENTRE.y + 100)).toBe(true);
        expect(isSlowed(s, SLOW_CENTRE.x, SLOW_CENTRE.y + 101)).toBe(false);
    });

    it('moves an enemy inside the range at SLOW_RATE (0.5) times ENEMY_SPEED: 3.2 px in a 0.1 s frame', () => {
        const s = waveWith([[5, 5, 'slow']]);
        const e = enemyAt(s, 280); // (270, 404): 56 px from the tower
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(283.2, 9);
    });

    it('moves an enemy outside the range at the full 6.4 px per 0.1 s frame', () => {
        const s = waveWith([[5, 5, 'slow']]);
        const e = enemyAt(s, 0); // (270, 124): 280 px up from the tower
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(6.4, 9);
    });

    it('does not stack: two slow towers in range still give SLOW_RATE once (3.2 px, not 1.6 px)', () => {
        const s = waveWith([[5, 5, 'slow'], [5, 6, 'slow']]);
        const e = enemyAt(s, 280); // in range of both towers
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(283.2, 9);
    });

    it('multiplies with the swamp factor: on a swamp and in range, 0.5 × 0.5 = 0.25 of ENEMY_SPEED', () => {
        const s = waveWith([[5, 5, 'slow']], terrainWith([[4, 5, 'swamp']]));
        // The shortest path must still run straight down column 4 for the positions below to hold.
        expect(s.path[5]).toEqual({ col: 4, row: 5 });
        const e = enemyAt(s, 280); // path cell 5 is the swamp (4, 5); 56 px from the tower
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(281.6, 9);
    });

    it('does not change where the enemy reaches G: a slowed enemy at 613 px is past 616 px after one frame, one at 612.5 px is not', () => {
        const s = waveWith([[5, 10, 'slow']]); // tower centre (326, 684)
        const reaches = enemyAt(s, 613); // (270, 737): 77 px from the tower, in range
        const stays = enemyAt(s, 612.5); // (270, 736.5): 77 px from the tower, in range
        update(s, 0.1);
        expect(reaches.traveled).toBeCloseTo(616.2, 9); // 616 px is the goal for this path
        expect(stays.traveled).toBeCloseTo(615.7, 9);
        // One enemy got past G and cost a life; the other is still short of it.
        expect(s.lives).toBe(9);
        expect(s.enemies).toHaveLength(1);
    });
});

describe('splash tower placement and sale (範囲砲: 費用 40、売却 20)', () => {
    it('costs 40 coins, and selling it returns floor(40 × 0.5) = 20 coins', () => {
        const s = createGame();
        selectTool(s, 'splash');
        expect(tapCell(s, 0, 0)).toBe('placed');
        expect(s.coins).toBe(20);
        selectTool(s, 'sell');
        expect(tapCell(s, 0, 0)).toBe('sold');
        expect(s.coins).toBe(40);
    });

    it('is refused with 39 coins, with the coins message', () => {
        const s = createGame();
        s.coins = 39;
        selectTool(s, 'splash');
        expect(tapCell(s, 0, 0)).toBe('failed');
        expect(s.message).toBe(MSG_NO_COINS);
        expect(getCell(s.board, 0, 0)).toBe('empty');
    });

    it('is placed with exactly 40 coins, and can be placed on a swamp', () => {
        const s = createGame(terrainWith([[5, 5, 'swamp']]));
        s.coins = 40;
        selectTool(s, 'splash');
        expect(tapCell(s, 5, 5)).toBe('placed');
        expect(s.coins).toBe(0);
        expect(getCell(s.board, 5, 5)).toBe('splash');
    });
});

describe('splash tower attack (範囲砲: 着弾点から SPLASH_RADIUS 40 px 以内の敵すべてに SPLASH_DAMAGE 1)', () => {
    it('starts with a full charge of SPLASH_INTERVAL (1.0 s) and is not a plain turret', () => {
        const s = waveWith([[5, 5, 'splash']]);
        expect(s.turrets).toHaveLength(1);
        expect(s.turrets[0].splash).toBe(true);
        expect(s.turrets[0].charge).toBeCloseTo(1.0, 9);
    });

    it('shows its shot for SPLASH_FLASH (0.3 s), longer than a turret line, and fades out to 0', () => {
        const s = waveWith([[5, 5, 'splash']]);
        enemyAt(s, 300, 3);
        update(s, 0);
        expect(s.turrets[0].flash).toBeCloseTo(0.3, 9);
        expect(s.turrets[0].targetX).toBe(PATH_X);
        expect(s.turrets[0].targetY).toBe(424);
        update(s, 0.1);
        expect(s.turrets[0].flash).toBeCloseTo(0.2, 9);
        update(s, 0.1); // dt is capped at DT_MAX (0.1), so step in 0.1 s frames
        update(s, 0.1);
        expect(s.turrets[0].flash).toBe(0);
    });

    it('hits the target and every enemy within 40 px of it, the boundary included, and not one at 41 px', () => {
        const s = waveWith([[5, 5, 'splash']]);
        const target = enemyAt(s, 300, 3); // (270, 424): furthest along, 59.5 px from the tower
        const at40 = enemyAt(s, 260, 3); // (270, 384): 40 px from the target
        const at41 = enemyAt(s, 259, 3); // (270, 383): 41 px from the target
        update(s, 0);
        expect(target.hp).toBe(2);
        expect(at40.hp).toBe(2);
        expect(at41.hp).toBe(3);
    });

    it('hits an enemy inside the impact radius even when it is outside the tower range (90 px)', () => {
        const s = waveWith([[5, 5, 'splash']]);
        const target = enemyAt(s, 216, 3); // (270, 340): 85 px from the tower, so in range
        const outside = enemyAt(s, 176, 3); // (270, 300): 118 px from the tower, but 40 px from the target
        update(s, 0);
        expect(target.hp).toBe(2);
        expect(outside.hp).toBe(2);
    });

    it('pays KILL_REWARD (2 coins) and counts a kill for a target that the splash finishes', () => {
        const s = waveWith([[5, 5, 'splash']]);
        const target = enemyAt(s, 300, 1);
        enemyAt(s, 0, 3); // far back, out of range: keeps the wave going
        update(s, 0);
        expect(target.hp).toBe(0);
        expect(s.kills).toBe(1);
        expect(s.coins).toBe(62);
        expect(s.enemies).toHaveLength(1);
    });

    it('fires on its first frame, then again after 1.0 s: after 1, 9 and 10 frames of 0.1 s the target is at 99, 99 and 98', () => {
        const s = waveWith([[5, 5, 'splash']]);
        const e = enemyAt(s, 280); // 56 px from the tower; 64 px further in 1.0 s, still in range
        update(s, 0.1);
        expect(e.hp).toBe(99);
        for (let frame = 2; frame <= 9; frame++) update(s, 0.1);
        expect(e.hp).toBe(99);
        update(s, 0.1);
        expect(e.hp).toBe(98);
    });

    it('skips an enemy that the turret before it in row-major order has already killed this frame', () => {
        // The turret at (5, 4) comes first in row-major order and kills the furthest enemy, the one at 300 px.
        const s = waveWith([[5, 4, 'turret'], [5, 5, 'splash']]);
        const killed = enemyAt(s, 300, 1); // (270, 424)
        const other = enemyAt(s, 260, 3); // (270, 384): 40 px from the killed enemy, in splash range
        update(s, 0);
        expect(killed.hp).toBe(0);
        expect(other.hp).toBe(2); // hit once, by the splash shot only
        expect(s.kills).toBe(1);
    });

    it('lets a turret after it in row-major order target an enemy the splash has already hit', () => {
        // X is out of the splash tower's range (94 px) but 40 px from Y, the splash's target. The splash (row 4)
        // acts first: it kills X. Reversed, the turret (row 5) would kill X first and the splash would then hit only Y.
        // Here the splash hits X (1 → 0); the turret then finds only Y, which takes a hit, and X is dead already.
        const s = waveWith([[5, 4, 'splash'], [5, 5, 'turret']]);
        const x = enemyAt(s, 300, 1); // (270, 424)
        const y = enemyAt(s, 260, 3); // (270, 384)
        update(s, 0);
        expect(x.hp).toBe(0);
        expect(y.hp).toBe(1);
        expect(s.kills).toBe(1);
        expect(s.coins).toBe(62);
    });

    it('kills two enemies with one splash shot and pays 2 coins for each', () => {
        const s = waveWith([[5, 5, 'splash']]);
        enemyAt(s, 300, 1); // target, (270, 424)
        enemyAt(s, 260, 1); // 40 px from the target
        enemyAt(s, 0, 100); // far back, out of range: keeps the wave going
        update(s, 0);
        expect(s.kills).toBe(2);
        expect(s.coins).toBe(64);
    });

    it('carries the overshoot like a turret: 31 shots in 30.0033 s of frames, starting with a full charge', () => {
        const s = waveWith([[5, 5, 'splash']]);
        const e = enemyAt(s, 280, 1000);
        for (let frame = 0; frame < 1802; frame++) {
            // Put the target back at 280 px before each frame so it stays in range for the whole run.
            e.traveled = 280;
            e.x = PATH_X;
            e.y = PATH_Y0 + 280;
            update(s, frame % 2 === 0 ? 0.0166 : 0.0167);
        }
        // Charge: 1.0 at the start plus 30.0033 s of frames = 31.0033, i.e. 31 shots of 1.0 s.
        expect(1000 - e.hp).toBe(31);
    });

    it('holds at most one shot of charge while idle, so an enemy entering range is hit once at once', () => {
        const s = waveWith([[5, 5, 'splash']]);
        const far = enemyAt(s, 0, 100); // (270, 124): out of range; keeps the wave going
        for (let i = 0; i < 30; i++) update(s, 0.1);
        expect(s.turrets[0].charge).toBeCloseTo(1.0, 9);
        // Enters range now: one shot on this frame (charge 1.1 → 0.1), none on the next (0.2).
        far.traveled = 280;
        far.x = PATH_X;
        far.y = PATH_Y0 + 280;
        update(s, 0.1);
        expect(far.hp).toBe(99);
        update(s, 0.1);
        expect(far.hp).toBe(99);
    });
});

describe('slow tower: the rules that come with the effect (減速塔: 標的、売却、判定の時点)', () => {
    it('does not change which enemy a turret picks: the furthest one in range is hit even when it is slowed', () => {
        // Turret (5, 4) at (326, 348). The far enemy (300 px) is inside the slow range; the near one (170 px) is not.
        const s = waveWith([[5, 4, 'turret'], [5, 5, 'slow']]);
        const far = enemyAt(s, 300, 3); // (270, 424): 59.5 px from the slow tower
        const near = enemyAt(s, 170, 3); // (270, 294): 110 px from the slow tower, 77.8 px from the turret
        update(s, 0.1);
        expect(far.hp).toBe(2);
        expect(near.hp).toBe(3);
    });

    it('stops slowing once the slow tower is sold before the wave', () => {
        const s = createGame();
        selectTool(s, 'slow');
        tapCell(s, 5, 5);
        selectTool(s, 'sell');
        tapCell(s, 5, 5);
        startWave(s);
        expect(isSlowed(s, SLOW_CENTRE.x, SLOW_CENTRE.y)).toBe(false);
    });

    it('marks an enemy that spawns inside the slow range as slowed on its spawn frame', () => {
        // S (270, 124) is 56 px from a slow tower at cell (5, 0), centre (326, 124): inside the range.
        const s = createGame();
        selectTool(s, 'slow');
        tapCell(s, 5, 0);
        startWave(s);
        update(s, 0.1); // the first enemy spawns at S and does not move on its spawn frame
        expect(s.enemies).toHaveLength(1);
        expect(s.enemies[0].traveled).toBe(0);
        expect(s.enemies[0].slowed).toBe(true);
    });

    it('decides the slow from the position at the start of the frame, so a frame that carries an enemy into range does not slow it', () => {
        // (270, 315) is 105 px from the slow tower: outside. After one frame at full speed it is at 197.4 px,
        // (270, 321.4), which is 99.7 px from the tower: inside. The slow uses the start position, so the move is 6.4 px.
        const s = waveWith([[5, 5, 'slow']]);
        const e = enemyAt(s, 191);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(197.4, 9);
        expect(e.slowed).toBe(false);
    });
});

describe('splash tower placement: the route check (範囲砲: 道をふさぐ設置は失敗)', () => {
    it('is refused where it would cut the route from S to G, with the blocked message and no coins spent', () => {
        const rocks = terrainWith([0, 1, 2, 3, 4, 5, 6, 7].map((c) => [c, 5, 'rock'] as [number, number, Terrain]));
        const s = createGame(rocks);
        selectTool(s, 'splash');
        expect(tapCell(s, 8, 5)).toBe('failed');
        expect(s.message).toBe(MSG_BLOCKED);
        expect(getCell(s.board, 8, 5)).toBe('empty');
        expect(s.coins).toBe(60);
    });
});
