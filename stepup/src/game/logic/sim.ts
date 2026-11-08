import { GOAL_H, GOAL_METERS, GOAL_VIEW_MARGIN, PLATFORM_H, PLAYER_H, PX_PER_METER, START_Y_RATIO } from '../params';
import { type BulletField, bulletHitsPlayer, createBulletField, stepBullets } from './bullets';
import { meters, scrollSpeed } from './difficulty';
import {
    type Platform,
    type Player,
    createPlayer,
    createWidePlatform,
    pressAction,
    stepPlayer,
    tickTimers,
} from './physics';

export type Outcome = 'clear' | 'hit' | 'left-behind';

export interface Sim {
    /** Logical height of the screen. */
    height: number;
    startY: number;
    goalY: number;
    /** World y of the top edge of the view; it decreases as the screen scrolls up. */
    viewTop: number;
    /** Highest (smallest y) the feet have reached. */
    highestFeetY: number;
    player: Player;
    platforms: Platform[];
    field: BulletField;
    outcome: Outcome | null;
}

/** World y of the start ground's top surface for a screen height. */
export const startYFor = (height: number): number => Math.round(height * START_Y_RATIO);

export function createSim(height: number): Sim {
    const startY = startYFor(height);
    const goalY = startY - GOAL_METERS * PX_PER_METER;
    return {
        height,
        startY,
        goalY,
        viewTop: 0,
        highestFeetY: startY,
        player: createPlayer(startY),
        platforms: [createWidePlatform('ground', startY, PLATFORM_H), createWidePlatform('goal', goalY, GOAL_H)],
        field: createBulletField(),
        outcome: null,
    };
}

export const simMeters = (s: Sim): number => meters(s.startY, s.highestFeetY);

/** Standing on the goal platform. */
export const isCleared = (player: Player, goalY: number): boolean => player.onGround && player.y <= goalY + 0.5;

/** The head is below the bottom edge of the view. */
export const isLeftBehind = (player: Player, viewBottom: number): boolean => player.y - PLAYER_H > viewBottom;

/** The end condition that holds now, by priority hit > left-behind > clear; null while playing. */
export function judge(s: Sim): Outcome | null {
    if (s.field.bullets.some((b) => bulletHitsPlayer(b, s.player))) return 'hit';
    if (isLeftBehind(s.player, s.viewTop + s.height)) return 'left-behind';
    if (isCleared(s.player, s.goalY)) return 'clear';
    return null;
}

/**
 * One frame of play in the spec's order: actions, timers, scroll, player, highest point, bullets, end check.
 * `dir` is the move direction (-1..1), `actions` the button presses since the last frame. No-op after the end.
 */
export function stepSim(s: Sim, dir: number, actions: number, dt: number, rng: () => number): void {
    if (s.outcome) return;
    for (let i = 0; i < actions; i++) pressAction(s.player, s.platforms);
    tickTimers(s.player, s.platforms, dt);
    s.viewTop = Math.max(s.goalY - GOAL_VIEW_MARGIN, s.viewTop - scrollSpeed(simMeters(s)) * dt);
    stepPlayer(s.player, dir, dt, s.platforms, s.viewTop);
    s.highestFeetY = Math.min(s.highestFeetY, s.player.y);
    stepBullets(s.field, dt, s.viewTop, s.height, simMeters(s), rng);
    s.outcome = judge(s);
}
