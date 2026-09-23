import type { GamePhase } from './types';

/** reveal -> placement, triggered by the "はじめる" button. No-op otherwise. */
export function beginPlacement(phase: GamePhase): GamePhase {
    return phase === 'reveal' ? 'placement' : phase;
}

/** placement -> scoring, triggered by the "採点する" button. No-op otherwise. */
export function beginScoring(phase: GamePhase): GamePhase {
    return phase === 'placement' ? 'scoring' : phase;
}
