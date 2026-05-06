import { cloneStage, inBounds, indexOf, neighbors8, revealZeros } from './board';
import type { MoveResult, Position, Stage } from './types';

export type RuleOutput = {
  stage: Stage;
  result: MoveResult;
  changedCellIndices: number[];
};

export const changedCellIndicesFrom = (changed: ReadonlySet<number>): number[] =>
  [...changed].sort((a, b) => a - b);

export const finalizeRuleOutput = (
  originalStage: Stage,
  nextStage: Stage,
  result: MoveResult,
  changed: ReadonlySet<number>
): RuleOutput => {
  const changedCellIndices = changedCellIndicesFrom(changed);

  return {
    stage: changedCellIndices.length === 0 ? originalStage : nextStage,
    result,
    changedCellIndices,
  };
};

const eqPos = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

const ensureWritableCell = (stage: Stage, originalCells: Stage['cells'], idx: number) => {
  if (stage.cells[idx] === originalCells[idx]) {
    stage.cells[idx] = { ...stage.cells[idx] };
  }

  return stage.cells[idx];
};

const revealZerosCopyOnWrite = (
  stage: Stage,
  origin: Position,
  originalCells: Stage['cells'],
  changed: Set<number>
): void => {
  const queue: Position[] = [origin];
  const seen = new Set<number>();
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const currentIdx = indexOf(stage, current);
    if (seen.has(currentIdx)) {
      continue;
    }
    seen.add(currentIdx);

    const currentCell = stage.cells[currentIdx];
    if (currentCell.hasBomb || currentCell.flagged) {
      continue;
    }

    const writable = ensureWritableCell(stage, originalCells, currentIdx);
    if (!writable.revealed) {
      writable.revealed = true;
      changed.add(currentIdx);
    }

    if (stage.cells[currentIdx].hint !== 0) {
      continue;
    }

    for (const n of neighbors8(stage, current)) {
      const nCell = stage.cells[indexOf(stage, n)];
      if (!nCell.hasBomb && !nCell.flagged) {
        queue.push(n);
      }
    }
  }
};

const revealCellWithoutMoving = (stage: Stage, pos: Position, changed: Set<number>): MoveResult | null => {
  const idx = indexOf(stage, pos);
  const cell = stage.cells[idx];

  if (cell.flagged || cell.revealed) {
    return null;
  }

  if (cell.hasBomb) {
    return { status: 'dead', message: 'bomb-without-flag' };
  }

  cell.revealed = true;
  changed.add(idx);
  if (cell.hint === 0) {
    const wasRevealed = stage.cells.map((currentCell) => currentCell.revealed);
    revealZeros(stage, pos);
    for (let i = 0; i < stage.cells.length; i += 1) {
      if (stage.cells[i].revealed && !wasRevealed[i]) {
        changed.add(i);
      }
    }
  }

  return null;
};

const collectGuaranteedSafeNeighbors = (stage: Stage, center: Position): Position[] => {
  const candidates = neighbors8(stage, center);
  const safe = new Map<number, Position>();

  for (const cluePos of candidates) {
    const clueCell = stage.cells[indexOf(stage, cluePos)];
    if (!clueCell.revealed || clueCell.hint <= 0) {
      continue;
    }

    const clueNeighbors = neighbors8(stage, cluePos);
    let flaggedCount = 0;

    for (const n of clueNeighbors) {
      if (stage.cells[indexOf(stage, n)].flagged) {
        flaggedCount += 1;
      }
    }

    if (flaggedCount !== clueCell.hint) {
      continue;
    }

    for (const n of clueNeighbors) {
      const idx = indexOf(stage, n);
      const cell = stage.cells[idx];
      const isNeighborOfCenter = Math.abs(n.x - center.x) <= 1 && Math.abs(n.y - center.y) <= 1;

      if (!isNeighborOfCenter || cell.flagged || cell.revealed) {
        continue;
      }

      safe.set(idx, n);
    }
  }

  return [...safe.values()];
};

const revealGuaranteedSafeAroundFlag = (stage: Stage, center: Position, changed: Set<number>): MoveResult | null => {
  let openedAny = false;

  while (true) {
    const guaranteedSafe = collectGuaranteedSafeNeighbors(stage, center);
    let openedThisPass = false;

    for (const pos of guaranteedSafe) {
      const revealResult = revealCellWithoutMoving(stage, pos, changed);
      if (revealResult) {
        return revealResult;
      }

      const cell = stage.cells[indexOf(stage, pos)];
      if (cell.revealed) {
        openedThisPass = true;
        openedAny = true;
      }
    }

    if (!openedThisPass) {
      break;
    }
  }

  if (!openedAny) {
    return { status: 'alive', message: 'not-enough-info' };
  }

  return { status: 'alive', message: 'auto-opened' };
};

