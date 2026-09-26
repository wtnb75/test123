import { RADIAL_COUNT, THREE_WAY_SPREAD, type EnemyKind } from './constants';
import { angleTo, type Point } from './geometry';

/** Directions (radians) of the bullets an enemy fires in one volley. */
export function volleyAngles(kind: EnemyKind, from: Point, target: Point): number[] {
    const aim = angleTo(from, target);
    switch (kind) {
        case 'grunt':
            return [aim];
        case 'shooter':
            return [aim - THREE_WAY_SPREAD, aim, aim + THREE_WAY_SPREAD];
        case 'heavy': {
            const angles: number[] = [];
            for (let i = 0; i < RADIAL_COUNT; i++) angles.push((Math.PI * 2 * i) / RADIAL_COUNT);
            return angles;
        }
        default:
            return [];
    }
}
