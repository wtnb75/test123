import { Core, type GameObjects, type Input, Scene, type Types } from 'phaser';
import {
    BAR_MARKER_H,
    BAR_MARKER_W,
    BAR_RIGHT,
    BAR_TOP,
    BAR_BOTTOM_MARGIN,
    BAR_W,
    BULLET_R,
    CONFETTI_COUNT,
    CONFETTI_S,
    CONFETTI_SIZE,
    DANGER_H,
    DT_MAX,
    FONT_HINT,
    FONT_HUD,
    GOAL_VIEW_MARGIN,
    HINT_OFFSET_1,
    HINT_OFFSET_2,
    HUD_X,
    HUD_Y,
    PLAYER_H,
    PLAYER_W,
    PUFF_MAX,
    PX_PER_METER,
    RESULT_DELAY,
    SCREEN_WIDTH,
    SHAKE_INTENSITY,
    SHAKE_MS,
} from '../params';
import { warnTilt } from '../logic/bullets';
import { displayMeters } from '../logic/difficulty';
import {
    barMarkerY,
    confettiParticle,
    dangerAlpha,
    endingDangerAlpha,
    goalBlinkAlpha,
    moveEvents,
    platformDrawWidth,
    platformEffectAlpha,
    playerLook,
    pulsedWarnTriangle,
    puffOffsets,
    puffParams,
    warnPulseScale,
} from '../logic/effects';
import { HINT_LINES, hudText } from '../logic/layout';
import { createSim, simMeters, stepSim, type Sim } from '../logic/sim';
import { combineDir, TouchTracker } from '../logic/touch';
import {
    addLabel,
    applyScreenSize,
    BG_CSS,
    COLOR,
    DEPTH,
    onKeyDown,
    RotateGuard,
    SceneExit,
    UI_FONT,
} from './ui';

const PLATFORM_COLOR = { ground: COLOR.ground, goal: COLOR.goal, built: COLOR.built } as const;
const PUFF_X = puffOffsets();

/** A dust puff: where the feet were and the effect-clock time it started. */
interface Puff {
    x: number;
    y: number;
    t0: number;
}

export class Game extends Scene {
    private sim!: Sim;
    private touch = new TouchTracker();
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private world!: GameObjects.Graphics;
    private overlay!: GameObjects.Graphics;
    private warnLayer!: GameObjects.Graphics;
    private hud!: GameObjects.Text;
    /** Button presses since the last frame; applied at the start of the next update. */
    private pending = 0;
    /** Seconds spent in `ending` (the frozen screen before Result). */
    private endingFor = 0;
    /** The effect clock: the sum of the frame times while the scene runs (frozen by the rotate notice). */
    private fx = 0;
    private puffs: Puff[] = [];
    /** Where the confetti starts (set when the run ends with a clear). */
    private confettiAt: { x: number; y: number } | null = null;

    constructor() {
        super('Game');
    }

