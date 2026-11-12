import { describe, expect, it } from 'vitest';
import { indexOf, type Terrain } from './board';
import {
    BOSS_HP_RATE,
    BOSS_LIFE_COST,
    BOSS_RADIUS,
    BOSS_REWARD,
    BOSS_SCORE,
    BOSS_SPEED_RATE,
    BOSS_WAVES,
    CELL,
    COINS_START,
    ENEMY_RADIUS,
    GRID_COLS,
    GRID_ROWS,
    KILL_REWARD,
    LIVES_START,
    WAVE_BONUS,
    WAVE_MAX
} from './config';
import { PopupPool } from './effects';
import { hpBarTop } from './layout';
import {
    computeScore,
    enemyCount,
    type EnemyKind,
    enemyHp,
    enemyKind,
    isBossWave,
    killReward,
    kindRadius,
    kindSpeedRate,
    waveSpawnTotal
} from './wave';
import { createGame, type Enemy, type GameState, messageText, phaseText, selectTool, startWave, tapCell, update } from './world';

/** The kind of every enemy of the wave, regular ones and the boss, by spawn index. */
const kindsOfWave = (wave: number): EnemyKind[] =>
    Array.from({ length: waveSpawnTotal(wave) }, (_, i) => enemyKind(wave, i));

describe('which waves have a boss', () => {
    it('has the boss in waves 5 and 10 only', () => {
        expect(BOSS_WAVES).toEqual([5, 10]);
        // Every boss wave is a real wave, listed once.
        expect(new Set(BOSS_WAVES).size).toBe(BOSS_WAVES.length);
        for (const w of BOSS_WAVES) expect(w >= 1 && w <= WAVE_MAX && Number.isInteger(w)).toBe(true);
        const bossWaves = Array.from({ length: WAVE_MAX }, (_, i) => i + 1).filter(isBossWave);
        expect(bossWaves).toEqual([5, 10]);
    });

    it('adds one spawn to a boss wave and none to the others', () => {
        expect(waveSpawnTotal(5)).toBe(17); // 16 regular + the boss
        expect(waveSpawnTotal(10)).toBe(27); // 26 regular + the boss
        for (const wave of [1, 2, 3, 4, 6, 7, 8, 9]) expect(waveSpawnTotal(wave)).toBe(enemyCount(wave));
    });

    it('makes the spawn after the regular enemies (i = n) the boss: i = 16 in wave 5, i = 26 in wave 10', () => {
        expect(enemyKind(5, 16)).toBe('boss');
        expect(enemyKind(10, 26)).toBe('boss');
        expect(enemyKind(5, 15)).toBe('tank'); // 15 mod 4 = 3
        expect(enemyKind(10, 25)).toBe('normal'); // 25 mod 4 = 1, 25 mod 8 = 1
    });

    it('keeps the kinds of the regular enemies as in the kind tables and puts exactly one boss last', () => {
        for (const wave of [5, 10]) {
            const kinds = kindsOfWave(wave);
            expect(kinds.filter((k) => k === 'boss')).toHaveLength(1);
            expect(kinds[kinds.length - 1]).toBe('boss');
            const count = (kind: EnemyKind) => kinds.filter((k) => k === kind).length;
            // [敵の種類] / [飛行する敵]: wave 5 = 6 normal, 4 fast, 4 tank, 2 flyer; wave 10 = 11, 6, 6, 3.
            const expected = wave === 5 ? [6, 4, 4, 2] : [11, 6, 6, 3];
            expect([count('normal'), count('fast'), count('tank'), count('flyer')]).toEqual(expected);
        }
    });

    it.each([1, 2, 3, 4, 6, 7, 8, 9])('has no boss in wave %i, even past the regular enemies', (wave) => {
        expect(kindsOfWave(wave)).not.toContain('boss');
        expect(enemyKind(wave, enemyCount(wave))).not.toBe('boss');
    });
});

