import { GameObjects, Input, Scene } from 'phaser';
import { StartGate } from 'title-demo';
import type { DemoEvent } from 'title-demo';
import { hslToHex } from '../logic/color';
import { hitPopScale, promptAlpha, tapRingAlpha, tapRingRadius } from '../logic/effects';
import { HELP_BUTTON_LABEL, helpButtonRect, titleTapTarget } from '../logic/help';
import type { Layout } from '../logic/layout';
import { dateToYmd } from '../logic/random';
import { firstSet } from '../logic/set';
import { DemoTap, TitleDemo, createTitleDemo } from '../logic/titleDemo';
import { titleLayoutFor } from '../logic/titleLayout';
import { PARAMS } from '../params';
import { MENU_HUE, PanelFrame, UI_FONT, drawBackdrop, drawPanel, strokeMark } from './draw';
import { bindOrientation } from './orientation';

const DEPTH = { backdrop: 0, panels: 1, marks: 2, ring: 3, text: 4 } as const;

/** A tap ring that is playing: `ms` since the tap frame (t = 0). */
interface Ring extends DemoTap {
    ms: number;
    /** Created this frame: it skips the first tick so that its first drawn frame is t = 0. */
    fresh: boolean;
}

/**
 * The title screen: name, tagline, today's date, the pulsing prompt and a demo (a bot finds the differences of a
 * random picture). The demo's flow lives in `logic/titleDemo` (shared `title-demo` package); this Scene feeds it
 * the clock, draws it, and starts the Game on any tap.
 */
export class Title extends Scene {
    private backdrop!: GameObjects.Graphics;
    private panels!: GameObjects.Graphics;
    private marks!: GameObjects.Graphics;
    private ringGfx!: GameObjects.Graphics;
    private name!: GameObjects.Text;
    private tagline!: GameObjects.Text;
    private dateText!: GameObjects.Text;
    private prompt!: GameObjects.Text;
    private helpBox!: GameObjects.Graphics;
    private helpLabel!: GameObjects.Text;
    private date = 0;
    private pulseMs = 0;
    /** Time since the Scene started, counted from `update`'s delta (the demo's clock). */
    private clock = 0;
    private demo!: TitleDemo;
    private gate = new StartGate();
    private layout!: Layout;
    private frames: PanelFrame[] = [
        { x: 0, y: 0, scale: 1 },
        { x: 0, y: 0, scale: 1 },
    ];
    /** Time since each difference was found (>= `hitPopMs` once its ring has finished growing). */
    private pops: number[] = [];
    private popFresh: boolean[] = [];
    private ring: Ring | null = null;
    private shownAlpha = 1;

    constructor() {
        super('Title');
    }

    create() {
        // The date is taken once here and handed to Game as is.
        const today = new Date();
        this.date = dateToYmd(today);
        this.pulseMs = 0;
        this.clock = 0;
        this.gate = new StartGate();
        this.ring = null;
        this.shownAlpha = 1;
        const label = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // The demo has its own randomness (its pictures never depend on the date or the set number).
        this.demo = createTitleDemo(Math.random, 0);
        this.resetPops();

        const text = (size: number, color: string) => ({ fontFamily: UI_FONT, fontSize: `${size}px`, color });
        this.backdrop = this.add.graphics().setDepth(DEPTH.backdrop);
        this.panels = this.add.graphics().setDepth(DEPTH.panels);
        this.marks = this.add.graphics().setDepth(DEPTH.marks);
        this.ringGfx = this.add.graphics().setDepth(DEPTH.ring);
        this.name = this.add.text(0, 0, 'SpotDiff', text(72, '#ffffff')).setOrigin(0.5).setDepth(DEPTH.text);
        this.tagline = this.add.text(0, 0, 'Find the differences', text(32, '#dfe6f5')).setOrigin(0.5).setDepth(DEPTH.text);
        this.dateText = this.add.text(0, 0, label, text(28, '#ffd166')).setOrigin(0.5).setDepth(DEPTH.text);
        this.prompt = this.add.text(0, 0, 'TAP TO START', text(36, '#ffffff')).setOrigin(0.5).setDepth(DEPTH.text);
        this.helpBox = this.add.graphics().setDepth(DEPTH.text);
        this.helpLabel = this.add.text(0, 0, HELP_BUTTON_LABEL, text(32, '#ffffff')).setOrigin(0.5).setDepth(DEPTH.text);

        this.place(bindOrientation(this, (layout) => this.place(layout)));
        // The button opens the Help; any other tap starts. The first request wins (a second input in the same frame is ignored).
        this.input.once('pointerdown', (pointer: Input.Pointer) => {
            if (!this.gate.start()) return;
            if (titleTapTarget(this.layout.kind, pointer.x, pointer.y) === 'help') this.scene.start('Help');
            else this.scene.start('Game', firstSet(this.date));
        });
    }

