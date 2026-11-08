// The five hand-made stages (docs/spec.md "面"). '#' is a block, '.' is empty; 8 columns per row.
import { BLOCK_COLS } from '../params';

export interface StageDef {
    rows: readonly string[];
    bumpers: ReadonlyArray<readonly [number, number]>;
}

export interface Block {
    col: number;
    row: number;
    alive: boolean;
}

export interface Bumper {
    x: number;
    y: number;
}

export const STAGES: readonly StageDef[] = [
    {
        rows: ['########', '########', '########'],
        bumpers: [
            [95, 300],
            [235, 300],
        ],
    },
    {
        rows: ['#.#.#.#.', '.#.#.#.#', '#.#.#.#.', '.#.#.#.#'],
        bumpers: [
            [165, 250],
            [85, 340],
            [245, 340],
        ],
    },
    {
        rows: ['########', '#......#', '#.####.#', '#......#', '########'],
        bumpers: [
            [165, 290],
            [80, 380],
            [250, 380],
        ],
    },
    {
        rows: ['...##...', '..####..', '.######.', '########'],
        bumpers: [
            [80, 300],
            [250, 300],
            [165, 380],
        ],
    },
    {
        rows: ['########', '##.##.##', '########', '.##..##.', '########'],
        bumpers: [
            [165, 250],
            [70, 330],
            [260, 330],
            [165, 410],
        ],
    },
];

/** Blocks of a stage (1-based), in reading order. */
export function loadBlocks(stage: number): Block[] {
    const blocks: Block[] = [];
    STAGES[stage - 1].rows.forEach((row, r) => {
        for (let c = 0; c < BLOCK_COLS; c++) {
            if (row[c] === '#') blocks.push({ col: c, row: r, alive: true });
        }
    });
    return blocks;
}

/** Bumpers of a stage (1-based). */
export function loadBumpers(stage: number): Bumper[] {
    return STAGES[stage - 1].bumpers.map(([x, y]) => ({ x, y }));
}

/** Whether every block of the stage is gone. */
export function stageCleared(blocks: readonly Block[]): boolean {
    return blocks.every((b) => !b.alive);
}
