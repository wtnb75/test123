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

/** A door of a room: the cell next to it (inside the board) and the wall it is in. */
export type StageDoor = {
  cell: Position;
  side: Heading;
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
  /**
   * What `goal` is: the down-stairs (default), the cell next to the room's first door (room A's exit A1), or
   * `none` (a dead-end room: it has no down-stairs and `goal` is only a placeholder equal to `start`; with
   * `none` nothing may read `goal` as a place).
   */
  goalKind?: 'down' | 'door' | 'none';
  /** The wall the room's (first) door is in (the door cell is `start` or `goal`, whichever has the kind `door`). */
  doorSide?: Heading;
  /** Every door of the room, first door first (room A: A1 then A2). Absent for a room made without doors. */
  doors?: StageDoor[];
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
  /** With `door`: which of the room's doors (index into `Stage.doors`; 0 when the room has one). */
  doorIndex?: number;
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
