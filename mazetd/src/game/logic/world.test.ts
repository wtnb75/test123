import { describe, expect, it } from 'vitest';
import { getCell, hasPath, setCell } from './board';
import {
    createGame,
    type GameState,
    messageText,
    MSG_BLOCKED,
    MSG_NO_COINS,
    MSG_START_GOAL,
    phaseText,
    selectTool,
    startWave,
    tapCell,
    update
} from './world';

// Hand-derived geometry: board left 18, top 96, 56px cells; S centre (270,124); straight path 11 cells = 616px.
const S_X = 270;
const S_Y = 124;
const STRAIGHT_PATH_PX = 616;

function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Starts a wave with the given turrets and no automatic spawning, so enemies can be placed by hand. */
function manualWave(turrets: [number, number][] = [], wave = 1): GameState {
    const s = createGame();
    s.wave = wave;
    for (const [c, r] of turrets) setCell(s.board, c, r, 'turret');
    startWave(s);
    s.spawned = 8 + 2 * (wave - 1);
    return s;
}

function addEnemy(s: GameState, traveled: number, hp = 3) {
    const e = { id: s.nextEnemyId++, hp, maxHp: 3, traveled, x: 0, y: 0 };
    s.enemies.push(e);
    return e;
}

function advance(s: GameState, seconds: number, step = 0.1) {
    let left = seconds;
    while (left > 1e-12 && s.phase === 'wave') {
        const dt = Math.min(step, left);
        update(s, dt);
        left -= dt;
    }
}

describe('initial state', () => {
    it('starts in build phase at wave 1 with 10 lives, 60 coins, the wall tool and an empty board', () => {
        const s = createGame();
        expect(s.phase).toBe('build');
        expect(s.wave).toBe(1);
        expect(s.lives).toBe(10);
        expect(s.coins).toBe(60);
        expect(s.tool).toBe('wall');
        expect(s.board.cells.every((c) => c === 'empty')).toBe(true);
        expect(s.path).toHaveLength(12);
    });

    it('shows the build prompt as the message', () => {
        const s = createGame();
        expect(messageText(s)).toBe('ウェーブ 1 の準備（開始を押す）');
    });
});

describe('placing', () => {
    it('placing a wall costs 5 coins and a turret 25', () => {
        const s = createGame();
        expect(tapCell(s, 0, 3)).toBe('placed');
        expect(s.coins).toBe(55);
        selectTool(s, 'turret');
        expect(tapCell(s, 1, 3)).toBe('placed');
        expect(s.coins).toBe(30);
        expect(getCell(s.board, 0, 3)).toBe('wall');
        expect(getCell(s.board, 1, 3)).toBe('turret');
    });

    it('updates the path preview when a wall forces a detour', () => {
        const s = createGame();
        tapCell(s, 4, 5);
        expect(s.path).toHaveLength(14);
        expect(s.pathX).toHaveLength(14);
    });

    it.each([
        ['S', 4, 0],
        ['G', 4, 11]
    ])('refuses to build on %s with the S/G message', (_label, col, row) => {
        const s = createGame();
        expect(tapCell(s, col, row)).toBe('failed');
        expect(s.message).toBe(MSG_START_GOAL);
        expect(s.coins).toBe(60);
        expect(getCell(s.board, col, row)).toBe('empty');
    });

    it('does nothing and keeps the current message when tapping an occupied cell', () => {
        const s = createGame();
        tapCell(s, 0, 0);
        s.message = MSG_NO_COINS;
        expect(tapCell(s, 0, 0)).toBe('ignored');
        expect(s.coins).toBe(55);
        expect(s.message).toBe(MSG_NO_COINS);
    });

    it('succeeds when coins exactly equal the cost', () => {
        const s = createGame();
        s.coins = 5;
        expect(tapCell(s, 0, 0)).toBe('placed');
        expect(s.coins).toBe(0);
    });

    it('fails with the no-coins message when one coin short', () => {
        const s = createGame();
        s.coins = 4;
        expect(tapCell(s, 0, 0)).toBe('failed');
        expect(s.message).toBe(MSG_NO_COINS);
        expect(s.coins).toBe(4);
        expect(getCell(s.board, 0, 0)).toBe('empty');
    });

    it('refuses a placement that would cut S off from G, leaving board and coins unchanged', () => {
        const s = createGame();
        s.coins = 100;
        for (let col = 0; col < 8; col++) tapCell(s, col, 5);
        expect(s.coins).toBe(60);
        const before = [...s.board.cells];
        expect(tapCell(s, 8, 5)).toBe('failed');
        expect(s.message).toBe(MSG_BLOCKED);
        expect(s.coins).toBe(60);
        expect(s.board.cells).toEqual(before);
        expect(hasPath(s.board)).toBe(true);
    });

    it('reports missing coins before a blocked path when both apply', () => {
        const s = createGame();
        s.coins = 40;
        for (let col = 0; col < 8; col++) tapCell(s, col, 5);
        expect(s.coins).toBe(0);
        expect(tapCell(s, 8, 5)).toBe('failed');
        expect(s.message).toBe(MSG_NO_COINS);
    });

    it('clears a failure message on a successful placement', () => {
        const s = createGame();
        tapCell(s, 4, 0);
        expect(messageText(s)).toBe(MSG_START_GOAL);
        tapCell(s, 0, 0);
        expect(s.message).toBeNull();
        expect(messageText(s)).toBe(phaseText(s));
    });
});

