// A mino dropping down the field. Pure logic, no Phaser.
import { P } from '../params';
import { canPlace, type Grid, type Piece } from './board';
import { feetY, type Player } from './player';

export interface FallResult {
    piece: Piece;
    /** Row the piece was fixed at, or null while it is still falling. */
    lockedRow: number | null;
    crushed: boolean;
}

/** True when any cell of the piece overlaps the player's rectangle (touching edges do not count). */
export const pieceCrushesPlayer = (piece: Piece, pl: Player): boolean =>
    piece.cells.some(({ c, r }) => {
        const left = piece.col + c;
        const top = piece.y + r;
        return pl.x < left + 1 && pl.x + P.PLAYER_W > left && pl.y < top + 1 && feetY(pl) > top;
    });

/**
 * Drops the piece by DROP_SPEED * dt in sub-steps of at most SUBSTEP_MAX cells, so it can't tunnel.
 * The crush test runs at every sub-step and at the clamped landing position; a crush wins over a lock.
 */
export const stepPiece = (grid: Grid, piece: Piece, dt: number, player: Player): FallResult => {
    let y = piece.y;
    let remaining = P.DROP_SPEED * dt;
    for (;;) {
        const base = Math.floor(y);
        if (!canPlace(grid, piece.cells, piece.col, base + 1)) {
            return settle(piece, base, player);
        }
        const step = Math.min(remaining, P.SUBSTEP_MAX);
        const newY = y + step;
        const newBase = Math.floor(newY);
        if (newBase > base && !canPlace(grid, piece.cells, piece.col, newBase + 1)) {
            return settle(piece, newBase, player);
        }
        y = newY;
        remaining -= step;
        const moved = { ...piece, y };
        if (pieceCrushesPlayer(moved, player)) return { piece: moved, lockedRow: null, crushed: true };
        if (remaining <= 1e-9) return { piece: moved, lockedRow: null, crushed: false };
    }
};

/** Clamp the piece to its landing row and decide: crushed there, or fixed. */
const settle = (piece: Piece, row: number, player: Player): FallResult => {
    const landed = { ...piece, y: row };
    if (pieceCrushesPlayer(landed, player)) return { piece: landed, lockedRow: null, crushed: true };
    return { piece: landed, lockedRow: row, crushed: false };
};
