import { GameObjects, Scene, Types } from 'phaser';
import {
    FIELD_LEFT,
    FIELD_RIGHT,
    FIELD_TOP,
    FRAME_WIDTH,
    HUD_FONT_SIZE,
    PADDLE_BOTTOM_MARGIN,
    SCREEN_WIDTH,
    SHAKE_DURATION,
    SHAKE_INTENSITY,
} from '../params';
import { shouldHideHint } from '../logic/hud';
import { nextPaddleX } from '../logic/paddle';
import { createRun, frameDt, stepRun, type Run } from '../logic/run';
import { fadeInScene, GameFx } from './effects';
import type { ResultData } from './Result';
import {
    addLabel,
    applyScreenSize,
    DEPTH,
    ENEMY_RED,
    FRAME_COLOR,
    HUD_MARGIN,
    HUD_Y,
    makeTextures,
    myBallTexture,
    RotateGuard,
    SceneExit,
    TEX,
    SHAKE_BLEED,
    UI_FONT,
} from './ui';

export class Game extends Scene {
    private run!: Run;
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private paddle!: GameObjects.Image;
    private paddleX = SCREEN_WIDTH / 2;
    /** x of a pointer that touched or moved since the last frame; consumed by update. */
    private pointerX: number | null = null;
    private keys!: Types.Input.Keyboard.CursorKeys;
    private enemySprites = new Map<number, GameObjects.Image>();
    private ballSprites = new Map<number, GameObjects.Image>();
    private waveText!: GameObjects.Text;
    private scoreText!: GameObjects.Text;
    private centerText!: GameObjects.Text;
    private fx!: GameFx;
    private hideHint!: () => void;
    /** Seconds of play so far (stops while the rotate prompt is up), for the paddle hint. */
    private elapsed = 0;
    private hintDone = false;
    private shownWave = -1;
    private shownScore = -1;
    private shownClear = false;

    constructor() {
        super('Game');
    }

