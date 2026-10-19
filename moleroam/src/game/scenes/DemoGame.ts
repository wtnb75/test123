import { PARAMS } from '../params';
import type { Pt } from '../logic/board';
import { decideDemo, newDemoMove, type DemoSight } from '../logic/demoBot';
import type { Layout } from '../logic/layout';
import type { Pop } from '../logic/pop';
import { Game } from './Game';

/** What the Title hands over when it starts (or restarts) the demo. */
export interface DemoData {
    layout: Layout;
}

/**
 * The real game played by a bot behind the Title: the same board, pops, arrows and effects as Game, but no
 * HUD, no input of its own, no fade-in and no Result. The Title restarts it now and then.
 */
export class DemoGame extends Game {
    private readonly move = newDemoMove();
    private readonly sightPops: Pop[] = [];
    private readonly sight: DemoSight = {
        now: 0,
        view: { x: 0, y: 0, w: 0, h: 0 },
        layout: this.layout,
        pops: this.sightPops,
    };

    constructor() {
        super('Demo');
    }

    /** The Title decides the size once; the demo uses the layout it is given and never picks again. */
    protected override chooseLayout(data?: unknown): Layout {
        return (data as DemoData).layout;
    }

    protected override beginScene(): void {
        // The Title fades in (its camera covers this one too).
    }

    protected override setupInput(): void {
        // The bot plays; nothing here listens to the player.
    }

    protected override teardownInput(): void {
        // Nothing was registered.
    }

    protected override createHud(): void {
        // No score, time or aiming ring.
    }

    protected override updateHud(): void {
        // See createHud.
    }

    protected override announceStreak(): void {
        // The "×N!" message belongs to the HUD layer, which the demo does not draw.
    }

    protected override enterEnding(): void {
        // The run is rebuilt long before the clock runs out; should it ever run out, the last picture stays.
    }

    /** The bot taps first (with this frame's view), then scrolls like the arrow keys, only slower. */
    protected override scrollStep(delta: number): void {
        const cam = this.cameras.main;
        this.sightPops.length = 0;
        for (const v of this.live) this.sightPops.push(v.pop);
        this.sight.now = this.elapsedMs;
        this.sight.layout = this.layout;
        this.sight.view.x = cam.scrollX;
        this.sight.view.y = cam.scrollY;
        this.sight.view.w = this.layout.viewW;
        this.sight.view.h = this.layout.viewH;
        decideDemo(this.sight, this.move);
        if (this.move.strike) this.strike(this.move.strikeX, this.move.strikeY);
        const step = (PARAMS.scrollSpeed * PARAMS.demoScrollRatio * delta) / 1000;
        const by: Pt = { x: this.move.moveX * step, y: this.move.moveY * step };
        this.scrollBy(by);
    }
}
