// One play: the state of a run and its update order (docs/spec.md "Game の進行フェーズ").
import {
    CAT_PENALTY,
    ENDING_SEC,
    FIRST_SPAWN_SEC,
    KEY_ROTATE_RAD_PER_SEC,
    LIFE_SEC,
    LOW_TIME_SECONDS,
    NORMA,
    TIME_LIMIT_SEC,
} from '../params';
import { findHit, popScreen } from './hit';
import { initialRotation, spun, type Mat3, type Point } from './math';
import type { Kind, Pop } from './pop';
import type { Shape } from './shape';
import { pickSpawn, tickSpawnTimer } from './spawn';

export type Phase = 'playing' | 'ending';
export type Outcome = 'clear' | 'fail';

export interface Run {
    rot: Mat3;
    pops: Pop[];
    /** Moles hit, minus cat penalties (never below 0). */
    progress: number;
    timeLeft: number;
    spawnTimer: number;
    phase: Phase;
    outcome: Outcome | null;
    endingLeft: number;
    /** Seconds played so far (advances in `playing` updates only); drives the arrow pulse. */
    elapsed: number;
}

export function createRun(): Run {
    return {
        rot: initialRotation(),
        pops: [],
        progress: 0,
        timeLeft: TIME_LIMIT_SEC,
        spawnTimer: FIRST_SPAWN_SEC,
        phase: 'playing',
        outcome: null,
        endingLeft: ENDING_SEC,
        elapsed: 0,
    };
}

/** The new progress after hitting a Pop of `kind`. */
export function applyHit(progress: number, kind: Kind): number {
    return kind === 'mole' ? progress + 1 : Math.max(0, progress - CAT_PENALTY);
}

/** Clear wins over time-up (a hit that reaches the norma in the update where time runs out counts). */
export function evaluate(progress: number, timeLeft: number): Outcome | null {
    if (progress >= NORMA) return 'clear';
    if (timeLeft <= 0) return 'fail';
    return null;
}

/** Seconds shown for the time left: rounded up, never below 0. */
export function displaySeconds(timeLeft: number): number {
    return Math.max(0, Math.ceil(timeLeft));
}

/** The time display turns red (and pulses on each change) once the displayed seconds are at or below the limit. */
export function isLowTime(displayedSeconds: number): boolean {
    return displayedSeconds <= LOW_TIME_SECONDS;
}

/** Rotates by a drag or key increment; ignored outside `playing`. */
export function spin(run: Run, ay: number, ax: number): void {
    if (run.phase !== 'playing') return;
    run.rot = spun(run.rot, ay, ax);
}

export interface TapResult {
    kind: Kind;
    /** Where the Pop was on screen when hit (for the floating text). */
    at: Point;
}

/** A tap/click/Space at (x, y): hits at most one Pop. Returns what was hit, or null (a miss, or not playing). */
export function tap(run: Run, x: number, y: number, o: Point): TapResult | null {
    if (run.phase !== 'playing') return null;
    const i = findHit(run.pops, run.rot, x, y, o);
    if (i < 0) return null;
    const pop = run.pops[i];
    const at = popScreen(pop, run.rot, o);
    run.pops.splice(i, 1);
    run.progress = applyHit(run.progress, pop.kind);
    return { kind: pop.kind, at };
}

export interface KeyDir {
    /** -1 left, +1 right. */
    x: number;
    /** -1 up, +1 down. */
    y: number;
}

/** What one update did: nothing special, entered `ending` (see run.outcome), or finished `ending`. */
export type StepEvent = 'none' | 'ended' | 'finished';

/**
 * One update of dt seconds, after the inputs that arrived since the last one were applied:
 * (2) key rotation, (3) time and Pop ages, (4) outcome, (5) spawn. In `ending` only the countdown runs.
 */
export function step(run: Run, dt: number, keys: KeyDir, shape: Shape, rng: () => number): StepEvent {
    if (run.phase === 'ending') {
        run.endingLeft -= dt;
        return run.endingLeft <= 0 ? 'finished' : 'none';
    }
    run.elapsed += dt;
    const k = KEY_ROTATE_RAD_PER_SEC * dt;
    if (keys.x !== 0 || keys.y !== 0) run.rot = spun(run.rot, keys.x * k, keys.y * k);

    run.timeLeft -= dt;
    for (const p of run.pops) p.age += dt;
    for (let i = run.pops.length - 1; i >= 0; i--) {
        if (run.pops[i].age >= LIFE_SEC) run.pops.splice(i, 1);
    }

    run.outcome = evaluate(run.progress, run.timeLeft);
    if (run.outcome) {
        run.phase = 'ending';
        run.pops = [];
        return 'ended';
    }

    const tick = tickSpawnTimer(run.spawnTimer, dt, run.pops.length);
    run.spawnTimer = tick.timer;
    if (tick.spawn) {
        const pick = pickSpawn(shape.holes, new Set(run.pops.map((p) => p.hole.id)), run.rot, rng);
        if (pick) run.pops.push({ hole: pick.hole, kind: pick.kind, age: 0 });
    }
    return 'none';
}
