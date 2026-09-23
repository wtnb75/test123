import { describe, expect, it } from 'vitest';
import { computeHints, createRandomStage } from './board';
import { createRng } from './random';
import { analyzeCurrentState, analyzeSolvability } from './solver';
import type { Stage } from './types';

// The solver only applies simple single-hint rules. These tests check them against a brute-force
// oracle that enumerates every bomb layout of a small board, so a deduction is only accepted if
// it holds in *all* layouts that are consistent with what the player can see.

class Oracle {
  readonly cells: number;
  private readonly counts: Uint8Array;
  private readonly neighbors: number[][];

  constructor(width: number, height: number) {
    this.cells = width * height;
    this.neighbors = Array.from({ length: this.cells }, (_, cell) => {
      const x = cell % width;
      const y = Math.floor(cell / width);
      const out: number[] = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if ((dx !== 0 || dy !== 0) && nx >= 0 && nx < width && ny >= 0 && ny < height) {
            out.push(ny * width + nx);
          }
        }
      }
      return out;
    });

    // counts[layout * cells + cell] = number of bombs around `cell` in that layout.
    this.counts = new Uint8Array((1 << this.cells) * this.cells);
    for (let layout = 0; layout < 1 << this.cells; layout += 1) {
      for (let cell = 0; cell < this.cells; cell += 1) {
        this.counts[layout * this.cells + cell] = this.neighbors[cell].filter((n) => (layout >> n) & 1).length;
      }
    }
  }

  neighborsOf(cell: number): number[] {
    return this.neighbors[cell];
  }

  hint(layout: number, cell: number): number {
    return this.counts[layout * this.cells + cell];
  }

  // Layouts in which every revealed cell is safe and shows the same hint as in `truth`.
  consistent(truth: number, revealed: number[]): number[] {
    const out: number[] = [];
    for (let layout = 0; layout < 1 << this.cells; layout += 1) {
      if (revealed.every((cell) => ((layout >> cell) & 1) === 0 && this.hint(layout, cell) === this.hint(truth, cell))) {
        out.push(layout);
      }
    }
    return out;
  }

  certain(layouts: number[]): { bombs: boolean[]; safe: boolean[] } {
    const bombs: boolean[] = [];
    const safe: boolean[] = [];
    for (let cell = 0; cell < this.cells; cell += 1) {
      bombs.push(layouts.every((layout) => (layout >> cell) & 1));
      safe.push(layouts.every((layout) => ((layout >> cell) & 1) === 0));
    }
    return { bombs, safe };
  }
}

const oracles = new Map<string, Oracle>();
const oracleFor = (width: number, height: number): Oracle => {
  const key = `${width}x${height}`;
  if (!oracles.has(key)) {
    oracles.set(key, new Oracle(width, height));
  }
  return oracles.get(key)!;
};

const HIDDEN = 0;
const BOMB = 1;
const REVEALED = 2;

const buildStage = (width: number, height: number, states: number[]): Stage => {
  const stage: Stage = {
    width,
    height,
    stageNo: 1,
    player: { x: 0, y: 0 },
    start: { x: 0, y: 0 },
    goal: { x: width - 1, y: height - 1 },
    generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
    cells: states.map((state) => ({ hasBomb: state === BOMB, flagged: false, revealed: state === REVEALED, hint: 0 }))
  };
  computeHints(stage);

  return stage;
};

const layoutOf = (states: number[]): number =>
  states.reduce((mask, state, cell) => (state === BOMB ? mask | (1 << cell) : mask), 0);

const describeStates = (width: number, states: number[]): string => {
  const glyph = ['.', '*', 'o'];
  const rows: string[] = [];
  for (let i = 0; i < states.length; i += width) {
    rows.push(states.slice(i, i + width).map((s) => glyph[s]).join(''));
  }

  return rows.join('/');
};

type Board = { width: number; height: number; states: number[] };

// Every assignment of {hidden safe, bomb, revealed safe} to the cells of a small board.
function* allBoards(width: number, height: number): Generator<Board> {
  const cells = width * height;
  for (let code = 0; code < 3 ** cells; code += 1) {
    const states: number[] = [];
    let rest = code;
    for (let i = 0; i < cells; i += 1) {
      states.push(rest % 3);
      rest = Math.floor(rest / 3);
    }
    yield { width, height, states };
  }
}

