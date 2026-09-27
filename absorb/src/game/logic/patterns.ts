import { RADIAL_COUNT, THREE_WAY_SPREAD, type ActorKind } from './constants';
import { angleTo, type Point } from './geometry';

/** Straight down when the two points coincide, instead of atan2's arbitrary 0. */
export function aimAt(from: Point, to: Point): number {
    return from.x === to.x && from.y === to.y ? Math.PI / 2 : angleTo(from, to);
}

/** Directions (radians) of the bullets an enemy fires in one volley. */
export function volleyAngles(kind: ActorKind, from: Point, target: Point): number[] {
    const aim = angleTo(from, target);
    switch (kind) {
        case 'grunt':
            return [aim];
        case 'splitter':
            // A drifting splitter can come to rest on an invulnerable player; aim straight down then.
            return [aimAt(from, target)];
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
