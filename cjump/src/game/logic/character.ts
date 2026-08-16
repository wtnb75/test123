export interface CharacterState {
    t: number;
    isJumping: boolean;
    jumpElapsedMs: number;
}

export function createCharacterState(): CharacterState {
    return { t: 0, isJumping: false, jumpElapsedMs: 0 };
}

export function requestJump(state: CharacterState): CharacterState {
    if (state.isJumping) {
        return state;
    }
    return { ...state, isJumping: true, jumpElapsedMs: 0 };
}

export function updateCharacter(
    state: CharacterState,
    dtMs: number,
    speedPerMs: number,
    jumpDurationMs: number
): CharacterState {
    if (state.isJumping) {
        const jumpElapsedMs = state.jumpElapsedMs + dtMs;
        if (jumpElapsedMs >= jumpDurationMs) {
            return { ...state, isJumping: false, jumpElapsedMs: 0 };
        }
        return { ...state, jumpElapsedMs };
    }
    return { ...state, t: Math.min(state.t + dtMs * speedPerMs, 1) };
}

export function hasFinished(state: CharacterState): boolean {
    return state.t >= 1;
}

export function isCollisionActive(state: CharacterState): boolean {
    return !state.isJumping;
}
