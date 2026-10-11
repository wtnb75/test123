// What the Title accepts as input, kept out of the Scene so it can be tested without Phaser
// (docs/spec.md "Title" > "デモ" > 入力).

/** Only Space and Enter start the game from the keyboard; a held key (auto-repeat) is ignored. */
export const isStartKey = (code: string, repeat: boolean): boolean =>
    !repeat && (code === 'Space' || code === 'Enter');

/**
 * Guards the one way out of the Title: the first start request wins, and once it has been made the
 * demo must not move any more (a move due in the same frame is not played).
 */
export class TitleGate {
    private leavingNow = false;

    /** Whether the Scene is on its way to the Game. */
    get leaving(): boolean {
        return this.leavingNow;
    }

    /** A start request (button or key). True only for the first one. */
    start(): boolean {
        if (this.leavingNow) return false;
        this.leavingNow = true;
        return true;
    }
}