describe('selling', () => {
    it('refunds floor(5*0.5)=2 for a wall and floor(25*0.5)=12 for a turret', () => {
        const s = createGame();
        tapCell(s, 0, 0);
        selectTool(s, 'turret');
        tapCell(s, 1, 0);
        expect(s.coins).toBe(30);
        selectTool(s, 'sell');
        expect(tapCell(s, 0, 0)).toBe('sold');
        expect(s.coins).toBe(32);
        expect(tapCell(s, 1, 0)).toBe('sold');
        expect(s.coins).toBe(44);
        expect(getCell(s.board, 0, 0)).toBe('empty');
        expect(getCell(s.board, 1, 0)).toBe('empty');
    });

    it('restores the straight path after selling the detour wall', () => {
        const s = createGame();
        tapCell(s, 4, 5);
        selectTool(s, 'sell');
        tapCell(s, 4, 5);
        expect(s.path).toHaveLength(12);
    });

    it.each([
        ['an empty cell', 0, 0],
        ['S', 4, 0],
        ['G', 4, 11]
    ])('does nothing and keeps the message when selling %s', (_label, col, row) => {
        const s = createGame();
        selectTool(s, 'sell');
        s.message = MSG_BLOCKED;
        expect(tapCell(s, col, row)).toBe('ignored');
        expect(s.coins).toBe(60);
        expect(s.message).toBe(MSG_BLOCKED);
    });

    it('clears a failure message on a successful sale', () => {
        const s = createGame();
        tapCell(s, 0, 0);
        selectTool(s, 'sell');
        s.message = MSG_BLOCKED;
        tapCell(s, 0, 0);
        expect(s.message).toBeNull();
    });
});

describe('tool selection', () => {
    it('switches the tool and clears a failure message', () => {
        const s = createGame();
        s.message = MSG_NO_COINS;
        selectTool(s, 'turret');
        expect(s.tool).toBe('turret');
        expect(s.message).toBeNull();
    });

    it('is allowed during a wave', () => {
        const s = createGame();
        startWave(s);
        selectTool(s, 'sell');
        expect(s.tool).toBe('sell');
    });
});