describe('boss values', () => {
    it('has 66 HP in wave 5 and 126 HP in wave 10 (base HP x BOSS_HP_RATE)', () => {
        expect(BOSS_HP_RATE).toBe(6);
        expect(enemyHp(5, 'boss')).toBe(66);
        expect(enemyHp(10, 'boss')).toBe(126);
    });

    it('walks at half speed, is drawn with radius 24 and pays 20 coins', () => {
        expect(kindSpeedRate('boss')).toBe(BOSS_SPEED_RATE);
        expect(BOSS_SPEED_RATE).toBe(0.5);
        expect(kindRadius('boss')).toBe(BOSS_RADIUS);
        expect(BOSS_RADIUS).toBe(24);
        expect(killReward('boss')).toBe(BOSS_REWARD);
        expect(BOSS_REWARD).toBe(20);
        expect(BOSS_LIFE_COST).toBe(3);
    });

    it('leaves the other kinds\' rewards at KILL_REWARD', () => {
        for (const kind of ['normal', 'fast', 'tank', 'flyer'] as const) expect(killReward(kind)).toBe(KILL_REWARD);
        expect(killReward()).toBe(KILL_REWARD);
        expect(kindRadius('normal')).toBe(ENEMY_RADIUS);
    });

    it('raises the total HP of wave 5 from 200 to 266 and of wave 10 from 612 to 738, and leaves other waves alone', () => {
        const total = (wave: number, withBoss: boolean) =>
            kindsOfWave(wave)
                .filter((k) => withBoss || k !== 'boss')
                .reduce((sum, k) => sum + enemyHp(wave, k), 0);
        expect(total(5, false)).toBe(200);
        expect(total(5, true)).toBe(266);
        expect(total(10, false)).toBe(612);
        expect(total(10, true)).toBe(738);
        expect(total(6, true)).toBe(total(6, false));
    });
});

describe('score with the boss', () => {
    it('scores the boss kill as 50 instead of 10: 29 regular kills + 1 boss + 7 lives on a clear = 690', () => {
        expect(BOSS_SCORE).toBe(50);
        expect(computeScore(30, 7, true, 1)).toBe(29 * 10 + 50 + 7 * 50);
        expect(computeScore(30, 7, true, 1)).toBe(690);
    });

    it('does not add the remaining lives on a game over, and counts bosses there too', () => {
        expect(computeScore(20, 0, false, 0)).toBe(200);
        expect(computeScore(21, 0, false, 1)).toBe(20 * 10 + 50);
        expect(computeScore(21, 5, false, 1)).toBe(250);
    });

    it('is the old formula when no boss was killed', () => {
        expect(computeScore(12, 4, true)).toBe(12 * 10 + 4 * 50);
        expect(computeScore(12, 4, true, 0)).toBe(320);
    });
});

describe('the build message in boss waves', () => {
    const withWall = (wave: number): GameState => {
        const s = createGame();
        s.wave = wave;
        s.board.cells[indexOf(s.board, 0, 5)] = 'wall';
        return s;
    };

    it.each([5, 10])('says the boss is coming in wave %i when the board has a building', (wave) => {
        expect(phaseText(withWall(wave))).toBe(`ウェーブ ${wave} の準備（ボスが来る・開始を押す）`);
    });

    it.each([1, 4, 6, 9])('keeps the plain message in wave %i', (wave) => {
        expect(phaseText(withWall(wave))).toBe(`ウェーブ ${wave} の準備（開始を押す）`);
    });

    it('keeps the empty-board hint in a boss wave and puts a failure message before the boss text', () => {
        const empty = createGame();
        empty.wave = 5;
        expect(phaseText(empty)).toBe('マスをタップして建物を置こう（置いたら開始）');
        const s = withWall(5);
        s.coins = 0;
        selectTool(s, 'turret');
        expect(tapCell(s, 1, 5)).toBe('failed');
        expect(messageText(s)).toBe('コインが足りません');
        selectTool(s, 'wall');
        expect(messageText(s)).toBe('ウェーブ 5 の準備（ボスが来る・開始を押す）');
    });

    it('shows the wave number only while the wave runs, as before', () => {
        const s = withWall(5);
        startWave(s);
        expect(phaseText(s)).toBe('ウェーブ 5');
    });
});

