import { describe, expect, it } from 'vitest';
import {
    type Board,
    createBoard,
    distanceField,
    findPath,
    getCell,
    getTerrain,
    hasPath,
    indexOf,
    initialTerrain,
    isGoal,
    isStart,
    type Terrain,
    UNREACHABLE
} from './board';
import { CELL, ENEMY_SPEED, GRID_COLS, GRID_ROWS } from './config';
import { enemyCount } from './wave';
import {
    createGame,
    type GameState,
    messageText,
    MSG_BLOCKED,
    MSG_NO_COINS,
    selectTool,
    speedFactor,
    startWave,
    tapCell,
    update
} from './world';

type Pos = [number, number]; // [row, col]

/** A terrain grid with the given rocks and swamps; everything else is plain. */
function terrainWith(rocks: Pos[], swamps: Pos[]): Terrain[] {
    const t = new Array<Terrain>(GRID_COLS * GRID_ROWS).fill('plain');
    for (const [r, c] of rocks) t[r * GRID_COLS + c] = 'rock';
    for (const [r, c] of swamps) t[r * GRID_COLS + c] = 'swamp';
    return t;
}

const pathOf = (board: Board): string[] => (findPath(board) ?? []).map((p) => `${p.row},${p.col}`);
const startDist = (board: Board): number => distanceField(board)[indexOf(board, board.start.col, board.start.row)];

describe('the initial terrain', () => {
    const board = createBoard(GRID_COLS, GRID_ROWS, initialTerrain());
    const at = (kind: Terrain): string[] => {
        const out: string[] = [];
        for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) if (getTerrain(board, c, r) === kind) out.push(`${r},${c}`);
        }
        return out;
    };

    it('has the five rocks and nine swamps of the spec, everything else plain', () => {
        expect(at('rock')).toEqual(['2,2', '3,6', '5,4', '6,1', '8,6']);
        expect(at('swamp')).toEqual(['3,3', '3,4', '4,3', '7,3', '7,4', '9,2', '9,3', '10,5', '10,6']);
        expect(at('plain')).toHaveLength(GRID_COLS * GRID_ROWS - 14);
    });

    it('keeps S and G plain, and leaves 101 cells to build on (all but S, G and the rocks)', () => {
        expect(getTerrain(board, board.start.col, board.start.row)).toBe('plain');
        expect(getTerrain(board, board.goal.col, board.goal.row)).toBe('plain');
        expect(GRID_COLS * GRID_ROWS - 2 - at('rock').length).toBe(101);
    });

    it('gives a 14-cell (13-step) path that detours right around the swamps and the rock, dist(S) = 26', () => {
        expect(pathOf(board)).toEqual([
            '0,4', '1,4', '2,4', '2,5', '3,5', '4,5', '5,5', '6,5', '7,5', '8,5', '9,5', '9,4', '10,4', '11,4'
        ]);
        expect(startDist(board)).toBe(26);
        // 13 steps of CELL px at ENEMY_SPEED px/s, no swamp on the way.
        expect((13 * CELL) / ENEMY_SPEED).toBeCloseTo(11.375, 10);
    });

    it('is what the game starts with when given the initial terrain, and all plain without it', () => {
        expect(createGame(initialTerrain()).path).toHaveLength(14);
        expect(createGame().path).toHaveLength(12);
        expect(createGame().board.terrain.every((t) => t === 'plain')).toBe(true);
    });
});

