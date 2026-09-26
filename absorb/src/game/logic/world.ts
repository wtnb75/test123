import {
    ENDING_DURATION, ENEMY_BULLET_RADIUS, ENEMY_SPECS, FIELD_RADIUS, FIRST_RAMMER_AT, GAME_HEIGHT, GAME_WIDTH,
    MAX_ENEMIES, MAX_RAMMERS, PLAYER_INVULNERABLE, PLAYER_LIVES, PLAYER_MIN_Y, PLAYER_RADIUS, PLAYER_SPEED,
    PLAYER_START_X, PLAYER_START_Y, READY_DURATION, RELEASE_LIFETIME, RELEASE_RADIUS, RELEASE_SPEED,
    RELEASE_SPREAD, RELEASE_TURN_RATE, STOCK_MAX, type EnemyKind
} from './constants';
import { getStage, pickEnemyKind } from './difficulty';
import { createEnemy, updateEnemy, type Enemy, type EnemyContext } from './enemy';
import {
    angleTo, circlesOverlap, distanceSq, isFullyOffScreen, isOnScreen, randomRange, removeWhere, turnToward, type Rng
} from './geometry';
import { volleyAngles } from './patterns';
import { releaseScore } from './scoring';

export type Phase = 'ready' | 'playing' | 'ending' | 'over';

export interface Input {
    /** -1, 0 or 1 on each axis. */
    moveX: number;
    moveY: number;
    /** True only on the frame the release key went down. */
    release: boolean;
}

export interface Player {
    x: number;
    y: number;
    lives: number;
    invulnerable: number;
}

export interface EnemyBullet {
    x: number;
    y: number;
    vx: number;
    vy: number;
    removed: boolean;
}

/** One release: its bullets and the base scores of the enemies they finished off. */
export interface ReleaseGroup {
    pending: number;
    kills: number[];
}

export interface ReleaseBullet {
    x: number;
    y: number;
    heading: number;
    age: number;
    group: ReleaseGroup;
    /** The enemy this bullet homes on; always counted in that enemy's `incoming`. */
    target: Enemy | null;
    removed: boolean;
}

const FIELD_RADIUS_SQ = FIELD_RADIUS * FIELD_RADIUS;
const isRemoved = (item: { removed: boolean }): boolean => item.removed;
const isTargetable = (e: Enemy): boolean => !e.removed && isOnScreen(e);

/** Bullets still needed to finish an enemy, after those already homing on it. */
export function shortfall(e: Enemy): number {
    return Math.max(0, e.hp - e.incoming);
}

/** Points a bullet at a new target, keeping both enemies' `incoming` counts in sync. */
function setTarget(b: ReleaseBullet, e: Enemy | null): void {
    if (b.target === e) return;
    if (b.target) b.target.incoming--;
    b.target = e;
    if (e) e.incoming++;
}

export class World {
    phase: Phase = 'ready';
    phaseTime = 0;
    /** Seconds spent in the playing phase; drives the difficulty stage. */
    elapsed = 0;
    player: Player = { x: PLAYER_START_X, y: PLAYER_START_Y, lives: PLAYER_LIVES, invulnerable: 0 };
    stock = 0;
    score = 0;
    enemies: Enemy[] = [];
    enemyBullets: EnemyBullet[] = [];
    releaseBullets: ReleaseBullet[] = [];
    openGroups: ReleaseGroup[] = [];
    private nextId = 1;
    private spawnTimer = 0;
    private rammerTimer = FIRST_RAMMER_AT;
    private readonly ctx: EnemyContext;

    constructor(private readonly rng: Rng = Math.random) {
        this.ctx = { player: this.player, elapsed: 0, rng };
    }

    step(dt: number, input: Input): void {
        this.phaseTime += dt;
        switch (this.phase) {
            case 'ready':
                this.movePlayer(dt, input);
                if (this.phaseTime >= READY_DURATION) this.setPhase('playing');
                break;
            case 'playing':
                this.stepPlaying(dt, input);
                break;
            case 'ending':
                this.stepEnding(dt);
                break;
        }
    }

