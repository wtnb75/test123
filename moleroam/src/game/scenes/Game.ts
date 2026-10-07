import { GameObjects, Input, Scene, Types } from 'phaser';
import { PARAMS } from '../params';
import { arrowFor, type View } from '../logic/arrow';
import { BOARD_H, BOARD_W, HOLE_COUNT, holeCenter, startScroll, type Pt } from '../logic/board';
import { applyStrike, changeLabel, judgeStrike, popState } from '../logic/pop';
import { displaySeconds, remainingMs } from '../logic/run';
import { combineScroll, edgeDelta, isDrag, keyDelta } from '../logic/scroll';
import { firstSpawnAt, isSpawnDue, nextSpawnAt, planSpawn } from '../logic/spawn';
import { PopView } from './PopView';
import { playCatHit, playMiss, playMoleHit } from './fx';
import { DEPTH, UI_FONT } from './ui';

type Phase = 'playing' | 'ending';

export class Game extends Scene {
    private phase: Phase = 'playing';
    private elapsedMs = 0;
    private endingElapsedMs = 0;
    private nextSpawn = 0;
    private score = 0;
    private live: PopView[] = [];
    private arrows: GameObjects.Triangle[] = [];
    private hud!: GameObjects.Text;
    private hudText = '';
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private pointerId: number | null = null;
    private dragging = false;
    /** Last observed mouse position in canvas coordinates; null for touch or outside the canvas. */
    private mouse: Pt | null = null;
    private readonly view: View = { x: 0, y: 0, w: PARAMS.viewW, h: PARAMS.viewH };

    constructor() {
        super('Game');
    }

    create() {
        this.phase = 'playing';
        this.elapsedMs = 0;
        this.endingElapsedMs = 0;
        this.nextSpawn = firstSpawnAt();
        this.score = 0;
        this.live = [];
        this.arrows = [];
        this.pointerId = null;
        this.dragging = false;
        this.mouse = null;
        this.hudText = '';

        this.drawBoard();
        this.createHud();
        this.createArrows();
        const start = startScroll();
        this.cameras.main.setScroll(start.x, start.y);
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.bindInput();
        this.events.once('shutdown', () => this.unbindInput());
    }

    update(_time: number, delta: number) {
        if (this.phase === 'ending') {
            this.updateEnding(delta);
            return;
        }
        this.scrollStep(delta);
        this.elapsedMs += delta;
        if (remainingMs(this.elapsedMs) <= 0) {
            this.enterEnding();
            return;
        }
        this.updatePops();
        this.spawnStep();
        this.updateArrows();
        this.updateHud();
    }

    // --- creation -----------------------------------------------------------------------------

    private drawBoard() {
        const g = this.add.graphics();
        g.fillStyle(0x3a8f3f, 1);
        g.fillRect(0, 0, BOARD_W, BOARD_H);
        g.fillStyle(0x3e2723, 1);
        for (let i = 0; i < HOLE_COUNT; i++) {
            const c = holeCenter(i);
            g.fillEllipse(c.x, c.y + 20, 150, 60);
        }
    }

    private createHud() {
        this.hud = this.add
            .text(16, 12, '', {
                fontFamily: UI_FONT,
                fontSize: '30px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 4,
            })
            .setScrollFactor(0)
            .setDepth(DEPTH.hud);
        this.add
            .circle(PARAMS.viewW / 2, PARAMS.viewH / 2, 14)
            .setStrokeStyle(3, 0xffffff)
            .setScrollFactor(0)
            .setDepth(DEPTH.hud);
        this.updateHud();
    }

    private createArrows() {
        for (let i = 0; i < PARAMS.maxActive; i++) {
            const arrow = this.add
                .triangle(0, 0, 0, -16, 40, 0, 0, 16, 0xffeb3b)
                .setScrollFactor(0)
                .setDepth(DEPTH.arrow)
                .setVisible(false);
            this.arrows.push(arrow);
        }
    }

    // --- input --------------------------------------------------------------------------------

    private bindInput() {
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.input.on('gameout', this.onGameOut, this);
        this.input.keyboard!.on('keydown-SPACE', this.onSpace, this);
    }

    private unbindInput() {
        this.input.off('pointerdown', this.onPointerDown, this);
        this.input.off('pointermove', this.onPointerMove, this);
        this.input.off('pointerup', this.onPointerUp, this);
        this.input.off('gameout', this.onGameOut, this);
        this.input.keyboard?.off('keydown-SPACE', this.onSpace, this);
    }

    private onPointerDown(p: Input.Pointer) {
        // Only the first pointer counts, and only the left mouse button.
        if (this.phase !== 'playing' || this.pointerId !== null) return;
        if (!p.wasTouch && p.button !== 0) return;
        this.pointerId = p.id;
        this.dragging = false;
        if (p.wasTouch) this.mouse = null;
    }

