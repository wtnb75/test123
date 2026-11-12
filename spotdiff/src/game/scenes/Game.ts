import { Cameras, Core, GameObjects, Input, Scene } from 'phaser';
import {
    MissEffects,
    clampPopupX,
    hitPopScale,
    isLowTime,
    lowTimeScale,
    missMarkAlpha,
    missPopupAlpha,
    missPopupRise,
    msgPopScale,
    showFirstHint,
} from '../logic/effects';
import { inHintSquare } from '../logic/hint';
import { Layout, panelPixels } from '../logic/layout';
import { Phase, Run } from '../logic/run';
import { makeStageFor } from '../logic/set';
import { hitPanelView, hudMaxWidth, inPanelRect, resetLabelX, resetVisible, viewFrame } from '../logic/zoom';
import { ZoomControl } from '../logic/zoomGesture';
import { PARAMS } from '../params';
import { PanelFrame, UI_FONT, drawBackdrop, drawPanel, strokeCross, strokeMark } from './draw';
import { bindOrientation } from './orientation';

interface GameData {
    date: number;
    setNo: number;
}

const PHASE_MESSAGES: Record<Exclude<Phase, 'paused'>, string> = { play: '', clear: 'CLEAR!', won: 'ALL CLEAR!', over: 'TIME UP' };
const HINT_MESSAGE = 'Tap where the pictures differ';
const HUD_COLOR = '#ffffff';
const HINT_OFF_COLOR = '#6b6b6b';

const DEPTH = { backdrop: 0, panels: 1, marks: 2, hint: 3, misses: 4, text: 5, popup: 6, overlay: 10 } as const;

export class Game extends Scene {
    private run!: Run;
    private layout!: Layout;
    private frames: PanelFrame[] = [
        { x: 0, y: 0, scale: 1 },
        { x: 0, y: 0, scale: 1 },
    ];
    private backdrop!: GameObjects.Graphics;
    // one Graphics per panel (each clipping camera must draw only its own panel's picture, rings and hint circle)
    private panels: GameObjects.Graphics[] = [];
    private marks: GameObjects.Graphics[] = [];
    private missGfx!: GameObjects.Graphics;
    private hintGfx: GameObjects.Graphics[] = [];
    private hintBtn!: GameObjects.Text;
    /** Centre of the HINT label; its hit square is centred here too (canvas px). */
    private hintCenter = { x: 0, y: 0 };
    /** The difference index the HINT circle was last drawn for (-1: none). */
    private hintDrawn = -1;
    private hintOn = false;
    // zoom (docs/spec/zoom.md): the view and gesture state, the RESET button, and the cameras that clip a zoomed picture to its panel
    private zoom = this.newZoom();
    private resetBtn!: GameObjects.Text;
    /** Centre of the RESET label; its hit square is centred here too (canvas px). */
    private resetCenter = { x: 0, y: 0 };
    private resetOn = false;
    /** While zoomed in the picture is drawn by `panelCams` (one per panel, clipped to its rectangle) and the misses by `topCam`, not by the main camera. */
    private clipped = false;
    private panelCams: Cameras.Scene2D.Camera[] = [];
    private topCam!: Cameras.Scene2D.Camera;
    private clipContent: GameObjects.GameObject[] = [];
    private clipTop: GameObjects.GameObject[] = [];
    private hud!: GameObjects.Text;
    private message!: GameObjects.Text;
    private popups: GameObjects.Text[] = [];
    private overlay!: GameObjects.Graphics;
    private pausedTitle!: GameObjects.Text;
    private pausedHint!: GameObjects.Text;
    // what the HUD currently shows; compared field by field so `update` allocates nothing
    private hudSet = -1;
    private hudStage = -1;
    private hudFound = -1;
    private hudTotal = -1;
    private hudSeconds = -1;
    private hudFit = 1;
    private hudLow = false;
    private hudPulse = 1;
    private lowMs = 0;
    // effects
    private misses = new MissEffects();
    private missesDrawn = false;
    private pops: number[] = [];
    private popFresh: boolean[] = [];
    private msgFresh = false;
    private msgPopMs: number = PARAMS.msgPopMs;
    private shownMessage = '';
    private shownPhase: Phase = 'play';
    private revealed = false;
    private startData: GameData = { date: 0, setNo: 1 };

