export type Position = {
  x: number;
  y: number;
};

/** A side of a room, or a heading of the floor: right (E), down (S), left (W), up (N). */
export type Heading = 'E' | 'S' | 'W' | 'N';

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
  /** What `start` is: the up-stairs (default) or the cell next to the room's door (room B's entry; docs/spec/rooms-and-floors.md). */
  startKind?: 'up' | 'door';
  /** What `goal` is: the down-stairs (default) or the cell next to the room's door (room A's exit). */
  goalKind?: 'down' | 'door';
  /** The wall the room's door is in (the door cell is `start` or `goal`, whichever has the kind `door`). */
  doorSide?: Heading;
  generation: {
    retries: number;
    depthTarget: number;
    solverDepth: number;
    generationMs: number;
  };
};

export type MoveResult = {
  /** `door`: the move went out through the room's door (the corridor starts); `goal`: it landed on the down-stairs. */
  status: 'alive' | 'dead' | 'goal' | 'door';
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