function* randomBoards(width: number, height: number, count: number, seed: number): Generator<Board> {
  const rng = createRng(seed);
  for (let n = 0; n < count; n += 1) {
    const bombRate = 0.1 + rng() * 0.3;
    const revealRate = 0.2 + rng() * 0.6;
    const states = Array.from({ length: width * height }, () => {
      if (rng() < bombRate) {
        return BOMB;
      }

      return rng() < revealRate ? REVEALED : HIDDEN;
    });
    yield { width, height, states };
  }
}

const checkCurrentState = ({ width, height, states }: Board): { deducedSomething: boolean } => {
  const oracle = oracleFor(width, height);
  const stage = buildStage(width, height, states);
  const truth = layoutOf(states);
  const revealed = states.flatMap((state, cell) => (state === REVEALED ? [cell] : []));
  const certain = oracle.certain(oracle.consistent(truth, revealed));
  const { knownBombs, knownSafe } = analyzeCurrentState(stage);
  const where = describeStates(width, states);

  for (const cell of knownBombs) {
    if (!certain.bombs[cell]) {
      expect.fail(`${where}: cell ${cell} reported as a bomb but is not certain`);
    }
  }
  for (const cell of knownSafe) {
    if (!certain.safe[cell]) {
      expect.fail(`${where}: cell ${cell} reported as safe but is not certain`);
    }
  }

  // Documented single-hint rules must always fire.
  for (const cell of revealed) {
    const hidden = oracle.neighborsOf(cell).filter((n) => states[n] !== REVEALED);
    const hint = oracle.hint(truth, cell);
    if (hint === 0 && !hidden.every((n) => knownSafe.has(n))) {
      expect.fail(`${where}: neighbors of zero-hint cell ${cell} should be safe`);
    }
    if (hint > 0 && hint === hidden.length && !hidden.every((n) => knownBombs.has(n))) {
      expect.fail(`${where}: all hidden neighbors of cell ${cell} should be bombs`);
    }
  }

  return { deducedSomething: knownBombs.size > 0 || knownSafe.size > 0 };
};

describe('analyzeCurrentState against a brute-force oracle', () => {
  it.each([
    [3, 3],
    [2, 4],
    [1, 7]
  ])('never reports an uncertain cell on any %ix%i board state', (width, height) => {
    let deduced = 0;

    for (const board of allBoards(width, height)) {
      if (checkCurrentState(board).deducedSomething) {
        deduced += 1;
      }
    }

    expect(deduced).toBeGreaterThan(0);
  });

  it.each([
    [4, 3],
    [4, 4]
  ])('never reports an uncertain cell on random %ix%i board states', (width, height) => {
    let deduced = 0;

    for (const board of randomBoards(width, height, 300, width * 100 + height)) {
      if (checkCurrentState(board).deducedSomething) {
        deduced += 1;
      }
    }

    expect(deduced).toBeGreaterThan(0);
  });

  it('ignores revealed bombs instead of treating them as safe neighbors', () => {
    // A revealed bomb (after game over) must not count as a revealed safe cell nor give a hint.
    const stage = buildStage(3, 1, [REVEALED, BOMB, HIDDEN]);
    stage.cells[1].revealed = true;

    const { knownBombs, knownSafe } = analyzeCurrentState(stage);

    expect(knownBombs.has(1)).toBe(true);
    expect(knownSafe.has(1)).toBe(false);
  });
});

// The oracle player: reveal everything that is certain given the numbers seen so far, repeatedly.
const perfectPlay = (oracle: Oracle, stage: Stage): { certainBombs: number } => {
  const truth = stage.cells.reduce((mask, cell, i) => (cell.hasBomb ? mask | (1 << i) : mask), 0);
  const revealed = new Set<number>();
  const queue = [stage.start.y * stage.width + stage.start.x];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (revealed.has(cell)) {
      continue;
    }
    revealed.add(cell);
    if (oracle.hint(truth, cell) === 0) {
      queue.push(...oracle.neighborsOf(cell));
    }
  }

  for (;;) {
    const layouts = oracle.consistent(truth, [...revealed]);
    const certain = oracle.certain(layouts);
    const next = certain.safe.flatMap((isSafe, cell) => (isSafe && !revealed.has(cell) ? [cell] : []));
    if (next.length === 0) {
      return { certainBombs: certain.bombs.filter(Boolean).length };
    }
    next.forEach((cell) => revealed.add(cell));
  }
};

