// The climber: movement, jumping and collision against the grid. Pure logic, no Phaser.
import { P } from '../params';
import { isSolid, type Grid } from './board';

export interface Player {
    /** Top-left corner, in cells. */
    x: number;
    y: number;
    vy: number;
    onGround: boolean;
}

export interface MoveInput {
    left: boolean;
    right: boolean;
    jump: boolean;
}

/** Keeps a snapped player strictly outside the solid cell it rests against. */
const EPS = 1e-6;

export const createPlayer = (): Player => ({
    x: P.COLS / 2 - P.PLAYER_W / 2,
    y: P.ROWS - P.PLAYER_H - EPS,
    vy: 0,
    onGround: true,
});

const overlapsSolid = (grid: Grid, x: number, y: number): boolean => {
    const c0 = Math.floor(x);
    const c1 = Math.floor(x + P.PLAYER_W - EPS);
    const r0 = Math.floor(y);
    const r1 = Math.floor(y + P.PLAYER_H - EPS);
    for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
            if (isSolid(grid, c, r)) return true;
        }
    }
    return false;
};

const moveHorizontally = (grid: Grid, x: number, y: number, dx: number): number => {
    if (dx === 0) return x;
    const nx = x + dx;
    if (!overlapsSolid(grid, nx, y)) return nx;
    return dx > 0 ? Math.floor(nx + P.PLAYER_W) - P.PLAYER_W - EPS : Math.floor(nx) + 1 + EPS;
};

/** One physics step. `dt` is clamped to MAX_DT. Returns a new Player. */
export const stepPlayer = (grid: Grid, pl: Player, input: MoveInput, dtRaw: number): Player => {
    const dt = Math.min(dtRaw, P.MAX_DT);
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const x = moveHorizontally(grid, pl.x, pl.y, dir * P.WALK_SPEED * dt);

    let vy = pl.vy;
    if (input.jump && pl.onGround) vy = -P.JUMP_V;
    vy += P.GRAVITY * dt;

    // Move vertically in sub-steps so a fast fall can't tunnel through a one-cell floor.
    const sign = vy >= 0 ? 1 : -1;
    let remaining = Math.abs(vy * dt);
    let y = pl.y;
    let onGround = false;
    while (remaining > 0) {
        const step = Math.min(remaining, P.SUBSTEP_MAX);
        const ny = y + sign * step;
        if (overlapsSolid(grid, x, ny)) {
            if (sign > 0) {
                y = Math.floor(ny + P.PLAYER_H) - P.PLAYER_H - EPS;
                onGround = true;
            } else {
                y = Math.floor(ny) + 1 + EPS;
            }
            vy = 0;
            break;
        }
        y = ny;
        remaining -= step;
    }
    return { x, y, vy, onGround };
};

/** Foot position (bottom edge) in rows. */
export const feetY = (pl: Player): number => pl.y + P.PLAYER_H;

export const reachedGoal = (pl: Player): boolean => feetY(pl) <= P.GOAL_ROW + P.GOAL_TOL;

/** HUD height n: 0 on the floor, ROWS - GOAL_ROW exactly when the goal is reached. */
export const heightOf = (pl: Player): number =>
    Math.max(0, Math.floor(P.ROWS - feetY(pl) + P.GOAL_TOL));

/** Players above a cleared row ride the stack down one row per cleared row below their feet. */
export const shiftForClears = (pl: Player, cleared: readonly number[]): Player => {
    const feet = feetY(pl);
    const drop = cleared.filter((r) => feet <= r + P.GOAL_TOL).length;
    return drop === 0 ? pl : { ...pl, y: pl.y + drop };
};
