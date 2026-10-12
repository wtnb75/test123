import { demoBot, type DemoSight } from '../logic/demoBot';
import { HEIGHT, WIDTH } from '../params';
import { DEMO_WINDOW } from '../logic/titleLayout';
import type { BoardViewOptions } from './BoardView';
import { Game, type Control } from './Game';

/**
 * The real game played by a bot behind the Title: the same Round and drawing as Game, but with no input
 * of its own, no hints, no touch tint, no Result and no shake. The Title restarts it now and then.
 */
export class Demo extends Game {
    protected override readonly isDemo: boolean = true;

    /** Reused every frame (the bot only reads it). */
    private readonly sight: DemoSight = { grid: [], player: { x: 0, y: 0, vy: 0, onGround: false }, flow: { kind: 'wait', timer: 0 } };

    constructor() {
        super('Demo');
    }

    override create(): void {
        super.create();
        // The whole board, uniformly shrunk into the Title's window.
        const w = DEMO_WINDOW;
        const cam = this.cameras.main;
        cam.setViewport(w.x, w.y, w.width, w.height);
        cam.setZoom(w.scale);
        cam.centerOn(WIDTH / 2, HEIGHT / 2);
    }

    protected override viewOptions(): BoardViewOptions {
        return { hints: false, touchTint: false };
    }

    protected override setupControls(): void {
        // The bot plays; nothing here listens to the player.
    }

    protected override readControl(): Control {
        this.sight.grid = this.round.grid;
        this.sight.player = this.round.player;
        this.sight.flow = this.round.flow;
        return { move: demoBot(this.sight, this.playSec), stick: null };
    }

    protected override onRoundEnd(): void {
        // The last picture stays until the Title rebuilds the run.
    }

    /** The curtain starts to close: the lights that are playing are dropped (docs/spec/title-demo.md). */
    dropEffects(): void {
        this.view?.clearEffects();
    }

    /** True once the round is over (cleared, crushed or topped out): the Title closes its curtain soon. */
    get roundEnded(): boolean {
        return this.round !== undefined && this.round.status !== 'playing';
    }
}
