import { decideDemoInput } from '../logic/demoBot';
import { Game } from './Game';

/**
 * The real game played by a bot behind the title: the same world, drawing and effects as Game, but with
 * no HUD, no countdown, no keys or pointer, no pause and no game-over screen. The Title scene restarts it.
 */
export class DemoGame extends Game {
    constructor() {
        super('Demo');
    }

    protected override startWorld(): void {
        this.world.beginPlay();
    }

    protected override setupControls(): void {
        // The bot plays; nothing here listens to the player.
    }

    protected override readInput(): void {
        decideDemoInput(this.world, this.input_);
    }

    protected override drawHudLayer(): void {
        if (import.meta.env.DEV) {
            // QA only: a read-only view of the demo's world (never part of the production bundle).
            const w = this.world;
            (window as unknown as { __qaDemo?: unknown }).__qaDemo = {
                phase: w.phase,
                elapsed: w.elapsed,
                score: w.score,
                lives: w.player.lives,
                stock: w.stock,
                enemies: w.enemies.length
            };
        }
    }

    protected override drawStartRings(): void {
        // No "3, 2, 1" and no "GO!" ring: the demo is already playing.
    }

    protected override onWorldOver(): void {
        // The demo is never ended by game over: the last picture stays until the title rebuilds it.
    }
}
