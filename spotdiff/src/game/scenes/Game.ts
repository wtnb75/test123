import { Core, GameObjects, Input, Scene } from 'phaser';
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
import { Layout, hitPanel } from '../logic/layout';
import { Phase, Run } from '../logic/run';
import { makeStageFor } from '../logic/set';
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

const DEPTH = { backdrop: 0, panels: 1, marks: 2, misses: 3, text: 4, popup: 5, overlay: 10 } as const;

export class Game extends Scene {
    private run!: Run;
    private layout!: Layout;
    private frames: PanelFrame[] = [
        { x: 0, y: 0, scale: 1 },
        { x: 0, y: 0, scale: 1 },
    ];
    private backdrop!: GameObjects.Graphics;
    private panels!: GameObjects.Graphics;
    private marks!: GameObjects.Graphics;
    private missGfx!: GameObjects.Graphics;
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
        this.resetPops();
        this.createObjects();

        this.layout = bindOrientation(this, (layout) => this.relayout(layout));
        this.relayout(this.layout);
        this.showOverlay(this.run.phase === 'paused');

        this.input.on('pointerdown', this.onPointerDown, this);
        this.game.events.on(Core.Events.HIDDEN, this.onHidden, this);
        this.game.events.on(Core.Events.VISIBLE, this.onVisible, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.game.events.off(Core.Events.HIDDEN, this.onHidden, this);
            this.game.events.off(Core.Events.VISIBLE, this.onVisible, this);
        });
    }

    update(_time: number, delta: number) {
        const event = this.run.tick(delta);
        if (event === 'stage') {
            this.revealed = false;
            this.resetEffects();
            this.drawStage();
        }
        if (event === 'result') {
            this.scene.start('Result', this.run.summary());
            return;
        }
        this.syncPhase();
        this.syncMessage();
        if (this.run.phase !== 'paused') this.advanceEffects(delta);
        this.updateHud();
        this.updateHudPulse(delta);
    }

    private createObjects() {
        const text = (size: number, color: string) => ({ fontFamily: UI_FONT, fontSize: `${size}px`, color });
        this.backdrop = this.add.graphics().setDepth(DEPTH.backdrop);
        this.panels = this.add.graphics().setDepth(DEPTH.panels);
        this.marks = this.add.graphics().setDepth(DEPTH.marks);
        this.missGfx = this.add.graphics().setDepth(DEPTH.misses);
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
    }

    private relayout(layout: Layout) {
        this.layout = layout;
        // portrait texts must stay >= 32px on the canvas (readable on a phone; spec 演出・UI); landscape keeps the compact sizes
        const big = layout.portrait;
        this.hud.setFontSize(big ? 36 : 30).setPosition(layout.hud.x, layout.hud.y);
        this.message.setFontSize(big ? 36 : 28).setPosition(layout.message.x, layout.message.y);
        for (const p of this.popups) p.setFontSize(big ? 36 : 30);
        this.pausedTitle.setPosition(layout.center.x, layout.center.y - 40);
        this.pausedHint.setPosition(layout.center.x, layout.center.y + 40);
        this.overlay.clear();
        this.overlay.fillStyle(0x101820, PARAMS.pauseOverlayAlpha);
        this.overlay.fillRect(0, 0, layout.width, layout.height);
        layout.panels.forEach((p, i) => {
            this.frames[i].x = p.x;
            this.frames[i].y = p.y;
            this.frames[i].scale = layout.panelScale;
        });
        this.drawStage();
        this.drawMisses();
        this.updateHud(true);
    }

    private drawStage() {
        const stage = this.run.stage;
        drawBackdrop(this.backdrop, this.layout.width, this.layout.height, stage.bgHue);
        this.panels.clear();
        drawPanel(this.panels, this.frames[0], stage.left, stage);
        drawPanel(this.panels, this.frames[1], stage.right, stage);
        this.drawMarks();
    }

    /** Found differences in red (growing while they pop in); on time-up the missed ones in yellow. */
    private drawMarks() {
        this.marks.clear();
        const { diffs } = this.run.stage;
        for (let i = 0; i < diffs.length; i++) {
            const found = this.run.found.has(i);
            if (!found && !this.revealed) continue;
            const color = found ? PARAMS.markColor : PARAMS.revealMarkColor;
            const factor = found && this.pops[i] < PARAMS.hitPopMs ? hitPopScale(this.pops[i]) : 1;
            strokeMark(this.marks, this.frames[0], diffs[i], color, factor);
            strokeMark(this.marks, this.frames[1], diffs[i], color, factor);
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
        this.hud.setText(`SET ${r.setNo}   STAGE ${r.stageNo}/${PARAMS.stageCount}   ${found}/${total}   TIME ${sec}`).setScale(1);
        // fit so that even the peak of the low-time pulse stays inside the canvas
        const maxWidth = (this.layout.width - 16) / (1 + PARAMS.lowTimePulse);
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

    private onPointerDown(pointer: Input.Pointer) {
        if (this.run.phase === 'paused') {
            if (this.run.resume()) this.showOverlay(false);
            return;
        }
        const hit = hitPanel(this.layout, pointer.x, pointer.y);
        if (!hit) return;
        const outcome = this.run.click(hit.x, hit.y);
        if (outcome === 'miss') {
            this.cameras.main.shake(PARAMS.missShakeMs, PARAMS.missShakeIntensity);
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
        this.syncMessage();
        this.updateHud();
    }

    private onHidden() {
        if (this.run.hide()) {
            this.cameras.main.resetFX();
            this.cancelEffects();
        }
        this.showOverlay(true);
    }

    private onVisible() {
        this.run.show();
    }
}