    constructor() {
        super('Game');
    }

    /** `displayScale` is canvas px per CSS px (the FIT scale seen from the canvas), which is what the CSS-px thresholds need. */
    private newZoom(): ZoomControl {
        return new ZoomControl(() => ({ layout: this.layout, canvasPerCss: this.scale.displayScale.x }));
    }

    init(data: GameData = { date: 0, setNo: 1 }) {
        this.startData = data;
    }

    create() {
        const { date, setNo } = this.startData;
        this.run = new Run({
            date,
            setNo,
            makeStage: makeStageFor(date, setNo),
            startHidden: document.hidden,
        });
        this.hudSet = this.hudStage = this.hudFound = this.hudTotal = this.hudSeconds = -1;
        this.hudFit = this.hudPulse = 1;
        this.hudLow = false;
        this.lowMs = 0;
        this.misses = new MissEffects();
        this.missesDrawn = false;
        this.msgPopMs = PARAMS.msgPopMs;
        this.shownMessage = '';
        this.shownPhase = 'play';
        this.revealed = false;
        this.zoom = this.newZoom();
        this.clipped = false;
        this.resetOn = false;
        // pinch and drag need the browser to leave the touches alone; the wheel must not scroll the page
        const canvas = this.game.canvas;
        const touchAction = canvas.style.touchAction;
        canvas.style.touchAction = 'none';
        this.resetPops();
        this.createObjects();
        // the scene instance is reused: force the first sync to set the HINT label's look, whatever the run starts as
        this.hintDrawn = -1;
        this.hintOn = true;
        this.syncHint();

        this.layout = bindOrientation(this, (layout) => this.relayout(layout));
        this.relayout(this.layout);
        this.showOverlay(this.run.phase === 'paused');

        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.input.on('pointerupoutside', this.onPointerUpOutside, this);
        this.input.on('wheel', this.onWheel, this);
        this.game.events.on(Core.Events.HIDDEN, this.onHidden, this);
        this.game.events.on(Core.Events.VISIBLE, this.onVisible, this);
        this.events.once('shutdown', () => {
            canvas.style.touchAction = touchAction;
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.input.off('pointerupoutside', this.onPointerUpOutside, this);
            this.input.off('wheel', this.onWheel, this);
            this.game.events.off(Core.Events.HIDDEN, this.onHidden, this);
            this.game.events.off(Core.Events.VISIBLE, this.onVisible, this);
        });
    }

    update(_time: number, delta: number) {
        const event = this.run.tick(delta);
        if (event === 'stage') {
            this.revealed = false;
            this.resetEffects();
            this.resetZoom();
            this.drawStage();
        }
        if (event === 'result') {
            this.scene.start('Result', this.run.summary());
            return;
        }
        this.syncPhase();
        this.syncZoom();
        this.syncMessage();
        this.syncHint();
        if (this.run.phase !== 'paused') this.advanceEffects(delta);
        this.updateHud();
        this.updateHudPulse(delta);
        // Dev build only: a read-only snapshot for the browser QA scripts (scripts/qa); removed from production.
        if (import.meta.env.DEV) {
            const r = this.run;
            Object.assign(window, {
                __qa: {
                    scene: 'Game',
                    phase: r.phase,
                    stageNo: r.stageNo,
                    timeLeft: r.timeLeft,
                    found: r.found.size,
                    total: r.stage.diffs.length,
                    foundIdx: [...r.found],
                    diffs: r.stage.diffs.map((d) => ({ x: d.x, y: d.y, r: d.r, kind: d.kind })),
                    hintUsed: r.hintUsed,
                    kind: this.layout.kind,
                    panels: this.layout.panels,
                    panelScale: this.layout.panelScale,
                    width: this.layout.width,
                    height: this.layout.height,
                    zoom: this.zoom.view.zoom,
                    view: { x: this.zoom.view.x, y: this.zoom.view.y },
                    gesture: this.zoom.state,
                    resetOn: this.resetOn,
                    clipped: this.clipped,
                },
            });
        }
    }