describe('random build sessions (reachable states only)', () => {
    it('never leaves the board blocked and keeps coin accounting exact', () => {
        const rand = mulberry32(2024);
        const cost = { wall: 5, turret: 25 } as const;
        let placed = 0;
        let sold = 0;
        let blocked = 0;
        let broke = 0;
        for (let game = 0; game < 200; game++) {
            const s = createGame();
            s.coins = 200 + Math.floor(rand() * 400);
            for (let n = 0; n < 150; n++) {
                const r = rand();
                selectTool(s, r < 0.6 ? 'wall' : r < 0.8 ? 'turret' : 'sell');
                const col = Math.floor(rand() * 9);
                const row = Math.floor(rand() * 12);
                const beforeKind = getCell(s.board, col, row);
                const beforeCoins = s.coins;
                const beforeCells = [...s.board.cells];
                const result = tapCell(s, col, row);
                if (result === 'placed') {
                    placed++;
                    const tool = s.tool as 'wall' | 'turret';
                    if (s.coins !== beforeCoins - cost[tool]) expect.fail(`wrong placement charge in game ${game}`);
                } else if (result === 'sold') {
                    sold++;
                    const refund = beforeKind === 'wall' ? 2 : 12;
                    if (s.coins !== beforeCoins + refund) expect.fail(`wrong refund in game ${game}`);
                } else {
                    if (result === 'failed' && s.message === MSG_BLOCKED) blocked++;
                    if (result === 'failed' && s.message === MSG_NO_COINS) broke++;
                    if (s.coins !== beforeCoins) expect.fail(`coins changed on ${result}`);
                    if (s.board.cells.some((c, i) => c !== beforeCells[i])) expect.fail(`board changed on ${result}`);
                }
                if (!hasPath(s.board)) expect.fail(`board blocked in game ${game} after ${n} taps`);
                if (s.coins < 0) expect.fail('negative coins');
            }
        }
        expect(placed).toBeGreaterThan(100);
        expect(sold).toBeGreaterThan(100);
        expect(blocked).toBeGreaterThan(10);
        expect(broke).toBeGreaterThan(10);
    });
});

describe('starting a wave', () => {
    it('switches to wave, clears the message and spawns nothing until the next update', () => {
        const s = createGame();
        s.message = MSG_NO_COINS;
        expect(startWave(s)).toBe(true);
        expect(s.phase).toBe('wave');
        expect(s.message).toBeNull();
        expect(messageText(s)).toBe('ウェーブ 1');
        expect(s.enemies).toHaveLength(0);
    });

    it.each([
        ['wave', 'wall'],
        ['wave', 'turret'],
        ['wave', 'sell'],
        ['cleared', 'wall'],
        ['cleared', 'turret'],
        ['cleared', 'sell'],
        ['gameover', 'wall'],
        ['gameover', 'turret'],
        ['gameover', 'sell']
    ] as const)('ignores board taps and start in the %s phase with the %s tool', (phase, tool) => {
        const s = createGame();
        tapCell(s, 0, 0); // a wall to try selling
        s.phase = phase;
        selectTool(s, tool);
        const cells = [...s.board.cells];
        const coins = s.coins;
        expect(tapCell(s, 0, 0)).toBe('ignored');
        expect(tapCell(s, 1, 0)).toBe('ignored');
        expect(startWave(s)).toBe(false);
        expect(s.board.cells).toEqual(cells);
        expect(s.coins).toBe(coins);
        expect(s.phase).toBe(phase);
    });

    it('fixes the current shortest path at the start of the wave', () => {
        const s = createGame();
        tapCell(s, 4, 5);
        startWave(s);
        expect(s.path).toHaveLength(14);
        expect(s.pathX[0]).toBe(S_X);
        expect(s.pathY[0]).toBe(S_Y);
        tapCell(s, 0, 0);
        expect(s.path).toHaveLength(14);
        expect(s.pathY[13]).toBe(740);
    });

    it('ignores board taps and a second start during the wave', () => {
        const s = createGame();
        startWave(s);
        expect(tapCell(s, 0, 0)).toBe('ignored');
        expect(getCell(s.board, 0, 0)).toBe('empty');
        expect(s.coins).toBe(60);
        expect(s.message).toBeNull();
        expect(startWave(s)).toBe(false);
    });

    it('creates one turret record per turret cell, ready to fire', () => {
        const s = createGame();
        setCell(s.board, 0, 0, 'turret');
        setCell(s.board, 8, 11, 'turret');
        setCell(s.board, 3, 3, 'wall');
        startWave(s);
        expect(s.turrets).toHaveLength(2);
        expect(s.turrets[0]).toMatchObject({ x: 46, y: 124 });
        expect(s.turrets[0].charge).toBe(0.5);
    });

    it('does nothing outside the wave phase when updated', () => {
        const s = createGame();
        expect(update(s, 0.1)).toBe('build');
        expect(s.enemies).toHaveLength(0);
    });
});

