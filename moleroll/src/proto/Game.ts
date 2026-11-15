// Throwaway prototype scene: one cube, moles and cats, norma-based clear.
import { Math as PMath, Scene } from 'phaser';
import { PARAMS } from './params';
import {
    IDENTITY, Mat3, Outcome, Target, Vec3,
    add, applyHit, apply, buildCubeFaces, buildCubeHoles, evaluate, hitTest,
    isFacing, isHidden, mul, pickHole, pickKind, popHeight, project, rotX, rotY, swipeDirection,
} from './logic';

const CX = PARAMS.width / 2;
const CY = PARAMS.height / 2 + 20;
const S = PARAMS.cubeScalePx;
const LIGHT = ((): Vec3 => {
    const l: Vec3 = [-0.35, -0.6, 0.72];
    const n = Math.hypot(...l);
    return [l[0] / n, l[1] / n, l[2] / n];
})();

interface PointerState {
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    mode: 'pending' | 'spin' | 'ignored';
}

export class Game extends Scene {
    private gfx!: Phaser.GameObjects.Graphics;
    private hud!: Phaser.GameObjects.Text;
    private banner!: Phaser.GameObjects.Text;
    private holes = buildCubeHoles();
    private faces = buildCubeFaces();
    private rot: Mat3 = IDENTITY;
    private targets: Target[] = [];
    private progress = 0;
    private timeLeft = PARAMS.timeLimitSec;
    private spawnTimer = 0;
    private outcome: Outcome = 'playing';
    // Active pointers by id. One of them at a time is the "spin finger"; the
    // others only tap. A pointer that moves past the threshold while another
    // finger is already spinning is ignored (neither spins nor taps).
    private pointers = new Map<number, PointerState>();
    private spinId = -1;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('Game');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1f2a44');
        this.gfx = this.add.graphics();
        this.hud = this.add.text(16, 16, '', { fontSize: '30px', color: '#ffffff', fontFamily: 'sans-serif' });
        this.banner = this.add
            .text(CX, PARAMS.height / 2, '', {
                fontSize: '44px', color: '#ffffff', fontFamily: 'sans-serif', align: 'center',
                backgroundColor: '#000000aa', padding: { x: 20, y: 16 },
            })
            .setOrigin(0.5)
            .setDepth(10);
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.input.keyboard!.on('keydown-SPACE', () => this.onAction(CX, CY));
        this.input.keyboard!.on('keydown-ENTER', () => this.onAction(CX, CY, true));
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointermove', this.onMove, this);
        this.input.on('pointerup', this.onUp, this);
        this.input.on('pointerupoutside', this.onUp, this);
        this.input.addPointer(PARAMS.extraPointers);
        this.reset();
    }

    private reset() {
        this.rot = mul(rotX(0.55), rotY(0.7));
        this.targets = [];
        this.progress = 0;
        this.timeLeft = PARAMS.timeLimitSec;
        this.spawnTimer = 0.3;
        this.outcome = 'playing';
        this.banner.setText('');
        this.banner.setVisible(false);
    }

    private onAction(x: number, y: number, restartOnly = false) {
        if (this.outcome !== 'playing') {
            this.reset();
            return;
        }
        if (!restartOnly) this.hit(x, y);
    }

    private onDown(p: Phaser.Input.Pointer) {
        this.pointers.set(p.id, { startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, mode: 'pending' });
    }

    private onMove(p: Phaser.Input.Pointer) {
        const s = this.pointers.get(p.id);
        if (!s || this.outcome !== 'playing') return;
        if (s.mode === 'pending' && Math.hypot(p.x - s.startX, p.y - s.startY) >= PARAMS.dragThresholdPx) {
            if (this.spinId === -1) {
                s.mode = 'spin';
                this.spinId = p.id;
                s.lastX = p.x;
                s.lastY = p.y;
            } else {
                s.mode = 'ignored';
            }
        }
        if (s.mode !== 'spin') return;
        this.spin((p.x - s.lastX) * PARAMS.dragRadPerPx, (p.y - s.lastY) * PARAMS.dragRadPerPx);
        s.lastX = p.x;
        s.lastY = p.y;
    }

    private onUp(p: Phaser.Input.Pointer) {
        const s = this.pointers.get(p.id);
        if (!s) return;
        this.pointers.delete(p.id);
        if (p.id === this.spinId) this.spinId = -1;
        if (s.mode === 'pending') this.onAction(p.x, p.y);
    }

    private spin(ay: number, ax: number) {
        this.rot = mul(mul(rotX(ax), rotY(ay)), this.rot);
    }

    private hit(x: number, y: number) {
        const i = hitTest(this.targets, this.rot, x, y, CX, CY);
        if (i < 0) return;
        const t = this.targets[i];
        this.targets.splice(i, 1);
        this.progress = applyHit(this.progress, t.kind);
        const p = project(apply(this.rot, add(t.hole.center, t.hole.normal, 0.3)), S, CX, CY);
        const label = t.kind === 'mole' ? '+1' : `-${PARAMS.catPenalty}`;
        const txt = this.add
            .text(p.x, p.y, label, { fontSize: '40px', color: t.kind === 'mole' ? '#ffe066' : '#ff6b6b', fontFamily: 'sans-serif' })
            .setOrigin(0.5)
            .setDepth(5);
        this.tweens.add({ targets: txt, y: p.y - 60, alpha: 0, duration: 500, onComplete: () => txt.destroy() });
        if (t.kind === 'cat') this.cameras.main.shake(150, 0.01);
    }

    update(_time: number, delta: number) {
        const dt = delta / 1000;
        if (this.outcome === 'playing') this.step(dt);
        this.draw();
    }

    private step(dt: number) {
        const k = PARAMS.keyRotateRadPerSec * dt;
        if (this.cursors.left.isDown) this.spin(-k, 0);
        if (this.cursors.right.isDown) this.spin(k, 0);
        if (this.cursors.up.isDown) this.spin(0, -k);
        if (this.cursors.down.isDown) this.spin(0, k);

        this.timeLeft -= dt;
        this.targets.forEach((t) => (t.age += dt));
        this.targets = this.targets.filter((t) => t.age < PARAMS.lifeSec);

        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.targets.length < PARAMS.maxActive) {
            const occupied = new Set(this.targets.map((t) => t.hole.id));
            const hole = pickHole(this.holes, occupied, this.rot, Math.random);
            if (hole) this.targets.push({ hole, kind: pickKind(Math.random), age: 0 });
            this.spawnTimer = PARAMS.spawnIntervalSec;
        }

        this.outcome = evaluate(this.progress, this.timeLeft);
        if (this.outcome !== 'playing') {
            const msg = this.outcome === 'clear' ? 'CLEAR!' : 'TIME UP';
            this.banner.setText(`${msg}\n${this.progress}/${PARAMS.norma}\nタップでもう一度`).setVisible(true);
        }
    }

    private vec(p: Vec3): PMath.Vector2 {
        const s = project(apply(this.rot, p), S, CX, CY);
        return new PMath.Vector2(s.x, s.y);
    }

    private poly(center: Vec3, u: Vec3, v: Vec3, r: number, n = 16): PMath.Vector2[] {
        const pts: PMath.Vector2[] = [];
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            pts.push(this.vec(add(add(center, u, Math.cos(a) * r), v, Math.sin(a) * r)));
        }
        return pts;
    }

    private draw() {
        const g = this.gfx;
        g.clear();
        this.hud.setText(`モグラ ${this.progress}/${PARAMS.norma}   ${Math.max(0, this.timeLeft).toFixed(0)}s`);

        // Faces facing the camera (convex solid, orthographic: no overlap), then holes.
        for (const f of this.faces) {
            if (!isFacing(this.rot, f.normal)) continue;
            const n = apply(this.rot, f.normal);
            const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
            const shade = Math.floor(70 + 150 * lit);
            const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) =>
                this.vec(add(add(f.normal, f.u, a), f.v, b)));
            g.fillStyle((shade << 16) | (Math.floor(shade * 0.78) << 8) | Math.floor(shade * 0.5), 1);
            g.fillPoints(corners, true);
            g.lineStyle(3, 0x2a1d0c, 1);
            g.strokePoints(corners, true);
        }
        for (const h of this.holes) {
            if (!isFacing(this.rot, h.normal)) continue;
            g.fillStyle(0x1a1208, 1);
            g.fillPoints(this.poly(h.center, h.u, h.v, PARAMS.holeRadius), true);
        }

        // Targets, back to front.
        const visible = this.targets
            .filter((t) => isFacing(this.rot, t.hole.normal))
            .sort((a, b) => apply(this.rot, a.hole.center)[2] - apply(this.rot, b.hole.center)[2]);
        for (const t of visible) this.drawTarget(t);

        for (const t of this.targets) if (isHidden(this.rot, t.hole) && t.kind === 'mole') this.drawArrow(t);
    }

    private drawTarget(t: Target) {
        const g = this.gfx;
        const h = popHeight(t.age, PARAMS.lifeSec);
        const lifted = add(t.hole.center, t.hole.normal, h);
        g.fillStyle(t.kind === 'mole' ? 0x8b5a2b : 0x9aa0a6, 1);
        g.fillPoints(this.poly(lifted, t.hole.u, t.hole.v, PARAMS.moleRadius), true);
        if (t.kind === 'cat') {
            g.fillStyle(0xf4a6b6, 1);
            for (const sgn of [-1, 1]) {
                const e = add(add(lifted, t.hole.u, sgn * 0.12), t.hole.v, -0.15);
                const q = project(apply(this.rot, e), S, CX, CY);
                g.fillCircle(q.x, q.y, 6);
            }
        }
        g.fillStyle(0x111111, 1);
        for (const sgn of [-1, 1]) {
            const e = add(add(lifted, t.hole.u, sgn * 0.06), t.hole.normal, 0.02);
            const q = project(apply(this.rot, e), S, CX, CY);
            g.fillCircle(q.x, q.y, 3);
        }
    }

    // Arrow on the rim at the mole's side, pointing in the swipe direction (inwards).
    private drawArrow(t: Target) {
        const g = this.gfx;
        const d = swipeDirection(this.rot, t.hole);
        const remaining = PARAMS.lifeSec - t.age;
        if (remaining < 0.6 && Math.floor(remaining * 8) % 2 === 0) return;
        const ax = CX - d.x * PARAMS.arrowRingPx;
        const ay = CY - d.y * PARAMS.arrowRingPx;
        const nx = -d.y;
        const ny = d.x;
        g.fillStyle(0xffa733, 1);
        g.fillTriangle(
            ax + d.x * 22, ay + d.y * 22,
            ax - d.x * 12 + nx * 16, ay - d.y * 12 + ny * 16,
            ax - d.x * 12 - nx * 16, ay - d.y * 12 - ny * 16,
        );
    }
}