describe('spawning the boss', () => {
    function runSpawn(wave: number, frames: number): { s: GameState; spawnedAfter: number[] } {
        const s = createGame();
        s.wave = wave;
        s.lives = 1e9; // leaks must not end the run
        startWave(s);
        const spawnedAfter: number[] = [];
        for (let f = 0; f < frames; f++) {
            update(s, 0.1);
            spawnedAfter.push(s.spawned);
        }
        return { s, spawnedAfter };
    }

    it('spawns the boss 12.8 s into wave 5, one SPAWN_INTERVAL after the 16th regular enemy (frame 128, not 127)', () => {
        const { s, spawnedAfter } = runSpawn(5, 128);
        expect(spawnedAfter[126]).toBe(16); // after frame 127 (clock 12.7) only the regular enemies are out
        expect(spawnedAfter[127]).toBe(17); // frame 128 (clock 12.8)
        const boss = s.enemies[s.enemies.length - 1];
        expect(boss.kind).toBe('boss');
        expect(boss.hp).toBe(66);
        expect(boss.maxHp).toBe(66);
        expect(boss.traveled).toBe(0); // it does not move in the frame it spawns
        expect(boss.x).toBe(s.pathX[0]);
        expect(boss.y).toBe(s.pathY[0]);
    });

    it('spawns the boss 20.8 s into wave 10 with 126 HP and nothing after it', () => {
        const { s, spawnedAfter } = runSpawn(10, 220);
        expect(spawnedAfter[206]).toBe(26); // clock 20.7
        expect(spawnedAfter[207]).toBe(27); // clock 20.8
        expect(spawnedAfter[219]).toBe(27); // nobody after the boss
        const boss = s.enemies.find((e) => e.kind === 'boss');
        expect(boss?.maxHp).toBe(126);
        expect(s.enemies.filter((e) => e.kind === 'boss')).toHaveLength(1);
    });

    it('spawns no boss in wave 6 and nothing after the 18th enemy', () => {
        const { s, spawnedAfter } = runSpawn(6, 200);
        expect(spawnedAfter[spawnedAfter.length - 1]).toBe(18);
        expect(s.enemies.some((e) => e.kind === 'boss')).toBe(false);
    });
});

// A swamp at (row 3, col 4) on the straight path: cell 3, traveled 140 to <196.
function swampTerrain(): Terrain[] {
    const t = new Array<Terrain>(GRID_COLS * GRID_ROWS).fill('plain');
    t[3 * GRID_COLS + 4] = 'swamp';
    return t;
}

/** A started wave with nothing left to spawn, so only the test's own enemies exist. */
function quietWave(wave = 1, terrain?: Terrain[], build?: (s: GameState) => void): GameState {
    const s = createGame(terrain);
    s.wave = wave;
    build?.(s);
    startWave(s);
    s.spawned = waveSpawnTotal(wave);
    return s;
}

/** An enemy standing on the straight path (col 4) at `traveled`. */
function put(s: GameState, kind: EnemyKind, traveled: number, hp = 99): Enemy {
    const e: Enemy = { id: s.nextEnemyId++, hp, maxHp: hp, kind, traveled, x: 270, y: 124 + traveled };
    s.enemies.push(e);
    return e;
}

const moved = (s: GameState, e: Enemy): number => {
    const before = e.traveled;
    update(s, 0.1);
    return e.traveled - before;
};

const slowTower = (s: GameState): void => {
    s.board.cells[indexOf(s.board, 5, 3)] = 'slow';
};