describe('spawning', () => {
    it('spawns the first enemy on the first update at the centre of S without moving it', () => {
        const s = createGame();
        startWave(s);
        update(s, 0.1);
        expect(s.enemies).toHaveLength(1);
        expect(s.enemies[0]).toMatchObject({ x: S_X, y: S_Y, traveled: 0, hp: 3, maxHp: 3 });
    });

    it('spawns the second enemy exactly at 0.8s, not at 0.79s', () => {
        const s = createGame();
        startWave(s);
        for (let i = 0; i < 7; i++) update(s, 0.1);
        update(s, 0.09);
        expect(s.enemies).toHaveLength(1);
        update(s, 0.01);
        expect(s.enemies).toHaveLength(2);
    });

    it('uses the HP of the current wave', () => {
        const s = createGame();
        s.wave = 3;
        startWave(s);
        update(s, 0.1);
        expect(s.enemies[0].hp).toBe(7);
    });

    it('spawns every enemy whose time has passed in the same frame, all at S', () => {
        const s = createGame();
        startWave(s);
        // DT_MAX (0.1) < SPAWN_INTERVAL (0.8) makes this unreachable through update alone, so set the clock directly.
        s.spawnClock = 1.55;
        update(s, 0.1);
        expect(s.enemies).toHaveLength(3);
        expect(s.enemies.every((e) => e.x === S_X && e.y === S_Y)).toBe(true);
    });

    it('stops after the wave count (8 in wave 1)', () => {
        const s = createGame();
        s.lives = 100;
        startWave(s);
        advance(s, 7.0);
        expect(s.spawned).toBe(8);
        advance(s, 1.0);
        expect(s.spawned).toBe(8);
    });
});

describe('enemy movement', () => {
    it('moves 6.4px per 0.1s straight down the empty-board path', () => {
        const s = createGame();
        startWave(s);
        update(s, 0.1);
        update(s, 0.1);
        expect(s.enemies[0].x).toBeCloseTo(S_X);
        expect(s.enemies[0].y).toBeCloseTo(S_Y + 6.4);
    });

    it('caps a long frame at 0.1s', () => {
        const s = createGame();
        startWave(s);
        update(s, 0.1);
        update(s, 5);
        expect(s.enemies[0].traveled).toBeCloseTo(6.4);
        expect(s.spawnClock).toBeCloseTo(0.2);
    });

    it('turns the corner of a detour instead of cutting it', () => {
        const s = createGame();
        tapCell(s, 4, 5);
        startWave(s);
        s.spawned = 8;
        const e = addEnemy(s, 4 * 56 + 28);
        update(s, 0);
        // Half-way from (4,4) to (3,4): same row, 28px left of column 4's centre.
        expect(e.x).toBeCloseTo(270 - 28);
        expect(e.y).toBeCloseTo(124 + 4 * 56);
    });

    it('removes an enemy and costs one life when it reaches G, without a coin', () => {
        const s = manualWave();
        // 64px/s * 0.03125s = 2px exactly, so the arrival frame is unambiguous.
        const arriving = addEnemy(s, STRAIGHT_PATH_PX - 4);
        addEnemy(s, 0); // keeps the wave from ending this frame
        update(s, 0.03125);
        expect(s.enemies).toContain(arriving);
        update(s, 0.03125);
        expect(s.enemies).not.toContain(arriving);
        expect(s.enemies).toHaveLength(1);
        expect(s.lives).toBe(9);
        expect(s.coins).toBe(60);
        expect(s.kills).toBe(0);
    });

    it('never drops lives below zero when more enemies arrive than lives remain', () => {
        const s = manualWave();
        s.lives = 1;
        addEnemy(s, STRAIGHT_PATH_PX - 1);
        addEnemy(s, STRAIGHT_PATH_PX - 1);
        addEnemy(s, STRAIGHT_PATH_PX - 1);
        expect(update(s, 0.1)).toBe('gameover');
        expect(s.lives).toBe(0);
    });
});