    private createObjects() {
        const text = (size: number, color: string) => ({ fontFamily: UI_FONT, fontSize: `${size}px`, color });
        this.backdrop = this.add.graphics().setDepth(DEPTH.backdrop);
        const perPanel = (depth: number) => [0, 1].map(() => this.add.graphics().setDepth(depth));
        this.panels = perPanel(DEPTH.panels);
        this.marks = perPanel(DEPTH.marks);
        this.hintGfx = perPanel(DEPTH.hint);
        this.missGfx = this.add.graphics().setDepth(DEPTH.misses);
        this.hintBtn = this.add.text(0, 0, 'HINT', text(PARAMS.hintTextSize, HUD_COLOR)).setOrigin(0.5).setDepth(DEPTH.text);
        this.resetBtn = this.add.text(0, 0, 'RESET', text(PARAMS.hintTextSize, HUD_COLOR)).setOrigin(0.5).setDepth(DEPTH.text).setVisible(false);
        this.hud = this.add.text(0, 0, '', text(30, HUD_COLOR)).setOrigin(0.5).setDepth(DEPTH.text);
        this.message = this.add.text(0, 0, '', text(28, '#ffd166')).setOrigin(0.5).setDepth(DEPTH.text);
        this.popups = Array.from({ length: PARAMS.missMarkMax }, () =>
            this.add
                .text(0, 0, `-${PARAMS.missPenalty}`, { ...text(30, '#ff8a8a'), stroke: '#101820', strokeThickness: 5 })
                .setOrigin(0.5)
                .setDepth(DEPTH.popup)
                .setVisible(false),
        );
        this.overlay = this.add.graphics().setDepth(DEPTH.overlay);
        this.pausedTitle = this.add.text(0, 0, 'PAUSED', text(64, '#ffffff')).setOrigin(0.5).setDepth(DEPTH.overlay + 1);
        this.pausedHint = this.add.text(0, 0, 'TAP TO RESUME', text(34, '#ffd166')).setOrigin(0.5).setDepth(DEPTH.overlay + 1);
        this.createClipCameras();
    }

    /**
     * Two cameras clip a zoomed picture to its panel (a camera viewport scissors what it draws) and a third draws the misses above them.
     * They render nothing until `setClip(true)`: the objects stay on the main camera while the picture is not zoomed.
     */
    private createClipCameras() {
        const ofPanel = (i: number) => [this.panels[i], this.marks[i], this.hintGfx[i]];
        this.clipContent = [...ofPanel(0), ...ofPanel(1)];
        this.clipTop = [this.missGfx, ...this.popups];
        const rest = [this.backdrop, this.hintBtn, this.resetBtn, this.hud, this.message, this.overlay, this.pausedTitle, this.pausedHint];
        this.panelCams = [0, 1].map(() => this.cameras.add(0, 0, 1, 1).setVisible(false));
        // each panel camera draws only its own panel's picture: the other panel's picture would spill into its viewport
        this.panelCams.forEach((cam, i) => cam.ignore([...rest, ...this.clipTop, ...ofPanel(1 - i)]));
        this.topCam = this.cameras.add(0, 0, 1, 1).setVisible(false);
        this.topCam.ignore([...rest, ...this.clipContent]);
    }

    private relayout(layout: Layout) {
        this.layout = layout;
        // phone layout texts must stay >= 32px on the canvas (readable on a phone; spec 演出・UI); landscape keeps the compact sizes
        const big = layout.bigText;
        // the wide layout's HUD and message rows (y = 34 / 78) are only 44px apart, so they use the 32px minimum
        const rowSize = layout.kind === 'wide' ? 32 : 36;
        this.hud.setFontSize(big ? rowSize : 30).setPosition(layout.hud.x, layout.hud.y);
        // the HINT label sits at the right end of the HUD row, its hit square reaches past the label (transparent)
        this.hintBtn.setFontSize(big ? rowSize : PARAMS.hintTextSize);
        this.hintCenter = { x: layout.width - PARAMS.hintMargin - this.hintBtn.width / 2, y: layout.hud.y };
        this.hintBtn.setPosition(this.hintCenter.x, this.hintCenter.y);
        // RESET mirrors HINT at the left end of the HUD row (shown only while zoomed in)
        this.resetBtn.setFontSize(big ? rowSize : PARAMS.hintTextSize);
        // the hit square is the exact mirror of HINT's; only the (wider) label may move right to stay inside the left margin
        this.resetCenter = { x: layout.width - this.hintCenter.x, y: layout.hud.y };
        this.resetBtn.setPosition(resetLabelX(layout.width, this.hintCenter.x, this.resetBtn.width), this.resetCenter.y);
        this.zoom.cancel();
        this.message.setFontSize(big ? rowSize : 28).setPosition(layout.message.x, layout.message.y);
        for (const p of this.popups) p.setFontSize(big ? 36 : 30);
        this.pausedTitle.setPosition(layout.center.x, layout.center.y - 40);
        this.pausedHint.setPosition(layout.center.x, layout.center.y + 40);
        this.overlay.clear();
        this.overlay.fillStyle(0x101820, PARAMS.pauseOverlayAlpha);
        this.overlay.fillRect(0, 0, layout.width, layout.height);
        this.updateFrames();
        this.layoutClipCameras();
        this.drawStage();
        this.drawMisses();
        this.drawHint();
        this.syncZoom();
        this.updateHud(true);
    }

