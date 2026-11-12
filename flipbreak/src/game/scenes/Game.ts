import { Core, Scene, type GameObjects } from 'phaser';
import {
    BALL_R,
    CHARGE_BAR_MAX,
    CHARGE_BAR_W,
    CHARGE_MARK,
    CLEAR_FONT_SIZE,
    CLEAR_POP_DURATION,
    CLEAR_POP_FROM,
    DEFLECTOR_X,
    FIELD_W,
    FLIPPER_R,
    FRAME_DT_MAX,
    H,
    HELP_FONT_SIZE,
    HINT_Y,
    HUD_FONT_SIZE,
    HUD_ROW_H,
    HUD_X,
    HUD_Y,
    LANE_BALL_X,
    LANE_FLOOR_Y,
    LANE_X,
    LIVES,
    MULTI_BALL_MAX,
    SPECIAL_COLOR,
    SPECIAL_STAR_R,
    W,
} from '../params';
import { InputRouter, type PointerState } from '../logic/input';
import { ballText, chargeColor, scoreText, stageText } from '../logic/hud';
import { ballAt, ballCount, blockRect, flipperTip, WALLS } from '../logic/physics';
import { GameSession } from '../logic/session';
import { GameEffects } from './effects';
import { addLabel, BG_COLOR, DEPTH, fadeInScene, RotateGuard, SceneExit, UI_FONT } from './ui';

const WALL_COLOR = 0x5566aa;
/** The dark colour of the star on a special block, and the inner radius of its points relative to the outer. */
const STAR_COLOR = 0x0b3a52;
const STAR_INNER_RATIO = 0.45;
const FLIPPER_COLOR = 0xffd84d;
/** Block colour per row (the rows of a stage cycle through these). */
const ROW_COLORS = [0xff5d5d, 0xffa24d, 0xffe14d, 0x7be26b, 0x4dc6ff, 0xa78bff];
/** Keys the page must not scroll or navigate on while playing. */
const CAPTURED_KEYS = 'LEFT,RIGHT,DOWN,SPACE,FORWARD_SLASH';
/** Pointers the Game needs (the mouse plus two more fingers); Phaser keeps them for the whole page. */
const POINTERS_NEEDED = 3;
/** The "reaches the table" mark on the plunger bar: a full-lane-width white line. */
const MARK_WIDTH = W - LANE_X; // the full width of the lane
const MARK_THICKNESS = 2;
const MARK_ALPHA = 0.8;

export class Game extends Scene {
    private session!: GameSession;
    private router!: InputRouter;
    private effects!: GameEffects;
    private guard!: RotateGuard;
    private exit!: SceneExit;
    /** KeyboardEvent.code of the keys held down; auto-repeat is ignored, so a key held over from the previous Scene stays out. */
    private readonly keys = new Set<string>();
    private readonly pointerStates: PointerState[] = [];

    private blocksGfx!: GameObjects.Graphics;
    private flippersGfx!: GameObjects.Graphics;
    /** One circle per ball that can be on the table (made once, shown for the balls there are). */
    private readonly ballShapes: GameObjects.Arc[] = [];
    private chargeBar!: GameObjects.Rectangle;
    private chargeMark!: GameObjects.Rectangle;
    private scoreLabel!: GameObjects.Text;
    private ballLabel!: GameObjects.Text;
    private stageLabel!: GameObjects.Text;
    private hint!: GameObjects.Text;
    private message!: GameObjects.Text;
    private drawnBlocksVersion = -1;
    private drawnStage = 0;
    private lastScore = 0;

    constructor() {
        super('Game');
    }

    create() {
        this.session = new GameSession();
        this.router = new InputRouter();
        this.keys.clear();
        this.drawnBlocksVersion = -1;
        this.drawnStage = 0;
        this.lastScore = 0;

        this.cameras.main.setBackgroundColor(BG_COLOR);
        fadeInScene(this);
        this.buildTable();
        this.effects = new GameEffects(this);
        this.buildHud();
        this.registerInput();

        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
        if (import.meta.env.DEV) {
            // QA only, written inline so none of it reaches the production bundle.
            Object.defineProperty(window, '__qa', {
                configurable: true,
                get: () => ({
                    scene: 'Game',
                    phase: this.session.phase,
                    stage: this.session.stage,
                    lives: this.session.lives,
                    score: this.session.score,
                    ready: this.session.ready,
                    charge: this.session.charge,
                    ball: { ...this.session.world.ball },
                    balls: ballCount(this.session.world),
                    blocksLeft: this.session.world.blocks.filter((b) => b.alive).length,
                    // Drops every ball out of the table (loses one life on the next frame).
                    dropBall: () => {
                        for (let i = 0; i < ballCount(this.session.world); i++) ballAt(this.session.world, i).y = H + 100;
                    },
                    // Breaks every block but the first `keep` (reaches a stage clear without minutes of play).
                    breakBlocks: (keep: number) => {
                        this.session.world.blocks.forEach((b, i) => (b.alive = i < keep));
                        this.session.blocksVersion += 1;
                    },
                }),
            });
            this.events.once('shutdown', () => Reflect.deleteProperty(window, '__qa'));
        }
    }