    update(_time: number, delta: number) {
        // the prompt is at full opacity on the first frame, then breathes
        this.prompt.setAlpha(promptAlpha(this.pulseMs));
        this.pulseMs += delta;
        if (this.gate.leaving) return; // on the way to the Game: the demo no longer moves
        this.clock += delta;
        const event = this.demo.tick(this.clock);
        if (event) this.onDemoEvent(event);
        this.advanceEffects(delta);
        this.applyOpacity();
        // Dev build only: a read-only snapshot for the browser QA scripts (scripts/qa); removed from production.
        if (import.meta.env.DEV) {
            const s = this.demo.state;
            Object.assign(window, {
                __qa: {
                    scene: 'Title',
                    phase: this.demo.phase,
                    stageNo: s.stageNo,
                    found: s.found.size,
                    total: s.stage.diffs.length,
                    rounds: this.demo.rounds,
                    kind: this.layout.kind,
                    opacity: this.shownAlpha,
                },
            });
        }
    }

    private place(layout: Layout) {
        this.layout = layout;
        const t = titleLayoutFor(layout.kind);
        drawBackdrop(this.backdrop, t.width, t.height, MENU_HUE);
        this.dateText.setFontSize(t.bigText ? 32 : 28); // phone layout texts stay >= 32px on the canvas
        this.name.setPosition(t.name.x, t.name.y);
        this.tagline.setPosition(t.tagline.x, t.tagline.y);
        this.dateText.setPosition(t.date.x, t.date.y);
        this.prompt.setPosition(t.prompt.x, t.prompt.y);
        const b = helpButtonRect(layout.kind);
        this.helpBox.clear();
        this.helpBox.fillStyle(hslToHex(MENU_HUE, 0.45, 0.32), 1);
        this.helpBox.fillRect(b.x, b.y, b.w, b.h);
        this.helpBox.lineStyle(3, 0xdfe6f5, 1);
        this.helpBox.strokeRect(b.x, b.y, b.w, b.h);
        this.helpLabel.setFontSize(b.size).setPosition(b.cx, b.cy);
        t.panels.forEach((p, i) => {
            this.frames[i].x = p.x;
            this.frames[i].y = p.y;
            this.frames[i].scale = t.panelScale;
        });
        // the demo goes on as it was; only its drawing is redone for the new layout
        this.drawStage();
        this.drawRing();
    }

    private onDemoEvent(event: DemoEvent<DemoTap>) {
        if (event.kind === 'action') {
            const { diff } = event.detail;
            this.pops[diff] = 0;
            this.popFresh[diff] = true;
            this.ring = { ...event.detail, ms: 0, fresh: true };
            this.drawMarks();
            this.drawRing();
        } else if (event.kind === 'fade-out') {
            // the rings still growing jump to their final size and the tap ring goes away with the picture
            this.pops.fill(PARAMS.hitPopMs);
            this.popFresh.fill(false);
            this.ring = null;
            this.drawMarks();
            this.drawRing();
        } else {
            // 'advance' (the next stage) and 'fade-in' (a new demo game): nothing of the old picture carries over
            this.ring = null;
            this.resetPops();
            this.drawStage();
            this.drawRing();
        }
    }

    private resetPops() {
        const n = this.demo.state.stage.diffs.length;
        this.pops = Array.from({ length: n }, () => PARAMS.hitPopMs);
        this.popFresh = Array.from({ length: n }, () => false);
    }

    private drawStage() {
        const { stage } = this.demo.state;
        this.panels.clear();
        drawPanel(this.panels, this.frames[0], stage.left, stage);
        drawPanel(this.panels, this.frames[1], stage.right, stage);
        this.drawMarks();
    }

    /** Found differences as red rings on both pictures, growing while they pop in. */
    private drawMarks() {
        this.marks.clear();
        const { stage, found } = this.demo.state;
        for (const i of found) {
            const factor = this.pops[i] < PARAMS.hitPopMs ? hitPopScale(this.pops[i]) : 1;
            strokeMark(this.marks, this.frames[0], stage.diffs[i], PARAMS.markColor, factor);
            strokeMark(this.marks, this.frames[1], stage.diffs[i], PARAMS.markColor, factor);
        }
    }

    /** The white ring where the bot just tapped (canvas px; the width and radii never scale with the picture). */
    private drawRing() {
        this.ringGfx.clear();
        const r = this.ring;
        if (!r) return;
        const f = this.frames[r.panel];
        this.ringGfx.lineStyle(PARAMS.demoRingWidth, PARAMS.demoRingColor, tapRingAlpha(r.ms));
        this.ringGfx.strokeCircle(f.x + r.x * f.scale, f.y + r.y * f.scale, tapRingRadius(r.ms));
    }

    private advanceEffects(delta: number) {
        let popping = false;
        for (let i = 0; i < this.pops.length; i++) {
            if (this.pops[i] >= PARAMS.hitPopMs) continue;
            // an effect started this frame is drawn at t = 0 first; it starts counting next frame
            if (this.popFresh[i]) this.popFresh[i] = false;
            else this.pops[i] = Math.min(this.pops[i] + delta, PARAMS.hitPopMs);
            popping = true;
        }
        if (popping) this.drawMarks();
        const r = this.ring;
        if (!r) return;
        if (r.fresh) r.fresh = false;
        else r.ms += delta;
        if (r.ms >= PARAMS.demoRingMs) this.ring = null;
        this.drawRing();
    }

    /** The pictures (and their rings) fade out and in between demo games; the texts do not. */
    private applyOpacity() {
        const alpha = this.demo.opacity(this.clock);
        if (alpha === this.shownAlpha) return;
        this.shownAlpha = alpha;
        this.panels.setAlpha(alpha);
        this.marks.setAlpha(alpha);
        this.ringGfx.setAlpha(alpha);
    }
}
