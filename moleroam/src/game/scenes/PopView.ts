import type { GameObjects, Scene } from 'phaser';
import { PARAMS } from '../params';
import { holeCenter, type Pt } from '../logic/board';
import type { Layout } from '../logic/layout';
import type { Pop } from '../logic/pop';
import { DEPTH } from './ui';

const MOLE_COLOR = 0x8d6e63;
const CAT_COLOR = 0xffb74d;

/** The objects that show one pop: a shaking dust cloud while it telegraphs, then its body. */
export class PopView {
    readonly center: Pt;
    body: GameObjects.Arc | null = null;
    private dust: GameObjects.Ellipse | null;

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
        const color = this.pop.kind === 'mole' ? MOLE_COLOR : CAT_COLOR;
        this.body = this.scene.add
            .circle(this.center.x, this.center.y - 10, PARAMS.bodyRadius, color)
            .setDepth(DEPTH.body)
            .setScale(1, 0.1);
        this.scene.tweens.add({ targets: this.body, scaleY: 1, duration: PARAMS.riseMs, ease: 'Back.Out' });
    }

    /** Pop timed out: the body sinks back into the hole. */
    retract(): void {
        this.removeDust();
        if (!this.body) return;
        this.scene.tweens.killTweensOf(this.body);
        this.scene.tweens.add({
            targets: this.body,
            scaleY: 0.1,
            duration: PARAMS.retractMs,
            onComplete: () => this.destroy(),
        });
    }

    destroy(): void {
        this.removeDust();
        if (this.body) this.scene.tweens.killTweensOf(this.body);
        this.body?.destroy();
        this.body = null;
    }

    private removeDust(): void {
        if (!this.dust) return;
        this.scene.tweens.killTweensOf(this.dust);
        this.dust.destroy();
        this.dust = null;
    }
}
