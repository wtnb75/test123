// How the pace grows with the playing time t (seconds) (docs/spec.md "ルール > 単語").
import {
    FALL_SPEED_MAX,
    FALL_SPEED_RAMP,
    FALL_SPEED_START,
    SPAWN_DECAY_PER_SEC,
    SPAWN_MIN_SEC,
    SPAWN_START_SEC,
    WORD_LEN_UP_SEC,
    WORD_MAX_LEN,
    WORD_MAX_LEN_START,
} from '../params';

/** Fall speed in fall distances per second. */
export const fallSpeedAt = (t: number): number => Math.min(FALL_SPEED_MAX, FALL_SPEED_START + FALL_SPEED_RAMP * t);

/** Seconds between spawns. */
export const spawnIntervalAt = (t: number): number => Math.max(SPAWN_MIN_SEC, SPAWN_START_SEC - SPAWN_DECAY_PER_SEC * t);

/** Longest word that can appear. */
export const maxLenAt = (t: number): number => Math.min(WORD_MAX_LEN, WORD_MAX_LEN_START + Math.floor(t / WORD_LEN_UP_SEC));
