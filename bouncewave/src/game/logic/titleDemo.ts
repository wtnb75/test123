// The Title demo: layout of the Title with its window, the bot that plays a reduced board, and the state it
// drives (pure; no Phaser). See docs/spec/title-demo.md.
import type { DemoGame, DemoOptions } from 'title-demo';
import {
    BALL_RADIUS,
    BUTTON_HEIGHT,
    DEMO_BEST_GAP,
    DEMO_FADE_MS,
    DEMO_FIELD_HEIGHT,
    DEMO_IDLE_SPEED,
    DEMO_MAX_WIDTH,
    DEMO_MIN_SCALE,
    DEMO_PADDLE_SPEED,
    DEMO_RUN_MS,
    DEMO_TOP,
    DEMO_VIEW_HEIGHT,
    FIELD_LEFT,
    FIELD_RIGHT,
    PADDLE_HEIGHT,
    PADDLE_MAX_ANGLE,
    PADDLE_WIDTH,
    SCREEN_WIDTH,
    TITLE_BEST_GAP,
    TITLE_BEST_HALF_HEIGHT,
    TITLE_NAME_Y,
} from '../params';
import { clampPaddle } from './paddle';
import { createRun, frameDt, type Rng, type Run, stepRun } from './run';

export interface DemoLayout {
    /** Whether the window is shown (its scale reaches DEMO_MIN_SCALE). */
    visible: boolean;
    /** Window scale: logical window px per Run px (0 when hidden). */
    scale: number;
    /** Top-left of the window and its size, in logical px (0 when hidden). */
    x: number;
    y: number;
    width: number;
    height: number;
    nameY: number;
    bestY: number;
    startY: number;
}

/** Positions of the Title's elements for a logical height (docs/spec/title-demo.md "レイアウト"). */
export function demoLayout(height: number): DemoLayout {
    const startY = height * 0.8;
    const bestY = startY - BUTTON_HEIGHT / 2 - TITLE_BEST_GAP;
    const bandBottom = bestY - TITLE_BEST_HALF_HEIGHT - DEMO_BEST_GAP;
    const availH = bandBottom - DEMO_TOP;
    const scale = Math.min(DEMO_MAX_WIDTH / SCREEN_WIDTH, availH / DEMO_VIEW_HEIGHT);
    if (scale < DEMO_MIN_SCALE) {
        return { visible: false, scale: 0, x: 0, y: 0, width: 0, height: 0, nameY: height * 0.17, bestY: height * 0.56, startY };
    }
    const width = SCREEN_WIDTH * scale;
    const winH = DEMO_VIEW_HEIGHT * scale;
    return {
        visible: true,
        scale,
        x: (SCREEN_WIDTH - width) / 2,
        y: DEMO_TOP + (availH - winH) / 2,
        width,
        height: winH,
        nameY: TITLE_NAME_Y,
        bestY,
        startY,
    };
}

const DEG = Math.PI / 180;
const LO = FIELD_LEFT + BALL_RADIUS;
const HI = FIELD_RIGHT - BALL_RADIUS;
const CATCH_RANGE = PADDLE_HEIGHT / 2 + BALL_RADIUS;

/** x of a ball after `t` seconds, folded between the side walls. */
export function foldedX(x: number, vx: number, t: number): number {
    const span = HI - LO;
    let p = x - LO + vx * t;
    p = ((p % (2 * span)) + 2 * span) % (2 * span);
    if (p > span) p = 2 * span - p;
    return LO + p;
}

export interface BotCommand {
    targetX: number;
    /** A ball is coming down: move fast. Otherwise drift slowly toward the formation. */
    urgent: boolean;
}