    private onPointerMove(p: Input.Pointer) {
        if (!p.wasTouch) this.mouse = { x: p.x, y: p.y };
        if (this.phase !== 'playing' || p.id !== this.pointerId || !p.isDown) return;
        if (!this.dragging && isDrag(p.x - p.downX, p.y - p.downY)) this.dragging = true;
        if (this.dragging) this.scrollBy({ x: p.prevPosition.x - p.x, y: p.prevPosition.y - p.y });
    }

    private onPointerUp(p: Input.Pointer) {
        if (p.id !== this.pointerId || (!p.wasTouch && p.button !== 0)) return;
        const wasDrag = this.dragging;
        this.pointerId = null;
        this.dragging = false;
        if (this.phase !== 'playing' || wasDrag || isDrag(p.upX - p.downX, p.upY - p.downY)) return;
        const inside = p.x >= 0 && p.x <= PARAMS.viewW && p.y >= 0 && p.y <= PARAMS.viewH;
        if (inside) this.strike(p.x, p.y);
    }

    private onGameOut() {
        this.mouse = null;
    }

    /** Space hits under the mouse cursor if there is one, otherwise at the screen center. */
    private onSpace(event: KeyboardEvent) {
        if (event.repeat || this.phase !== 'playing') return;
        const at = this.mouse ?? { x: PARAMS.viewW / 2, y: PARAMS.viewH / 2 };
        this.strike(at.x, at.y);
    }

    private scrollStep(delta: number) {
        const k = keyDelta(
            this.cursors.left.isDown,
            this.cursors.right.isDown,
            this.cursors.up.isDown,
            this.cursors.down.isDown,
            delta,
        );
        const e = this.mouse && !this.input.activePointer.isDown ? edgeDelta(this.mouse, delta) : { x: 0, y: 0 };
        this.scrollBy(k, e);
    }

    private scrollBy(...deltas: Pt[]) {
        const cam = this.cameras.main;
        const next = combineScroll({ x: cam.scrollX, y: cam.scrollY }, ...deltas);
        cam.setScroll(next.x, next.y);
    }

    // --- play ---------------------------------------------------------------------------------

    /** A strike at canvas position (sx, sy). */
    private strike(sx: number, sy: number) {
        if (this.phase !== 'playing') return;
        const cam = this.cameras.main;
        const at = { x: cam.scrollX + sx, y: cam.scrollY + sy };
        const hit = judgeStrike(at, this.live.map((v) => v.pop), this.elapsedMs);
        const view = this.live.find((v) => v.pop === hit);
        if (!hit || !view) {
            playMiss(this, at.x, at.y);
            return;
        }
        const { score, applied } = applyStrike(this.score, hit.kind);
        this.score = score;
        this.live = this.live.filter((v) => v !== view);
        if (hit.kind === 'mole') playMoleHit(this, view, changeLabel(applied));
        else playCatHit(this, view, changeLabel(applied));
    }

    private updatePops() {
        for (const view of [...this.live]) {
            const state = popState(view.pop, this.elapsedMs);
            if (state === 'up' && !view.isUp) view.rise();
            if (state === 'gone') {
                this.live = this.live.filter((v) => v !== view);
                view.retract();
            }
        }
    }

    /** At most one spawn check per update, however large the frame step. */
    private spawnStep() {
        if (!isSpawnDue(this.elapsedMs, this.nextSpawn)) return;
        const plans = planSpawn(this.live.map((v) => v.pop.hole), Math.random);
        for (const plan of plans) {
            this.live.push(new PopView(this, { ...plan, spawnedAt: this.elapsedMs }));
        }
        this.nextSpawn = nextSpawnAt(this.elapsedMs);
    }

    private updateArrows() {
        const cam = this.cameras.main;
        this.view.x = cam.scrollX;
        this.view.y = cam.scrollY;
        let used = 0;
        for (const v of this.live) {
            if (v.pop.kind !== 'mole' || used >= this.arrows.length) continue;
            const arrow = arrowFor(v.center, this.view);
            if (!arrow) continue;
            this.arrows[used].setPosition(arrow.x, arrow.y).setRotation(arrow.angle).setVisible(true);
            used++;
        }
        for (let i = used; i < this.arrows.length; i++) this.arrows[i].setVisible(false);
    }

    private updateHud() {
        const text = `スコア ${this.score}　残り ${displaySeconds(remainingMs(this.elapsedMs))}`;
        if (text === this.hudText) return;
        this.hudText = text;
        this.hud.setText(text);
    }

    // --- ending -------------------------------------------------------------------------------

    private enterEnding() {
        this.phase = 'ending';
        this.live.forEach((v) => v.destroy());
        this.live = [];
        this.arrows.forEach((a) => a.setVisible(false));
        this.pointerId = null;
        this.dragging = false;
        this.updateHud();
    }

    private updateEnding(delta: number) {
        this.endingElapsedMs += delta;
        if (this.endingElapsedMs >= PARAMS.endingMs) this.scene.start('Result', { score: this.score });
    }
}
