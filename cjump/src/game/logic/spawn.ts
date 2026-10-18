export interface SpawnTick {
    msSinceLastSpawn: number;
    shouldSpawn: boolean;
}

// Shared by the Game scene and the difficulty simulator so both spawn on the same frames.
// The remainder is not carried over: the accumulator goes back to 0 on a spawn.
export function advanceSpawnTimer(msSinceLastSpawn: number, deltaMs: number, intervalMs: number): SpawnTick {
    const elapsed = msSinceLastSpawn + deltaMs;
    if (elapsed >= intervalMs) {
        return { msSinceLastSpawn: 0, shouldSpawn: true };
    }
    return { msSinceLastSpawn: elapsed, shouldSpawn: false };
}
