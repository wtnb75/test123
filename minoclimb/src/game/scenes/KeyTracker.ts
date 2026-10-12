import { Core, type Events, type Input } from 'phaser';

const CAPTURED = 'UP,DOWN,LEFT,RIGHT,SPACE';

/**
 * Tracks which keys went down in this Scene's lifetime. Auto-repeat events are ignored, so a key that
 * was already held before the Scene started (e.g. the retry key) never shows up as pressed.
 * The set is cleared when the game loses focus or the tab is hidden, because the matching key-up
 * events never arrive.
 */
export class KeyTracker {
    readonly down = new Set<string>();
    /** Fresh key-downs since the last time the owner cleared it. */
    readonly pressed = new Set<string>();
    private readonly keyboard: Input.Keyboard.KeyboardPlugin;
    private readonly gameEvents: Events.EventEmitter;

    constructor(keyboard: Input.Keyboard.KeyboardPlugin, gameEvents: Events.EventEmitter) {
        this.keyboard = keyboard;
        this.gameEvents = gameEvents;
        keyboard.addCapture(CAPTURED);
        keyboard.on('keydown', this.onDown);
        keyboard.on('keyup', this.onUp);
        gameEvents.on(Core.Events.BLUR, this.onBlur);
        gameEvents.on(Core.Events.HIDDEN, this.onBlur);
    }

    destroy(): void {
        this.keyboard.off('keydown', this.onDown);
        this.keyboard.off('keyup', this.onUp);
        this.gameEvents.off(Core.Events.BLUR, this.onBlur);
        this.gameEvents.off(Core.Events.HIDDEN, this.onBlur);
        this.down.clear();
        this.pressed.clear();
    }

    private readonly onDown = (event: KeyboardEvent): void => {
        if (event.repeat) return;
        this.down.add(event.code);
        this.pressed.add(event.code);
    };

    private readonly onUp = (event: KeyboardEvent): void => {
        this.down.delete(event.code);
    };

    private readonly onBlur = (): void => {
        this.down.clear();
    };
}