    update(_time: number, deltaMs: number) {
        this.collectPointers();
        const routed = this.router.route({ pointers: this.pointerStates, keys: this.keys, ready: this.session.ready });
        // The "rotate" notice covers the screen: nothing moves, and a charge in progress is dropped. The router
        // still runs, so a finger lifted and pressed again under the notice counts as a fresh press afterwards.
        if (this.guard.active) {
            this.session.cancelCharge();
            return;
        }
        const ev = this.session.frame(routed, deltaMs);
        this.playEffects(ev, Math.min(deltaMs / 1000, FRAME_DT_MAX));
        this.render();
        if (ev.result) this.exit.to('Result', ev.result);
    }

    /** Turn what happened this frame into effects (they hang off the frame's result, never the rules). */
    private playEffects(ev: ReturnType<GameSession['frame']>, dt: number) {
        const s = this.session;
        // Time first, so a trigger in this frame starts at t = 0 and the next frame advances it.
        this.effects.tick(dt);
        for (const index of ev.brokenBlocks) this.effects.blockBroken(s.world.blocks[index]);
        for (const index of ev.hitBumpers) this.effects.bumperHit(index);
        if (ev.ballsLost > 0) this.effects.ballLost();
        if (s.score > this.lastScore) this.effects.scoreGained();
        this.lastScore = s.score;
        if (s.phase === 'playing') this.effects.recordTrail(s.world);
    }

    /** Walls (drawn once) and the layers redrawn only when they change. */
    private buildTable() {
        const walls = this.add.graphics().setDepth(DEPTH.walls);
        walls.lineStyle(2, WALL_COLOR, 1);
        for (const [ax, ay, bx, by] of WALLS) walls.lineBetween(ax, ay, bx, by);
        this.blocksGfx = this.add.graphics().setDepth(DEPTH.blocks);
        this.flippersGfx = this.add.graphics().setDepth(DEPTH.flippers);
        this.ballShapes.length = 0;
        for (let i = 0; i < MULTI_BALL_MAX; i++) {
            this.ballShapes.push(this.add.circle(0, 0, BALL_R, 0xffffff).setDepth(DEPTH.ball).setVisible(i === 0));
        }
        // The plunger bar sits behind the ball, centred in the lane; a line marks the charge that reaches the table.
        this.chargeBar = this.add
            .rectangle(LANE_BALL_X, LANE_FLOOR_Y, CHARGE_BAR_W, 0, chargeColor(0))
            .setOrigin(0.5, 1)
            .setDepth(DEPTH.hint)
            .setVisible(false);
        this.chargeMark = this.add
            .rectangle(
                (LANE_X + W) / 2,
                LANE_FLOOR_Y - CHARGE_BAR_MAX * CHARGE_MARK,
                MARK_WIDTH,
                MARK_THICKNESS,
                0xffffff,
                MARK_ALPHA,
            )
            .setDepth(DEPTH.hint)
            .setVisible(false);
    }

    private buildHud() {
        const style = { fontFamily: UI_FONT, fontSize: `${HUD_FONT_SIZE}px`, color: '#ffffff' };
        // SCORE grows around its left-middle; the BALL label is fixed at the left edge it has with LIVES dots.
        this.scoreLabel = this.add
            .text(HUD_X, HUD_Y + HUD_ROW_H / 2, '', style)
            .setOrigin(0, 0.5)
            .setDepth(DEPTH.hud);
        this.ballLabel = this.add.text(0, HUD_Y, ballText(LIVES), style).setDepth(DEPTH.hud);
        this.ballLabel.setX(DEFLECTOR_X - 4 - this.ballLabel.width);
        this.stageLabel = this.add.text(HUD_X, HUD_Y + HUD_ROW_H, '', style).setDepth(DEPTH.hud);
        this.hint = addLabel(this, FIELD_W / 2, HINT_Y, '押し続けて溜め、離して発射', HELP_FONT_SIZE, '#aab4cc').setDepth(
            DEPTH.hint,
        );
        this.message = addLabel(this, W / 2, H / 2, '', CLEAR_FONT_SIZE)
            .setStroke('#000000', 5)
            .setDepth(DEPTH.center);
    }

    /** Key tracking, the fingers already down, and their removal on shutdown. */
    private registerInput() {
        const kb = this.input.keyboard;
        const pointers = this.input.manager.pointers;
        // Pointers outlive Scenes: add only what is missing, or each retry would add more.
        const missing = POINTERS_NEEDED - this.input.manager.pointersTotal;
        if (missing > 0) this.input.addPointer(missing);
        // Fingers down since before this Scene (the START tap's, a flipper's) stay ignored until released.
        this.router.startBlock(pointers.filter((p) => p.isDown).map((p) => p.id));
        if (kb) {
            const down = (e: KeyboardEvent) => {
                if (!e.repeat) this.keys.add(e.code);
            };
            const up = (e: KeyboardEvent) => this.keys.delete(e.code);
            kb.on('keydown', down);
            kb.on('keyup', up);
            kb.addCapture(CAPTURED_KEYS);
            this.events.once('shutdown', () => {
                kb.off('keydown', down);
                kb.off('keyup', up);
                kb.removeCapture(CAPTURED_KEYS);
            });
        }
        // Keys can't report their release while the window is unfocused.
        const release = () => this.keys.clear();
        this.game.events.on(Core.Events.BLUR, release);
        this.events.once('shutdown', () => this.game.events.off(Core.Events.BLUR, release));
    }