    /** The panels' drawing frames under the current view (the layout's own frames while not zoomed). */
    private updateFrames() {
        this.layout.panels.forEach((p, i) => {
            const f = viewFrame(p, this.layout.panelScale, this.zoom.view);
            this.frames[i].x = f.x;
            this.frames[i].y = f.y;
            this.frames[i].scale = f.scale;
        });
    }

    private layoutClipCameras() {
        const { panels, width, height } = this.layout;
        const size = panelPixels(this.layout);
        this.panelCams.forEach((cam, i) => cam.setViewport(panels[i].x, panels[i].y, size, size).setScroll(panels[i].x, panels[i].y));
        this.topCam.setViewport(0, 0, width, height).setScroll(0, 0);
    }

    /**
     * Draws the picture clipped to its panel on the panel cameras (and the misses on the top camera) while zoomed in,
     * else on the main camera as before. The picture is hidden by the pause screen, which only the main camera shows.
     */
    private setClip(on: boolean) {
        if (on !== this.clipped) {
            this.clipped = on;
            const bit = this.cameras.main.id;
            for (const o of [...this.clipContent, ...this.clipTop]) o.cameraFilter = on ? o.cameraFilter | bit : o.cameraFilter & ~bit;
        }
        const show = this.clipped && this.run.phase !== 'paused';
        for (const cam of this.panelCams) cam.setVisible(show);
        this.topCam.setVisible(this.clipped);
    }

    /** Redraws everything that depends on the view. */
    private applyView() {
        this.updateFrames();
        this.setClip(this.zoom.zoomed);
        this.drawPanels();
        this.drawHint();
        this.drawMisses();
        this.syncReset();
    }

    /** Back to the whole picture (the gesture is dropped too). With `redraw` the picture is redrawn at once. */
    private resetZoom(redraw = false) {
        this.zoom.cancel();
        if (!this.zoom.zoomed && this.zoom.view.x === 0 && this.zoom.view.y === 0) return;
        this.zoom.resetView();
        if (redraw) this.applyView();
        else {
            this.updateFrames();
            this.setClip(false);
            this.syncReset();
        }
    }

    /** Keeps the zoom in step with the phase: no gesture outside `play`, the whole picture on `clear` / `won` / `over`, the cameras and RESET right. */
    private syncZoom() {
        const phase = this.run.phase;
        if (phase !== 'play') this.zoom.cancel();
        if (phase === 'clear' || phase === 'won' || phase === 'over') this.resetZoom(true);
        this.setClip(this.zoom.zoomed);
        this.syncReset();
    }

    private syncReset() {
        const on = resetVisible(this.zoom.view, this.run.phase === 'play');
        if (on === this.resetOn) return;
        this.resetOn = on;
        this.resetBtn.setVisible(on);
    }

    private drawStage() {
        const stage = this.run.stage;
        drawBackdrop(this.backdrop, this.layout.width, this.layout.height, stage.bgHue);
        this.drawPanels();
    }

    private drawPanels() {
        const stage = this.run.stage;
        for (const g of this.panels) g.clear();
        drawPanel(this.panels[0], this.frames[0], stage.left, stage);
        drawPanel(this.panels[1], this.frames[1], stage.right, stage);
        this.drawMarks();
    }

