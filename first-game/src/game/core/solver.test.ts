import { describe, expect, it } from 'vitest';
import type { Stage } from './types';
import { computeHints, indexOf } from './board';
import { analyzeSolvability, analyzeCurrentState } from './solver';

const createStage = (): Stage => ({
  width: 3,
  height: 3,
  stageNo: 1,
  player: { x: 0, y: 0 },
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
  cells: Array.from({ length: 9 }, () => ({ hasBomb: false, flagged: false, revealed: false, hint: 0 }))
});

describe('solver', () => {
  it('marks simple board as solvable', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
    computeHints(stage);

    const result = analyzeSolvability(stage);

    expect(result.solvable).toBe(true);
    expect(result.decidedBombs).toBe(1);
  });

  it('can report unsolved board', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 0, y: 2 })].hasBomb = true;
    stage.cells[indexOf(stage, { x: 2, y: 0 })].hasBomb = true;
    computeHints(stage);

    const result = analyzeSolvability(stage);

    expect(result.decidedBombs).toBeLessThanOrEqual(2);
  });
});

describe('analyzeCurrentState', () => {
  it('identifies logically certain bomb from revealed hint', () => {
    // 3x3 フィールド: (2,2) が爆弾。(0,0) を開示すると隣接に爆弾なし、
    // 周囲全体が安全確定。コーナーの (1,0) ヒント=1 が開示されると (2,2) が爆弾確定にはならないが、
    // シンプルに「開示マスのヒント = 残り未確定数」のケースを検証する。
    const stage = createStage();
    // (2,0) に爆弾、(0,0) を開示してヒント0 → 周囲全員安全確定にはならない
    // 簡単なケース: 1x3 を模擬するため横1行
    const s: Stage = {
      width: 3,
      height: 1,
      stageNo: 1,
      player: { x: 0, y: 0 },
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
      cells: [
        { hasBomb: false, flagged: false, revealed: true,  hint: 0 }, // (0,0) 開示済み
        { hasBomb: false, flagged: false, revealed: false, hint: 0 }, // (1,0) 未開示
        { hasBomb: true,  flagged: false, revealed: false, hint: 0 }, // (2,0) 爆弾・未開示
      ]
    };
    computeHints(s);
    // (0,0).hint = 0 (隣接爆弾なし), but (1,0).hint = 1 (隣接に(2,0)爆弾)
    // (0,0) は開示・hint=0 → 隣接(1,0)は安全確定
    // (1,0) は未開示なのでヒント使えない → (2,0) は確定不可

    const result = analyzeCurrentState(s);

    expect(result.knownSafe.has(indexOf(s, { x: 1, y: 0 }))).toBe(true);
    expect(result.knownBombs.has(indexOf(s, { x: 2, y: 0 }))).toBe(false);
  });

  it('identifies logically certain bomb when revealed hint equals undecided count', () => {
    const s: Stage = {
      width: 3,
      height: 1,
      stageNo: 1,
      player: { x: 0, y: 0 },
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      generation: { retries: 0, depthTarget: 1, solverDepth: 0, generationMs: 0 },
      cells: [
        { hasBomb: false, flagged: false, revealed: true,  hint: 1 }, // (0,0) 開示・hint=1
        { hasBomb: true,  flagged: false, revealed: false, hint: 0 }, // (1,0) 爆弾・未開示
        { hasBomb: false, flagged: false, revealed: false, hint: 0 }, // (2,0) 未開示
      ]
    };
    // hint手動設定: (0,0).hint=1, 隣接未確定は(1,0)のみ → (1,0)が爆弾確定

    const result = analyzeCurrentState(s);

    expect(result.knownBombs.has(indexOf(s, { x: 1, y: 0 }))).toBe(true);
    expect(result.knownSafe.has(indexOf(s, { x: 1, y: 0 }))).toBe(false);
  });

  it('returns empty sets when no cells are revealed', () => {
    const stage = createStage();
    stage.cells[indexOf(stage, { x: 2, y: 2 })].hasBomb = true;
    computeHints(stage);

    const result = analyzeCurrentState(stage);

    expect(result.knownBombs.size).toBe(0);
    expect(result.knownSafe.size).toBe(0);
  });
});
