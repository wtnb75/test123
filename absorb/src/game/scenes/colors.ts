/** Body colours of each enemy kind, shared by the play scene and the game-over breakdown. */
export const KIND_COLORS = {
    grunt: 0x66bb6a,
    shooter: 0xffa726,
    heavy: 0xab47bc,
    rammer: 0xef5350,
    // A deeper blue than the field and release cyan, so a splitter never reads as the player's own.
    splitter: 0x42a5f5,
    // Plain grey hull; its cargo shows as a mark in that kind's colour.
    carrier: 0x90a4ae,
    boss: 0xffd54f
} as const;

export const cssColor = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