describe('how the boss moves (dt 0.1)', () => {
    it('walks 3.2 px per frame on plain ground', () => {
        const s = quietWave(5);
        expect(moved(s, put(s, 'boss', 100))).toBeCloseTo(3.2, 10);
    });

    it('walks 1.6 px in a swamp: 139.9 -> 143.1 (plain frame), then 1.6 more (swamp frame)', () => {
        const s = quietWave(5, swampTerrain());
        const e = put(s, 'boss', 139.9);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(143.1, 10);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(144.7, 10);
    });

    it('walks 1.6 px inside a slow tower range and 0.8 px in a swamp inside it; two towers still halve once', () => {
        const slowed = quietWave(5, swampTerrain(), slowTower);
        expect(moved(slowed, put(slowed, 'boss', 224))).toBeCloseTo(1.6, 10); // plain cell, 79 px from the tower
        const both = quietWave(5, swampTerrain(), slowTower);
        expect(moved(both, put(both, 'boss', 168))).toBeCloseTo(0.8, 10); // swamp and tower
        const twice = quietWave(5, swampTerrain(), (g) => {
            slowTower(g);
            g.board.cells[indexOf(g.board, 5, 4)] = 'slow';
        });
        expect(moved(twice, put(twice, 'boss', 224))).toBeCloseTo(1.6, 10);
    });

    it('takes 193 frames to cover the 616 px of the plain straight path (616 / 3.2 = 192.5)', () => {
        const s = quietWave(5);
        put(s, 'boss', 0);
        let frames = 0;
        while (s.lives === LIVES_START && frames < 1000) {
            update(s, 0.1);
            frames++;
        }
        // It arrives on the 193rd frame after the spawn frame (which does not move it).
        expect(frames).toBe(193);
    });
});

describe('the boss reaching G', () => {
    // The plain straight path has 11 steps: G at traveled 616.
    it('arrives when traveled reaches 616: 612.7 + 3.2 stays (615.9), 613 + 3.2 arrives (616.2)', () => {
        const stays = quietWave(5);
        const a = put(stays, 'boss', 612.7);
        update(stays, 0.1);
        expect(stays.enemies).toContain(a);
        expect(stays.lives).toBe(LIVES_START);

        const arrives = quietWave(5);
        const b = put(arrives, 'boss', 613);
        update(arrives, 0.1);
        expect(arrives.enemies).not.toContain(b);
    });

    it('costs 3 lives, with no coins, no kill, no boss kill, and one leak event', () => {
        const s = quietWave(5, undefined, (g) => {
            g.coins = 50;
        });
        put(s, 'boss', 613);
        put(s, 'normal', 0); // keeps the wave going so the wave bonus doesn't muddy the coins
        update(s, 0.1);
        expect(s.lives).toBe(LIVES_START - 3);
        expect(s.coins).toBe(50);
        expect(s.kills).toBe(0);
        expect(s.bossKills).toBe(0);
        expect(s.events.leaks).toBe(1);
        expect(s.events.killX).toHaveLength(0);
    });

    it.each([
        [3, 0],
        [2, 0],
        [1, 0],
        [4, 1]
    ])('goes from %i lives to %i (never below 0)', (before, after) => {
        const s = quietWave(5, undefined, (g) => {
            g.lives = before;
        });
        put(s, 'boss', 613);
        put(s, 'normal', 0);
        update(s, 0.1);
        expect(s.lives).toBe(after);
    });

    it('costs 3 + 1 when the boss and a regular enemy arrive in the same frame (lives 10 -> 6)', () => {
        const s = quietWave(5);
        put(s, 'boss', 613);
        put(s, 'normal', 612);
        update(s, 0.1);
        expect(s.lives).toBe(LIVES_START - 4);
        expect(s.events.leaks).toBe(2);
    });

    it('stops at 0 when the boss and a regular enemy arrive together, with 4 lives or with 2', () => {
        for (const lives of [4, 2]) {
            const s = quietWave(5, undefined, (g) => {
                g.lives = lives;
            });
            put(s, 'boss', 613);
            put(s, 'fast', 610);
            update(s, 0.1);
            expect(s.lives).toBe(0);
            expect(s.phase).toBe('gameover');
        }
    });

    it('ends the game when the boss takes the last lives, before the wave end is looked at', () => {
        const s = quietWave(10, undefined, (g) => {
            g.lives = 3;
        });
        put(s, 'boss', 613);
        expect(update(s, 0.1)).toBe('gameover'); // the wave would also end (nobody left); game over wins
        expect(s.lives).toBe(0);
    });

    it('clears the last wave when the boss leaks and lives are left', () => {
        const s = quietWave(10, undefined, (g) => {
            g.lives = 4;
        });
        put(s, 'boss', 613);
        expect(update(s, 0.1)).toBe('cleared');
        expect(s.lives).toBe(1);
        expect(s.bossKills).toBe(0);
    });
});

