/** Body colours of each enemy kind, shared by the play scene and the game-over breakdown. */
export const KIND_COLORS = {
    grunt: 0x66bb6a,
    shooter: 0xffa726,
    heavy: 0xab47bc,
    rammer: 0xef5350,
    boss: 0xffd54f
} as const;

export const cssColor = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
