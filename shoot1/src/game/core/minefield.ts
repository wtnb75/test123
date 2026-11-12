import {
    ENEMY_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER, MINE_EXPLODE_RADIUS, MINE_PLACE_GRACE_SEC,
    MINE_RADIUS, MINE_TIMEOUT_SEC, PLAYER_RADIUS
} from './constants';
import { removeBulletsAt, removeEnemiesAt, type FieldState } from './field';
import { calcChainExplosionRadius, circlesOverlap, getTargetsInExplosion } from './physics';

// The mines on the field and how their explosions are resolved, without any drawing: the Scene keeps the
// game objects by mine id and draws what a step reports. The order of the steps is the one the Scene used
// before this moved here (docs/spec.md, 技術要件「地雷の core」). Nothing here is random.

export type MineBody = {
    id: number;
    x: number;
    y: number;
    /** Seconds since it was placed. */
    age: number;
};

export type Minefield = {
    mines: MineBody[];
    nextId: number;
};

export type RemovedEnemy = { id: number; x: number; y: number };

/** One mine going off: what it swept away and whether its blast reaches the player. */
export type Explosion = {
    mineId: number;
    x: number;
    y: number;
    radius: number;
    chainCount: number;
    /** In the enemy list's order: the Scene rolls an item drop for each, in this order. */
    removedEnemies: RemovedEnemy[];
    removedBulletIds: number[];
    hitsPlayer: boolean;
};

export type MinefieldStepInput = {
    dt: number;
    /** The player's position after this frame's movement. */
    playerX: number;
    playerY: number;
};

export type MinefieldHooks = {
    /** Asked per mine, at that moment: false while touching a mine does nothing (the barrier's grace window). */
    playerTouchActive: () => boolean;
    /**
     * The player touched a mine: its explosions (the mine and its chain), already applied to the field. The Scene
     * draws them and settles the failure; return true when that ends the game, which stops the step right there.
     */
    onTouchBurst: (explosions: readonly Explosion[]) => boolean;
};

export type MinefieldStepResult = {
    aborted: boolean;
    /** Every explosion of the mines that were due (timeout, or an enemy touched them), in order. Empty when aborted. */
    explosions: Explosion[];
    /** Some explosion of `explosions` reaches the player. */
    playerHit: boolean;
};

export function createMinefield(): Minefield {
    return { mines: [], nextId: 1 };
}

/** Places a mine at the position unless it would overlap one already there. Returns the new mine, or null. */
export function addMineAt(field: Minefield, x: number, y: number): MineBody | null {
    for (const m of field.mines) {
        if (circlesOverlap(x, y, MINE_RADIUS, m.x, m.y, MINE_RADIUS)) return null;
    }
    const mine: MineBody = { id: field.nextId, x, y, age: 0 };
    field.nextId += 1;
    field.mines.push(mine);
    return mine;
}

/**
 * Sets off one mine and, depth first, the mines its blast reaches (each one's radius is bigger by
 * MINE_CHAIN_RADIUS_MULTIPLIER). Appends each explosion to `out` (this one first) and returns whether any of
 * them reaches the player. A mine already in `visited` does nothing.
 */
function explode(
    mines: Minefield, field: FieldState, mine: MineBody, visited: Set<number>, chainCount: number,
    input: MinefieldStepInput, out: Explosion[]
): boolean {
    if (visited.has(mine.id)) return false;
    visited.add(mine.id);

    const radius = calcChainExplosionRadius(MINE_EXPLODE_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER, chainCount);

    const index = mines.mines.indexOf(mine);
    if (index !== -1) mines.mines.splice(index, 1);

    // the mines this blast reaches are collected before anything is swept, from those still on the field
    const chained: MineBody[] = [];
    for (const other of mines.mines) {
        if (visited.has(other.id)) continue;
        const dx = mine.x - other.x;
        const dy = mine.y - other.y;
        if (dx * dx + dy * dy <= radius * radius) chained.push(other);
    }

    const hitEnemies = getTargetsInExplosion(mine.x, mine.y, radius, field.enemies);
    const removedEnemies = hitEnemies.map((i) => ({ id: field.enemies[i].id, x: field.enemies[i].x, y: field.enemies[i].y }));
    removeEnemiesAt(field, hitEnemies);
    const removedBulletIds = removeBulletsAt(field, getTargetsInExplosion(mine.x, mine.y, radius, field.bullets));

    const hitsPlayer = circlesOverlap(mine.x, mine.y, radius, input.playerX, input.playerY, PLAYER_RADIUS);
    out.push({ mineId: mine.id, x: mine.x, y: mine.y, radius, chainCount, removedEnemies, removedBulletIds, hitsPlayer });

    let anyHitsPlayer = hitsPlayer;
    for (const next of chained) {
        if (explode(mines, field, next, visited, chainCount + 1, input, out)) anyHitsPlayer = true;
    }
    return anyHitsPlayer;
}

/**
 * One update of the mines, after the enemies and bullets have moved. Ages every mine; a mine that timed out, or
 * that an enemy touches, is due to explode; a mine the player touches explodes at once (its own set of
 * exploded mines) and the hooks decide whether the step goes on. The due mines then explode together, sharing
 * one set of exploded mines, in the order they became due.
 */
export function stepMinefield(
    mines: Minefield, field: FieldState, input: MinefieldStepInput, hooks: MinefieldHooks
): MinefieldStepResult {
    const due: MineBody[] = [];
    // a copy: a touched mine explodes inside the loop (and chains), and the player may survive it behind a barrier
    for (const mine of [...mines.mines]) {
        if (!mines.mines.includes(mine)) continue;
        mine.age += input.dt;

        if (mine.age >= MINE_TIMEOUT_SEC) {
            due.push(mine);
            continue;
        }

        if (field.enemies.some((e) => circlesOverlap(mine.x, mine.y, MINE_RADIUS, e.x, e.y, ENEMY_RADIUS))) {
            due.push(mine);
        }

        if (mine.age > MINE_PLACE_GRACE_SEC && hooks.playerTouchActive()
            && circlesOverlap(mine.x, mine.y, MINE_RADIUS, input.playerX, input.playerY, PLAYER_RADIUS)) {
            const burst: Explosion[] = [];
            explode(mines, field, mine, new Set(), 0, input, burst);
            if (hooks.onTouchBurst(burst)) return { aborted: true, explosions: [], playerHit: false };
        }
    }

    const visited = new Set<number>();
    const explosions: Explosion[] = [];
    for (const mine of due) {
        // one that already went off (a touched one, or in a chain) must not explode twice
        if (!mines.mines.includes(mine)) continue;
        explode(mines, field, mine, visited, 0, input, explosions);
    }
    return { aborted: false, explosions, playerHit: explosions.some((e) => e.hitsPlayer) };
}
