export type BinaryCell = 0 | 1;

export type PlayerCell = 'unknown' | 'filled' | 'marked';

export type SolveTechnique =
    | 'full-line-fill'
    | 'full-line-empty'
    | 'edge-overlap'
    | 'candidate-common';

export type DifficultyRank = 'easy' | 'normal' | 'hard' | 'unsolved';

export type AnalysisResult = {
    solvable: boolean;
    unique: boolean;
    logical: boolean;
    remainingCells: number;
    techniquesUsed: Partial<Record<SolveTechnique, number>>;
    score: number;
    difficulty: DifficultyRank;
    timedOut: boolean;
};

export type PuzzleData = {
    width: number;
    height: number;
    solution: BinaryCell[][];
    rows: number[][];
    cols: number[][];
};
