import type { Region } from './types';

/** Everything at or below trayTopY is the tray; above it is the placement area. */
export function regionForY(y: number, trayTopY: number): Region {
    return y >= trayTopY ? 'tray' : 'placement';
}
