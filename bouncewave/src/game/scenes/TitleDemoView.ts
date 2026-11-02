import type { GameObjects, Scene } from 'phaser';
import {
    BALL_RADIUS,
    DEMO_BEST_GAP,
    DEMO_BORDER,
    DEMO_CROP_TOP,
    DEMO_FIELD_HEIGHT,
    DEMO_VIEW_HEIGHT,
    FIELD_LEFT,
    FIELD_RIGHT,
    FIELD_TOP,
    FRAME_WIDTH,
    SCREEN_WIDTH,
} from '../params';
import type { DemoLayout, DemoState } from '../logic/titleDemo';
import { BG_COLOR, ENEMY_RED, FRAME_COLOR, myBallTexture, TEX } from './ui';

const WINDOW_BG = 0x0a101c; // a shade darker than the Scene background, so the window reads as a frame
/** Draw order on the Title: the picture, then the strip hiding balls below the window, then the frame; all above the texts (depth 0). */
const DEPTH_PICTURE = 1;
const DEPTH_BOTTOM_STRIP = 2;
const DEPTH_FRAME = 3;
const DANGER_THICKNESS = 4; // Run px (the game's 2 would be under 1 on-screen px in the window)

/**
 * The Title's demo window: a reduced picture of the demo Run, drawn with the game's own textures. The picture
 * (background, walls, danger line, sprites) lives in one container so it fades as a whole; the frame around it,
 * and a strip hiding balls that leave through the open bottom, stay put.
 */
export class TitleDemoView {
    private readonly content: GameObjects.Container;
    private readonly enemyLayer: GameObjects.Container;
    private readonly enemyBallLayer: GameObjects.Container;
    private readonly myBallLayer: GameObjects.Container;
    private readonly paddle: GameObjects.Image;
    private readonly enemies = new Map<number, GameObjects.Image>();
    private readonly balls = new Map<number, GameObjects.Image>();

    constructor(
        private readonly scene: Scene,
        layout: DemoLayout,
        dangerY: number,
    ) {
        // Run (0, DEMO_CROP_TOP) sits at the window's top-left: nothing above the top wall is shown.
        this.content = scene.add.container(layout.x, layout.y - DEMO_CROP_TOP * layout.scale).setScale(layout.scale).setDepth(DEPTH_PICTURE);
        this.content.add(scene.add.rectangle(0, DEMO_CROP_TOP, SCREEN_WIDTH, DEMO_VIEW_HEIGHT, WINDOW_BG).setOrigin(0, 0));
        this.content.add(this.drawFrame());
        this.content.add(this.drawDangerLine(dangerY));
        this.enemyLayer = scene.add.container(0, 0);
        this.paddle = scene.add.image(SCREEN_WIDTH / 2, 0, TEX.paddle);
        this.enemyBallLayer = scene.add.container(0, 0);
        this.myBallLayer = scene.add.container(0, 0);
        this.content.add([this.enemyLayer, this.paddle, this.enemyBallLayer, this.myBallLayer]);

        // Hides what overshoots the window's bottom edge: a ball is drawn until its centre is a radius below the
        // field, so up to 2 radii stick out. Capped at the gap above the best-score text (at most ~0.7 px of a ball's
        // tip can show on the widest window).
        const overshoot = Math.min(2 * BALL_RADIUS * layout.scale, DEMO_BEST_GAP);
        scene.add
            .rectangle(layout.x + layout.width / 2, layout.y + layout.height + overshoot / 2, layout.width, overshoot, BG_COLOR)
            .setDepth(DEPTH_BOTTOM_STRIP);
        // The frame sits outside the content (the stroke is centred on the edge of a rectangle B larger).
        scene.add
            .rectangle(layout.x + layout.width / 2, layout.y + layout.height / 2, layout.width + DEMO_BORDER, layout.height + DEMO_BORDER)
            .setStrokeStyle(DEMO_BORDER, FRAME_COLOR)
            .setDepth(DEPTH_FRAME);
    }

    /** The walls, as the Game draws them (the bottom stays open). */
    private drawFrame(): GameObjects.Graphics {
        const top = FIELD_TOP - FRAME_WIDTH;
        return this.scene.add
            .graphics()
            .fillStyle(FRAME_COLOR)
            .fillRect(0, top, SCREEN_WIDTH, FRAME_WIDTH)
            .fillRect(0, top, FIELD_LEFT, DEMO_FIELD_HEIGHT - top)
            .fillRect(FIELD_RIGHT, top, SCREEN_WIDTH - FIELD_RIGHT, DEMO_FIELD_HEIGHT - top);
    }

    private drawDangerLine(y: number): GameObjects.Graphics {
        const g = this.scene.add.graphics().fillStyle(ENEMY_RED, 0.45);
        const dash = 12;
        const gap = 8;
        for (let x = FIELD_LEFT; x < FIELD_RIGHT; x += dash + gap) {
            g.fillRect(x, y - DANGER_THICKNESS / 2, Math.min(dash, FIELD_RIGHT - x), DANGER_THICKNESS);
        }
        return g;
    }

    /** Opacity of the picture (the frame, texts and START are not part of it). */
    setAlpha(alpha: number): void {
        this.content.setAlpha(alpha);
    }

    /** Starts over for a new Run: drops every sprite and draws the formation. Call before any `sync`. */
    reset(demo: DemoState): void {
        for (const s of this.enemies.values()) s.destroy();
        for (const s of this.balls.values()) s.destroy();
        this.enemies.clear();
        this.balls.clear();
        this.paddle.setPosition(demo.paddleX, demo.run.paddleY);
        this.addEnemies(demo);
    }

    private addEnemies(demo: DemoState): void {
        for (const e of demo.run.formation.enemies) {
            const s = this.scene.add.image(e.rect.x, e.rect.y, TEX.enemy);
            this.enemyLayer.add(s);
            this.enemies.set(e.id, s);
        }
    }

    /** Draws the state after a `stepDemo` (reads that step's outputs: killed enemies, removed balls, new wave). */
    sync(demo: DemoState): void {
        const run = demo.run;
        for (const id of run.killedEnemyIds) {
            this.enemies.get(id)?.destroy();
            this.enemies.delete(id);
        }
        if (run.formationSpawned) this.addEnemies(demo);
        for (const e of run.formation.enemies) this.enemies.get(e.id)?.setPosition(e.rect.x, e.rect.y);
        this.paddle.x = demo.paddleX;

        for (const id of run.removedBallIds) {
            this.balls.get(id)?.destroy();
            this.balls.delete(id);
        }
        for (const b of run.balls) {
            const tex = b.owner === 'mine' ? myBallTexture(b.tier) : TEX.enemyBall;
            let s = this.balls.get(b.id);
            if (!s) {
                s = this.scene.add.image(b.x, b.y, tex);
                (b.owner === 'mine' ? this.myBallLayer : this.enemyBallLayer).add(s);
                this.balls.set(b.id, s);
            } else if (s.texture.key !== tex) {
                s.setTexture(tex);
                // An enemy ball turns into an own ball when the paddle catches it: move it to the own-ball layer.
                if (b.owner === 'mine') this.myBallLayer.add(s);
            }
            s.setPosition(b.x, b.y);
        }
    }
}