    /** The HINT circle around the marked difference, on both panels, while it shows. */
    private drawHint() {
        for (const g of this.hintGfx) g.clear();
        const index = this.run.hintShown;
        this.hintDrawn = index ?? -1;
        if (index === null) return;
        const d = this.run.stage.diffs[index];
        this.frames.forEach((frame, i) => {
            this.hintGfx[i].lineStyle(PARAMS.markLineWidth, PARAMS.hintColor);
            this.hintGfx[i].strokeCircle(
                frame.x + d.x * frame.scale,
                frame.y + d.y * frame.scale,
                d.r * PARAMS.hintRadiusScale * frame.scale,
            );
        });
    }

    /** Keeps the HINT circle in step with the run, and the HINT label grey once it cannot be used. */
    private syncHint() {
        if ((this.run.hintShown ?? -1) !== this.hintDrawn) this.drawHint();
        const on = this.run.phase === 'play' && !this.run.hintUsed;
        if (on === this.hintOn) return;
        this.hintOn = on;
        this.hintBtn.setColor(on ? HUD_COLOR : HINT_OFF_COLOR);
    }

    /** Found differences in red (growing while they pop in); on time-up the missed ones in yellow. */
    private drawMarks() {
        for (const g of this.marks) g.clear();
        const { diffs } = this.run.stage;
        for (let i = 0; i < diffs.length; i++) {
            const found = this.run.found.has(i);
            if (!found && !this.revealed) continue;
            const color = found ? PARAMS.markColor : PARAMS.revealMarkColor;
            const factor = found && this.pops[i] < PARAMS.hitPopMs ? hitPopScale(this.pops[i]) : 1;
            strokeMark(this.marks[0], this.frames[0], diffs[i], color, factor);
            strokeMark(this.marks[1], this.frames[1], diffs[i], color, factor);
        }
    }

    private drawMisses() {
        this.missGfx.clear();
        const items = this.misses.items;
        for (let i = 0; i < this.popups.length; i++) {
            const popup = this.popups[i];
            const item = items[i];
            if (!item) {
                popup.setVisible(false);
                continue;
            }
            const frame = this.frames[item.panel];
            const x = frame.x + item.x * frame.scale;
            const y = frame.y + item.y * frame.scale;
            // a miss sticks to the picture: when zoomed it is not shown while its spot is out of view
            if (!inPanelRect(this.layout, item.panel, x, y)) {
                popup.setVisible(false);
                continue;
            }
            strokeCross(this.missGfx, x, y, missMarkAlpha(item.ms));
            popup
                .setPosition(clampPopupX(x, this.layout.width), y - missPopupRise(item.ms))
                .setAlpha(missPopupAlpha(item.ms))
                .setVisible(true);
        }
        this.missesDrawn = items.length > 0;
    }

    private resetPops() {
        this.pops = this.run.stage.diffs.map(() => PARAMS.hitPopMs);
        this.popFresh = this.run.stage.diffs.map(() => false);
        this.msgFresh = false;
    }

    /** New stage: nothing of the previous stage's effects carries over. */
    private resetEffects() {
        this.misses.clear();
        this.resetPops();
        this.msgPopMs = PARAMS.msgPopMs;
        this.message.setScale(1);
        this.lowMs = 0;
    }

    /** Entering `paused`: misses vanish, pops and the message pop jump to their final values. */
    private cancelEffects() {
        this.misses.clear();
        this.pops.fill(PARAMS.hitPopMs);
        this.popFresh.fill(false);
        this.msgPopMs = PARAMS.msgPopMs;
        this.msgFresh = false;
        this.message.setScale(1);
        this.hudPulse = 1;
        this.hud.setScale(this.hudFit);
        this.drawMarks();
        this.drawMisses();
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
        if (this.misses.items.length > 0) {
            this.misses.tick(delta);
            this.drawMisses();
        } else if (this.missesDrawn) {
            this.drawMisses();
        }
        if (this.msgPopMs < PARAMS.msgPopMs) {
            if (this.msgFresh) this.msgFresh = false;
            else this.msgPopMs = Math.min(this.msgPopMs + delta, PARAMS.msgPopMs);
            this.message.setScale(msgPopScale(this.msgPopMs));
        }
    }

