import { describe, expect, it } from 'vitest';
import { BALL_R, BLOCK_COLS, BUMPER_R, FIELD_W, STAGE_COUNT } from '../params';
import { blockRect } from './physics';
import { STAGES, loadBlocks, loadBumpers, stageCleared } from './stages';

describe('stages', () => {
    it('has STAGE_COUNT stages', () => {
        expect(STAGES).toHaveLength(STAGE_COUNT);
    });

    it('has 24 / 16 / 26 / 20 / 34 blocks, 120 in all', () => {
        const counts = [1, 2, 3, 4, 5].map((s) => loadBlocks(s).length);
        expect(counts).toEqual([24, 16, 26, 20, 34]);
        expect(counts.reduce((a, b) => a + b, 0)).toBe(120);
    });

    // Copied by hand from docs/spec.md "面（手作りの 5 面）".
    const SPEC_BUMPERS: Array<Array<[number, number]>> = [
        [[95, 300], [235, 300]],
        [[165, 250], [85, 340], [245, 340]],
        [[165, 290], [80, 380], [250, 380]],
        [[80, 300], [250, 300], [165, 380]],
        [[165, 250], [70, 330], [260, 330], [165, 410]],
    ];
    // Block columns per row (top to bottom), from the same table.
    const SPEC_ROWS: number[][][] = [
        [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7]],
        [[0, 2, 4, 6], [1, 3, 5, 7], [0, 2, 4, 6], [1, 3, 5, 7]],
        [[0, 1, 2, 3, 4, 5, 6, 7], [0, 7], [0, 2, 3, 4, 5, 7], [0, 7], [0, 1, 2, 3, 4, 5, 6, 7]],
        [[3, 4], [2, 3, 4, 5], [1, 2, 3, 4, 5, 6], [0, 1, 2, 3, 4, 5, 6, 7]],
        [[0, 1, 2, 3, 4, 5, 6, 7], [0, 1, 3, 4, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 5, 6], [0, 1, 2, 3, 4, 5, 6, 7]],
    ];

    it.each([1, 2, 3, 4, 5])('puts the bumpers of stage %i at the positions in the spec table', (stage) => {
        expect(loadBumpers(stage).map((b) => [b.x, b.y])).toEqual(SPEC_BUMPERS[stage - 1]);
    });

    it.each([1, 2, 3, 4, 5])('lays out the blocks of stage %i row by row as in the spec table', (stage) => {
        const rows = SPEC_ROWS[stage - 1];
        const blocks = loadBlocks(stage);
        rows.forEach((cols, row) => {
            expect(blocks.filter((b) => b.row === row).map((b) => b.col)).toEqual(cols);
        });
        expect(blocks).toHaveLength(rows.reduce((n, cols) => n + cols.length, 0));
    });

    it('reads stage 1 as 3 full rows, the top-left block at column 0, row 0', () => {
        const blocks = loadBlocks(1);
        expect(blocks[0]).toEqual({ col: 0, row: 0, alive: true, special: true });
        expect(blocks[blocks.length - 1]).toEqual({ col: 7, row: 2, alive: true });
    });

    it('reads the checkerboard of stage 2 and the hollow frame of stage 3', () => {
        const s2 = loadBlocks(2).filter((b) => b.row === 0).map((b) => b.col);
        expect(s2).toEqual([0, 2, 4, 6]);
        const s3 = loadBlocks(3).filter((b) => b.row === 2).map((b) => b.col);
        expect(s3).toEqual([0, 2, 3, 4, 5, 7]);
        expect(loadBlocks(3).filter((b) => b.row === 1).map((b) => b.col)).toEqual([0, 7]);
    });

    it('returns fresh blocks each time (breaking one does not leak into the next load)', () => {
        const a = loadBlocks(1);
        a[0].alive = false;
        expect(loadBlocks(1)[0].alive).toBe(true);
    });

    it('keeps every block inside the grid and above the lowest row the table allows', () => {
        for (let s = 1; s <= STAGE_COUNT; s++) {
            for (const b of loadBlocks(s)) {
                expect(b.col).toBeGreaterThanOrEqual(0);
                expect(b.col).toBeLessThan(BLOCK_COLS);
                expect(b.row).toBeLessThan(6);
                const r = blockRect(b);
                expect(r.x + r.w).toBeLessThanOrEqual(FIELD_W);
            }
        }
    });

    it('keeps every bumper clear of every block (a ball can always get between them)', () => {
        for (let s = 1; s <= STAGE_COUNT; s++) {
            for (const bu of loadBumpers(s)) {
                for (const b of loadBlocks(s)) {
                    const r = blockRect(b);
                    const cx = Math.max(r.x, Math.min(bu.x, r.x + r.w));
                    const cy = Math.max(r.y, Math.min(bu.y, r.y + r.h));
                    expect(Math.hypot(bu.x - cx, bu.y - cy)).toBeGreaterThan(BUMPER_R + 2 * BALL_R);
                }
            }
        }
    });

    it('keeps bumpers inside the table, away from the walls', () => {
        for (let s = 1; s <= STAGE_COUNT; s++) {
            for (const bu of loadBumpers(s)) {
                expect(bu.x - BUMPER_R).toBeGreaterThan(2 * BALL_R);
                expect(bu.x + BUMPER_R).toBeLessThan(FIELD_W - 2 * BALL_R);
            }
        }
    });
});

describe('stageCleared', () => {
    it('is true only when no block is left alive', () => {
        const blocks = loadBlocks(2);
        expect(stageCleared(blocks)).toBe(false);
        for (const b of blocks) b.alive = false;
        expect(stageCleared(blocks)).toBe(true);
        blocks[3].alive = true;
        expect(stageCleared(blocks)).toBe(false);
    });
});