describe('the fastest path with swamps (hand-worked weights: plain-plain 2, plain-swamp 3, swamp-swamp 4)', () => {
    it('is the straight 11 steps with dist(S) = 22 on an all-plain board', () => {
        const board = createBoard();
        expect(pathOf(board)).toHaveLength(12);
        expect(startDist(board)).toBe(22);
    });

    it('avoids a column of ten swamps: straight costs 3 + 4 * 9 + 3 = 42, the left column 26, and left beats right on the tie', () => {
        const swamps: Pos[] = [];
        for (let r = 1; r <= 10; r++) swamps.push([r, 4]);
        const board = createBoard(GRID_COLS, GRID_ROWS, terrainWith([], swamps));
        expect(startDist(board)).toBe(26);
        expect(pathOf(board)).toEqual([
            '0,4', '0,3', '1,3', '2,3', '3,3', '4,3', '5,3', '6,3', '7,3', '8,3', '9,3', '10,3', '11,3', '11,4'
        ]);
    });

    it('goes straight through a single swamp: 11 * 2 + 2 = 24 beats the 2-steps-longer detour of 26', () => {
        const board = createBoard(GRID_COLS, GRID_ROWS, terrainWith([], [[5, 4]]));
        expect(startDist(board)).toBe(24);
        expect(pathOf(board)).toEqual(Array.from({ length: 12 }, (_, r) => `${r},4`));
    });

    it('treats a rock like a wall: it cannot be walked, and the last gap cannot be closed', () => {
        const rocks: Pos[] = [];
        for (let c = 0; c < 8; c++) rocks.push([5, c]);
        const board = createBoard(GRID_COLS, GRID_ROWS, terrainWith(rocks, []));
        expect(hasPath(board)).toBe(true);
        expect(pathOf(board)).toContain('5,8');
        const game = createGame(terrainWith(rocks, []));
        game.coins = 100;
        expect(tapCell(game, 8, 5)).toBe('failed'); // wall on the only gap
        expect(messageText(game)).toBe(MSG_BLOCKED);
        expect(getCell(game.board, 8, 5)).toBe('empty');
        expect(game.coins).toBe(100);
    });

    it('is the same as a step-count shortest path on a board with no swamps (ties down, left, right, up)', () => {
        const board = createBoard(GRID_COLS, GRID_ROWS, terrainWith([[5, 4]], []));
        // Around the rock via the left column; at (10, 3) down and right tie and down comes first.
        expect(pathOf(board)).toEqual(['0,4', '1,4', '2,4', '3,4', '4,4', '4,3', '5,3', '6,3', '7,3', '8,3', '9,3', '10,3', '11,3', '11,4']);
    });
});

/** Independent oracle: weighted distances by repeated relaxation over all cells until nothing changes. */
function oracleDistances(board: Board): number[] {
    const cost = (i: number): number => (board.terrain[i] === 'swamp' ? 2 : 1);
    const open = (i: number): boolean => board.cells[i] === 'empty' && board.terrain[i] !== 'rock';
    const dist = new Array<number>(board.cells.length).fill(Infinity);
    dist[indexOf(board, board.goal.col, board.goal.row)] = 0;
    for (let changed = true; changed; ) {
        changed = false;
        for (let i = 0; i < dist.length; i++) {
            if (!open(i)) continue;
            const c = i % board.cols;
            const r = Math.floor(i / board.cols);
            for (const [dc, dr] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) {
                const nc = c + dc;
                const nr = r + dr;
                if (nc < 0 || nr < 0 || nc >= board.cols || nr >= board.rows) continue;
                const j = nr * board.cols + nc;
                if (open(j) && dist[j] + cost(i) + cost(j) < dist[i]) {
                    dist[i] = dist[j] + cost(i) + cost(j);
                    changed = true;
                }
            }
        }
    }
    return dist;
}

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