    create() {
        // The logical size is decided here and stays for Game and Result.
        const { height } = applyScreenSize(this);
        this.sim = createSim(height);
        this.touch = new TouchTracker();
        this.pending = 0;
        this.endingFor = 0;
        this.fx = 0;
        this.puffs = [];
        this.confettiAt = null;
        this.cameras.main.resetFX(); // no shake left over from the run before
        this.cameras.main.setBackgroundColor(BG_CSS);
        this.cameras.main.scrollY = this.sim.viewTop;

        const cx = this.scale.gameSize.width / 2;
        HINT_LINES.forEach((line, i) => {
            const y = this.sim.startY + (i === 0 ? HINT_OFFSET_1 : HINT_OFFSET_2);
            addLabel(this, cx, y, line, FONT_HINT, COLOR.sub).setDepth(DEPTH.hint);
        });
        this.world = this.add.graphics().setDepth(DEPTH.world);
        this.overlay = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.overlay);
        this.warnLayer = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.warn);
        this.hud = this.add
            .text(HUD_X, HUD_Y, hudText(0), { fontFamily: UI_FONT, fontSize: `${FONT_HUD}px`, color: COLOR.text })
            .setScrollFactor(0)
            .setDepth(DEPTH.hud);

        this.guard = new RotateGuard(this, () => {
            // Whatever the fingers were doing is over: no stuck swipe, no half-made tap.
            this.touch.clear();
        });
        this.exit = new SceneExit(this);
        this.cursors = this.input.keyboard!.createCursorKeys();
        onKeyDown(this, (key) => {
            if ((key === ' ' || key === 'ArrowUp') && this.accepting()) this.pending++;
        });
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointermove', this.onMove, this);
        this.input.on('pointerup', this.onUp, this);
        this.input.on('pointerupoutside', this.onUp, this);
        // A finger lifted while the window was not looking never reports its release: forget them all.
        this.game.events.on(Core.Events.BLUR, this.onBlur, this);
        this.events.once('shutdown', () => {
            this.cameras.main.resetFX();
            this.game.events.off(Core.Events.BLUR, this.onBlur, this);
            this.input.off('pointerdown', this.onDown, this);
            this.input.off('pointermove', this.onMove, this);
            this.input.off('pointerup', this.onUp, this);
            this.input.off('pointerupoutside', this.onUp, this);
        });

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Game' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                guard: { get: () => this.guard.active },
                state: {
                    get: () => ({
                        outcome: this.sim.outcome,
                        meters: simMeters(this.sim),
                        viewTop: this.sim.viewTop,
                        player: { ...this.sim.player },
                        platforms: this.sim.platforms.length,
                        bullets: this.sim.field.bullets.length,
                        warns: this.sim.field.warns.length,
                    }),
                },
            });
            Object.assign(qa, {
                press: () => this.pending++,
                // Jump the player to a height (metres) in the air, to reach the goal quickly.
                warp: (m: number) => {
                    const s = this.sim;
                    s.player.y = s.startY - m * PX_PER_METER;
                    s.player.vy = 0;
                    s.highestFeetY = Math.min(s.highestFeetY, s.player.y);
                    s.viewTop = Math.max(s.goalY - GOAL_VIEW_MARGIN, s.player.y - s.height * 0.6);
                    s.field.bullets.length = 0;
                    s.field.warns.length = 0;
                },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }

    /** Input counts only while playing and with no rotate notice. */
    private accepting(): boolean {
        return !this.guard.active && !this.sim.outcome;
    }

    private onBlur() {
        this.touch.clear();
    }

    private onDown(p: Input.Pointer) {
        if (!this.accepting()) return;
        if (!p.wasTouch && !p.leftButtonDown()) return; // only the left mouse button plays
        // Phaser's own down / up times come from the browser event: a stalled frame must not turn a long press
        // into a tap, and both ends of a press use the same clock.
        this.pending += this.touch.down(p.id, p.x, p.y, p.downTime);
    }

    private onMove(p: Input.Pointer) {
        if (this.accepting()) this.touch.move(p.id, p.x, p.y);
    }

    private onUp(p: Input.Pointer) {
        if (!p.wasTouch && p.button !== 0) return;
        if (p.wasCanceled) this.touch.cancel(p.id);
        else if (this.accepting()) this.pending += this.touch.up(p.id, p.upTime);
        else this.touch.cancel(p.id);
    }

    private keyDir(): number {
        return (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
    }

    update(_time: number, deltaMs: number) {
        if (this.guard.active) return; // the notice holds the clock
        const dt = Math.min(deltaMs / 1000, DT_MAX);
        this.fx += dt;
        if (!this.sim.outcome) {
            const actions = this.pending;
            this.pending = 0;
            const p = this.sim.player;
            const before = { x: p.x, y: p.y, onGround: p.onGround, vy: p.vy };
            stepSim(this.sim, combineDir(this.keyDir(), this.touch.dir), actions, dt, Math.random);
            this.moveEffects(before);
            if (this.sim.outcome) {
                this.touch.clear();
                this.pending = 0;
                this.startEnding(this.sim.outcome);
            }
        } else {
            this.endingFor += dt;
            if (this.endingFor >= RESULT_DELAY) {
                this.exit.to('Result', { outcome: this.sim.outcome, meters: displayMeters(simMeters(this.sim)) });
            }
        }
        this.render();
    }

    /** Dust for a jump / landing of the frame that just ran (also on the frame the run ends). */
    private moveEffects(before: { x: number; y: number; onGround: boolean; vy: number }) {
        const p = this.sim.player;
        const event = moveEvents(before, p);
        if (!event) return;
        // A jump puffs where the feet left the ground, a landing where they arrived.
        const at = event === 'jump' ? before : p;
        this.puffs.push({ x: at.x, y: at.y - 2, t0: this.fx });
        if (this.puffs.length > PUFF_MAX) this.puffs.shift();
    }

    /** The cues of the frame the run ends: a shake after a hit, confetti after a clear. */
    private startEnding(outcome: NonNullable<Sim['outcome']>) {
        if (outcome === 'hit') this.cameras.main.shake(SHAKE_MS, SHAKE_INTENSITY);
        if (outcome === 'clear') {
            this.confettiAt = { x: this.sim.player.x, y: this.sim.player.y - PLAYER_H / 2 };
        }
    }

    private render() {
        const s = this.sim;
        this.cameras.main.scrollY = s.viewTop;
        this.renderWorld();
        this.renderOverlay();
        this.hud.setText(hudText(displayMeters(simMeters(s))));
    }

    /** Platforms, dust, bullets, the player and confetti, in world coordinates. */
    private renderWorld() {
        const s = this.sim;
        const ending = s.outcome !== null;
        const g = this.world;
        g.clear();
        for (const p of s.platforms) {
            const blinking = ending && s.outcome === 'clear' && p.kind === 'goal';
            const alpha = blinking ? goalBlinkAlpha(this.endingFor) : platformEffectAlpha(p);
            const w = p.kind === 'built' ? platformDrawWidth(p.age) : p.w;
            g.fillStyle(PLATFORM_COLOR[p.kind], alpha);
            g.fillRect(p.x - w / 2, p.y, w, p.h);
        }
        for (let i = this.puffs.length - 1; i >= 0; i--) {
            const look = puffParams(this.fx - this.puffs[i].t0);
            if (!look) {
                this.puffs.splice(i, 1);
                continue;
            }
            g.fillStyle(COLOR.puff, look.alpha);
            for (const dx of PUFF_X) g.fillCircle(this.puffs[i].x + dx, this.puffs[i].y, look.radius);
        }
        g.fillStyle(COLOR.bullet, 1);
        for (const b of s.field.bullets) g.fillCircle(b.x, b.y, BULLET_R);
        const look = playerLook(s.outcome, this.endingFor);
        g.fillStyle(look === 'red' ? COLOR.playerHit : COLOR.player, 1);
        g.fillRect(s.player.x - PLAYER_W / 2, s.player.y - PLAYER_H, PLAYER_W, PLAYER_H);
        this.renderConfetti(g);
    }

    private renderConfetti(g: GameObjects.Graphics) {
        const at = this.confettiAt;
        if (!at || this.endingFor >= CONFETTI_S) return;
        for (let i = 0; i < CONFETTI_COUNT; i++) {
            const c = confettiParticle(i, this.endingFor);
            g.fillStyle(COLOR.confetti[i % COLOR.confetti.length], c.alpha);
            g.fillRect(at.x + c.x - CONFETTI_SIZE / 2, at.y + c.y - CONFETTI_SIZE / 2, CONFETTI_SIZE, CONFETTI_SIZE);
        }
    }

    /** Screen-fixed cues: the bottom band, the progress bar, and the warning marks. */
    private renderOverlay() {
        const s = this.sim;
        const height = this.scale.gameSize.height;
        const o = this.overlay;
        o.clear();
        const bandAlpha =
            s.outcome === 'left-behind'
                ? endingDangerAlpha(this.endingFor)
                : dangerAlpha(s.player.y, s.viewTop + s.height);
        if (bandAlpha > 0) {
            o.fillStyle(COLOR.bullet, bandAlpha);
            o.fillRect(0, height - DANGER_H, SCREEN_WIDTH, DANGER_H);
        }
        const barX = SCREEN_WIDTH - BAR_RIGHT - BAR_W;
        const centreX = barX + BAR_W / 2;
        o.fillStyle(COLOR.barTrack, 0.25);
        o.fillRect(barX, BAR_TOP, BAR_W, height - BAR_BOTTOM_MARGIN - BAR_TOP);
        o.fillStyle(COLOR.goal, 1);
        o.fillRect(centreX - BAR_MARKER_W / 2, BAR_TOP - BAR_MARKER_H / 2, BAR_MARKER_W, BAR_MARKER_H);
        o.fillStyle(COLOR.barMarker, 1);
        o.fillRect(centreX - BAR_MARKER_W / 2, barMarkerY(simMeters(s), height) - BAR_MARKER_H / 2, BAR_MARKER_W, BAR_MARKER_H);

        const w = this.warnLayer;
        w.clear();
        w.fillStyle(COLOR.bullet, 0.75);
        for (const warn of s.field.warns) {
            const [a, b, c] = pulsedWarnTriangle(warn.x, warnTilt(warn), warnPulseScale(warn.t));
            w.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1]);
        }
    }
}