// `solvable` means "every bomb can be identified by logic". It does not mean the whole board is
// determined: a safe cell that touches no revealed number stays unknowable and does not matter.
describe('analyzeSolvability against a perfect-logic oracle', () => {
  it.each([
    [4, 4],
    [5, 3]
  ])('never claims more than perfect play can deduce on random %ix%i stages', (width, height) => {
    const oracle = oracleFor(width, height);
    let localSolvable = 0;

    for (let seed = 1; seed <= 120; seed += 1) {
      const bombCount = 2 + (seed % 5);
      const stage = createRandomStage({ width, height, bombCount, stageNo: 1, depthTarget: 1 }, createRng(seed));
      const totalBombs = stage.cells.filter((cell) => cell.hasBomb).length;

      const local = analyzeSolvability(stage);
      const perfect = perfectPlay(oracle, stage);
      const where = `seed=${seed} ${width}x${height} bombs=${totalBombs}`;

      if (local.depth < 1 || local.decidedBombs > totalBombs) {
        expect.fail(`${where}: implausible result ${JSON.stringify(local)}`);
      }
      if (local.decidedBombs > perfect.certainBombs) {
        expect.fail(`${where}: decided ${local.decidedBombs} bombs but only ${perfect.certainBombs} are certain`);
      }
      if (local.solvable) {
        localSolvable += 1;
        if (perfect.certainBombs !== totalBombs) {
          expect.fail(`${where}: claims solvable but only ${perfect.certainBombs}/${totalBombs} bombs are certain`);
        }
      }
    }

    expect(localSolvable).toBeGreaterThan(0);
  });
});

describe('analyzeSolvability semantics', () => {
  // Row 0 and row 1 are open; the bombs in rows 2-3 are all pinned down by the numbers above them,
  // but the bottom-right cell touches no revealed cell.
  const bottomRightStates = (bombAtBottomRight: boolean): number[] => {
    const states = Array.from({ length: 16 }, () => HIDDEN);
    for (const cell of [10, 11, 12, 13, 14]) {
      states[cell] = BOMB;
    }
    states[15] = bombAtBottomRight ? BOMB : HIDDEN;

    return states;
  };

  it('counts a board as solvable when every bomb is deduced, even if a safe cell stays unknowable', () => {
    const stage = buildStage(4, 4, bottomRightStates(false));
    stage.start = { x: 0, y: 1 };

    expect(analyzeSolvability(stage)).toMatchObject({ solvable: true, decidedBombs: 5 });
  });

  it('is not solvable when a bomb touches no revealed number', () => {
    const stage = buildStage(4, 4, bottomRightStates(true));
    stage.start = { x: 0, y: 1 };

    expect(analyzeSolvability(stage)).toMatchObject({ solvable: false, decidedBombs: 5 });
  });
});

describe('createRandomStage invariants', () => {
  it.each([
    [8, 8, 12],
    [12, 12, 25],
    [6, 10, 30]
  ])('produces consistent hints and a correct opening on %ix%i boards with %i bombs', (width, height, bombCount) => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const stage = createRandomStage({ width, height, bombCount, stageNo: 1, depthTarget: 1 }, createRng(seed));
      const bombAt = (x: number, y: number): boolean =>
        x >= 0 && y >= 0 && x < width && y < height && stage.cells[y * width + x].hasBomb;

      stage.cells.forEach((cell, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        let around = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if ((dx !== 0 || dy !== 0) && bombAt(x + dx, y + dy)) {
              around += 1;
            }
          }
        }

        const label = `seed=${seed} cell=(${x},${y})`;
        expect(cell.hint, label).toBe(cell.hasBomb ? -1 : around);
        expect(cell.revealed && cell.hasBomb, `${label} revealed bomb`).toBe(false);
        // Nothing is opened except the start and cells touching a revealed zero.
        if (cell.revealed && !(x === stage.start.x && y === stage.start.y)) {
          let touchesRevealedZero = false;
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              const inside = nx >= 0 && ny >= 0 && nx < width && ny < height;
              if (inside && stage.cells[ny * width + nx].revealed && stage.cells[ny * width + nx].hint === 0) {
                touchesRevealedZero = true;
              }
            }
          }
          expect(touchesRevealedZero, `${label} opened without a neighboring zero`).toBe(true);
        }
        // A revealed zero must have opened all of its neighbors.
        if (cell.revealed && cell.hint === 0) {
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
                expect(stage.cells[ny * width + nx].revealed, `${label} zero neighbor (${nx},${ny})`).toBe(true);
              }
            }
          }
        }
      });

      expect(stage.cells[stage.start.y * width + stage.start.x].revealed).toBe(true);
      expect(stage.start).not.toEqual(stage.goal);
    }
  });
});
