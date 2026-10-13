// The climber: movement, jumping and collision against the grid. Pure logic, no Phaser.
import { P } from '../params';
import { isSolid, type Grid } from './board';

/** The wall kick bookkeeping carried from one update to the next (docs/spec.md "壁蹴り"). */
export interface WallKick {
    /** Side of the wall kicked last: -1 left, 1 right, 0 none yet (forgotten on landing). */
    side: -1 | 0 | 1;
    /** Seconds of dt since the last kick, not counting the current frame (Infinity: none). */
    since: number;
    /** The jump input of the previous frame (a kick needs a new press). */
    jumpHeld: boolean;
    /** True when the update that produced this state kicked off a wall. */
    kicked: boolean;
    /** Side whose horizontal input is ignored: the wall kicked last, until landing or touching the other wall. */
    barred: -1 | 0 | 1;
}

export interface Player {
    /** Top-left corner, in cells. */
    x: number;
    y: number;
    vy: number;
    onGround: boolean;
    /** Absent (a fresh climber) means no kick yet and no jump held. */
    kick?: WallKick;
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

const NO_KICK: WallKick = { side: 0, since: Infinity, jumpHeld: false, kicked: false, barred: 0 };

/** Slack for floating point error at the touch distance and at the end of the kick lock. */
const SLACK = 1e-9;

/** Which wall the body touches (within WALL_TOUCH_TOL): -1 left, 1 right, 0 none. Never both. */
const wallSide = (grid: Grid, x: number, y: number): -1 | 0 | 1 => {
    const r0 = Math.floor(y);
    const r1 = Math.floor(y + P.PLAYER_H - EPS);
    const touches = (c: number): boolean => {
        for (let r = r0; r <= r1; r++) {
            if (isSolid(grid, c, r)) return true;
        }
        return false;
    };
    const left = Math.floor(x);
    if (x - left <= P.WALL_TOUCH_TOL + SLACK && touches(left - 1)) return -1;
    const right = Math.floor(x + P.PLAYER_W - EPS) + 1;
    if (right - (x + P.PLAYER_W) <= P.WALL_TOUCH_TOL + SLACK && touches(right)) return 1;
    return 0;
};

/** One physics step. `dt` is clamped to MAX_DT. Returns a new Player. */
export const stepPlayer = (grid: Grid, pl: Player, input: MoveInput, dtRaw: number): Player => {
    const dt = Math.min(dtRaw, P.MAX_DT);
    const prev = pl.kick ?? NO_KICK;

    // A kick needs the body in the air, touching a wall, a new jump press and the other side's wall.
    let side = prev.side;
    let since = prev.since;
    let kicked = false;
    if (!pl.onGround && input.jump && !prev.jumpHeld) {
        const touching = wallSide(grid, pl.x, pl.y);
        if (touching !== 0 && touching !== side) {
            kicked = true;
            side = touching;
            since = 0;
        }
    }

    // While the kick lasts the input is ignored and the body moves away from the wall it kicked.
    const locked = side !== 0 && since + SLACK < P.WALL_KICK_LOCK;
    const walk = (input.right && prev.barred !== 1 ? 1 : 0) - (input.left && prev.barred !== -1 ? 1 : 0);
    const dir = locked ? -side : walk;
    const speed = locked ? P.WALL_KICK_VX : P.WALK_SPEED;
    const x = moveHorizontally(grid, pl.x, pl.y, dir * speed * dt);

    let vy = pl.vy;
    if (kicked) vy = -P.WALL_KICK_VY;
    else if (input.jump && pl.onGround) vy = -P.JUMP_V;
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
    // Landing forgets the kick (the next frame's horizontal move is back on the input).
    // The kicked wall stays barred until landing or touching the other wall (a kick re-bars it).
    let barred = prev.barred;
    if (kicked) barred = side;
    else if (barred !== 0 && wallSide(grid, x, y) === -barred) barred = 0;
    const next: WallKick = onGround
        ? { side: 0, since: Infinity, jumpHeld: input.jump, kicked, barred: 0 }
        : { side, since: since + dt, jumpHeld: input.jump, kicked, barred };
    return { x, y, vy, onGround, kick: next };
};

/** Foot position (bottom edge) in rows. */
export const feetY = (pl: Player): number => pl.y + P.PLAYER_H;

export const reachedGoal = (pl: Player): boolean => feetY(pl) <= P.GOAL_ROW + P.GOAL_TOL;

/** HUD height n: 0 on the floor, ROWS - GOAL_ROW exactly when the goal is reached. */
export const heightOf = (pl: Player): number =>
    Math.max(0, Math.floor(P.ROWS - feetY(pl) + P.GOAL_TOL));

/**
 * After full rows were removed from `grid`: the player stays where they are (the stack drops under
 * them and gravity does the rest), unless an overhang that fell down now overlaps their rectangle.
 * Then they move down one cell per cleared row below their feet, like the stack above that row did.
 * `grid` is the field after the clear.
 */
export const shiftForClears = (grid: Grid, pl: Player, cleared: readonly number[]): Player => {
    const feet = feetY(pl);
    const drop = cleared.filter((r) => feet <= r + P.GOAL_TOL).length;
    if (drop === 0 || !overlapsSolid(grid, pl.x, pl.y)) return pl;
    return { ...pl, y: pl.y + drop };
};