    private setPhase(phase: Phase): void {
        this.phase = phase;
        this.phaseTime = 0;
    }

    private stepPlaying(dt: number, input: Input): void {
        this.ctx.elapsed = this.elapsed;
        this.movePlayer(dt, input);
        if (this.player.invulnerable > 0) this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
        if (input.release) this.release();
        this.spawn(dt);
        this.updateEnemies(dt, true);
        this.updateEnemyBullets(dt, true);
        this.updateReleaseBullets(dt, true);
        this.checkContact();
        removeWhere(this.enemies, isRemoved);
        this.elapsed += dt;
    }

    private stepEnding(dt: number): void {
        this.updateEnemies(dt, false);
        this.updateEnemyBullets(dt, false);
        this.updateReleaseBullets(dt, false);
        removeWhere(this.enemies, isRemoved);
        if (this.phaseTime >= ENDING_DURATION) {
            this.flushGroups();
            this.setPhase('over');
        }
    }

    movePlayer(dt: number, input: Input): void {
        let { moveX, moveY } = input;
        if (moveX !== 0 && moveY !== 0) {
            moveX *= Math.SQRT1_2;
            moveY *= Math.SQRT1_2;
        }
        const p = this.player;
        p.x = Math.min(Math.max(p.x + moveX * PLAYER_SPEED * dt, PLAYER_RADIUS), GAME_WIDTH - PLAYER_RADIUS);
        p.y = Math.min(Math.max(p.y + moveY * PLAYER_SPEED * dt, PLAYER_MIN_Y), GAME_HEIGHT - PLAYER_RADIUS);
    }

    /** Fires every stocked bullet as one release group. Does nothing with an empty stock. */
    release(): void {
        const n = this.stock;
        if (n <= 0) return;
        this.stock = 0;
        const group: ReleaseGroup = { pending: n, kills: [] };
        this.openGroups.push(group);
        const targets = this.assignTargets(n);
        for (let i = 0; i < n; i++) {
            const b: ReleaseBullet = {
                x: this.player.x,
                y: this.player.y,
                heading: -Math.PI / 2 + randomRange(this.rng, -RELEASE_SPREAD, RELEASE_SPREAD),
                age: 0,
                group,
                target: null,
                removed: false
            };
            setTarget(b, targets[i] ?? null);
            this.releaseBullets.push(b);
        }
    }

    private countEnemies(rammers: boolean): number {
        let n = 0;
        for (const e of this.enemies) if ((e.kind === 'rammer') === rammers) n++;
        return n;
    }

    private addEnemy(kind: EnemyKind): void {
        this.enemies.push(createEnemy(kind, this.nextId++, this.rng));
    }