describe('killing the boss', () => {
    // A turret at (row 2, col 5): centre (326, 236), range 112. A normal enemy at traveled 0 is 125 px away: out of range.
    const withTurret = (s: GameState): void => {
        s.board.cells[indexOf(s.board, 5, 2)] = 'turret';
    };

    it('pays 20 coins (not 22), counts one kill and one boss kill, and reports the reward of 20', () => {
        const s = quietWave(5, undefined, withTurret);
        const boss = put(s, 'boss', 100, 1);
        put(s, 'normal', 0);
        const coins = s.coins;
        update(s, 0.1);
        expect(s.enemies).not.toContain(boss);
        expect(s.kills).toBe(1);
        expect(s.bossKills).toBe(1);
        expect(s.coins).toBe(coins + BOSS_REWARD);
        expect(s.events.killReward).toEqual([20]);
        expect(s.events.killX).toHaveLength(1);
        expect(s.events.killY).toHaveLength(1);
    });

    it('pays a regular kill 2 and does not count it as a boss kill', () => {
        const s = quietWave(5, undefined, withTurret);
        put(s, 'normal', 100, 1);
        put(s, 'normal', 0);
        const coins = s.coins;
        update(s, 0.1);
        expect(s.kills).toBe(1);
        expect(s.bossKills).toBe(0);
        expect(s.coins).toBe(coins + KILL_REWARD);
        expect(s.events.killReward).toEqual([2]);
    });

    it('damages and kills the boss in a splash together with a regular enemy: +20 and +2, 2 kills, 1 boss kill', () => {
        const s = quietWave(5, undefined, (g) => {
            g.board.cells[indexOf(g.board, 5, 2)] = 'splash';
        });
        put(s, 'boss', 100, 1);
        put(s, 'normal', 100, 1);
        put(s, 'normal', 0); // out of range and radius: keeps the wave going
        const coins = s.coins;
        update(s, 0.1);
        expect(s.kills).toBe(2);
        expect(s.bossKills).toBe(1);
        expect(s.coins).toBe(coins + BOSS_REWARD + KILL_REWARD);
        expect([...s.events.killReward].sort((a, b) => a - b)).toEqual([2, 20]);
    });

    it('lowers the boss HP by the turret damage per shot and keeps it alive above 0', () => {
        const s = quietWave(5, undefined, withTurret);
        const boss = put(s, 'boss', 100, 66);
        update(s, 0.1);
        expect(boss.hp).toBe(65);
        expect(s.kills).toBe(0);
    });

    it('shoots the regular enemy that is further along rather than the boss, and the boss when it is alone', () => {
        const s = quietWave(5, undefined, withTurret);
        const boss = put(s, 'boss', 100);
        const normal = put(s, 'normal', 150);
        update(s, 0.1);
        expect(normal.hp).toBe(98);
        expect(boss.hp).toBe(99);

        const alone = quietWave(5, undefined, withTurret);
        const only = put(alone, 'boss', 100);
        update(alone, 0.1);
        expect(only.hp).toBe(98);
    });

    it('does not let a turret kill the boss in the frame it reaches G', () => {
        const s = quietWave(5, undefined, (g) => {
            g.board.cells[indexOf(g.board, 5, 10)] = 'turret';
        });
        put(s, 'boss', 613, 1);
        update(s, 0.1);
        expect(s.kills).toBe(0);
        expect(s.bossKills).toBe(0);
        expect(s.lives).toBe(LIVES_START - 3);
    });

    it('has no boss kill and no leftover events in a wave without a boss, and clears the events next frame', () => {
        const s = quietWave(3, undefined, withTurret);
        put(s, 'normal', 100, 1);
        put(s, 'normal', 0);
        update(s, 0.1);
        expect(s.bossKills).toBe(0);
        expect(s.events.killReward).toEqual([2]);
        update(s, 0.1);
        expect(s.events.killReward).toEqual([]);
        expect(s.events.killX).toEqual([]);
    });
});

