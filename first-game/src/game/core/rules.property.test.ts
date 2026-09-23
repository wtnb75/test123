import { describe, expect, it } from 'vitest';
import { computeHints } from './board';
import { createRng, type Rng } from './random';
import { chordAtPlayer, moveByDelta, movePlayer, toggleFlag } from './rules';
import type { Position, Stage } from './types';

// Property tests over many seeded random boards. The rules are checked against declarative
// statements about the result (what changed, what must never happen) instead of re-running the
// same steps, plus the guarantee the game is built on: correct flags never get the player killed.

type FlagMode = 'correct-flags' | 'any-flags';

const SIZES: Array<[number, number]> = [
  [4, 4],
  [3, 5],
  [5, 3]
];
const BOARDS_PER_CASE = 1500;

const randomStage = (rng: Rng, width: number, height: number, mode: FlagMode): Stage => {
  const bombRate = 0.15 + rng() * 0.3;
  const revealRate = 0.2 + rng() * 0.5;
  const flagRate = 0.1 + rng() * 0.5;

  const cells = Array.from({ length: width * height }, () => {
    const hasBomb = rng() < bombRate;
    // Revealed cells are never bombs and never flagged, exactly as the rules guarantee.
    const revealed = !hasBomb && rng() < revealRate;
    const flaggable = !revealed && (mode === 'any-flags' || hasBomb);

    return { hasBomb, revealed, flagged: flaggable && rng() < flagRate, hint: 0 };
  });
  const pick = (): Position => ({ x: Math.floor(rng() * width), y: Math.floor(rng() * height) });

  const stage: Stage = {
    width,
    height,
    stageNo: 1,
    cells,
    player: pick(),
    start: pick(),
    goal: pick(),
    generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 }
  };
  computeHints(stage);
  closeOpenZeros(stage);

  return stage;
};

// Real play keeps this invariant (opening a zero always opens its unflagged neighbors), so the
// random boards must too; otherwise the flood-fill checks would be judged against impossible states.
const closeOpenZeros = (stage: Stage): void => {
  let changed = true;
  while (changed) {
    changed = false;
    stage.cells.forEach((cell, i) => {
      if (!cell.revealed || cell.hint !== 0) {
        return;
      }
      for (const n of neighborsOf(stage, { x: i % stage.width, y: Math.floor(i / stage.width) })) {
        const next = stage.cells[at(stage, n)];
        if (!next.revealed && !next.flagged && !next.hasBomb) {
          next.revealed = true;
          changed = true;
        }
      }
    });
  }
};

function* boards(mode: FlagMode): Generator<{ stage: Stage; label: string; rng: Rng }> {
  for (const [width, height] of SIZES) {
    const rng = createRng(width * 1000 + height * 10 + (mode === 'correct-flags' ? 1 : 2));
    for (let n = 0; n < BOARDS_PER_CASE; n += 1) {
      yield { stage: randomStage(rng, width, height, mode), label: `${mode} ${width}x${height} #${n}`, rng };
    }
  }
}

const at = (stage: Stage, pos: Position): number => pos.y * stage.width + pos.x;

const neighborsOf = (stage: Stage, pos: Position): Position[] => {
  const out: Position[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const n = { x: pos.x + dx, y: pos.y + dy };
      if ((dx !== 0 || dy !== 0) && n.x >= 0 && n.y >= 0 && n.x < stage.width && n.y < stage.height) {
        out.push(n);
      }
    }
  }

  return out;
};

const cellDiff = (before: Stage, after: Stage): number[] =>
  before.cells.flatMap((cell, i) =>
    cell.revealed !== after.cells[i].revealed || cell.flagged !== after.cells[i].flagged ? [i] : []
  );

const sorted = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);

// Facts every rule must keep: bombs and hints are static, the input is never mutated, the
// reported changed indices are exactly the cells whose revealed/flagged state differs.
const expectSaneOutput = (
  label: string,
  snapshot: Stage,
  input: Stage,
  out: { stage: Stage; changedCellIndices?: number[] }
): void => {
  expect(input, `${label} mutated its input`).toEqual(snapshot);
  expect(
    out.stage.cells.map((c) => [c.hasBomb, c.hint]),
    `${label} changed bombs or hints`
  ).toEqual(snapshot.cells.map((c) => [c.hasBomb, c.hint]));
  expect(sorted(out.changedCellIndices ?? []), `${label} changedCellIndices`).toEqual(cellDiff(snapshot, out.stage));
  expect(new Set(out.changedCellIndices).size, `${label} duplicate indices`).toBe(out.changedCellIndices?.length ?? 0);
};

