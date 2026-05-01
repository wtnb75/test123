import { indexOf, neighbors8 } from './board';
import type { SolvabilityResult, Stage } from './types';

export type LogicalAnalysis = {
  knownBombs: Set<number>;
  knownSafe: Set<number>;
};

export const analyzeSolvability = (stage: Stage): SolvabilityResult => {
  const knownBomb = new Set<number>();
  const knownSafe = new Set<number>();

  let changed = true;
  let depth = 0;

  while (changed) {
    changed = false;
    depth += 1;

    for (let y = 0; y < stage.height; y += 1) {
      for (let x = 0; x < stage.width; x += 1) {
        const pos = { x, y };
        const cell = stage.cells[indexOf(stage, pos)];
        if (cell.hasBomb) {
          continue;
        }

        const neighbors = neighbors8(stage, pos);
        let bombKnown = 0;
        const undecided: number[] = [];

        for (const n of neighbors) {
          const idx = indexOf(stage, n);
          if (knownBomb.has(idx)) {
            bombKnown += 1;
          } else if (!knownSafe.has(idx)) {
            undecided.push(idx);
          }
        }

        const bombsNeeded = cell.hint - bombKnown;
        if (bombsNeeded < 0) {
          continue;
        }

        if (bombsNeeded === 0) {
          for (const idx of undecided) {
            if (!knownSafe.has(idx)) {
              knownSafe.add(idx);
              changed = true;
            }
          }
        }

        if (bombsNeeded === undecided.length) {
          for (const idx of undecided) {
            if (!knownBomb.has(idx)) {
              knownBomb.add(idx);
              changed = true;
            }
          }
        }
      }
    }

    if (depth > stage.width * stage.height) {
      break;
    }
  }

  let totalBombs = 0;
  for (const cell of stage.cells) {
    if (cell.hasBomb) {
      totalBombs += 1;
    }
  }

  return {
    solvable: knownBomb.size === totalBombs,
    depth: Math.max(1, depth - 1),
    decidedBombs: knownBomb.size
  };
};

/**
 * 現在のゲーム状態（開示済みマスのヒントのみ）から、論理的に確定できるマスを返す。
 * ゲームオーバー時のヒント表示などに使用する。
 */
export const analyzeCurrentState = (stage: Stage): LogicalAnalysis => {
  const knownBomb = new Set<number>();
  const knownSafe = new Set<number>();

  let changed = true;
  let iterations = 0;

  while (changed) {
    changed = false;
    iterations += 1;

    for (let y = 0; y < stage.height; y += 1) {
      for (let x = 0; x < stage.width; x += 1) {
        const pos = { x, y };
        const cell = stage.cells[indexOf(stage, pos)];

        // 開示済みかつ非爆弾マスのヒントのみを制約として使用する
        if (!cell.revealed || cell.hasBomb) {
          continue;
        }

        const neighbors = neighbors8(stage, pos);
        let bombKnown = 0;
        const undecided: number[] = [];

        for (const n of neighbors) {
          const nIdx = indexOf(stage, n);
          const nCell = stage.cells[nIdx];

          if (nCell.revealed && !nCell.hasBomb) {
            // 開示済み安全マス → スキップ
          } else if (knownBomb.has(nIdx)) {
            bombKnown += 1;
          } else if (knownSafe.has(nIdx)) {
            // 既に安全確定 → スキップ
          } else {
            undecided.push(nIdx);
          }
        }

        const bombsNeeded = cell.hint - bombKnown;
        if (bombsNeeded < 0) {
          continue;
        }

        if (bombsNeeded === 0) {
          for (const nIdx of undecided) {
            if (!knownSafe.has(nIdx)) {
              knownSafe.add(nIdx);
              changed = true;
            }
          }
        }

        if (bombsNeeded === undecided.length && bombsNeeded > 0) {
          for (const nIdx of undecided) {
            if (!knownBomb.has(nIdx)) {
              knownBomb.add(nIdx);
              changed = true;
            }
          }
        }
      }
    }

    if (iterations > stage.width * stage.height) {
      break;
    }
  }

  return { knownBombs: knownBomb, knownSafe: knownSafe };
};
