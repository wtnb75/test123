// Prototype stages: '#' = block, '.' = empty. 8 columns per row.
export interface StageDef {
    rows: string[];
    bumpers: Array<[number, number]>;
}

export const STAGES: StageDef[] = [
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
];