    /** Reveals the answers on time-up when the phase changed; `paused` keeps the look. */
    private syncPhase() {
        const phase = this.run.phase;
        if (phase === 'paused' || phase === this.shownPhase) return;
        this.shownPhase = phase;
        if (phase === 'over') {
            this.revealed = true;
            this.drawMarks();
        }
    }

    /** The message line: CLEAR!/ALL CLEAR!/TIME UP (with a pop), else the first-run hint, else empty. */
    private syncMessage() {
        const phase = this.run.phase;
        if (phase === 'paused') return;
        const text = phase === 'play' ? (showFirstHint(this.run) ? HINT_MESSAGE : '') : PHASE_MESSAGES[phase];
        if (text === this.shownMessage) return;
        this.shownMessage = text;
        this.message.setText(text);
        this.msgPopMs = phase === 'play' ? PARAMS.msgPopMs : 0;
        this.msgFresh = phase !== 'play';
        this.message.setScale(phase === 'play' ? 1 : msgPopScale(0));
    }

    private updateHud(force = false) {
        const r = this.run;
        const found = r.found.size;
        const total = r.stage.diffs.length;
        const sec = r.displaySeconds;
        const same =
            this.hudSet === r.setNo && this.hudStage === r.stageNo && this.hudFound === found &&
            this.hudTotal === total && this.hudSeconds === sec;
        if (!force && same) return;
        this.hudSet = r.setNo;
        this.hudStage = r.stageNo;
        this.hudFound = found;
        this.hudTotal = total;
        this.hudSeconds = sec;
        this.hud.setText(`${r.setNo}   ${r.stageNo}/${PARAMS.stageCount}   ${found}/${total}   TIME ${sec}`).setScale(1);
        // the HUD is centred, so it keeps clear of the HINT label on both sides; fit so that even the peak of the low-time pulse stays inside
        const maxWidth = hudMaxWidth(this.layout.width, this.hintBtn.width, this.resetBtn.width);
        this.hudFit = this.hud.width > maxWidth ? maxWidth / this.hud.width : 1;
        this.hud.setScale(this.hudFit * this.hudPulse);
    }

    /** Low-time warning: red text while <= lowTimeSec, plus a pulse while playing (t is frozen while paused). */
    private updateHudPulse(delta: number) {
        const phase = this.run.phase;
        if (phase === 'paused') return;
        const low = isLowTime(this.run.displaySeconds);
        if (low !== this.hudLow) {
            this.hudLow = low;
            this.hud.setColor(low ? PARAMS.lowTimeColor : HUD_COLOR);
            if (!low) this.lowMs = 0;
        }
        // t = 0 on the frame the warning starts; the pulse stops (scale back to 1) as soon as play ends
        let pulse = 1;
        if (low && phase === 'play') {
            pulse = lowTimeScale(this.lowMs);
            this.lowMs += delta;
        } else {
            this.lowMs = 0;
        }
        if (pulse === this.hudPulse) return;
        this.hudPulse = pulse;
        this.hud.setScale(this.hudFit * pulse);
    }

    private showOverlay(on: boolean) {
        this.overlay.setVisible(on);
        this.pausedTitle.setVisible(on);
        this.pausedHint.setVisible(on);
    }

