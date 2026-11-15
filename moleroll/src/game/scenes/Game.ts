import { Scene, type Input, type Types } from 'phaser';
import {
    BANNER_FONT_PX,
    CAT_PENALTY,
    HUD_FONT_PX,
    HUD_MARGIN_PX,
    LOW_TIME_PULSE_SEC,
    LOW_TIME_SCALE,
    MAX_TOUCH_POINTERS,
    NORMA,
} from '../params';
import { PointerTracker, type PointerKind } from '../logic/pointers';
import {
    createRun,
    displaySeconds,
    isLowTime,
    spin,
    step,
    tap,
    type KeyDir,
    type Outcome,
    type Run,
} from '../logic/run';
import { buildCube } from '../logic/shape';
import { arrowFor, hasArrow } from '../logic/arrow';
import { popScreen } from '../logic/hit';
import { dragRotation, isFacing, type Point } from '../logic/math';
import { CubeView } from './CubeView';
import { floatText, hitRing, shakeForCat } from './effects';
import { addLabel, applyScreenSize, DEPTH, fadeInScene, onKeyPress, SceneExit, UI_FONT } from './ui';

export interface ResultData {
    outcome: Outcome;
    progress: number;
    timeLeft: number;
}

const SHAPE = buildCube();
const HUD_COLOR = '#ffffff';
const LOW_TIME_COLOR = '#ff6b6b';

export class Game extends Scene {
    private run!: Run;
    private view!: CubeView;
    private tracker = new PointerTracker();
    private origin!: Point;
    private exit!: SceneExit;
    private hudProgress!: Phaser.GameObjects.Text;
    private hudTime!: Phaser.GameObjects.Text;
    private banner!: Phaser.GameObjects.Text;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    /** What the HUD texts currently show (-1: nothing yet). */
    private shownProgress = -1;
    private shownSeconds = -1;
    /** Reused every update. */
    private readonly keys: KeyDir = { x: 0, y: 0 };

    constructor() {
        super('Game');
    }

    create() {
        const { width, height } = applyScreenSize(this);
        fadeInScene(this);
        this.origin = { x: width / 2, y: height / 2 };
        this.run = createRun();
        this.tracker.reset();
        this.exit = new SceneExit(this);
        this.shownProgress = -1;
        this.shownSeconds = -1;

        this.view = new CubeView(this, SHAPE, this.origin);
        const hud = { fontFamily: UI_FONT, fontSize: `${HUD_FONT_PX}px`, color: HUD_COLOR };
        this.hudProgress = this.add.text(HUD_MARGIN_PX, HUD_MARGIN_PX, '', hud).setDepth(DEPTH.hud);
        this.hudTime = this.add
            .text(width - HUD_MARGIN_PX, HUD_MARGIN_PX, '', hud)
            .setOrigin(1, 0)
            .setDepth(DEPTH.hud);
        this.banner = addLabel(this, this.origin.x, this.origin.y, '', BANNER_FONT_PX)
            .setBackgroundColor('#000000aa')
            .setPadding(20, 16)
            .setDepth(DEPTH.banner)
            .setVisible(false);

        this.setupInput();
        this.syncHud();
        if (import.meta.env.DEV) {
            // QA only, written inline so none of it reaches the production bundle.
            Object.defineProperty(window, '__qa', {
                configurable: true,
                get: () => ({
                    scene: 'Game',
                    phase: this.run.phase,
                    outcome: this.run.outcome,
                    progress: this.run.progress,
                    timeLeft: this.run.timeLeft,
                    origin: this.origin,
                    rot: this.run.rot,
                    size: { width: this.scale.gameSize.width, height: this.scale.gameSize.height },
                    pops: this.run.pops.map((p) => {
                        const at = popScreen(p, this.run.rot, this.origin);
                        return {
                            hole: p.hole.id,
                            kind: p.kind,
                            age: p.age,
                            x: at.x,
                            y: at.y,
                            visible: isFacing(this.run.rot, p.hole),
                            arrow: hasArrow(p, this.run.rot) ? arrowFor(p, this.run.rot, this.origin) : null,
                        };
                    }),
                }),
            });
        }
    }

