import { cloneStage, inBounds, indexOf, neighbors8, revealZeros } from './board';
import type { MoveResult, Position, Stage } from './types';

const eqPos = (a: Position, b: Position): boolean => a.x === b.x && a.y === b.y;

const revealCellWithoutMoving = (stage: Stage, pos: Position): MoveResult | null => {
  const cell = stage.cells[indexOf(stage, pos)];

  if (cell.flagged || cell.revealed) {
    return null;
  }

  if (cell.hasBomb) {
    return { status: 'dead', message: 'bomb-without-flag' };
  }

  cell.revealed = true;
  if (cell.hint === 0) {
    revealZeros(stage, pos);
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

const revealGuaranteedSafeAroundFlag = (stage: Stage, center: Position): MoveResult | null => {
  let openedAny = false;

  while (true) {
    const guaranteedSafe = collectGuaranteedSafeNeighbors(stage, center);
    let openedThisPass = false;

    for (const pos of guaranteedSafe) {
      const revealResult = revealCellWithoutMoving(stage, pos);
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

  const next = cloneStage(stage);
  const cell = next.cells[indexOf(next, pos)];
  if (cell.revealed) {
    return next;
  }
  cell.flagged = !cell.flagged;

  return next;
};

export const movePlayer = (stage: Stage, pos: Position): { stage: Stage; result: MoveResult } => {
  if (!inBounds(stage, pos)) {
    return { stage, result: { status: 'alive', message: 'out-of-bounds' } };
  }

  const next = cloneStage(stage);
  const cell = next.cells[indexOf(next, pos)];

  next.player = { ...pos };

  if (cell.hasBomb && !cell.flagged) {
    return { stage: next, result: { status: 'dead', message: 'bomb-without-flag' } };
  }

  if (!cell.hasBomb && cell.flagged) {
    return { stage: next, result: { status: 'dead', message: 'false-flag' } };
  }

  if (!cell.hasBomb) {
    cell.revealed = true;
    if (cell.hint === 0) {
      revealZeros(next, pos);
    }
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
): { stage: Stage; result: MoveResult } => {
  return movePlayer(stage, { x: stage.player.x + dx, y: stage.player.y + dy });
};

export const chordAtPlayer = (stage: Stage): { stage: Stage; result: MoveResult } => {
  const center = stage.player;
  const centerCell = stage.cells[indexOf(stage, center)];

  if (centerCell.flagged) {
    const next = cloneStage(stage);
    const revealResult = revealGuaranteedSafeAroundFlag(next, center);

    return { stage: next, result: revealResult ?? { status: 'alive', message: 'not-enough-info' } };
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

  if (flaggedCount < centerCell.hint) {
    const unresolved = neighbors.filter((n) => {
      const c = next.cells[indexOf(next, n)];
      return !c.flagged && !c.revealed;
    });
    const bombsNeeded = centerCell.hint - flaggedCount;
    if (unresolved.length === bombsNeeded) {
      for (const n of unresolved) {
        next.cells[indexOf(next, n)].flagged = true;
      }
      return { stage: next, result: { status: 'alive', message: 'auto-flagged' } };
    }
    return { stage: next, result: { status: 'alive', message: 'not-enough-info' } };
  }

  for (const n of neighbors) {
    const revealResult = revealCellWithoutMoving(next, n);
    if (revealResult) {
      return { stage: next, result: revealResult };
    }
  }

  return { stage: next, result: { status: 'alive', message: 'auto-opened' } };
};