describe('the wave end with a boss', () => {
    it('does not end wave 5 before the boss has spawned, even with no enemy on the board', () => {
        const s = createGame();
        s.wave = 5;
        startWave(s);
        s.spawned = enemyCount(5); // 16 regular enemies out, none alive, the boss still to come
        expect(update(s, 0)).toBe('wave');
        expect(s.wave).toBe(5);
    });

    it('does not end the wave while the boss is alive, and ends it with the bonus when the boss dies', () => {
        const s = quietWave(5, undefined, (g) => {
            g.board.cells[indexOf(g.board, 5, 2)] = 'turret';
        });
        const boss = put(s, 'boss', 100, 2);
        const coins = s.coins;
        expect(update(s, 0.1)).toBe('wave');
        expect(boss.hp).toBe(1);
        // The turret fires every 0.5 s: the second shot comes on the 5th frame and kills the boss.
        let phase = update(s, 0.1);
        for (let f = 0; f < 10 && phase === 'wave'; f++) phase = update(s, 0.1);
        expect(phase).toBe('build');
        expect(boss.hp).toBe(0);
        expect(s.wave).toBe(6);
        expect(s.coins).toBe(coins + BOSS_REWARD + WAVE_BONUS);
    });

    it('clears wave 10 only after the boss is gone', () => {
        const s = quietWave(10);
        const boss = put(s, 'boss', 100);
        expect(update(s, 0.1)).toBe('wave');
        s.enemies.splice(s.enemies.indexOf(boss), 1);
        expect(update(s, 0.1)).toBe('cleared');
    });

    it('does not carry boss kills into a new game', () => {
        expect(createGame().bossKills).toBe(0);
    });
});

describe('the HP bar position', () => {
    it('sits 8 px above the body, and is held 2 px inside the board top for a boss on S (124 - 24 - 8 = 92 would be hidden)', () => {
        expect(hpBarTop(300, 24)).toBe(268);
        expect(hpBarTop(124, 14)).toBe(102); // a regular enemy on S is unchanged
        expect(hpBarTop(124, 24)).toBe(98); // BOARD_TOP 96 + 2
        expect(hpBarTop(128, 24)).toBe(98); // 128 - 32 = 96 -> still held at 98
        expect(hpBarTop(130, 24)).toBe(98); // 130 - 32 = 98: exactly the margin
        expect(hpBarTop(131, 24)).toBe(99);
    });
});

describe('the "+N" popup carries the reward', () => {
    it('stores the reward given at spawn and replaces it when the oldest entry is reused', () => {
        const pool = new PopupPool(2, 0.6);
        const a = pool.spawn(10, 20, 20);
        expect(a.reward).toBe(20);
        pool.tick(0.1);
        const b = pool.spawn(30, 40, 2);
        expect(b.reward).toBe(2);
        pool.tick(0.1);
        const c = pool.spawn(50, 60, 7); // pool full: reuses the oldest (a)
        expect(c).toBe(a);
        expect(a.reward).toBe(7);
        expect(b.reward).toBe(2);
    });

    it('defaults to a reward of 0 when none is given', () => {
        expect(new PopupPool(1, 0.6).spawn(0, 0).reward).toBe(0);
    });
});