    /**
     * HINT, RESET and the pause screen act on the press (`pointerdown`); a press on a panel only starts a gesture, and the tap
     * is judged when the finger lifts (`onPointerUp`), so a pinch or a drag is never a miss.
     */
    private onPointerDown(pointer: Input.Pointer) {
        const id = pointer.id;
        if (this.run.phase === 'paused') {
            if (this.run.resume()) {
                this.showOverlay(false);
                this.syncZoom();
            }
            this.zoom.ignoreFinger(id);
            return;
        }
        // the buttons are no panel input: a press on one never counts as a hit or a miss, and its finger never taps a panel
        // at a small FIT scale the squares grow (in canvas px) so that they stay 44 CSS px on screen (displayScale: canvas px per CSS px)
        const side = Math.max(PARAMS.hintHitPx, 44 * this.scale.displayScale.x);
        if (inHintSquare(pointer.x, pointer.y, this.hintCenter.x, this.hintCenter.y, side)) {
            if (this.run.useHint() !== null) {
                this.resetZoom(true); // the circle must be visible: back to the whole picture first
                this.syncPhase();
                this.syncZoom();
                this.syncMessage();
                this.syncHint();
                this.updateHud();
            }
            this.zoom.ignoreFinger(id);
            return;
        }
        if (this.resetOn && inHintSquare(pointer.x, pointer.y, this.resetCenter.x, this.resetCenter.y, side)) {
            this.resetZoom(true);
            this.zoom.ignoreFinger(id);
            return;
        }
        // on a panel only the touch and the left mouse button take part (`pointer.button`: the button that went down now;
        // a right / middle press is no tap and no drag, and does not disturb a left-button gesture already going)
        if (this.run.phase !== 'play' || (!pointer.wasTouch && pointer.button !== 0)) {
            this.zoom.ignoreFinger(id);
            return;
        }
        this.zoom.down(id, pointer.x, pointer.y);
    }

    private onPointerMove(pointer: Input.Pointer) {
        if (this.zoom.move(pointer.id, pointer.x, pointer.y)) this.applyView();
    }

    private onPointerUp(pointer: Input.Pointer) {
        // Phaser delivers a system-cancelled touch (`touchcancel`) as a pointerup flagged `wasCanceled`: never a tap
        if (pointer.wasCanceled) {
            this.zoom.cancelPointer(pointer.id);
            return;
        }
        // a right / middle button released: only its own (ignored) press ends; a left-button gesture still going is left alone
        if (!pointer.wasTouch && pointer.button !== 0) {
            if (!pointer.leftButtonDown()) this.zoom.cancelPointer(pointer.id);
            return;
        }
        const tap = this.zoom.up(pointer.id, pointer.x, pointer.y);
        if (tap) this.onTap(tap.x, tap.y);
    }

    /** The finger lifted outside the canvas: never a tap. */
    private onPointerUpOutside(pointer: Input.Pointer) {
        // a right / middle release outside the canvas must not end a left-button drag still going (same rule as `onPointerUp`)
        if (!pointer.wasTouch && pointer.button !== 0 && pointer.leftButtonDown()) return;
        this.zoom.cancelPointer(pointer.id);
    }

    private onWheel(pointer: Input.Pointer, _over: unknown, _dx: number, dy: number) {
        const event = pointer.event as WheelEvent | undefined;
        event?.preventDefault?.();
        if (this.run.phase !== 'play') return;
        if (this.zoom.wheel(pointer.x, pointer.y, dy, event?.deltaMode ?? 0)) this.applyView();
    }

    /** A tap on a panel (judged at the lift, through the view): a hit finds a difference, a miss costs time. */
    private onTap(x: number, y: number) {
        const hit = hitPanelView(this.layout, this.zoom.view, x, y);
        if (!hit) return;
        const outcome = this.run.click(hit.x, hit.y);
        if (outcome === 'miss') {
            this.shake();
            this.misses.add(hit.panel, hit.x, hit.y);
            this.drawMisses();
        } else if (outcome === 'hit') {
            this.pops[this.run.lastHit] = 0;
            this.popFresh[this.run.lastHit] = true;
            this.drawMarks();
        } else {
            return; // ignored (clear / won / over): nothing changed
        }
        this.syncPhase();
        this.syncZoom();
        this.syncMessage();
        this.syncHint();
        this.updateHud();
    }

    /** The miss shake: the main camera, and the clipping cameras too while they draw the picture. */
    private shake() {
        this.cameras.main.shake(PARAMS.missShakeMs, PARAMS.missShakeIntensity);
        if (!this.clipped) return;
        for (const cam of [...this.panelCams, this.topCam]) cam.shake(PARAMS.missShakeMs, PARAMS.missShakeIntensity);
    }

    private onHidden() {
        if (this.run.hide()) {
            this.cameras.main.resetFX();
            for (const cam of [...this.panelCams, this.topCam]) cam.resetFX();
            this.zoom.cancel();
            this.cancelEffects();
        }
        this.showOverlay(true);
        this.syncZoom();
    }

    private onVisible() {
        this.run.show();
    }
}
