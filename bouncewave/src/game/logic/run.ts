// One play from wave 1 to game over: the Game Scene's state and its per-frame step (pure; no Phaser).
import {
    BALL_RADIUS,
    DANGER_MARGIN,
    LIVES,
    MAX_FRAME_DT,
    PADDLE_BOTTOM_MARGIN,
    RESULT_DELAY,
    SCORE_PER_ENEMY,
    WAVE_DELAY,
} from '../params';
import {
    createFormation,
    enemyShotVelocity,
    fireInterval,
    moveFormation,
    pickShooter,
    reachedDanger,
    type Formation,
} from './formation';
import { bounceOffRect, catchBall, hitsPaddle, isOut, keepInsideWalls, stepBall, type Ball } from './physics';

export type Phase = 'playing' | 'waveClear' | 'ending';

/** A ball the paddle caught this frame, at its position after being placed on the paddle. */
export interface Catch {
    id: number;
    x: number;
    y: number;
    /** The ball's tier after the catch (1 for a caught enemy ball). */
    tier: number;
}

/** An enemy killed this frame: its rectangle at that moment and the score it added. */
export interface Kill {
    id: number;
    x: number;
    y: number;
    w: number;
    h: number;
    score: number;
    /** Tier of the ball that killed it. */
    tier: number;
}

export interface Run {
    readonly height: number;
    readonly paddleY: number;
    /** y of the danger line (DANGER_MARGIN above the paddle centre). */
    readonly dangerY: number;
    phase: Phase;
    wave: number;
    score: number;
    lives: number;
    formation: Formation;
    balls: Ball[];
    fireTimer: number;
    /** Seconds left in waveClear or ending. */
    phaseTimer: number;
    /** Set once ending has run its course: the Scene moves on to Result. */
    resultReady: boolean;
    nextId: number;
    // Per-step outputs for the Scene (cleared at the start of each step).
    /** Lives actually lost this step (enemy balls that left, capped by the lives there were). */
    livesLost: number;
    removedBallIds: number[];
    killedEnemyIds: number[];
    /** The formation reached the danger line in this step (only on that frame: the run ends in it). */
    invaded: boolean;
    kills: Kill[];
    caught: Catch[];
    formationSpawned: boolean;
}

export type Rng = () => number;

/** Seconds one frame may advance (long frames, e.g. after the tab was hidden, are cut to MAX_FRAME_DT). */
export function frameDt(rawDt: number): number {
    return Math.min(rawDt, MAX_FRAME_DT);
}

export function scoreForKill(wave: number, tier: number): number {
    return SCORE_PER_ENEMY * wave * tier;
}

export function createRun(height: number): Run {
    const paddleY = height - PADDLE_BOTTOM_MARGIN;
    const dangerY = paddleY - DANGER_MARGIN;
    const run: Run = {
        height,
        paddleY,
        dangerY,
        phase: 'playing',
        wave: 0,
        score: 0,
        lives: LIVES,
        formation: { enemies: [], offsetX: 0, dir: 1, total: 0, drop: 0 }, // replaced by startWave below
        balls: [],
        fireTimer: 0,
        phaseTimer: 0,
        resultReady: false,
        nextId: 1,
        livesLost: 0,
        removedBallIds: [],
        killedEnemyIds: [],
        invaded: false,
        kills: [],
        caught: [],
        formationSpawned: false,
    };
    startWave(run);
    return run;
}

/** Next wave: clears enemy shots (own balls stay), spawns a centered formation, resets the fire timer. */
export function startWave(run: Run): void {
    run.wave += 1;
    run.balls = run.balls.filter((b) => {
        if (b.owner === 'mine') return true;
        run.removedBallIds.push(b.id);
        return false;
    });
    run.formation = createFormation(run.wave, run.nextId, run.dangerY);
    run.nextId += run.formation.enemies.length;
    run.fireTimer = fireInterval(run.wave);
    run.phase = 'playing';
    run.phaseTimer = 0;
    run.formationSpawned = true;
}

function fire(run: Run, dt: number, rng: Rng): void {
    run.fireTimer -= dt;
    if (run.fireTimer > 0) return;
    run.fireTimer = fireInterval(run.wave);
    const s = pickShooter(run.formation.enemies, rng());
    if (!s) return;
    const v = enemyShotVelocity(rng());
    run.balls.push({
        id: run.nextId++,
        x: s.rect.x,
        y: s.rect.y + s.rect.h / 2 + BALL_RADIUS,
        vx: v.vx,
        vy: v.vy,
        owner: 'enemy',
        tier: 1,
    });
}

function hitEnemy(run: Run, b: Ball): void {
    const enemies = run.formation.enemies;
    for (let i = 0; i < enemies.length; i++) {
        if (!bounceOffRect(b, enemies[i].rect)) continue;
        const { id, rect } = enemies[i];
        const score = scoreForKill(run.wave, b.tier);
        run.killedEnemyIds.push(id);
        run.kills.push({ id, x: rect.x, y: rect.y, w: rect.w, h: rect.h, score, tier: b.tier });
        enemies.splice(i, 1);
        run.score += score;
        return;
    }
}

/** Moves every ball; returns how many enemy balls left the bottom this frame. */
function moveBalls(run: Run, dt: number, paddleX: number): number {
    let escaped = 0;
    let kept = 0;
    for (const b of run.balls) {
        stepBall(b, dt);
        if (hitsPaddle(b, paddleX, run.paddleY)) {
            catchBall(b, paddleX, run.paddleY);
            run.caught.push({ id: b.id, x: b.x, y: b.y, tier: b.tier });
        }
        if (b.owner === 'mine') {
            hitEnemy(run, b);
            keepInsideWalls(b);
        }
        if (isOut(b, run.height)) {
            if (b.owner === 'enemy') escaped += 1;
            run.removedBallIds.push(b.id);
            continue;
        }
        run.balls[kept++] = b;
    }
    run.balls.length = kept;
    return escaped;
}

/** Advances the run by one frame. paddleX is the paddle center for this frame. */
export function stepRun(run: Run, rawDt: number, paddleX: number, rng: Rng): void {
    run.livesLost = 0;
    run.removedBallIds.length = 0;
    run.killedEnemyIds.length = 0;
    run.invaded = false;
    run.kills.length = 0;
    run.caught.length = 0;
    run.formationSpawned = false;
    const dt = frameDt(rawDt);

    if (run.phase === 'ending') {
        run.phaseTimer -= dt;
        if (run.phaseTimer <= 0) run.resultReady = true;
        return;
    }
    if (run.phase === 'playing') {
        moveFormation(run.formation, dt);
        // Judged before the balls move; this frame's hits still count. No new shot on the game-over frame.
        run.invaded = reachedDanger(run.formation, run.dangerY);
        if (!run.invaded) fire(run, dt, rng);
    }
    const escaped = moveBalls(run, dt, paddleX);

    // One life per escaped enemy ball, never below 0; the formation reaching the danger line takes them all.
    // livesLost is what was actually lost.
    const before = run.lives;
    run.lives = run.invaded ? 0 : Math.max(0, run.lives - escaped);
    run.livesLost = before - run.lives;
    if (run.lives === 0) {
        run.phase = 'ending';
        run.phaseTimer = RESULT_DELAY;
        return;
    }
    if (run.phase === 'playing') {
        if (run.formation.enemies.length === 0) {
            run.phase = 'waveClear';
            run.phaseTimer = WAVE_DELAY;
        }
        return;
    }
    run.phaseTimer -= dt;
    if (run.phaseTimer <= 0) startWave(run);
}
