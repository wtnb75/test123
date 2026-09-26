import { describe, expect, it } from 'vitest';
import {
    type Board,
    type CellPos,
    createBoard,
    distanceField,
    findPath,
    getCell,
    hasPath,
    indexOf,
    isGoal,
    isStart,
    setCell,
    UNREACHABLE
} from './board';

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

/** Oracle: shortest step counts to the goal by repeated relaxation until nothing changes (no queue, no BFS). */
function oracleDistances(board: Board): number[] {
    const n = board.cols * board.rows;
    const dist = new Array<number>(n).fill(Infinity);
    dist[indexOf(board, board.goal.col, board.goal.row)] = 0;
    let changed = true;
    while (changed) {
        changed = false;
        for (let row = 0; row < board.rows; row++) {
            for (let col = 0; col < board.cols; col++) {
                if (getCell(board, col, row) !== 'empty') continue;
                const i = indexOf(board, col, row);
                const around: [number, number][] = [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]];
                for (const [c, r] of around) {
                    if (c < 0 || r < 0 || c >= board.cols || r >= board.rows) continue;
                    const d = dist[indexOf(board, c, r)] + 1;
                    if (d < dist[i]) {
                        dist[i] = d;
                        changed = true;
                    }
                }
            }
        }
    }
    return dist;
}

function randomBoard(rand: () => number, cols: number, rows: number, density: number): Board {
    const board = createBoard(cols, rows);
    board.start = { col: Math.floor(rand() * cols), row: 0 };
    board.goal = { col: Math.floor(rand() * cols), row: rows - 1 };
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (isStart(board, col, row) || isGoal(board, col, row)) continue;
            if (rand() < density) setCell(board, col, row, rand() < 0.5 ? 'wall' : 'turret');
        }
    }
    return board;
}

const PRIORITY: readonly CellPos[] = [
    { col: 0, row: 1 },
    { col: -1, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: -1 }
];

describe('createBoard', () => {
    it('places S at the top of the centre column and G at the bottom of it on the default 9x12 board', () => {
        const board = createBoard();
        expect(board.cols).toBe(9);
        expect(board.rows).toBe(12);
        expect(board.start).toEqual({ col: 4, row: 0 });
        expect(board.goal).toEqual({ col: 4, row: 11 });
        expect(board.cells.every((c) => c === 'empty')).toBe(true);
    });
});

describe('findPath on hand-made boards', () => {
    it('walks straight down the centre column (12 cells) on an empty board', () => {
        const path = findPath(createBoard());
        expect(path).toHaveLength(12);
        expect(path!.every((p, i) => p.col === 4 && p.row === i)).toBe(true);
    });

    it('prefers left over right when a wall directly below splits two equal detours', () => {
        const board = createBoard();
        setCell(board, 4, 5, 'wall');
        const path = findPath(board)!;
        const expected: CellPos[] = [
            ...[0, 1, 2, 3, 4].map((row) => ({ col: 4, row })),
            ...[4, 5, 6, 7, 8, 9, 10, 11].map((row) => ({ col: 3, row })),
            { col: 4, row: 11 }
        ];
        expect(path).toEqual(expected);
    });

    it('prefers right over up when both are one step closer to the goal', () => {
        // 2x3 board, S=(0,2) G=(1,0): from S both right (1,2) and up (0,1) are 2 steps from G.
        const board = createBoard(2, 3);
        board.start = { col: 0, row: 2 };
        board.goal = { col: 1, row: 0 };
        expect(findPath(board)).toEqual([
            { col: 0, row: 2 },
            { col: 1, row: 2 },
            { col: 1, row: 1 },
            { col: 1, row: 0 }
        ]);
    });

    it('returns null and hasPath false when a full row of walls separates S from G', () => {
        const board = createBoard();
        for (let col = 0; col < board.cols; col++) setCell(board, col, 6, 'wall');
        expect(findPath(board)).toBeNull();
        expect(hasPath(board)).toBe(false);
    });

    it('treats turrets as blocking just like walls', () => {
        const board = createBoard();
        for (let col = 0; col < board.cols; col++) setCell(board, col, 6, col % 2 === 0 ? 'turret' : 'wall');
        expect(hasPath(board)).toBe(false);
    });

    it('marks blocked cells as unreachable in the distance field', () => {
        const board = createBoard();
        setCell(board, 0, 0, 'wall');
        const dist = distanceField(board);
        expect(dist[indexOf(board, 0, 0)]).toBe(UNREACHABLE);
        expect(dist[indexOf(board, 4, 11)]).toBe(0);
        expect(dist[indexOf(board, 4, 0)]).toBe(11);
    });
});

describe('findPath against a relaxation oracle on random boards', () => {
    it('always returns a shortest, walkable, tie-break-respecting path, or null exactly when unreachable', () => {
        const rand = mulberry32(12345);
        let reachable = 0;
        let unreachable = 0;
        let ties = 0;
        for (let n = 0; n < 3000; n++) {
            const cols = 2 + Math.floor(rand() * 6);
            const rows = 2 + Math.floor(rand() * 6);
            const board = randomBoard(rand, cols, rows, rand() * 0.6);
            const dist = oracleDistances(board);
            const startDist = dist[indexOf(board, board.start.col, board.start.row)];
            const path = findPath(board);
            if (startDist === Infinity) {
                unreachable++;
                if (path !== null || hasPath(board)) expect.fail(`expected no path: ${JSON.stringify(board)}`);
                continue;
            }
            reachable++;
            if (path === null || !hasPath(board)) expect.fail(`expected a path: ${JSON.stringify(board)}`);
            if (path.length - 1 !== startDist) expect.fail(`not shortest: ${JSON.stringify(board)}`);
            const first = path[0];
            const last = path[path.length - 1];
            if (first.col !== board.start.col || first.row !== board.start.row) expect.fail('path must start at S');
            if (last.col !== board.goal.col || last.row !== board.goal.row) expect.fail('path must end at G');
            for (let i = 0; i + 1 < path.length; i++) {
                const a = path[i];
                const b = path[i + 1];
                if (getCell(board, b.col, b.row) !== 'empty') expect.fail(`walks through a tower: ${JSON.stringify(board)}`);
                const want = dist[indexOf(board, a.col, a.row)] - 1;
                const candidates = PRIORITY.map((d) => ({ col: a.col + d.col, row: a.row + d.row })).filter(
                    (c) =>
                        c.col >= 0 && c.row >= 0 && c.col < cols && c.row < rows && dist[indexOf(board, c.col, c.row)] === want
                );
                if (candidates.length > 1) ties++;
                if (candidates[0].col !== b.col || candidates[0].row !== b.row) {
                    expect.fail(`tie-break violated at step ${i}: ${JSON.stringify(board)}`);
                }
            }
        }
        expect(reachable).toBeGreaterThan(100);
        expect(unreachable).toBeGreaterThan(100);
        expect(ties).toBeGreaterThan(100);
    });
});