    private setupInput() {
        // Mouse + pointer1 exist; add the rest of the touch pointers (once: a restart reuses them).
        const need = 1 + MAX_TOUCH_POINTERS - this.input.manager.pointers.length;
        if (need > 0) this.input.addPointer(need);
        this.cursors = this.input.keyboard!.createCursorKeys();
        onKeyPress(this, ['SPACE'], () => this.doTap(this.origin.x, this.origin.y));

        const up = (p: Input.Pointer) => this.onUp(p, true);
        const upOutside = (p: Input.Pointer) => this.onUp(p, false);
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointermove', this.onMove, this);
        this.input.on('pointerup', up);
        this.input.on('pointerupoutside', upOutside);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onDown, this);
            this.input.off('pointermove', this.onMove, this);
            this.input.off('pointerup', up);
            this.input.off('pointerupoutside', upOutside);
        });
    }

    /** Whether the pointer with this id is still pressed (a release may never reach us). */
    private pressed = (id: number): boolean => {
        const p = this.input.manager.pointers[id];
        if (!p) return false;
        return p.wasTouch ? p.isDown : p.leftButtonDown();
    };

    private kindOf = (p: Input.Pointer): PointerKind => (p.wasTouch ? 'touch' : 'mouse');

    private onDown(p: Input.Pointer) {
        if (this.run.phase !== 'playing') return;
        if (!p.wasTouch && p.button !== 0) return; // the mouse: left button only
        this.tracker.down(p.id, p.x, p.y, this.kindOf(p), this.pressed);
    }

    private onMove(p: Input.Pointer) {
        if (this.run.phase !== 'playing') return;
        const drag = this.tracker.move(p.id, p.x, p.y, this.pressed);
        if (!drag) return;
        const { ay, ax } = dragRotation(drag.dx, drag.dy);
        spin(this.run, ay, ax);
    }

    private onUp(p: Input.Pointer, overCanvas: boolean) {
        if (!p.wasTouch && p.button !== 0) return; // the mouse: left button only
        // A touch that began on the canvas reports its release there even when the finger left it (black bars).
        const { width, height } = this.scale.gameSize;
        const inside = overCanvas && !p.wasCanceled && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height;
        const t = this.tracker.up(p.id, p.x, p.y, inside);
        if (t) this.doTap(t.x, t.y);
    }

    private doTap(x: number, y: number) {
        const hit = tap(this.run, x, y, this.origin);
        if (!hit) return;
        if (hit.kind === 'mole') {
            hitRing(this, hit.at.x, hit.at.y);
            floatText(this, hit.at.x, hit.at.y, '+1', '#ffe066');
        } else {
            floatText(this, hit.at.x, hit.at.y, `−${CAT_PENALTY}`, '#ff6b6b');
            shakeForCat(this);
        }
    }

    update(_time: number, deltaMs: number) {
        const keys = this.keys;
        keys.x = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
        keys.y = (this.cursors.down.isDown ? 1 : 0) - (this.cursors.up.isDown ? 1 : 0);
        const event = step(this.run, deltaMs / 1000, keys, SHAPE, Math.random);
        if (event === 'ended') this.beginEnding();
        else if (event === 'finished') {
            this.exit.to('Result', {
                outcome: this.run.outcome ?? 'fail',
                progress: this.run.progress,
                timeLeft: this.run.timeLeft,
            } satisfies ResultData);
        }
        this.view.draw(this.run);
        this.syncHud();
    }

    private beginEnding() {
        this.tracker.reset();
        this.banner.setText(this.run.outcome === 'clear' ? 'クリア！' : 'タイムアップ！').setVisible(true);
    }

    private pulseTime() {
        this.tweens.killTweensOf(this.hudTime);
        this.hudTime.setScale(LOW_TIME_SCALE);
        this.tweens.add({ targets: this.hudTime, scale: 1, duration: LOW_TIME_PULSE_SEC * 1000, ease: 'Linear' });
    }

    private syncHud() {
        // Compare numbers; build the strings only when one changed.
        const seconds = displaySeconds(this.run.timeLeft);
        if (this.shownProgress !== this.run.progress) {
            this.shownProgress = this.run.progress;
            this.hudProgress.setText(`モグラ ${this.run.progress}/${NORMA}`);
        }
        if (this.shownSeconds !== seconds) {
            const first = this.shownSeconds === -1;
            this.shownSeconds = seconds;
            this.hudTime.setText(`${seconds}秒`);
            if (isLowTime(seconds)) {
                this.hudTime.setColor(LOW_TIME_COLOR);
                // Each change from the limit down pops the text up and back (the right edge stays: origin (1, 0)).
                if (!first) this.pulseTime();
            } else {
                this.hudTime.setColor(HUD_COLOR);
            }
        }
    }
}