describe('weighted paths against a relaxation oracle on random boards with terrain', () => {
    it('matches the oracle distances, and the path is walkable, optimal and respects the tie-break', () => {
        const rand = mulberry32(2024);
        let reachable = 0;
        let unreachable = 0;
        let ties = 0;
        let swampSteps = 0;
        for (let n = 0; n < 2000; n++) {
            const cols = 3 + Math.floor(rand() * 5);
            const rows = 3 + Math.floor(rand() * 5);
            const board = createBoard(cols, rows);
            for (let i = 0; i < board.cells.length; i++) {
                if (i === indexOf(board, board.start.col, board.start.row) || i === indexOf(board, board.goal.col, board.goal.row)) continue;
                const roll = rand();
                if (roll < 0.15) board.terrain[i] = 'rock';
                else if (roll < 0.4) board.terrain[i] = 'swamp';
                if (rand() < 0.1) board.cells[i] = 'wall';
            }
            // The start column may be off the small board; keep S and G on the board.
            if (board.start.col >= cols || board.goal.col >= cols) continue;
            const oracle = oracleDistances(board);
            const dist = distanceField(board);
            for (let i = 0; i < dist.length; i++) {
                const want = oracle[i] === Infinity ? UNREACHABLE : oracle[i];
                if (dist[i] !== want) expect.fail(`distance differs at ${i}: ${dist[i]} vs ${want}`);
            }
            const path = findPath(board);
            const s = indexOf(board, board.start.col, board.start.row);
            if (oracle[s] === Infinity) {
                unreachable++;
                if (path !== null || hasPath(board)) expect.fail('expected no path');
                continue;
            }
            reachable++;
            if (path === null || !hasPath(board)) expect.fail('expected a path');
            let total = 0;
            for (let i = 0; i + 1 < path.length; i++) {
                const a = path[i];
                const b = path[i + 1];
                const ia = indexOf(board, a.col, a.row);
                const ib = indexOf(board, b.col, b.row);
                if (board.cells[ib] !== 'empty' || board.terrain[ib] === 'rock') expect.fail('walks through a block');
                const w = (board.terrain[ia] === 'swamp' ? 2 : 1) + (board.terrain[ib] === 'swamp' ? 2 : 1);
                if (board.terrain[ib] === 'swamp') swampSteps++;
                total += w;
                const candidates = [[0, 1], [-1, 0], [1, 0], [0, -1]]
                    .map(([dc, dr]) => ({ col: a.col + dc, row: a.row + dr }))
                    .filter((c) => {
                        if (c.col < 0 || c.row < 0 || c.col >= cols || c.row >= rows) return false;
                        const j = indexOf(board, c.col, c.row);
                        const wj = (board.terrain[ia] === 'swamp' ? 2 : 1) + (board.terrain[j] === 'swamp' ? 2 : 1);
                        return oracle[j] + wj === oracle[ia];
                    });
                if (candidates.length > 1) ties++;
                if (candidates[0].col !== b.col || candidates[0].row !== b.row) expect.fail('tie-break violated');
            }
            if (total !== oracle[s]) expect.fail(`path weight ${total} is not the optimum ${oracle[s]}`);
        }
        // Guard against vacuous runs.
        expect(reachable).toBeGreaterThan(200);
        expect(unreachable).toBeGreaterThan(50);
        expect(ties).toBeGreaterThan(100);
        expect(swampSteps).toBeGreaterThan(100);
    });
});

describe('placing and selling on terrain', () => {
    const game = (): GameState => createGame(terrainWith([[5, 4]], [[3, 4]]));

    it('ignores a tap on a rock for every tool: no coins, message, building or failure', () => {
        for (const tool of ['wall', 'turret', 'sell'] as const) {
            const s = game();
            selectTool(s, tool);
            expect(tapCell(s, 4, 5)).toBe('ignored');
            expect([s.coins, s.message, getCell(s.board, 4, 5)]).toEqual([60, null, 'empty']);
        }
    });

    it('ignores a rock before the coin check: with too few coins the message stays as it was', () => {
        const s = game();
        s.coins = 0;
        expect(tapCell(s, 4, 5)).toBe('ignored');
        expect(s.message).toBeNull();
        expect(tapCell(s, 4, 1)).toBe('failed'); // a plain cell does fail on coins
        expect(s.message).toBe(MSG_NO_COINS);
        expect(tapCell(s, 4, 5)).toBe('ignored'); // and the failure message stays while a rock is tapped
        expect(s.message).toBe(MSG_NO_COINS);
    });

    it('builds a wall on a swamp for the normal cost and gives the swamp back when it is sold', () => {
        const s = game();
        expect(tapCell(s, 4, 3)).toBe('placed');
        expect(s.coins).toBe(55);
        expect(getCell(s.board, 4, 3)).toBe('wall');
        expect(getTerrain(s.board, 4, 3)).toBe('swamp');
        selectTool(s, 'sell');
        expect(tapCell(s, 4, 3)).toBe('sold');
        expect(s.coins).toBe(57); // floor(5 * 0.5)
        expect(getCell(s.board, 4, 3)).toBe('empty');
        expect(getTerrain(s.board, 4, 3)).toBe('swamp');
        expect(tapCell(s, 4, 3)).toBe('ignored'); // selling an empty swamp does nothing
        expect(s.coins).toBe(57);
        selectTool(s, 'wall');
        expect(tapCell(s, 4, 3)).toBe('placed'); // the swamp can be built on again
        expect(s.coins).toBe(52);
    });

    it('counts a swamp with a turret on it as blocked, and the preview goes around it', () => {
        const s = game();
        selectTool(s, 'turret');
        expect(tapCell(s, 4, 3)).toBe('placed');
        expect(s.path.some((p) => p.col === 4 && p.row === 3)).toBe(false);
    });

    it('shows the placement hint while there are no buildings, rocks and swamps notwithstanding', () => {
        const s = game();
        expect(messageText(s)).toBe('マスをタップして建物を置こう（置いたら開始）');
        tapCell(s, 4, 3);
        expect(messageText(s)).toBe('ウェーブ 1 の準備（開始を押す）');
    });

    it('keeps S and G unbuildable', () => {
        const s = game();
        const { board } = s;
        expect(isStart(board, 4, 0) && isGoal(board, 4, 11)).toBe(true);
        expect(tapCell(s, 4, 0)).toBe('failed');
        expect(tapCell(s, 4, 11)).toBe('failed');
    });
});

