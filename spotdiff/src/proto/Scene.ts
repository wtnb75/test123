import { Scene, GameObjects } from 'phaser';
import { PARAMS } from './params';
import { Diff, Layout, Shape, Stage, generateStage, hslToHex, judgeClick, layoutFor, mulberry32 } from './logic';

type Phase = 'play' | 'clear' | 'over' | 'won';

const isPortrait = () => window.innerHeight > window.innerWidth;

export class ProtoScene extends Scene {
    private stageNo = 1;
    private stage!: Stage;
    private found = new Set<number>();
    private timeLeft = 0;
    private phase: Phase = 'play';
    private seed = Date.now();
    private portrait = false;
    private layout!: Layout;
    private backdrop!: GameObjects.Graphics;
    private panels!: GameObjects.Graphics;
    private marks!: GameObjects.Graphics;
    private hud!: GameObjects.Text;
    private msg!: GameObjects.Text;

    constructor() {
        super('ProtoScene');
    }

    create() {
        this.backdrop = this.add.graphics();
        this.panels = this.add.graphics();
        this.marks = this.add.graphics();
        this.hud = this.add.text(0, 0, '', { fontSize: '30px', color: '#ffffff' }).setOrigin(0.5);
        this.msg = this.add.text(0, 0, '', { fontSize: '28px', color: '#ffd166' }).setOrigin(0.5);
        this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onClick(p.x, p.y));
        const onResize = () => this.applyOrientation();
        window.addEventListener('resize', onResize);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown');
            window.removeEventListener('resize', onResize);
        });
        this.portrait = isPortrait();
        this.applyLayout();
        this.stageNo = 1;
        this.startStage();
    }

    private applyOrientation() {
        const portrait = isPortrait();
        if (portrait === this.portrait) return;
        this.portrait = portrait;
        this.applyLayout();
        this.redraw();
    }

    private applyLayout() {
        this.layout = layoutFor(this.portrait);
        this.scale.setGameSize(this.layout.width, this.layout.height);
        this.hud.setPosition(this.layout.hud.x, this.layout.hud.y);
        this.msg.setPosition(this.layout.msg.x, this.layout.msg.y);
    }

    private startStage() {
        this.stage = generateStage(this.stageNo, mulberry32(this.seed + this.stageNo));
        this.found.clear();
        this.timeLeft = PARAMS.timeLimits[this.stageNo - 1];
        this.phase = 'play';
        this.msg.setText('');
        this.redraw();
    }

    private drawBackdrop() {
        const g = this.backdrop;
        const { width, height } = this.layout;
        g.clear();
        g.fillStyle(hslToHex(this.stage.bgHue, 0.35, 0.16), 1);
        g.fillRect(0, 0, width, height);
        // large soft circles for depth
        g.fillStyle(hslToHex(this.stage.bgHue, 0.4, 0.22), 1);
        g.fillCircle(width * 0.12, height * 0.15, width * 0.22);
        g.fillCircle(width * 0.9, height * 0.85, width * 0.26);
        g.fillStyle(hslToHex(this.stage.bgHue + 40, 0.4, 0.2), 1);
        g.fillCircle(width * 0.85, height * 0.1, width * 0.12);
    }

    private drawShape(g: GameObjects.Graphics, s: Shape, ox: number, oy: number) {
        g.fillStyle(hslToHex(s.hue, s.sat, s.light), 1);
        const x = ox + s.x;
        const y = oy + s.y;
        if (s.kind === 'circle') g.fillCircle(x, y, s.size);
        else if (s.kind === 'rect') g.fillRect(x - s.size, y - s.size, s.size * 2, s.size * 2);
        else g.fillTriangle(x, y - s.size, x - s.size, y + s.size, x + s.size, y + s.size);
    }

    private drawPanel(ox: number, oy: number, shapes: Shape[]) {
        const g = this.panels;
        const ps = PARAMS.panelSize;
        g.fillStyle(hslToHex(this.stage.bgHue, 0.3, 0.9), 1);
        g.fillRect(ox, oy, ps, ps);
        g.fillStyle(hslToHex(this.stage.bgHue, 0.3, 0.82), 1);
        this.stage.dots.forEach((d) => g.fillCircle(ox + d.x, oy + d.y, d.r));
        shapes.forEach((s) => this.drawShape(g, s, ox, oy));
    }

    private redraw() {
        this.drawBackdrop();
        this.panels.clear();
        const [a, b] = this.layout.panels;
        this.drawPanel(a.x, a.y, this.stage.left);
        this.drawPanel(b.x, b.y, this.stage.right);
        this.marks.clear();
        this.found.forEach((i) => this.mark(this.stage.diffs[i]));
        if (this.phase === 'over') this.revealRest();
        this.updateHud();
    }

    private mark(d: Diff) {
        this.marks.lineStyle(4, 0xe63946, 1);
        for (const p of this.layout.panels) this.marks.strokeCircle(p.x + d.x, p.y + d.y, d.r);
    }

    private revealRest() {
        this.stage.diffs.forEach((d, i) => {
            if (!this.found.has(i)) this.mark(d);
        });
    }

    private updateHud() {
        this.hud.setText(
            `STAGE ${this.stageNo}/${PARAMS.stageCount}   ${this.found.size}/${this.stage.diffs.length}   TIME ${Math.ceil(this.timeLeft)}`,
        );
    }

    private panelAt(px: number, py: number): { x: number; y: number } | null {
        const ps = PARAMS.panelSize;
        for (const p of this.layout.panels) {
            if (px >= p.x && px <= p.x + ps && py >= p.y && py <= p.y + ps) return p;
        }
        return null;
    }

    private onClick(px: number, py: number) {
        if (this.phase === 'over' || this.phase === 'won') {
            this.stageNo = 1;
            this.startStage();
            return;
        }
        if (this.phase !== 'play') return;
        const panel = this.panelAt(px, py);
        if (!panel) return;
        const hit = judgeClick(this.stage.diffs, this.found, px - panel.x, py - panel.y);
        if (hit >= 0) {
            this.found.add(hit);
            this.mark(this.stage.diffs[hit]);
            if (this.found.size === this.stage.diffs.length) this.clearStage();
        } else {
            this.timeLeft = Math.max(0, this.timeLeft - PARAMS.missPenalty);
            this.cameras.main.shake(120, 0.004);
        }
        this.updateHud();
        if (this.timeLeft <= 0 && this.phase === 'play') this.end('over');
    }

    private clearStage() {
        if (this.stageNo >= PARAMS.stageCount) {
            this.end('won');
            return;
        }
        this.phase = 'clear';
        this.msg.setText('CLEAR!');
        this.time.delayedCall(PARAMS.stageClearPauseMs, () => {
            this.stageNo += 1;
            this.startStage();
        });
    }

    private end(phase: 'over' | 'won') {
        this.phase = phase;
        this.msg.setText(phase === 'won' ? 'ALL CLEAR! tap to restart' : 'TIME UP... tap to restart');
        if (phase === 'over') this.revealRest();
    }

    update(_time: number, delta: number) {
        if (this.phase !== 'play') return;
        this.timeLeft = Math.max(0, this.timeLeft - delta / 1000);
        this.updateHud();
        if (this.timeLeft <= 0) this.end('over');
    }
}