    private spawn(dt: number): void {
        const stage = getStage(this.elapsed);
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            if (this.countEnemies(false) < MAX_ENEMIES) this.addEnemy(pickEnemyKind(this.elapsed, this.rng));
            this.spawnTimer += stage.spawnInterval;
        }
        this.rammerTimer -= dt;
        if (this.rammerTimer <= 0) {
            if (this.countEnemies(true) < MAX_RAMMERS) this.addEnemy('rammer');
            this.rammerTimer += stage.rammerInterval;
        }
    }

    private updateEnemies(dt: number, canFire: boolean): void {
        for (const e of this.enemies) {
            if (updateEnemy(e, dt, this.ctx) && canFire) this.fireVolley(e);
        }
    }

    private fireVolley(e: Enemy): void {
        const speed = getStage(this.elapsed).bulletSpeed;
        for (const a of volleyAngles(e.kind, e, this.player)) {
            this.enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, removed: false });
        }
    }

    private updateEnemyBullets(dt: number, canAbsorb: boolean): void {
        const p = this.player;
        for (const b of this.enemyBullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (canAbsorb && distanceSq(b.x, b.y, p.x, p.y) <= FIELD_RADIUS_SQ) {
                b.removed = true;
                this.absorb();
            } else if (isFullyOffScreen(b, ENEMY_BULLET_RADIUS)) {
                b.removed = true;
            }
        }
        removeWhere(this.enemyBullets, isRemoved);
    }

    /** Adds one bullet to the stock, auto-releasing the moment it reaches the cap. */
    absorb(): void {
        this.stock++;
        if (this.stock >= STOCK_MAX) this.release();
    }

    /**
     * Targets for n newly released bullets: on-screen enemies nearest the player first, each given
     * just enough bullets to finish it, then any surplus handed out round-robin in the same order.
     * Returns an empty list when no enemy is on screen.
     */
    assignTargets(n: number): Enemy[] {
        const p = this.player;
        const candidates = this.enemies.filter(isTargetable);
        candidates.sort((a, b) => distanceSq(a.x, a.y, p.x, p.y) - distanceSq(b.x, b.y, p.x, p.y));
        const targets: Enemy[] = [];
        for (const e of candidates) {
            const take = Math.min(shortfall(e), n - targets.length);
            for (let i = 0; i < take; i++) targets.push(e);
        }
        for (let i = 0; candidates.length > 0 && targets.length < n; i++) {
            targets.push(candidates[i % candidates.length]);
        }
        return targets;
    }

    /**
     * New target for a bullet in flight: the nearest enemy still short of bullets, otherwise the
     * nearest on-screen enemy, otherwise null.
     */
    retarget(b: ReleaseBullet): Enemy | null {
        let best: Enemy | null = null;
        let bestD = Infinity;
        let bestShort = false;
        for (const e of this.enemies) {
            if (!isTargetable(e)) continue;
            const short = shortfall(e) > 0;
            const d = distanceSq(e.x, e.y, b.x, b.y);
            if ((short && !bestShort) || (short === bestShort && d < bestD)) {
                best = e;
                bestD = d;
                bestShort = short;
            }
        }
        return best;
    }

    private updateReleaseBullets(dt: number, canHit: boolean): void {
        const maxTurn = RELEASE_TURN_RATE * dt;
        for (const b of this.releaseBullets) {
            if (!b.target || !isTargetable(b.target)) setTarget(b, this.retarget(b));
            if (b.target) b.heading = turnToward(b.heading, angleTo(b, b.target), maxTurn);
            b.x += Math.cos(b.heading) * RELEASE_SPEED * dt;
            b.y += Math.sin(b.heading) * RELEASE_SPEED * dt;
            b.age += dt;
            if (canHit) this.hitEnemy(b);
            if (b.removed || b.age >= RELEASE_LIFETIME || isFullyOffScreen(b, RELEASE_RADIUS)) {
                b.removed = true;
                setTarget(b, null);
                this.settle(b.group);
            }
        }
        removeWhere(this.releaseBullets, isRemoved);
    }

    /** Applies one bullet's damage to the first enemy it touches. */
    private hitEnemy(b: ReleaseBullet): void {
        for (const e of this.enemies) {
            if (e.removed || !circlesOverlap(b, RELEASE_RADIUS, e, e.radius)) continue;
            b.removed = true;
            e.hp--;
            if (e.hp <= 0) {
                e.removed = true;
                b.group.kills.push(ENEMY_SPECS[e.kind].score);
            }
            return;
        }
    }

    private settle(group: ReleaseGroup): void {
        group.pending--;
        if (group.pending > 0) return;
        this.score += releaseScore(group.kills);
        removeWhere(this.openGroups, (g) => g === group);
    }

    /** Scores every release that still has bullets in flight (used when the run ends). */
    private flushGroups(): void {
        for (const g of this.openGroups) this.score += releaseScore(g.kills);
        this.openGroups.length = 0;
    }

    private checkContact(): void {
        const p = this.player;
        if (p.invulnerable > 0) return;
        for (const e of this.enemies) {
            if (e.removed || !circlesOverlap(p, PLAYER_RADIUS, e, e.radius)) continue;
            p.lives--;
            p.invulnerable = PLAYER_INVULNERABLE;
            if (p.lives <= 0) this.setPhase('ending');
            return;
        }
    }
}

