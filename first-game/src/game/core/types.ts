export type Position = {
  x: number;
  y: number;
};

export type Cell = {
  hasBomb: boolean;
  flagged: boolean;
  revealed: boolean;
  hint: number;
};

export type Stage = {
  width: number;
  height: number;
  stageNo: number;
  cells: Cell[];
  player: Position;
  start: Position;
  goal: Position;
  generation: {
    retries: number;
    depthTarget: number;
    solverDepth: number;
    generationMs: number;
  };
};

export type MoveResult = {
  status: 'alive' | 'dead' | 'goal';
  message?: string;
};

export type SolvabilityResult = {
  solvable: boolean;
  depth: number;
  decidedBombs: number;
};

export type StageParams = {
  width: number;
  height: number;
  bombCount: number;
  stageNo: number;
  depthTarget: number;
};