describe('movePlayer properties', () => {
  it.each(['correct-flags', 'any-flags'] as const)('keeps its invariants and classifies every step (%s)', (mode) => {
    const seen = new Set<string>();

    for (const { stage, label, rng } of boards(mode)) {
      const snapshot = structuredClone(stage);
      const target = { x: Math.floor(rng() * (stage.width + 2)) - 1, y: Math.floor(rng() * (stage.height + 2)) - 1 };
      const inBounds = target.x >= 0 && target.y >= 0 && target.x < stage.width && target.y < stage.height;
      const out = movePlayer(stage, target);
      const where = `${label} -> (${target.x},${target.y})`;

      expectSaneOutput(where, snapshot, stage, out);

      if (!inBounds) {
        expect(out.result, where).toEqual({ status: 'alive', message: 'out-of-bounds' });
        expect(out.stage, where).toBe(stage);
        seen.add('out-of-bounds');
        continue;
      }

      const cell = snapshot.cells[at(snapshot, target)];
      expect(out.stage.player, where).toEqual(target);

      if (cell.hasBomb && !cell.flagged) {
        expect(out.result, where).toEqual({ status: 'dead', message: 'bomb-without-flag' });
        seen.add('bomb');
      } else if (!cell.hasBomb && cell.flagged) {
        expect(out.result, where).toEqual({ status: 'dead', message: 'false-flag' });
        seen.add('false-flag');
      } else {
        const atGoal = target.x === snapshot.goal.x && target.y === snapshot.goal.y;
        expect(out.result, where).toEqual({ status: atGoal ? 'goal' : 'alive' });
        seen.add(atGoal ? 'goal' : 'alive');
      }

      const newlyRevealed = cellDiff(snapshot, out.stage);
      if (cell.hasBomb || cell.flagged || cell.revealed) {
        // Stepping on a flagged bomb or an already open cell changes nothing on the board.
        expect(newlyRevealed, where).toEqual([]);
        continue;
      }

      seen.add('reveal');
      expect(out.stage.cells[at(snapshot, target)].revealed, `${where} target not revealed`).toBe(true);
      for (const i of newlyRevealed) {
        const opened = out.stage.cells[i];
        expect(opened.revealed && !snapshot.cells[i].revealed, `${where} cell ${i} was not newly revealed`).toBe(true);
        expect(opened.hasBomb || opened.flagged, `${where} opened a bomb or flagged cell ${i}`).toBe(false);
      }

      // The opened area is the zero-hint flood from the target: every safe, unflagged neighbor
      // of an opened zero is open, and every other opened cell touches an opened zero.
      const isOpen = (i: number): boolean => out.stage.cells[i].revealed;
      const openedZeros = [at(snapshot, target), ...newlyRevealed].filter(
        (i) => isOpen(i) && out.stage.cells[i].hint === 0 && (i === at(snapshot, target) || !snapshot.cells[i].revealed)
      );
      for (const zero of openedZeros) {
        const pos = { x: zero % stage.width, y: Math.floor(zero / stage.width) };
        for (const n of neighborsOf(stage, pos)) {
          const nCell = out.stage.cells[at(stage, n)];
          if (!nCell.hasBomb && !nCell.flagged) {
            expect(nCell.revealed, `${where} neighbor of opened zero ${zero} left closed`).toBe(true);
          }
        }
      }
      for (const i of newlyRevealed) {
        if (i === at(snapshot, target)) {
          continue;
        }
        const pos = { x: i % stage.width, y: Math.floor(i / stage.width) };
        const justified = neighborsOf(stage, pos).some((n) => openedZeros.includes(at(stage, n)));
        expect(justified, `${where} cell ${i} opened without an adjacent opened zero`).toBe(true);
      }
    }

    // Guard against a vacuous run: every outcome class must have been exercised.
    for (const kind of ['out-of-bounds', 'bomb', 'false-flag', 'goal', 'alive', 'reveal']) {
      if (kind === 'false-flag' && mode === 'correct-flags') {
        continue;
      }
      expect(seen.has(kind), `${mode} never produced ${kind}`).toBe(true);
    }
  });

  it('moveByDelta moves relative to the player and matches movePlayer', () => {
    for (const { stage, label, rng } of boards('any-flags')) {
      const dx = Math.floor(rng() * 5) - 2;
      const dy = Math.floor(rng() * 5) - 2;

      const viaDelta = moveByDelta(stage, dx, dy);
      const direct = movePlayer(stage, { x: stage.player.x + dx, y: stage.player.y + dy });

      expect(viaDelta, `${label} delta (${dx},${dy})`).toEqual(direct);
    }
  });
});

