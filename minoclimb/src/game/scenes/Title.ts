import { Scene, type GameObjects } from 'phaser';
import { P } from '../params';
import { START_KEYS, wasPressed } from '../logic/input';
import { DemoRunClock } from '../logic/demoRun';
import { DEMO_WINDOW, TITLE_LAYOUT as L } from '../logic/titleLayout';
import type { Demo } from './Demo';
import { SceneInput } from './SceneInput';

const DEPTH_CURTAIN = 1;
const DEPTH_UI = 2;
const BUTTON_COLOR = 0xffe040;
const BUTTON_RADIUS = 12;
const FRAME_COLOR = 0x8890a8;
const FRAME_WIDTH = 2;
const FONT = 'sans-serif';

/**
 * The first screen: the name, a small window in which a bot plays the real game (the Demo scene, drawn
 * into that window) and START. A black curtain over the window hides the rebuilds of the demo
 * (docs/spec/title-demo.md). Nothing here overlaps the demo.
 */
export class Title extends Scene {
    private clock = new DemoRunClock();
    private controls: SceneInput | null = null;
    private curtain!: GameObjects.Rectangle;

    constructor() {
        super('Title');
    }

    create(): void {
        // The Scene instance is reused when the Title comes back, so every per-visit field is reset here.
        this.clock = new DemoRunClock();
        this.controls = new SceneInput(this);

        const cx = L.centerX;
        const w = DEMO_WINDOW;
        const midX = w.x + w.width / 2;
        const midY = w.y + w.height / 2;
        this.curtain = this.add.rectangle(midX, midY, w.width, w.height, 0x000000, 1)
            .setAlpha(0).setDepth(DEPTH_CURTAIN);
        this.add.rectangle(midX, midY, w.width + FRAME_WIDTH * 2, w.height + FRAME_WIDTH * 2)
            .setStrokeStyle(FRAME_WIDTH, FRAME_COLOR).setDepth(DEPTH_UI);

        this.add.text(cx, L.nameY, 'MINOCLIMB', {
            fontFamily: FONT, fontSize: `${L.nameSize}px`, color: '#ffffff',
        }).setOrigin(0.5).setDepth(DEPTH_UI);
        this.add.graphics().setDepth(DEPTH_UI)
            .fillStyle(BUTTON_COLOR, 1)
            .fillRoundedRect(cx - P.START_W / 2, L.buttonY - P.START_H / 2, P.START_W, P.START_H, BUTTON_RADIUS);
        this.add.text(cx, L.buttonY, 'START', {
            fontFamily: FONT, fontSize: `${L.startLabelSize}px`, color: '#10131c', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(DEPTH_UI);

        this.events.once('shutdown', () => {
            // Whatever way the Title ends, the demo in its window does not outlive it.
            this.scene.stop('Demo');
        });
        this.scene.launch('Demo');
        this.scene.bringToTop();
    }

    update(_time: number, deltaMs: number): void {
        if (this.clock.leaving) return;

        // Presses (a key, a tap anywhere) are latched by SceneInput, so even a very short one counts.
        if (wasPressed(this.controls!.read(), START_KEYS) && this.clock.requestStart()) {
            this.scene.stop('Demo');
            this.scene.start('Game');
            return;
        }

        const demo = this.scene.get('Demo') as Demo;
        // Game time, like the Round's: a long frame (a stall, a tab coming back) is capped at MAX_DT.
        const event = this.clock.update(Math.min(deltaMs, P.MAX_DT * 1000), demo.roundEnded);
        if (event?.kind === 'fade-out') demo.dropEffects();
        if (event?.kind === 'fade-in') {
            // The window is black: a new run starts under the lifting curtain.
            this.scene.stop('Demo');
            this.scene.launch('Demo');
            this.scene.bringToTop();
        }
        this.curtain.setAlpha(1 - this.clock.opacity());

        if (import.meta.env.DEV) {
            // QA only (never part of the production bundle): a read-only view of the Title and its demo.
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Title',
                demoVisible: true,
                demoPhase: this.clock.phase,
                demoRounds: demo.roundEnded ? 1 : 0, // rounds finished in the current run (a run is one round)
                rebuilds: this.clock.rebuilds,
                clock: this.clock.clock,
                curtain: this.curtain.alpha,
            };
        }
    }
}
