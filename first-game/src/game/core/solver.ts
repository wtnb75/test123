import { indexOf, neighbors8 } from './board';
import type { SolvabilityResult, Stage } from './types';

const keyOf = (idx: number): string => `${idx}`;

export const analyzeSolvability = (stage: Stage): SolvabilityResult => {
  const knownBomb = new Set<string>();
  const knownSafe = new Set<string>();

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
          if (knownBomb.has(keyOf(idx))) {
            bombKnown += 1;
          } else if (!knownSafe.has(keyOf(idx))) {
            undecided.push(idx);
          }
        }

        const bombsNeeded = cell.hint - bombKnown;
        if (bombsNeeded < 0) {
          continue;
        }

        if (bombsNeeded === 0) {
          for (const idx of undecided) {
            const key = keyOf(idx);
            if (!knownSafe.has(key)) {
              knownSafe.add(key);
              changed = true;
            }
          }
        }

        if (bombsNeeded === undecided.length) {
          for (const idx of undecided) {
            const key = keyOf(idx);
            if (!knownBomb.has(key)) {
              knownBomb.add(key);
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
