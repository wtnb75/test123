import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';
import { holeCenter, type Pt } from '../logic/board';
import type { Layout } from '../logic/layout';
import type { Pop } from '../logic/pop';
import { DEPTH } from './ui';

const MOLE_COLOR = 0x8d6e63;
const CAT_COLOR = 0xffb74d;
const GOLDEN_BODY_COLOR = 0xffc107;
const GOLDEN_RIM_COLOR = 0xfff59d;
const CLOCK_FACE_COLOR = 0xffffff;
const CLOCK_RIM_COLOR = 0x333333;
const CAT_HIT_COLOR = 0xff1744;

/**
 * A clock's body (docs/spec/items.md): a white face with a dark rim and two hands, drawn once at the origin
 * so the same tweens that move a round body move it.
 */
const drawClock = (scene: Scene, x: number, y: number): GameObjects.Container => {
    const r = PARAMS.bodyRadius;
    const g = scene.add.graphics();
    g.fillStyle(CLOCK_FACE_COLOR, 1);
    g.fillCircle(0, 0, r);
    // the rim is drawn inside the radius so the clock's diameter matches a mole body's
    g.lineStyle(6, CLOCK_RIM_COLOR, 1);
    g.strokeCircle(0, 0, r - 3);
    g.lineBetween(0, 0, 0, -r * 0.6);
    g.lineBetween(0, 0, r * 0.45, 0);
    return scene.add.container(x, y, [g]);
};

/**
 * A golden mole's body (docs/spec/golden-mole.md): a gold disc with a light rim and a small sparkle (a four-point
 * star), drawn once at the origin like a clock so the same tweens that move a round body move it. The sparkle is
 * returned so the caller can make it twinkle.
 */
const drawGolden = (scene: Scene, x: number, y: number): { body: GameObjects.Container; sparkle: GameObjects.Star } => {
    const r = PARAMS.bodyRadius;
    const disc = scene.add.graphics();
    disc.fillStyle(GOLDEN_BODY_COLOR, 1);
    disc.fillCircle(0, 0, r);
    disc.lineStyle(5, GOLDEN_RIM_COLOR, 1);
    disc.strokeCircle(0, 0, r - 2.5);
    // a four-point star: inner radius 4, outer radius 14
    const sparkle = scene.add.star(-r * 0.35, -r * 0.35, 4, 4, 14, 0xffffff);
    return { body: scene.add.container(x, y, [disc, sparkle]), sparkle };
};

/** The objects that show one pop: a shaking dust cloud while it telegraphs, then its body. */
export class PopView {
    readonly center: Pt;
    body: GameObjects.Arc | GameObjects.Container | null = null;
    /** The round body of a mole or cat (a clock's body is a container and never turns red). */
    private roundBody: GameObjects.Arc | null = null;
    private dust: GameObjects.Ellipse | null;
    /** A golden mole's twinkling sparkle (null for every other kind). */
    private sparkle: GameObjects.Star | null = null;

    constructor(
        private readonly scene: Scene,
        readonly pop: Pop,
        layout: Layout,
    ) {
        this.center = holeCenter(pop.hole, layout);
        this.dust = scene.add
            .ellipse(this.center.x, this.center.y + 10, PARAMS.dustWidth, PARAMS.dustHeight, 0xd7ccc8, 0.8)
            .setDepth(DEPTH.dust);
        scene.tweens.add({ targets: this.dust, x: this.center.x + 6, scaleX: 1.2, duration: 70, yoyo: true, repeat: -1 });
    }

    get isUp(): boolean {
        return this.body !== null;
    }

    /** End of the telegraph: the dust goes and the body rises out of the hole. */
    rise(): void {
        this.removeDust();
        const x = this.center.x;
        const y = this.center.y - 10;
        if (this.pop.kind === 'clock') {
            this.body = drawClock(this.scene, x, y).setDepth(DEPTH.body).setScale(1, 0.1);
        } else if (this.pop.kind === 'golden') {
            const golden = drawGolden(this.scene, x, y);
            this.body = golden.body.setDepth(DEPTH.body).setScale(1, 0.1);
            this.sparkle = golden.sparkle;
            this.scene.tweens.add({ targets: this.sparkle, alpha: 0.25, scale: 0.7, duration: 250, yoyo: true, repeat: -1 });
        } else {
            const color = this.pop.kind === 'mole' ? MOLE_COLOR : CAT_COLOR;
            this.roundBody = this.scene.add.circle(x, y, PARAMS.bodyRadius, color).setDepth(DEPTH.body).setScale(1, 0.1);
            this.body = this.roundBody;
        }
        this.scene.tweens.add({ targets: this.body, scaleY: 1, duration: PARAMS.riseMs, ease: 'Back.Out' });
    }

    /** A cat hit turns the body red (only a round body does; a cat is never a clock). */
    reddenBody(): void {
        this.roundBody?.setFillStyle(CAT_HIT_COLOR);
    }

    /** Pop timed out: the body sinks back into the hole. */
    retract(): void {
        this.removeDust();
        if (!this.body) return;
        this.scene.tweens.killTweensOf(this.body);
        this.stopSparkle();
        this.scene.tweens.add({
            targets: this.body,
            scaleY: 0.1,
            duration: PARAMS.retractMs,
            onComplete: () => this.destroy(),
        });
    }

    destroy(): void {
        this.removeDust();
        this.stopSparkle();
        if (this.body) this.scene.tweens.killTweensOf(this.body);
        this.body?.destroy();
        this.body = null;
        this.roundBody = null;
    }

    private stopSparkle(): void {
        if (!this.sparkle) return;
        this.scene.tweens.killTweensOf(this.sparkle);
        this.sparkle = null;
    }

    private removeDust(): void {
        if (!this.dust) return;
        this.scene.tweens.killTweensOf(this.dust);
        this.dust.destroy();
        this.dust = null;
    }
}
