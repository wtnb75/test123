// What every Title Scene hand-wrote around a `DemoDirector`: the Scene's own clock (accumulated from `update`
// deltas), the start gate and the fade opacity. Phaser-free; see ../README.md "TitleDemoRunner".
import { DemoDirector, type DemoEvent, type DemoGame, type DemoOptions } from './director';
import { StartGate } from './gate';

export class TitleDemoRunner<S, A, R> {
    /** The flow itself (its `state` and `phase` are what the Scene draws). */
    readonly director: DemoDirector<S, A, R>;

    private readonly gate = new StartGate();
    private now = 0;

    /** Make one in the Scene's `create`, so each visit to the Title starts a new run at time 0. */
    constructor(game: DemoGame<S, A, R>, options: DemoOptions) {
        this.director = new DemoDirector(game, options, 0);
    }

    /** The Scene's clock in ms: the sum of the `update` deltas (frozen once a start was accepted). */
    get clock(): number {
        return this.now;
    }

    /** Whether the Scene is on its way to the game. */
    get leaving(): boolean {
        return this.gate.leaving;
    }

    /** The state of the current run. */
    get state(): S {
        return this.director.state;
    }

    /**
     * One frame: advances the clock by `deltaMs` and ticks the director (at most one event).
     * Returns `null`, without moving the clock, once a start was accepted.
     */
    update(deltaMs: number): DemoEvent<R> | null {
        if (this.gate.leaving) {
            return null;
        }

        this.now += Math.max(0, deltaMs);
        return this.director.tick(this.now);
    }

    /** The opacity to draw the demo with (1 except while a run is rebuilt). */
    opacity(): number {
        return this.director.opacity(this.now);
    }

    /** A start request (a button, a key, a tap). True only for the first one; the Scene then leaves. */
    requestStart(): boolean {
        return this.gate.start();
    }
}
