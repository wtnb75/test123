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
    removed: boolean;
}

const FIELD_RADIUS_SQ = FIELD_RADIUS * FIELD_RADIUS;
const isRemoved = (item: { removed: boolean }): boolean => item.removed;

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
        for (let i = 0; i < n; i++) {
            this.releaseBullets.push({
                x: this.player.x,
                y: this.player.y,
                heading: -Math.PI / 2 + randomRange(this.rng, -RELEASE_SPREAD, RELEASE_SPREAD),
                age: 0,
                group,
                removed: false
            });
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

    /** The on-screen living enemy closest to the player, or null when none. */
    findTarget(): Enemy | null {
        const p = this.player;
        let best: Enemy | null = null;
        let bestD = Infinity;
        for (const e of this.enemies) {
            if (e.removed || !isOnScreen(e)) continue;
            const d = distanceSq(e.x, e.y, p.x, p.y);
            if (d < bestD) {
                bestD = d;
                best = e;
            }
        }
        return best;
    }

    private updateReleaseBullets(dt: number, canHit: boolean): void {
        let target = this.findTarget();
        const maxTurn = RELEASE_TURN_RATE * dt;
        for (const b of this.releaseBullets) {
            if (target) b.heading = turnToward(b.heading, angleTo(b, target), maxTurn);
            b.x += Math.cos(b.heading) * RELEASE_SPEED * dt;
            b.y += Math.sin(b.heading) * RELEASE_SPEED * dt;
            b.age += dt;
            if (canHit && this.hitEnemy(b)) {
                target = this.findTarget();
            }
            if (b.removed || b.age >= RELEASE_LIFETIME || isFullyOffScreen(b, RELEASE_RADIUS)) {
                b.removed = true;
                this.settle(b.group);
            }
        }
        removeWhere(this.releaseBullets, isRemoved);
    }

    /** Applies one bullet's damage to the first enemy it touches. Returns true if that enemy died. */
    private hitEnemy(b: ReleaseBullet): boolean {
        for (const e of this.enemies) {
            if (e.removed || !circlesOverlap(b, RELEASE_RADIUS, e, e.radius)) continue;
            b.removed = true;
            e.hp--;
            if (e.hp > 0) return false;
            e.removed = true;
            b.group.kills.push(ENEMY_SPECS[e.kind].score);
            return true;
        }
        return false;
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

