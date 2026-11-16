// Draws the aim line (docs/spec/aim-line.md "画面・Scene 構成"). Which ball, where the line goes and how it is cut
// into dashes are computed by the pure logic/aim.ts.
import type { GameObjects, Scene } from 'phaser';
import { AIM_DASH, AIM_GAP, AIM_LINE_ALPHA, AIM_LINE_WIDTH } from '../params';
import { aimPath, createAimPath, dashSegments } from '../logic/aim';
import type { Run } from '../logic/run';
import { DEPTH } from './ui';

const AIM_COLOR = 0xffffff;

export class AimView {
    private readonly line: GameObjects.Graphics;
    private readonly path = createAimPath();
    private readonly dashes: number[] = [];

    constructor(scene: Scene) {
        this.line = scene.add.graphics().setDepth(DEPTH.aim);
    }

    /** Redraws the line from the run's current state and the paddle (call once a frame, after the run's step). */
    update(run: Run, paddleX: number): void {
        const g = this.line.clear();
        if (run.phase !== 'playing') return;
        aimPath(run, paddleX, this.path);
        if (this.path.pts.length < 4) return;
        dashSegments(this.path.pts, AIM_DASH, AIM_GAP, this.dashes);
        const d = this.dashes;
        g.lineStyle(AIM_LINE_WIDTH, AIM_COLOR, AIM_LINE_ALPHA);
        g.beginPath(); // all dashes in one path: one stroke instead of one per dash
        for (let i = 0; i + 3 < d.length; i += 4) {
            g.moveTo(d[i], d[i + 1]);
            g.lineTo(d[i + 2], d[i + 3]);
        }
        g.strokePath();
    }
}