    create() {
        const { height } = applyScreenSize(this);
        makeTextures(this);
        this.run = createRun(height);
        this.paddleX = SCREEN_WIDTH / 2;
        this.pointerX = null;
        this.enemySprites.clear();
        this.ballSprites.clear();
        this.shownWave = this.shownScore = -1;
        this.shownClear = false;
        this.elapsed = 0;
        this.hintDone = false;
        fadeInScene(this);

        this.drawFrame(height);
        this.drawDangerLine();
        this.paddle = this.add.image(this.paddleX, this.run.paddleY, TEX.paddle).setDepth(DEPTH.paddle);
        this.fx = new GameFx(this, this.paddle, HUD_Y);
        this.hideHint = this.fx.hint(height - PADDLE_BOTTOM_MARGIN / 2);
        this.createHud();
        this.syncEnemies();

        this.keys = this.input.keyboard!.createCursorKeys();
        this.input.on('pointerdown', this.onPointer, this);
        this.input.on('pointermove', this.onPointer, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onPointer, this);
            this.input.off('pointermove', this.onPointer, this);
        });
        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
        this.exposeQa();
    }

    /**
     * The playfield walls: balls bounce on their inner faces (FIELD_LEFT / FIELD_RIGHT, and FIELD_TOP for the
     * top wall). The side walls run SHAKE_BLEED past the canvas sides and bottom so a camera shake never opens a
     * gap at the edge; the top wall spans the screen (the side walls cover its corners). The bottom stays open.
     */
    private drawFrame(height: number) {
        const top = FIELD_TOP - FRAME_WIDTH;
        const wallHeight = height + SHAKE_BLEED - top;
        this.add
            .graphics()
            .fillStyle(FRAME_COLOR)
            .fillRect(0, top, SCREEN_WIDTH, FRAME_WIDTH)
            .fillRect(-SHAKE_BLEED, top, FIELD_LEFT + SHAKE_BLEED, wallHeight)
            .fillRect(FIELD_RIGHT, top, SCREEN_WIDTH - FIELD_RIGHT + SHAKE_BLEED, wallHeight)
            .setDepth(DEPTH.frame);
    }

    /** A faint red dashed line: the formation's bottom reaching it ends the game. */
    private drawDangerLine() {
        const g = this.add.graphics().fillStyle(ENEMY_RED, 0.45).setDepth(DEPTH.danger);
        const dash = 12;
        const gap = 8;
        for (let x = FIELD_LEFT; x < FIELD_RIGHT; x += dash + gap) {
            g.fillRect(x, this.run.dangerY - 1, Math.min(dash, FIELD_RIGHT - x), 2);
        }
    }

    private createHud() {
        const style = { fontFamily: UI_FONT, fontSize: `${HUD_FONT_SIZE}px`, color: '#ffffff' };
        this.waveText = this.add.text(HUD_MARGIN, HUD_Y, '', style).setOrigin(0, 0.5).setDepth(DEPTH.hud);
        this.scoreText = this.add.text(160, HUD_Y, '', style).setOrigin(0, 0.5).setDepth(DEPTH.hud);
        const { height } = this.scale.gameSize;
        this.centerText = addLabel(this, SCREEN_WIDTH / 2, height / 2, '', HUD_FONT_SIZE).setDepth(DEPTH.center);
        this.updateHud();
    }

    private onPointer(pointer: { x: number }) {
        this.pointerX = pointer.x;
    }

    update(_time: number, deltaMs: number) {
        if (this.guard.active) {
            this.pointerX = null;
            return;
        }
        const run = this.run;
        const dt = frameDt(deltaMs / 1000);
        if (run.phase !== 'ending') {
            this.paddleX = nextPaddleX(this.paddleX, this.pointerX, this.keys.left.isDown, this.keys.right.isDown, dt);
            this.paddle.x = this.paddleX;
        }
        this.pointerX = null;

        stepRun(run, dt, this.paddleX, Math.random);
        this.playEffects(dt);
        this.syncEnemies();
        this.syncBalls();
        this.updateHud();
        if (run.resultReady) {
            const data: ResultData = { score: run.score, wave: run.wave };
            this.exit.to('Result', data);
        }
    }

    /** Effects fed by this frame's result (docs/spec.md "演出・UI（Game）"). */
    private playEffects(dt: number) {
        const run = this.run;
        for (const k of run.kills) this.fx.kill(k);
        if (run.kills.length > 0) this.fx.scoreBump(this.scoreText, Math.max(...run.kills.map((k) => k.tier)));
        this.fx.catches(run.caught);
        if (run.livesLost > 0) {
            this.cameras.main.shake(SHAKE_DURATION, SHAKE_INTENSITY, true);
            this.fx.livesLost(run.livesLost, run.lives);
        }
        this.elapsed += dt;
        const moved = this.paddleX !== SCREEN_WIDTH / 2;
        if (!this.hintDone && (run.phase === 'ending' || shouldHideHint(this.elapsed, moved))) {
            this.hintDone = true;
            this.hideHint();
        }
    }

    private syncEnemies() {
        for (const id of this.run.killedEnemyIds) {
            this.enemySprites.get(id)?.destroy();
            this.enemySprites.delete(id);
        }
        if (this.run.formationSpawned) {
            for (const e of this.run.formation.enemies) {
                this.enemySprites.set(e.id, this.add.image(e.rect.x, e.rect.y, TEX.enemy).setDepth(DEPTH.formation));
            }
        }
        // Both axes: the formation moves sideways and drops on every turn.
        for (const e of this.run.formation.enemies) this.enemySprites.get(e.id)?.setPosition(e.rect.x, e.rect.y);
    }

    private syncBalls() {
        for (const id of this.run.removedBallIds) {
            this.ballSprites.get(id)?.destroy();
            this.ballSprites.delete(id);
        }
        for (const b of this.run.balls) {
            const tex = b.owner === 'mine' ? myBallTexture(b.tier) : TEX.enemyBall;
            const depth = b.owner === 'mine' ? DEPTH.myBall : DEPTH.enemyBall;
            let s = this.ballSprites.get(b.id);
            if (!s) {
                s = this.add.image(b.x, b.y, tex).setDepth(depth);
                this.ballSprites.set(b.id, s);
            } else if (s.texture.key !== tex) {
                s.setTexture(tex).setDepth(depth);
            }
            s.setPosition(b.x, b.y);
        }
    }

    private updateHud() {
        const run = this.run;
        if (run.wave !== this.shownWave) {
            this.shownWave = run.wave;
            this.waveText.setText(`WAVE ${run.wave}`);
        }
        if (run.score !== this.shownScore) {
            this.shownScore = run.score;
            this.scoreText.setText(`SCORE ${run.score}`);
        }
        const clear = run.phase === 'waveClear';
        if (clear !== this.shownClear) {
            this.shownClear = clear;
            this.centerText.setText(clear ? `WAVE ${run.wave} CLEAR` : '');
            if (clear) this.fx.popCenter(this.centerText);
            else if (run.phase === 'ending') this.fx.stopCenter(this.centerText); // cut a pop still running
        }
    }

    private exposeQa() {
        if (import.meta.env.DEV) {
            // QA only, written inline so none of it reaches the production bundle: a read-only snapshot for the
            // browser QA scripts (positions are canvas coordinates).
            Object.defineProperty(window, '__qa', {
                configurable: true,
                get: () => ({
                    phase: this.run.phase,
                    wave: this.run.wave,
                    score: this.run.score,
                    lives: this.run.lives,
                    enemies: this.run.formation.enemies.length,
                    balls: this.run.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, owner: b.owner, tier: b.tier })),
                    paddleX: this.paddleX,
                    paddleY: this.run.paddleY,
                    prompt: this.guard.active,
                    run: this.run, // live state, so QA can stage a situation
                }),
            });
        }
    }
}
