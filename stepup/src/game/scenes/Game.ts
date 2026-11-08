import { type GameObjects, type Input, Scene, type Types } from 'phaser';
import {
    BULLET_R,
    DT_MAX,
    FONT_HINT,
    FONT_HUD,
    HINT_OFFSET_1,
    HINT_OFFSET_2,
    HUD_X,
    HUD_Y,
    PLAYER_H,
    PLAYER_W,
    RESULT_DELAY,
} from '../params';
import { warnTilt, warnTriangle } from '../logic/bullets';
import { displayMeters } from '../logic/difficulty';
import { HINT_LINES, hudText } from '../logic/layout';
import { platformAlpha } from '../logic/physics';
import { createSim, simMeters, stepSim, type Sim } from '../logic/sim';
import { combineDir, TouchTracker } from '../logic/touch';
import {
    addLabel,
    applyScreenSize,
    COLOR,
    DEPTH,
    onKeyDown,
    RotateGuard,
    SceneExit,
    UI_FONT,
} from './ui';

const PLATFORM_COLOR = { ground: COLOR.ground, goal: COLOR.goal, built: COLOR.built } as const;

export class Game extends Scene {
    private sim!: Sim;
    private touch = new TouchTracker();
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private world!: GameObjects.Graphics;
    private warnLayer!: GameObjects.Graphics;
    private hud!: GameObjects.Text;
    /** Button presses since the last frame; applied at the start of the next update. */
    private pending = 0;
    /** Seconds spent in `ending` (the frozen screen before Result). */
    private endingFor = 0;

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
        this.cameras.main.setBackgroundColor('#1b2540');
        this.cameras.main.scrollY = this.sim.viewTop;

        const cx = this.scale.gameSize.width / 2;
        HINT_LINES.forEach((line, i) => {
            const y = this.sim.startY + (i === 0 ? HINT_OFFSET_1 : HINT_OFFSET_2);
            addLabel(this, cx, y, line, FONT_HINT, COLOR.sub).setDepth(DEPTH.hint);
        });
        this.world = this.add.graphics().setDepth(DEPTH.world);
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
        this.events.once('shutdown', () => {
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
                    s.player.y = s.startY - m * 10;
                    s.player.vy = 0;
                    s.highestFeetY = Math.min(s.highestFeetY, s.player.y);
                    s.viewTop = Math.max(s.goalY - 170, s.player.y - s.height * 0.6);
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

    private onDown(p: Input.Pointer) {
        if (!this.accepting()) return;
        if (!p.wasTouch && !p.leftButtonDown()) return; // only the left mouse button plays
        this.pending += this.touch.down(p.id, p.x, p.y, this.time.now);
    }

    private onMove(p: Input.Pointer) {
        if (this.accepting()) this.touch.move(p.id, p.x, p.y);
    }

    private onUp(p: Input.Pointer) {
        if (!p.wasTouch && p.button !== 0) return;
        if (p.wasCanceled) this.touch.cancel(p.id);
        else if (this.accepting()) this.pending += this.touch.up(p.id, this.time.now);
        else this.touch.cancel(p.id);
    }

    private keyDir(): number {
        return (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
    }

    update(_time: number, deltaMs: number) {
        if (this.guard.active) return; // the notice holds the clock
        const dt = Math.min(deltaMs / 1000, DT_MAX);
        if (!this.sim.outcome) {
            const actions = this.pending;
            this.pending = 0;
            stepSim(this.sim, combineDir(this.keyDir(), this.touch.dir), actions, dt, Math.random);
            if (this.sim.outcome) {
                this.touch.clear();
                this.pending = 0;
            }
        } else {
            this.endingFor += dt;
            if (this.endingFor >= RESULT_DELAY) {
                this.exit.to('Result', { outcome: this.sim.outcome, meters: displayMeters(simMeters(this.sim)) });
            }
        }
        this.render();
    }

    private render() {
        const s = this.sim;
        this.cameras.main.scrollY = s.viewTop;
        const g = this.world;
        g.clear();
        for (const p of s.platforms) {
            g.fillStyle(PLATFORM_COLOR[p.kind], platformAlpha(p));
            g.fillRect(p.x - p.w / 2, p.y, p.w, p.h);
        }
        g.fillStyle(COLOR.bullet, 1);
        for (const b of s.field.bullets) g.fillCircle(b.x, b.y, BULLET_R);
        g.fillStyle(COLOR.player, 1);
        g.fillRect(s.player.x - PLAYER_W / 2, s.player.y - PLAYER_H, PLAYER_W, PLAYER_H);

        const w = this.warnLayer;
        w.clear();
        w.fillStyle(COLOR.bullet, 0.75);
        for (const warn of s.field.warns) {
            const [a, b, c] = warnTriangle(warn.x, warnTilt(warn));
            w.fillTriangle(a[0], a[1], b[0], b[1], c[0], c[1]);
        }
        this.hud.setText(hudText(displayMeters(simMeters(s))));
    }
}
