/** The parts of a KeyboardEvent the game reads. */
export interface KeyLike {
    key: string;
    code: string;
}

/**
 * A filter that returns true the first time it sees an event object and false afterwards. Phaser 4 processes
 * the whole key queue each time a key arrives and clears it only at the end of the frame, so when several keys
 * arrive in one frame the earlier ones are delivered again; each real key press must act once.
 */
export function firstTimeOnly<T extends object>(): (event: T) => boolean {
    const seen = new WeakSet<T>();
    return (event) => {
        if (seen.has(event)) return false;
        seen.add(event);
        return true;
    };
}

/** `key` values a browser reports while an IME is composing: the character is not available. */
const IME_KEYS = new Set(['Process', 'Unidentified']);

/**
 * True for an Enter / Space press that belongs to IME text (confirming or converting a composition): it must
 * not start or restart the game.
 */
export const isImeCommitKey = (name: string, isComposing: boolean): boolean =>
    isComposing && (name === 'Enter' || name === ' ');

/**
 * The key a press means: `e.key` as reported, so letters follow the keyboard layout. While a Japanese IME is
 * on the browser reports `Process` instead; then the physical key (`e.code`) stands in for the letters,
 * Enter, Space, Backspace and the arrows the game uses.
 */
export function keyName(e: KeyLike): string {
    if (!IME_KEYS.has(e.key)) return e.key;
    const letter = /^Key([A-Z])$/.exec(e.code);
    if (letter) return letter[1];
    switch (e.code) {
        case 'Enter':
        case 'NumpadEnter':
            return 'Enter';
        case 'Space':
            return ' ';
        case 'Backspace':
        case 'ArrowUp':
        case 'ArrowDown':
            return e.code;
        default:
            return e.key;
    }
}