describe('the regular enemies are unchanged by the boss', () => {
    it('moves and shoots like before in a boss wave: a normal enemy walks 6.4 px per frame', () => {
        const s = quietWave(5);
        expect(moved(s, put(s, 'normal', 100))).toBeCloseTo(6.4, 10);
    });

    it('starts the game with the lives and coins of before', () => {
        const s = createGame();
        expect(s.lives).toBe(LIVES_START);
        expect(s.coins).toBe(COINS_START);
        expect(CELL).toBe(56);
    });
});

describe('more boss targeting, range and event details', () => {
    const withTurret = (s: GameState): void => {
        s.board.cells[indexOf(s.board, 5, 2)] = 'turret';
    };

    it('hits the older enemy when the boss is exactly level with it, and the boss when it is the older one', () => {
        // After one frame: boss 100 + 3.2 = 103.2; a normal enemy 96.8 + 6.4 = 103.2 -> level.
        const older = quietWave(5, undefined, withTurret);
        const normal = put(older, 'normal', 96.8);
        const boss = put(older, 'boss', 100);
        update(older, 0.1);
        // Exactly level (the targeting compares with a strict >); if a constant changes and this fails, re-derive the start values.
        expect(normal.traveled).toBe(boss.traveled);
        expect(normal.hp).toBe(98);
        expect(boss.hp).toBe(99);

        const bossFirst = quietWave(5, undefined, withTurret);
        const firstBoss = put(bossFirst, 'boss', 100);
        const laterNormal = put(bossFirst, 'normal', 96.8);
        update(bossFirst, 0.1);
        expect(firstBoss.traveled).toBe(laterNormal.traveled);
        expect(firstBoss.hp).toBe(98);
        expect(laterNormal.hp).toBe(99);
    });

    // A slow tower at (row 3, col 5): centre (326, 292). The boss is placed to the left of it on its row.
    it('slows the boss exactly 100 px from a slow tower (1.6 px) and not 100.5 px away (3.2 px)', () => {
        const inside = quietWave(5, undefined, slowTower);
        const a = put(inside, 'boss', 168);
        a.x = 226;
        a.y = 292;
        expect(moved(inside, a)).toBeCloseTo(1.6, 10);

        const outside = quietWave(5, undefined, slowTower);
        const b = put(outside, 'boss', 168);
        b.x = 225.5;
        b.y = 292;
        expect(moved(outside, b)).toBeCloseTo(3.2, 10);
    });

    it('reports where the boss died, and no leak event on the frame after a leak', () => {
        const s = quietWave(5, undefined, withTurret);
        put(s, 'boss', 100, 1);
        put(s, 'normal', 0);
        update(s, 0.1);
        // The boss moved to traveled 103.2 before it was shot: (270, 124 + 103.2).
        expect(s.events.killX[0]).toBeCloseTo(270, 10);
        expect(s.events.killY[0]).toBeCloseTo(227.2, 10);

        const leak = quietWave(5);
        put(leak, 'boss', 613);
        put(leak, 'normal', 0);
        update(leak, 0.1);
        expect(leak.events.leaks).toBe(1);
        update(leak, 0.1);
        expect(leak.events.leaks).toBe(0);
    });

    it('clears wave 10 by killing the boss: +20 coins, no wave bonus, one boss kill', () => {
        const s = quietWave(10, undefined, withTurret);
        put(s, 'boss', 100, 1);
        const coins = s.coins;
        expect(update(s, 0.1)).toBe('cleared');
        expect(s.bossKills).toBe(1);
        expect(s.kills).toBe(1);
        expect(s.coins).toBe(coins + BOSS_REWARD);
    });

    it('damages the boss without killing it in a splash: 66 -> 65', () => {
        const s = quietWave(5, undefined, (g) => {
            g.board.cells[indexOf(g.board, 5, 2)] = 'splash';
        });
        const boss = put(s, 'boss', 100, 66);
        update(s, 0.1);
        expect(boss.hp).toBe(65);
        expect(s.bossKills).toBe(0);
    });
});