describe('turrets', () => {
    // Turret at (6,3) has its centre at (382,292); the straight path passes x=270, so an enemy
    // with traveled=168 sits at (270,292), exactly 112px away.
    it('hits an enemy exactly at range 112px', () => {
        const s = manualWave([[6, 3]]);
        const e = addEnemy(s, 168);
        update(s, 0);
        expect(e.hp).toBe(2);
        expect(s.turrets[0].flash).toBeCloseTo(0.08);
        expect(s.turrets[0].targetX).toBe(270);
        expect(s.turrets[0].targetY).toBe(292);
    });

    it.each([167, 169])('does not hit an enemy just outside the range (traveled %s)', (traveled) => {
        const s = manualWave([[6, 3]]);
        const e = addEnemy(s, traveled);
        update(s, 0);
        expect(e.hp).toBe(3);
    });

    it('targets the in-range enemy closest to the goal along the path', () => {
        const s = manualWave([[5, 3]]);
        const behind = addEnemy(s, 150);
        const ahead = addEnemy(s, 180);
        update(s, 0);
        expect(ahead.hp).toBe(2);
        expect(behind.hp).toBe(3);
    });

    it('breaks a tie by targeting the enemy that spawned first', () => {
        const s = manualWave([[5, 3]]);
        const first = addEnemy(s, 168);
        const second = addEnemy(s, 168);
        update(s, 0);
        expect(first.hp).toBe(2);
        expect(second.hp).toBe(3);
    });

    // Mutating `<` to `<=` in the interval check survives: TIME_EPS makes them agree at the exact 0.5s boundary.
    it('fires again only after 0.5s', () => {
        const s = manualWave([[5, 3]]);
        const e = addEnemy(s, 168, 10);
        update(s, 0);
        expect(e.hp).toBe(9);
        // Frames are capped at 0.1s, so reach 0.49s in steps; the enemy stays within range meanwhile.
        for (let i = 0; i < 4; i++) update(s, 0.1);
        update(s, 0.09);
        expect(e.hp).toBe(9);
        update(s, 0.01);
        expect(e.hp).toBe(8);
    });

    it('with dt=0.1 fires on frame 1 (charge 0.6 -> 0.1), skips frames 2-4 and fires again on frame 5', () => {
        const s = manualWave([[5, 3]]);
        const e = addEnemy(s, 168, 100);
        const hits: number[] = [];
        for (let frame = 1; frame <= 5; frame++) {
            const before = e.hp;
            update(s, 0.1);
            if (e.hp < before) hits.push(frame);
            if (frame === 1) expect(s.turrets[0].charge).toBeCloseTo(0.1);
        }
        expect(hits).toEqual([1, 5]);
    });

    it('charges by the capped dt: a 5s frame adds only 0.1s of charge', () => {
        const s = manualWave([[5, 3]]);
        const e = addEnemy(s, 168, 100);
        update(s, 0); // first shot; charge 0.5 -> 0
        e.traveled = 168;
        update(s, 5);
        expect(e.hp).toBe(99);
        expect(s.turrets[0].charge).toBeCloseTo(0.1);
    });

    it('fires when the charge reaches 0.5 exactly even if float addition lands a hair below it', () => {
        const s = manualWave([[5, 3]]);
        const e = addEnemy(s, 168, 100);
        update(s, 0); // first shot; charge 0.5 -> 0
        expect(e.hp).toBe(99);
        // These sum to 0.5 exactly in decimal, but to 0.49999999999999994 in floating point.
        const dts = [0.1, 0.1, 0.05, 0.1, 0.1, 0.05];
        dts.forEach((dt, i) => {
            e.traveled = 168;
            update(s, dt);
            expect(e.hp).toBe(i === dts.length - 1 ? 98 : 99);
        });
    });

    it('keeps the average rate under jittery 60Hz frames: 1802 frames of 0.0166/0.0167s give exactly 61 shots', () => {
        const s = manualWave([[5, 3]]);
        const e = addEnemy(s, 168, 1000);
        for (let frame = 0; frame < 1802; frame++) {
            e.traveled = 168; // hold the enemy inside the range for the whole run
            update(s, frame % 2 === 0 ? 0.0166 : 0.0167);
        }
        // 30.0033s at one shot per 0.5s from t=0; resetting the charge to 0 would need 31 frames per shot (59 shots).
        // Exactly 61 by hand: shots at 0, 0.5, ..., 30.0s of accumulated charge (the spec's lower bound is 60).
        expect(1000 - e.hp).toBe(61);
    });

    it('does not bank shots while idle: after 3s with no target it fires once on entry and not on the next frame', () => {
        // Turret (5,8) sits at (326,572); an enemy held at S is far outside its range and keeps the wave alive.
        const s = manualWave([[5, 8]]);
        const far = addEnemy(s, 0, 100);
        for (let frame = 0; frame < 30; frame++) {
            far.traveled = 0;
            update(s, 0.1);
        }
        expect(s.turrets[0].charge).toBe(0.5);
        // Moves 6.4px this frame to (270,572): same row as the turret, 56px away.
        const near = addEnemy(s, 448 - 6.4, 100);
        far.traveled = 0;
        update(s, 0.1);
        expect(near.hp).toBe(99);
        far.traveled = 0;
        update(s, 0.1);
        expect(near.hp).toBe(99);
    });

    it('processes turrets row-major, and a later turret whose only target was just killed holds its charge at 0.5', () => {
        // (5,2) is in an earlier row than (3,4), so it acts first even though its column is later.
        const s = manualWave([
            [3, 4],
            [5, 2]
        ]);
        expect(s.turrets.map((t) => [t.x, t.y])).toEqual([
            [326, 236],
            [214, 348]
        ]);
        addEnemy(s, 0, 100); // far from both turrets; keeps the wave running
        const doomed = addEnemy(s, 168, 1);
        s.enemies[0].traveled = 0;
        update(s, 0.1);
        expect(doomed.hp).toBe(0);
        const upper = s.turrets.find((t) => t.x === 326 && t.y === 236)!;
        const lower = s.turrets.find((t) => t.x === 214 && t.y === 348)!;
        expect(upper.flash).toBeGreaterThan(0);
        expect(upper.charge).toBeCloseTo(0.1);
        expect(lower.flash).toBe(0);
        expect(lower.charge).toBe(0.5);
    });

    it('fades the shot line after 0.08s', () => {
        const s = manualWave([[5, 3]]);
        addEnemy(s, 168, 10);
        update(s, 0);
        update(s, 0.05);
        expect(s.turrets[0].flash).toBeGreaterThan(0);
        update(s, 0.03);
        expect(s.turrets[0].flash).toBe(0);
    });

    it('kills an enemy at 0 HP, adding a kill and 2 coins', () => {
        const s = manualWave([[5, 3]]);
        addEnemy(s, 168, 1);
        addEnemy(s, 0, 3);
        update(s, 0);
        expect(s.enemies).toHaveLength(1);
        expect(s.kills).toBe(1);
        expect(s.coins).toBe(62);
    });

    it('lets a later turret skip an enemy killed earlier in the same frame', () => {
        const s = manualWave([
            [5, 3],
            [3, 3]
        ]);
        const doomed = addEnemy(s, 180, 1);
        const other = addEnemy(s, 160, 3);
        update(s, 0);
        expect(doomed.hp).toBe(0);
        expect(other.hp).toBe(2);
        expect(s.kills).toBe(1);
    });

    it('does not kill an enemy that reached G in the same frame', () => {
        // Turret at (5,11) is adjacent to G, so the enemy would be in range if it were still on the board.
        const s = manualWave([[5, 11]]);
        addEnemy(s, STRAIGHT_PATH_PX - 1, 1);
        addEnemy(s, 0); // far from the turret; keeps the wave from ending this frame
        update(s, 0.1);
        expect(s.phase).toBe('wave');
        expect(s.kills).toBe(0);
        expect(s.lives).toBe(9);
        expect(s.coins).toBe(60);
    });
});

