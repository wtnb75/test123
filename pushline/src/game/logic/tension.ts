import { PARAMS } from '../params';

/** How alarming the remaining moves are: drives the red pulse of the moves counter and the screen edge. */
export type Tension = 'none' | 'warn' | 'critical';

export function tensionOf(moves: number): Tension {
    if (moves <= PARAMS.lowMovesCritical) return 'critical';
    if (moves <= PARAMS.lowMovesWarn) return 'warn';
    return 'none';
}
