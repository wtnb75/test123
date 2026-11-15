// Draws the cube, its holes, the Pops and the direction arrows with one Graphics object
// (docs/spec.md "Game の盤面", "方向矢印"). Point arrays are reused so a frame allocates little.
import { Math as PMath, type GameObjects, type Scene } from 'phaser';
import { CAMERA_DISTANCE, CUBE_SCALE_PX, HOLE_RADIUS, MOLE_RADIUS } from '../params';
import { arrowFor, arrowPulseScale, arrowTriangle, hasArrow, popArrowVisible } from '../logic/arrow';
import { popHeight, type Pop } from '../logic/pop';
import { popPoint } from '../logic/hit';
import { add, apply, isFacing, project, type Mat3, type Point, type Vec3 } from '../logic/math';
import type { Run } from '../logic/run';
import type { Shape } from '../logic/shape';
import { DEPTH } from './ui';

const CIRCLE_SEGMENTS = 20;
const CIRCLE_COS_SIN: readonly (readonly [number, number])[] = Array.from({ length: CIRCLE_SEGMENTS }, (_, i) => {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)] as const;
});
/** Light from the upper left, in front (unit length after normalising below). */
const LIGHT: Vec3 = (() => {
    const l: [number, number, number] = [-0.35, -0.6, 0.72];
    const n = Math.hypot(...l);
    return [l[0] / n, l[1] / n, l[2] / n];
})();
const ARROW_COLOR = 0xffa733;
const MOLE_COLOR = 0x8b5a2b;
const CAT_COLOR = 0x9aa0a6;
const EAR_COLOR = 0xf4a6b6;
const HOLE_COLOR = 0x1a1208;

export class CubeView {
    private readonly g: GameObjects.Graphics;
    private readonly circle: PMath.Vector2[] = Array.from({ length: CIRCLE_SEGMENTS }, () => new PMath.Vector2());
    private readonly quad: PMath.Vector2[] = Array.from({ length: 4 }, () => new PMath.Vector2());
    private readonly tri: PMath.Vector2[] = Array.from({ length: 3 }, () => new PMath.Vector2());
    /** Pops in drawing order, reused every frame. */
    private readonly order: { pop: Pop; z: number }[] = [];

    constructor(scene: Scene, private readonly shape: Shape, private readonly origin: Point) {
        this.g = scene.add.graphics().setDepth(DEPTH.cube);
    }

    /** Fills the reused points with a circle on the surface (tangents u, v) round `center`. */
    private setCircle(m: Mat3, center: Vec3, u: Vec3, v: Vec3, r: number): void {
        // Rotate the centre and the two tangents once; each vertex is then plain arithmetic.
        const c = apply(m, center);
        const ru = apply(m, u);
        const rv = apply(m, v);
        for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
            const k = CIRCLE_COS_SIN[i];
            const a = k[0] * r;
            const b = k[1] * r;
            const x = c[0] + ru[0] * a + rv[0] * b;
            const y = c[1] + ru[1] * a + rv[1] * b;
            const z = c[2] + ru[2] * a + rv[2] * b;
            const f = CAMERA_DISTANCE / (CAMERA_DISTANCE - z);
            this.circle[i].set(this.origin.x + x * CUBE_SCALE_PX * f, this.origin.y + y * CUBE_SCALE_PX * f);
        }
    }

    private dot(m: Mat3, q: Vec3, radius: number, color: number): void {
        const s = project(apply(m, q), this.origin);
        this.g.fillStyle(color, 1);
        this.g.fillCircle(s.x, s.y, radius);
    }

    draw(run: Run): void {
        const g = this.g;
        const m = run.rot;
        g.clear();
        this.drawFaces(m);
        this.drawPops(run);
        this.drawArrows(run);
    }

    private drawFaces(m: Mat3): void {
        const g = this.g;
        for (const f of this.shape.faces) {
            if (!isFacing(m, f)) continue;
            const n = apply(m, f.normal);
            const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
            const shade = Math.floor(70 + 150 * lit);
            f.corners.forEach((c, i) => {
                const s = project(apply(m, c), this.origin);
                this.quad[i].set(s.x, s.y);
            });
            g.fillStyle((shade << 16) | (Math.floor(shade * 0.78) << 8) | Math.floor(shade * 0.5), 1);
            g.fillPoints(this.quad, true);
            g.lineStyle(3, 0x2a1d0c, 1);
            g.strokePoints(this.quad, true);
        }
        g.fillStyle(HOLE_COLOR, 1);
        for (const h of this.shape.holes) {
            if (!isFacing(m, h)) continue;
            this.setCircle(m, h.center, h.u, h.v, HOLE_RADIUS);
            g.fillPoints(this.circle, true);
        }
    }

    private drawPops(run: Run): void {
        const m = run.rot;
        this.order.length = 0;
        for (const pop of run.pops) {
            if (isFacing(m, pop.hole)) this.order.push({ pop, z: popPoint(pop, m)[2] });
        }
        this.order.sort((a, b) => a.z - b.z);
        for (const { pop } of this.order) this.drawPop(m, pop);
    }

    private drawPop(m: Mat3, pop: Pop): void {
        const g = this.g;
        const { hole } = pop;
        const lifted = add(hole.center, hole.normal, popHeight(pop.age));
        this.setCircle(m, lifted, hole.u, hole.v, MOLE_RADIUS);
        g.fillStyle(pop.kind === 'mole' ? MOLE_COLOR : CAT_COLOR, 1);
        g.fillPoints(this.circle, true);
        if (pop.kind === 'cat') {
            for (const sgn of [-1, 1]) this.dot(m, add(add(lifted, hole.u, sgn * 0.12), hole.v, -0.15), 6, EAR_COLOR);
        }
        for (const sgn of [-1, 1]) this.dot(m, add(add(lifted, hole.u, sgn * 0.06), hole.normal, 0.02), 3, 0x111111);
    }

    private drawArrows(run: Run): void {
        const g = this.g;
        g.fillStyle(ARROW_COLOR, 1);
        const pulse = arrowPulseScale(run.elapsed);
        for (const pop of run.pops) {
            if (!hasArrow(pop, run.rot) || !popArrowVisible(pop)) continue;
            const [tip, b1, b2] = arrowTriangle(arrowFor(pop, run.rot, this.origin), pulse);
            this.tri[0].set(tip.x, tip.y);
            this.tri[1].set(b1.x, b1.y);
            this.tri[2].set(b2.x, b2.y);
            g.fillPoints(this.tri, true);
        }
    }
}