describe('wave end and results', () => {
    it('returns to build with +10 coins and the next wave once every enemy is spawned and gone', () => {
        const s = manualWave();
        const e = addEnemy(s, 168, 1);
        s.turrets.push({ x: 382, y: 292, charge: 0.5, flash: 0, targetX: 0, targetY: 0 });
        expect(e.hp).toBe(1);
        expect(update(s, 0)).toBe('build');
        expect(s.wave).toBe(2);
        expect(s.coins).toBe(60 + 2 + 10);
        expect(s.turrets).toHaveLength(0);
        expect(messageText(s)).toBe('ウェーブ 2 の準備（開始を押す）');
    });

    it('draws no shot lines from a turret sold after the wave (turret list cleared at wave end)', () => {
        const s = createGame();
        s.coins = 1000;
        selectTool(s, 'turret');
        tapCell(s, 5, 3);
        startWave(s);
        s.spawned = 8;
        addEnemy(s, 168, 1);
        expect(update(s, 0)).toBe('build');
        selectTool(s, 'sell');
        tapCell(s, 5, 3);
        expect(s.turrets.some((t) => t.x === 326 && t.y === 292)).toBe(false);
    });

    it('keeps the wave running while enemies are still to spawn', () => {
        const s = createGame();
        startWave(s);
        update(s, 0.1);
        s.enemies.length = 0;
        expect(update(s, 0.1)).toBe('wave');
    });

    it('clears the game after the final wave without a bonus', () => {
        const s = manualWave([], 10);
        expect(update(s, 0)).toBe('cleared');
        expect(s.coins).toBe(60);
        expect(s.wave).toBe(10);
    });

    it('prefers game over when the last enemy reaching G takes the last life', () => {
        const s = manualWave();
        s.lives = 1;
        addEnemy(s, STRAIGHT_PATH_PX - 1);
        expect(update(s, 0.1)).toBe('gameover');
    });

    it('ends in game over mid-wave as soon as lives hit zero', () => {
        const s = createGame();
        s.lives = 1;
        startWave(s);
        let phase = s.phase;
        let frames = 0;
        while (phase === 'wave' && frames < 2000) {
            phase = update(s, 0.1);
            frames++;
        }
        expect(phase).toBe('gameover');
        // The first enemy arrives at 9.625s, while later ones are still walking.
        expect(s.enemies.length).toBeGreaterThan(0);
    });

    it('runs a full wave 1, then wave 2 respawns from scratch and stops at 10 enemies', () => {
        const s = createGame();
        // Hand-picked defence: turrets along the straight path kill 3-HP enemies well before G.
        // The kills/lives/phase checks rely on this defence being strong enough at the current balance;
        // the spawn-count checks and kills + lost lives = 18 do not.
        s.coins = 1000;
        selectTool(s, 'turret');
        for (const [c, r] of [[3, 2], [5, 2], [3, 5], [5, 5], [3, 8], [5, 8]]) tapCell(s, c, r);
        startWave(s);
        advance(s, 60);
        expect(s.phase).toBe('build');
        expect(s.wave).toBe(2);
        expect(s.kills).toBe(8);
        expect(s.lives).toBe(10);

        expect(startWave(s)).toBe(true);
        expect(s.enemies).toHaveLength(0);
        expect(s.spawned).toBe(0);
        update(s, 0.1);
        expect(s.spawned).toBe(1);
        expect(s.enemies[0]).toMatchObject({ traveled: 0, hp: 5 });
        advance(s, 7.0); // clock 7.1s: enemies at 0, 0.8, ... 6.4s are out, the 10th (7.2s) is not
        expect(s.spawned).toBe(9);
        advance(s, 60);
        expect(s.spawned).toBe(10);
        expect(s.phase).toBe('build');
        expect(s.wave).toBe(3);
        expect(s.kills + (10 - s.lives)).toBe(18);
    });

    it('stays in its final phase on further updates', () => {
        const s = manualWave([], 10);
        update(s, 0);
        expect(update(s, 0.1)).toBe('cleared');
    });
});