describe('walking through a swamp (single swamp at row 3, col 4 on the straight path: cell 3, traveled 140 to <196)', () => {
    const wave = (): GameState => {
        const s = createGame(terrainWith([], [[3, 4]]));
        startWave(s);
        s.spawned = enemyCount(s.wave); // no new enemies; the test places its own
        return s;
    };
    const walker = (s: GameState, traveled: number) => {
        const e = { id: s.nextEnemyId++, hp: 99, maxHp: 99, traveled, x: 0, y: 0 };
        s.enemies.push(e);
        return e;
    };

    it('takes the speed factor from the cell holding the position, switching at half a cell', () => {
        const s = wave();
        expect(speedFactor(s, 0)).toBe(1);
        expect(speedFactor(s, 139.9)).toBe(1);
        expect(speedFactor(s, 140)).toBe(0.5); // exactly half a cell before the centre: already in the swamp
        expect(speedFactor(s, 168)).toBe(0.5);
        expect(speedFactor(s, 195.9)).toBe(0.5);
        expect(speedFactor(s, 196)).toBe(1); // exactly half a cell after: the next cell
        expect(speedFactor(s, 11 * CELL)).toBe(1); // G
    });

    it('moves 6.4 px per 0.1 s on plain ground and 3.2 px in the swamp', () => {
        const s = wave();
        const e = walker(s, 139.9);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(146.3, 10); // decided at the start of the frame (plain)
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(149.5, 10); // now in the swamp
    });

    it('leaves the swamp at 196: 195.9 still crawls (to 199.1), then the next frame walks at full speed', () => {
        const s = wave();
        const e = walker(s, 195.9);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(199.1, 10);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(205.5, 10);
    });

    it('does not slow an enemy on a board without swamps', () => {
        const s = createGame();
        startWave(s);
        s.spawned = enemyCount(s.wave);
        const e = { id: 0, hp: 99, maxHp: 99, traveled: 168, x: 0, y: 0 };
        s.enemies.push(e);
        update(s, 0.1);
        expect(e.traveled).toBeCloseTo(174.4, 10);
    });

    it('still reaches G when the traveled distance reaches steps * CELL, swamps or not', () => {
        const s = wave();
        const e = walker(s, 11 * CELL - 3);
        update(s, 0.1);
        expect(s.enemies).not.toContain(e);
        expect(s.lives).toBe(9);
    });

    it('keeps the target choice on traveled: the enemy further along is shot, not the older or the nearer one', () => {
        const s = createGame(terrainWith([], [[3, 4]]));
        s.board.cells[indexOf(s.board, 3, 4)] = 'turret'; // turret beside the path: centre (214, 348)
        startWave(s);
        s.spawned = enemyCount(s.wave);
        // On the straight path an enemy at `traveled` stands at (270, 124 + traveled).
        // `behind` is older and nearer the turret (distance 56 vs about 67); `ahead` has walked further.
        const behind = { id: 0, hp: 5, maxHp: 5, traveled: 230, x: 0, y: 0 };
        const ahead = { id: 1, hp: 5, maxHp: 5, traveled: 260, x: 0, y: 0 };
        s.enemies.push(behind, ahead);
        update(s, 0.1);
        expect(ahead.hp).toBe(4);
        expect(behind.hp).toBe(5);
    });
});
