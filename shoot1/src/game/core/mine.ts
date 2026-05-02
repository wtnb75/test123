/** 地雷の状態管理 */
export type MineState = {
    count: number;
    maxCount: number;
};

export function createMineState(initialCount: number): MineState {
    return { count: initialCount, maxCount: initialCount };
}

export function canPlaceMine(state: MineState): boolean {
    return state.count > 0;
}

export function placeMine(state: MineState): MineState {
    if (state.count <= 0) return state;
    return { ...state, count: state.count - 1 };
}

export function replenishMine(state: MineState): MineState {
    if (state.count >= state.maxCount) return state;
    return { ...state, count: state.count + 1 };
}
