/**
 * Guards the one way out of a Title: the first start request wins, and once it has been made the demo must
 * not move any more (an action due in the same frame is not played).
 */
export class StartGate {
    private leavingNow = false;

    /** Whether the Scene is on its way to the game. */
    get leaving(): boolean {
        return this.leavingNow;
    }

    /** A start request (a button, a key, a tap). True only for the first one. */
    start(): boolean {
        if (this.leavingNow) return false;
        this.leavingNow = true;
        return true;
    }
}