export const toggleFlag = (stage: Stage, pos: Position): Stage => {
  if (!inBounds(stage, pos)) {
    return stage;
  }

  const idx = indexOf(stage, pos);
  if (stage.cells[idx].revealed) {
    return stage;
  }

  const next: Stage = {
    ...stage,
    cells: [...stage.cells]
  };

  const cell = { ...next.cells[idx] };
  next.cells[idx] = cell;
  cell.flagged = !cell.flagged;

  return next;
};

export const movePlayer = (stage: Stage, pos: Position): RuleOutput => {
  if (!inBounds(stage, pos)) {
    return { stage, result: { status: 'alive', message: 'out-of-bounds' } };
  }

  const targetIdx = indexOf(stage, pos);
  const targetCell = stage.cells[targetIdx];
  const next: Stage = {
    ...stage,
    player: { ...pos },
    cells: stage.cells
  };

  if (targetCell.hasBomb && !targetCell.flagged) {
    return { stage: next, result: { status: 'dead', message: 'bomb-without-flag' } };
  }

  if (!targetCell.hasBomb && targetCell.flagged) {
    return { stage: next, result: { status: 'dead', message: 'false-flag' } };
  }

  if (!targetCell.hasBomb && !targetCell.revealed) {
    const originalCells = stage.cells;
    const changed = new Set<number>();
    next.cells = [...stage.cells];
    const writableTarget = ensureWritableCell(next, originalCells, targetIdx);
    if (!writableTarget.revealed) {
      writableTarget.revealed = true;
      changed.add(targetIdx);
    }
    if (targetCell.hint === 0) {
      revealZerosCopyOnWrite(next, pos, originalCells, changed);
    }

    if (eqPos(pos, next.goal)) {
      return { stage: next, result: { status: 'goal' }, changedCellIndices: [...changed] };
    }

    return { stage: next, result: { status: 'alive' }, changedCellIndices: [...changed] };
  }

  if (eqPos(pos, next.goal)) {
    return { stage: next, result: { status: 'goal' } };
  }

  return { stage: next, result: { status: 'alive' } };
};

export const moveByDelta = (
  stage: Stage,
  dx: number,
  dy: number
): RuleOutput => {
  return movePlayer(stage, { x: stage.player.x + dx, y: stage.player.y + dy });
};

export const chordAtPlayer = (stage: Stage): RuleOutput => {
  const center = stage.player;
  const centerCell = stage.cells[indexOf(stage, center)];

  if (centerCell.flagged) {
    const next = cloneStage(stage);
    const changed = new Set<number>();
    const revealResult = revealGuaranteedSafeAroundFlag(next, center, changed);
    const result = revealResult ?? { status: 'alive', message: 'not-enough-info' };
    if (result.status === 'alive' && result.message === 'not-enough-info') {
      return { stage, result };
    }

    return { stage: next, result, changedCellIndices: [...changed] };
  }

  if (!centerCell.revealed || centerCell.hint <= 0) {
    return { stage, result: { status: 'alive', message: 'chord-not-available' } };
  }

  const neighbors = neighbors8(stage, center);
  let flaggedCount = 0;

  for (const n of neighbors) {
    if (stage.cells[indexOf(stage, n)].flagged) {
      flaggedCount += 1;
    }
  }

  if (flaggedCount > centerCell.hint) {
    return { stage, result: { status: 'alive', message: 'flag-overflow' } };
  }

  const next = cloneStage(stage);
  const changed = new Set<number>();

  if (flaggedCount < centerCell.hint) {
    const unresolved = neighbors.filter((n) => {
      const c = next.cells[indexOf(next, n)];
      return !c.flagged && !c.revealed;
    });
    const bombsNeeded = centerCell.hint - flaggedCount;
    if (unresolved.length === bombsNeeded) {
      for (const n of unresolved) {
        const idx = indexOf(next, n);
        next.cells[idx].flagged = true;
        changed.add(idx);
      }
      return { stage: next, result: { status: 'alive', message: 'auto-flagged' }, changedCellIndices: [...changed] };
    }
    return { stage, result: { status: 'alive', message: 'not-enough-info' } };
  }

  for (const n of neighbors) {
    const revealResult = revealCellWithoutMoving(next, n, changed);
    if (revealResult) {
      return { stage: next, result: revealResult, changedCellIndices: [...changed] };
    }
  }

  return { stage: next, result: { status: 'alive', message: 'auto-opened' }, changedCellIndices: [...changed] };
};
