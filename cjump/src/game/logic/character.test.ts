import { describe, it, expect } from 'vitest';
import {
    createCharacterState,
    requestJump,
    updateCharacter,
    hasFinished,
    isCollisionActive
} from './character';

describe('character state machine', () => {
    it('starts at t=0, not jumping', () => {
        expect(createCharacterState()).toEqual({ t: 0, isJumping: false, jumpElapsedMs: 0 });
    });

    it('advances t while not jumping', () => {
        const state = updateCharacter(createCharacterState(), 100, 0.001, 400);
        expect(state.t).toBeCloseTo(0.1);
        expect(state.isJumping).toBe(false);
    });

    it('clamps t at 1 once finished', () => {
        const state = updateCharacter({ t: 0.95, isJumping: false, jumpElapsedMs: 0 }, 1000, 0.001, 400);
        expect(state.t).toBe(1);
        expect(hasFinished(state)).toBe(true);
    });

    it('starts a jump on request when idle', () => {
        const state = requestJump(createCharacterState());
        expect(state.isJumping).toBe(true);
        expect(state.jumpElapsedMs).toBe(0);
    });

    it('ignores a jump request while already jumping', () => {
        const jumping = { t: 0.2, isJumping: true, jumpElapsedMs: 150 };
        expect(requestJump(jumping)).toEqual(jumping);
    });

    it('does not advance t while jumping', () => {
        const jumping = requestJump(createCharacterState());
        const state = updateCharacter(jumping, 100, 0.001, 400);
        expect(state.t).toBe(0);
        expect(state.isJumping).toBe(true);
        expect(state.jumpElapsedMs).toBe(100);
    });

    it('lands exactly at the jump duration and resumes movement next frame', () => {
        const jumping = requestJump(createCharacterState());
        const landed = updateCharacter(jumping, 400, 0.001, 400);
        expect(landed.isJumping).toBe(false);
        expect(landed.jumpElapsedMs).toBe(0);

        const resumed = updateCharacter(landed, 100, 0.001, 400);
        expect(resumed.t).toBeCloseTo(0.1);
    });

    it('disables collision only while jumping', () => {
        const idle = createCharacterState();
        expect(isCollisionActive(idle)).toBe(true);
        expect(isCollisionActive(requestJump(idle))).toBe(false);
    });
});
