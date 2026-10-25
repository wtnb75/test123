import { describe, expect, it } from 'vitest';
import { BG_COLORS, ENEMY_RADIUS, GAME_HEIGHT, PLAYER_RADIUS } from './constants';
import { advanceStar, backdropColorOf, backdropStageIndex, ENEMY_SHAPE, PLAYER_SHAPE } from './look';

describe('backdropStageIndex', () => {
    it('is stage 0 just before 10 seconds', () => {
        expect(backdropStageIndex(9.99)).toBe(0);
    });

    it('moves to stage 1 exactly at 10 seconds', () => {
        expect(backdropStageIndex(10)).toBe(1);
    });

    it('is stage 4 at 119.99 seconds and stage 5 at 120 seconds', () => {
        expect(backdropStageIndex(119.99)).toBe(4);
        expect(backdropStageIndex(120)).toBe(5);
    });

    it('stays at the last stage after 120 seconds', () => {
        expect(backdropStageIndex(600)).toBe(5);
    });
});

describe('backdropColorOf', () => {
    it('gives the first colour before 10 seconds and the sixth from 120 seconds', () => {
        expect(backdropColorOf(0)).toBe(BG_COLORS[0]);
        expect(backdropColorOf(120)).toBe(BG_COLORS[5]);
    });

    it('changes colour at each stage boundary', () => {
        expect(backdropColorOf(9.99)).not.toBe(backdropColorOf(10));
    });
});

describe('advanceStar', () => {
    it('moves a star down by speed times dt', () => {
        expect(advanceStar(100, 60, 0.5, GAME_HEIGHT)).toBe(130);
    });

    it('keeps a star still inside the screen at the bottom edge', () => {
        expect(advanceStar(GAME_HEIGHT, 0, 1, GAME_HEIGHT)).toBe(GAME_HEIGHT);
    });

    it('sends a star that passes the bottom edge back above the top', () => {
        expect(advanceStar(GAME_HEIGHT - 0.5, 60, 1, GAME_HEIGHT)).toBe(-1);
    });
});

describe('ship and enemy shapes', () => {
    const distance = ([x, y]: readonly [number, number]) => Math.hypot(x, y);

    it('keeps every vertex of the triangle ship within the player hit radius', () => {
        for (const vertex of PLAYER_SHAPE) {
            expect(distance(vertex)).toBeLessThanOrEqual(PLAYER_RADIUS);
        }
    });

    it('keeps every vertex of the diamond enemy within the enemy hit radius', () => {
        for (const vertex of ENEMY_SHAPE) {
            expect(distance(vertex)).toBeLessThanOrEqual(ENEMY_RADIUS);
        }
    });

    it('draws the triangle ship with three vertices and the enemy diamond with four', () => {
        expect(PLAYER_SHAPE).toHaveLength(3);
        expect(ENEMY_SHAPE).toHaveLength(4);
    });
});