    private collectPointers() {
        this.pointerStates.length = 0;
        for (const p of this.input.manager.pointers) {
            if (p.isDown) this.pointerStates.push({ id: p.id, x: p.x });
        }
    }

    private render() {
        const s = this.session;
        const world = s.world;
        if (this.drawnStage !== s.stage) {
            this.drawnStage = s.stage;
            this.effects.setBumpers(world.bumpers);
        }
        if (this.drawnBlocksVersion !== s.blocksVersion) {
            this.drawnBlocksVersion = s.blocksVersion;
            this.drawBlocks();
        }
        const balls = ballCount(world);
        for (let i = 0; i < this.ballShapes.length; i++) {
            const shape = this.ballShapes[i];
            shape.setVisible(i < balls);
            if (i < balls) {
                const ball = ballAt(world, i);
                shape.setPosition(ball.x, ball.y);
            }
        }
        this.effects.drawTrail();

        const g = this.flippersGfx;
        g.clear();
        g.lineStyle(FLIPPER_R * 2, FLIPPER_COLOR, 1);
        g.fillStyle(FLIPPER_COLOR, 1);
        for (const f of world.flippers) {
            const [tx, ty] = flipperTip(f);
            g.lineBetween(f.px, f.py, tx, ty);
            g.fillCircle(f.px, f.py, FLIPPER_R);
            g.fillCircle(tx, ty, FLIPPER_R);
        }

        // The bar and its mark are touched only while charging, and once more to hide them.
        const charging = s.charge > 0;
        if (charging) {
            this.chargeBar.setSize(CHARGE_BAR_W, CHARGE_BAR_MAX * s.charge).setFillStyle(chargeColor(s.charge));
        }
        if (charging !== this.chargeBar.visible) {
            this.chargeBar.setVisible(charging);
            this.chargeMark.setVisible(charging);
        }
        this.hint.setVisible(s.phase === 'playing' && s.ready);
        this.setText(this.scoreLabel, scoreText(s.score));
        this.scoreLabel.setScale(this.effects.scoreScale);
        this.setText(this.ballLabel, ballText(s.lives, this.effects.ghost));
        this.setText(this.stageLabel, stageText(s.stage));
        this.updateMessage(s.message ?? '');
    }

    /** The centre message; a new one shrinks in from CLEAR_POP_FROM times its size while fading in. */
    private updateMessage(text: string) {
        if (this.message.text === text) return;
        this.message.setText(text);
        this.tweens.killTweensOf(this.message);
        if (text === '') {
            this.message.setScale(1).setAlpha(1);
            return;
        }
        // Start state first, so the text is never drawn once at full size and opacity before the tween begins.
        this.message.setScale(CLEAR_POP_FROM).setAlpha(0);
        this.tweens.add({
            targets: this.message,
            scale: { from: CLEAR_POP_FROM, to: 1 },
            alpha: { from: 0, to: 1 },
            duration: CLEAR_POP_DURATION * 1000,
            ease: 'Linear',
        });
    }

    /** The blocks still alive, redrawn when a block breaks or a stage starts. */
    private drawBlocks() {
        const b = this.blocksGfx;
        b.clear();
        for (const block of this.session.world.blocks) {
            if (!block.alive) continue;
            const r = blockRect(block);
            b.fillStyle(block.special ? SPECIAL_COLOR : ROW_COLORS[block.row % ROW_COLORS.length], 1);
            b.fillRect(r.x, r.y, r.w, r.h);
            if (block.special) this.drawStar(r.x + r.w / 2, r.y + r.h / 2);
        }
    }

    /** The "★" mark of a special block: a five-pointed star of outer radius SPECIAL_STAR_R, in a dark colour. */
    private drawStar(cx: number, cy: number) {
        const g = this.blocksGfx;
        g.fillStyle(STAR_COLOR, 1);
        g.beginPath();
        for (let k = 0; k < 10; k++) {
            const r = k % 2 === 0 ? SPECIAL_STAR_R : SPECIAL_STAR_R * STAR_INNER_RATIO;
            const a = -Math.PI / 2 + (k * Math.PI) / 5;
            const x = cx + Math.cos(a) * r;
            const y = cy + Math.sin(a) * r;
            if (k === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
        }
        g.closePath();
        g.fillPath();
    }

    /** setText only when the text changed (a Text re-renders its texture on every call). */
    private setText(label: GameObjects.Text, text: string) {
        if (label.text !== text) label.setText(text);
    }
}
