import { describe, expect, it } from 'vitest';
import { DT_MAX, SPAWN_INTERVAL, TURRET_INTERVAL } from './config';

describe('config assumptions', () => {
    it('keeps DT_MAX below TURRET_INTERVAL so a turret never needs two shots in one frame', () => {
        expect(DT_MAX).toBeLessThan(TURRET_INTERVAL);
    });

    it('keeps DT_MAX below SPAWN_INTERVAL so a normal frame spawns at most one enemy', () => {
        expect(DT_MAX).toBeLessThan(SPAWN_INTERVAL);
    });
});