/** Where the demo paddle wants to be (pure function of the Run; same state, same answer). Allocates only its result. */
export function demoBot(run: Run): BotCommand {
    const enemies = run.formation.enemies;
    let found = false;
    let pickT = 0;
    let pickX = 0;
    let pickId = 0;
    for (const b of run.balls) {
        if (b.vy <= 0 || b.y > run.paddleY + CATCH_RANGE) continue;
        const t = Math.max(0, (run.paddleY - CATCH_RANGE - b.y) / b.vy);
        if (!found || t < pickT || (t === pickT && b.id < pickId)) {
            found = true;
            pickT = t;
            pickX = foldedX(b.x, b.vx, t);
            pickId = b.id;
        }
    }
    if (!found) {
        let sum = 0;
        for (const e of enemies) sum += e.rect.x;
        return { targetX: clampPaddle(enemies.length > 0 ? sum / enemies.length : SCREEN_WIDTH / 2), urgent: false };
    }
    let aimX = SCREEN_WIDTH / 2;
    let aimY = 300;
    if (enemies.length > 0) {
        let lowest = -Infinity;
        let rowSize = 0;
        for (const e of enemies) {
            if (e.rect.y > lowest) {
                lowest = e.rect.y;
                rowSize = 0;
            }
            if (e.rect.y === lowest) rowSize += 1;
        }
        // The (id mod rowSize)-th enemy of the lowest row, counting from the left (0-based).
        const want = pickId % rowSize;
        for (const e of enemies) {
            if (e.rect.y !== lowest) continue;
            let left = 0;
            for (const o of enemies) if (o.rect.y === lowest && o.rect.x < e.rect.x) left += 1;
            if (left === want) {
                aimX = e.rect.x;
                aimY = e.rect.y;
                break;
            }
        }
    }
    const angle = Math.atan((aimX - pickX) / Math.max(1, run.paddleY - aimY));
    const offset = Math.max(-1, Math.min(1, angle / (PADDLE_MAX_ANGLE * DEG)));
    return { targetX: clampPaddle(pickX - offset * (PADDLE_WIDTH / 2)), urgent: true };
}

/** Moves the paddle toward the bot's target by at most its speed (never past it), inside the walls. */
export function stepDemoPaddle(x: number, cmd: BotCommand, dt: number): number {
    const reach = (cmd.urgent ? DEMO_PADDLE_SPEED : DEMO_IDLE_SPEED) * dt;
    return clampPaddle(x + Math.max(-reach, Math.min(reach, cmd.targetX - x)));
}

/** A small seeded generator (mulberry32), for the demo's shots. */
export function seededRng(seed: number): Rng {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** One demo run: the Run, the generator for its shots and the bot's paddle. */
export interface DemoState {
    run: Run;
    rng: Rng;
    paddleX: number;
}

export function createDemoState(seed: number): DemoState {
    const run = createRun(DEMO_FIELD_HEIGHT);
    // The view draws the first formation itself when it starts over; the flag is for waves that start later.
    run.formationSpawned = false;
    return { run, rng: seededRng(seed), paddleX: SCREEN_WIDTH / 2 };
}

/** Advances the demo by one frame (`dt` seconds; stepRun caps it like the game does). */
export function stepDemo(demo: DemoState, dt: number): void {
    demo.paddleX = stepDemoPaddle(demo.paddleX, demoBot(demo.run), dt);
    stepRun(demo.run, dt, demo.paddleX, demo.rng);
}

/** Milliseconds the demo clock and Run advance in one frame: long frames (a hidden tab) are cut like the game's. */
export function demoStepMs(deltaMs: number): number {
    return frameDt(deltaMs / 1000) * 1000;
}

/** The bot lost (lives gone or the formation reached the danger line). */
export function demoEnded(demo: DemoState): boolean {
    return demo.run.phase === 'ending';
}

/** The clock of the demo: one round, one action that does nothing. The Scene steps the Run itself. */
export const TITLE_DEMO_GAME: DemoGame<number, number, undefined> = {
    start: () => 0,
    plan: () => [0],
    play: () => ({ moved: true, roundDone: true, detail: undefined }),
};

export const TITLE_DEMO_OPTIONS: DemoOptions = {
    rounds: 1,
    timing: { stepMs: 1, waitMs: DEMO_RUN_MS / 2, fadeMs: DEMO_FADE_MS },
};