describe('toggleFlag properties', () => {
  it('flips exactly the chosen hidden cell and never mutates its input', () => {
    for (const { stage, label, rng } of boards('any-flags')) {
      const snapshot = structuredClone(stage);
      const pos = { x: Math.floor(rng() * (stage.width + 2)) - 1, y: Math.floor(rng() * (stage.height + 2)) - 1 };
      const inBounds = pos.x >= 0 && pos.y >= 0 && pos.x < stage.width && pos.y < stage.height;
      const next = toggleFlag(stage, pos);
      const where = `${label} @(${pos.x},${pos.y})`;

      expect(stage, `${where} mutated its input`).toEqual(snapshot);

      if (!inBounds || snapshot.cells[at(snapshot, pos)].revealed) {
        expect(next, where).toBe(stage);
        continue;
      }

      expect(cellDiff(snapshot, next), where).toEqual([at(snapshot, pos)]);
      expect(next.cells[at(snapshot, pos)].flagged, where).toBe(!snapshot.cells[at(snapshot, pos)].flagged);
      expect(toggleFlag(next, pos).cells, `${where} toggling twice`).toEqual(snapshot.cells);
    }
  });
});

describe('chordAtPlayer properties', () => {
  const chordKind = (stage: Stage): string => {
    const center = stage.cells[at(stage, stage.player)];
    if (center.flagged) {
      return 'from-flag';
    }
    if (!center.revealed || center.hint <= 0) {
      return 'chord-not-available';
    }

    const around = neighborsOf(stage, stage.player).map((n) => stage.cells[at(stage, n)]);
    const flagged = around.filter((c) => c.flagged).length;
    if (flagged > center.hint) {
      return 'flag-overflow';
    }
    if (flagged < center.hint) {
      const unresolved = around.filter((c) => !c.flagged && !c.revealed).length;
      return unresolved === center.hint - flagged ? 'auto-flagged' : 'not-enough-info';
    }

    return around.some((c) => c.hasBomb && !c.flagged) ? 'dead' : 'auto-opened';
  };

  it.each(['correct-flags', 'any-flags'] as const)('matches the documented behavior for every case (%s)', (mode) => {
    const seen = new Set<string>();

    for (const { stage, label } of boards(mode)) {
      const snapshot = structuredClone(stage);
      const out = chordAtPlayer(stage);
      const kind = chordKind(snapshot);
      const where = `${label} player=(${stage.player.x},${stage.player.y}) ${kind}`;

      expectSaneOutput(where, snapshot, stage, out);
      expect(out.stage.player, `${where} moved the player`).toEqual(snapshot.player);
      seen.add(kind);

      const unchanged = { stage: out.stage === stage, indices: cellDiff(snapshot, out.stage).length === 0 };
      switch (kind) {
        case 'chord-not-available':
        case 'flag-overflow':
        case 'not-enough-info':
          expect(out.result, where).toEqual({ status: 'alive', message: kind });
          expect(unchanged, where).toEqual({ stage: true, indices: true });
          break;
        case 'auto-flagged': {
          expect(out.result, where).toEqual({ status: 'alive', message: 'auto-flagged' });
          // Only hidden, unflagged neighbors of the center get flagged; nothing gets revealed.
          const center = stage.player;
          const newlyFlagged = cellDiff(snapshot, out.stage);
          const around = neighborsOf(stage, center).map((n) => at(stage, n));
          expect(newlyFlagged.every((i) => around.includes(i) && out.stage.cells[i].flagged), where).toBe(true);
          expect(newlyFlagged.some((i) => out.stage.cells[i].revealed), where).toBe(false);
          if (mode === 'correct-flags') {
            expect(newlyFlagged.every((i) => snapshot.cells[i].hasBomb), `${where} flagged a safe cell`).toBe(true);
          }
          break;
        }
        case 'dead':
          expect(out.result, where).toEqual({ status: 'dead', message: 'bomb-without-flag' });
          break;
        case 'auto-opened':
          expect(out.result, where).toEqual({ status: 'alive', message: 'auto-opened' });
          // Flags match the hint and none is wrong, so every hidden unflagged neighbor gets opened.
          for (const n of neighborsOf(stage, stage.player)) {
            const before = snapshot.cells[at(stage, n)];
            if (!before.flagged && !before.revealed) {
              expect(out.stage.cells[at(stage, n)].revealed, `${where} neighbor (${n.x},${n.y}) left closed`).toBe(true);
            }
          }
          break;
        default:
          // Chord from a flagged tile: either it opens something, has no info, or hits a bomb.
          expect(['auto-opened', 'not-enough-info', 'bomb-without-flag'], where).toContain(out.result.message);
          expect(out.result.status, where).toBe(out.result.message === 'bomb-without-flag' ? 'dead' : 'alive');
          if (out.result.message === 'not-enough-info') {
            expect(unchanged, where).toEqual({ stage: true, indices: true });
          }
          if (out.result.message === 'auto-opened') {
            expect(cellDiff(snapshot, out.stage).length, `${where} reported opening but changed nothing`).toBeGreaterThan(0);
          }
      }

      // Nothing the chord newly opens is flagged or a bomb, and every opened cell is either next
      // to the player or is part of a zero cascade (adjacent to a newly opened zero).
      const newlyOpened = cellDiff(snapshot, out.stage).filter((i) => out.stage.cells[i].revealed);
      const nextToPlayer = neighborsOf(stage, stage.player).map((n) => at(stage, n));
      const openedZeros = newlyOpened.filter((i) => out.stage.cells[i].hint === 0);
      for (const i of newlyOpened) {
        const cell = out.stage.cells[i];
        expect(cell.flagged, `${where} opened flagged cell ${i}`).toBe(false);
        expect(cell.hasBomb, `${where} opened bomb ${i}`).toBe(false);

        const pos = { x: i % stage.width, y: Math.floor(i / stage.width) };
        const inCascade = neighborsOf(stage, pos).some((n) => openedZeros.includes(at(stage, n)));
        expect(nextToPlayer.includes(i) || inCascade, `${where} cell ${i} opened without a reason`).toBe(true);

        // Standing on a flag, a neighbor may only be opened directly because some revealed clue
        // next to the player has exactly as many flags around it as its hint.
        if (kind === 'from-flag' && !inCascade) {
          const flagsAround = (n: Position): number =>
            neighborsOf(stage, n).filter((m) => snapshot.cells[at(stage, m)].flagged).length;
          const backedByClue = neighborsOf(stage, stage.player).some((clue) => {
            const clueCell = out.stage.cells[at(stage, clue)];
            const adjacent = Math.max(Math.abs(clue.x - pos.x), Math.abs(clue.y - pos.y)) === 1;

            return adjacent && clueCell.revealed && clueCell.hint > 0 && flagsAround(clue) === clueCell.hint;
          });
          expect(backedByClue, `${where} cell ${i} opened without a matching clue`).toBe(true);
        }
      }
    }

    for (const kind of ['chord-not-available', 'flag-overflow', 'auto-flagged', 'not-enough-info', 'auto-opened', 'from-flag']) {
      // With only correct flags the flag count can never exceed the hint.
      if (kind === 'flag-overflow' && mode === 'correct-flags') {
        expect(seen.has(kind), 'correct flags cannot overflow the hint').toBe(false);
        continue;
      }
      expect(seen.has(kind), `${mode} never produced ${kind}`).toBe(true);
    }
  });

  it('never kills the player when every flag is correct', () => {
    let opened = 0;

    for (const { stage, label } of boards('correct-flags')) {
      const out = chordAtPlayer(stage);

      expect(out.result.status, `${label} died with only correct flags`).toBe('alive');
      opened += out.result.message === 'auto-opened' ? 1 : 0;
    }

    expect(opened).toBeGreaterThan(0);
  });

  it('kills the player when the flag count matches but a flag is wrong', () => {
    let deaths = 0;

    for (const { stage, label } of boards('any-flags')) {
      const center = stage.cells[at(stage, stage.player)];
      if (center.flagged || !center.revealed || center.hint <= 0) {
        continue;
      }
      const around = neighborsOf(stage, stage.player).map((n) => stage.cells[at(stage, n)]);
      const flagged = around.filter((c) => c.flagged);
      if (flagged.length !== center.hint || flagged.every((c) => c.hasBomb)) {
        continue;
      }

      // A wrong flag means at least one real bomb around the center is left unflagged.
      expect(chordAtPlayer(stage).result, label).toEqual({ status: 'dead', message: 'bomb-without-flag' });
      deaths += 1;
    }

    expect(deaths).toBeGreaterThan(0);
  });
});
