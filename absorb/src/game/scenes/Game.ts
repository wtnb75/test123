import { GameObjects, Input, Scene } from 'phaser';
import {
    ENDING_DURATION, ENEMY_BULLET_RADIUS, FIELD_RADIUS, GRUNT_WARN, PLAYER_RADIUS, READY_DURATION,
    RELEASE_RADIUS, STOCK_MAX
} from '../logic/constants';
import type { Enemy } from '../logic/enemy';
import { distanceSq } from '../logic/geometry';
import { computeScreenSize } from '../logic/screen';
import { World, type Input as WorldInput } from '../logic/world';

const COLORS = {
    player: 0xffffff,
    field: 0x4dd0e1,
    enemyBullet: 0xff5252,
    releaseBullet: 0x80ffea,
    grunt: 0x66bb6a,
    shooter: 0xffa726,
    heavy: 0xab47bc,
    rammer: 0xef5350,
    warn: 0xffffff,
    gaugeBack: 0x263238,
    gaugeFill: 0x4dd0e1,
    explosion: 0xffcc80,
    button: 0x4dd0e1
};

/** Longest frame step fed to the simulation, so a tab switch doesn't teleport everything. */
const MAX_DT = 0.05;

const GAUGE_WIDTH = 160;
const GAUGE_HEIGHT = 14;
const GAUGE_RIGHT_MARGIN = 20;
const GAUGE_Y = 22;

const BUTTON_RADIUS = 56;
const BUTTON_INSET = 90;

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'x' | 'enter' | 'space', Input.Keyboard.Key>;

export class Game extends Scene {
    private world: World;
    private keys: Keys;
    private gfx: GameObjects.Graphics;
    private hudGfx: GameObjects.Graphics;
    private scoreText: GameObjects.Text;
    private livesText: GameObjects.Text;
    private stockText: GameObjects.Text;
    private centerText: GameObjects.Text;
    private buttonText: GameObjects.Text | null;
    private shownScore = -1;
    private shownLives = -1;
    private shownStock = -1;
    private finished = false;
    private touchUi = false;
    private buttonX = 0;
    private buttonY = 0;
    private dragPointerId = -1;
    private dragLastX = 0;
    private dragLastY = 0;
    private releaseQueued = false;
    private readonly input_: WorldInput = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };

    constructor() {
        super('Game');
    }

    create() {
        const size = computeScreenSize(window.innerWidth, window.innerHeight);
        if (this.scale.width !== size.width || this.scale.height !== size.height) {
            this.scale.setGameSize(size.width, size.height);
        }
        this.cameras.main.setSize(size.width, size.height);

        this.world = new World(size);
        this.finished = false;
        this.shownScore = this.shownLives = this.shownStock = -1;
        this.dragPointerId = -1;
        this.releaseQueued = false;
        this.touchUi = this.sys.game.device.input.touch;
        this.buttonX = size.width - BUTTON_INSET;
        this.buttonY = size.height - BUTTON_INSET;

        this.createHud(size.width, size.height);
        this.setupKeyboard();
        this.setupPointer();
    }

    private createHud(width: number, height: number) {
        this.gfx = this.add.graphics();
        this.hudGfx = this.add.graphics().setDepth(10);
        const style = { fontFamily: 'monospace', fontSize: 22, color: '#ffffff' };
        this.scoreText = this.add.text(20, 16, '', style).setDepth(10);
        this.livesText = this.add.text(width / 2, 16, '', style).setOrigin(0.5, 0).setDepth(10);
        this.stockText = this.add.text(this.gaugeX() - 10, 16, '', style).setOrigin(1, 0).setDepth(10);
        this.centerText = this.add.text(width / 2, height / 2, '', {
            fontFamily: 'monospace', fontSize: 96, color: '#ffffff'
        }).setOrigin(0.5).setDepth(10);
        this.buttonText = this.touchUi
            ? this.add.text(this.buttonX, this.buttonY, '', { fontFamily: 'monospace', fontSize: 28, color: '#ffffff' })
                .setOrigin(0.5).setDepth(11)
            : null;
    }

    private gaugeX(): number {
        return this.world.screen.width - GAUGE_WIDTH - GAUGE_RIGHT_MARGIN;
    }

    private setupKeyboard() {
        const K = Input.Keyboard.KeyCodes;
        this.keys = this.input.keyboard!.addKeys({
            up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
            w: K.W, a: K.A, s: K.S, d: K.D, x: K.X, enter: K.ENTER, space: K.SPACE
        }) as Keys;
        // Queue the release on the key's down event rather than polling JustDown in update():
        // a tap shorter than one frame is released before update() runs, and Phaser clears the
        // just-down flag on key up, so polling would drop it.
        const queueRelease = () => { this.releaseQueued = true; };
        this.keys.x.on('down', queueRelease);
        this.keys.enter.on('down', queueRelease);
        this.keys.space.on('down', queueRelease);
        // Destroying the keys also removes their listeners.
        this.events.once('shutdown', () => this.input.keyboard?.removeAllKeys(true));
    }

    private setupPointer() {
        // One extra pointer so a second finger can press the button while the first one drags.
        this.input.addPointer(1);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.input.on('pointerupoutside', this.onPointerUp, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.input.off('pointerupoutside', this.onPointerUp, this);
        });
    }

    private onPointerDown(p: Input.Pointer) {
        if (this.touchUi && distanceSq(p.x, p.y, this.buttonX, this.buttonY) <= BUTTON_RADIUS * BUTTON_RADIUS) {
            this.releaseQueued = true;
            return;
        }
        if (this.dragPointerId !== -1) return;
        this.dragPointerId = p.id;
        this.dragLastX = p.x;
        this.dragLastY = p.y;
    }

    private onPointerMove(p: Input.Pointer) {
        if (p.id !== this.dragPointerId) return;
        this.input_.dragX += p.x - this.dragLastX;
        this.input_.dragY += p.y - this.dragLastY;
        this.dragLastX = p.x;
        this.dragLastY = p.y;
    }

    private onPointerUp(p: Input.Pointer) {
        if (p.id === this.dragPointerId) this.dragPointerId = -1;
    }

    update(_time: number, delta: number) {
        const dt = Math.min(delta / 1000, MAX_DT);
        this.readKeys();
        this.world.step(dt, this.input_);
        this.input_.dragX = 0;
        this.input_.dragY = 0;
        this.draw();
        this.drawHud();
        if (this.world.phase === 'over' && !this.finished) {
            this.finished = true;
            this.scene.start('GameOver', { score: this.world.score });
        }
    }

    private readKeys() {
        const k = this.keys;
        const i = this.input_;
        i.moveX = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
        i.moveY = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
        i.release = this.releaseQueued;
        this.releaseQueued = false;
    }

    private draw() {
        const g = this.gfx;
        const w = this.world;
        g.clear();

        for (const e of w.enemies) this.drawEnemy(e);

        g.fillStyle(COLORS.enemyBullet, 1);
        for (const b of w.enemyBullets) g.fillCircle(b.x, b.y, ENEMY_BULLET_RADIUS);

        g.fillStyle(COLORS.releaseBullet, 1);
        for (const b of w.releaseBullets) g.fillCircle(b.x, b.y, RELEASE_RADIUS);

        this.drawPlayer();
    }

    private drawPlayer() {
        const g = this.gfx;
        const w = this.world;
        const p = w.player;
        if (w.phase === 'ending' || w.phase === 'over') {
            const t = Math.min(w.phaseTime / ENDING_DURATION, 1);
            g.fillStyle(COLORS.explosion, 1 - t);
            g.fillCircle(p.x, p.y, PLAYER_RADIUS + t * 80);
            return;
        }
        if (w.phase === 'playing') {
            // The field glows brighter as the stock fills up.
            g.fillStyle(COLORS.field, 0.06 + 0.2 * (w.stock / STOCK_MAX));
            g.fillCircle(p.x, p.y, FIELD_RADIUS);
            g.lineStyle(2, COLORS.field, 0.7);
            g.strokeCircle(p.x, p.y, FIELD_RADIUS);
        }
        const blinkOff = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
        if (!blinkOff) {
            g.fillStyle(COLORS.player, 1);
            g.fillCircle(p.x, p.y, PLAYER_RADIUS);
        }
    }

    private drawEnemy(e: Enemy) {
        const g = this.gfx;
        const r = e.radius;
        switch (e.kind) {
            case 'grunt': {
                const shake = e.state === 'warn' ? Math.sin((e.stateTime / GRUNT_WARN) * Math.PI * 16) * 3 : 0;
                const x = e.x + shake;
                g.fillStyle(COLORS.grunt, 1);
                g.fillTriangle(x - r, e.y - r * 0.7, x + r, e.y - r * 0.7, x, e.y + r);
                break;
            }
            case 'shooter':
                g.fillStyle(COLORS.shooter, 1);
                g.fillRect(e.x - r, e.y - r, r * 2, r * 2);
                break;
            case 'heavy':
                g.fillStyle(COLORS.heavy, 1);
                g.fillCircle(e.x, e.y, r);
                g.lineStyle(3, 0xffffff, 0.6);
                g.strokeCircle(e.x, e.y, r * 0.6);
                break;
            default: {
                const blinking = e.state === 'warn' && Math.floor(e.stateTime * 10) % 2 === 0;
                g.fillStyle(blinking ? COLORS.warn : COLORS.rammer, 1);
                // Arrow head pointing along the charge direction (straight down until it locks on).
                const h = e.state === 'dash' ? e.heading : Math.PI / 2;
                const cos = Math.cos(h);
                const sin = Math.sin(h);
                g.fillTriangle(
                    e.x + cos * r * 1.3, e.y + sin * r * 1.3,
                    e.x - cos * r + sin * r, e.y - sin * r - cos * r,
                    e.x - cos * r - sin * r, e.y - sin * r + cos * r
                );
            }
        }
        // Remaining HP as small pips under each enemy.
        g.fillStyle(0xffffff, 0.8);
        for (let i = 0; i < e.hp; i++) g.fillRect(e.x - e.hp * 3 + i * 6, e.y + r + 4, 4, 3);
    }

    private drawHud() {
        const w = this.world;
        if (w.score !== this.shownScore) {
            this.shownScore = w.score;
            this.scoreText.setText(`SCORE ${w.score}`);
        }
        if (w.player.lives !== this.shownLives) {
            this.shownLives = w.player.lives;
            this.livesText.setText(`LIFE ${'♥'.repeat(Math.max(w.player.lives, 0))}`);
        }
        if (w.stock !== this.shownStock) {
            this.shownStock = w.stock;
            this.stockText.setText(`${w.stock}/${STOCK_MAX}`);
            this.redrawGaugeAndButton();
        }
        const countdown = w.phase === 'ready' ? String(Math.max(1, Math.ceil(READY_DURATION - w.phaseTime))) : '';
        if (this.centerText.text !== countdown) this.centerText.setText(countdown);
    }

    private redrawGaugeAndButton() {
        const g = this.hudGfx;
        const stock = this.world.stock;
        const x = this.gaugeX();
        g.clear();
        g.fillStyle(COLORS.gaugeBack, 1);
        g.fillRect(x, GAUGE_Y, GAUGE_WIDTH, GAUGE_HEIGHT);
        g.fillStyle(COLORS.gaugeFill, 1);
        g.fillRect(x, GAUGE_Y, GAUGE_WIDTH * (stock / STOCK_MAX), GAUGE_HEIGHT);
        if (!this.buttonText) return;
        // The release button brightens once there is something to release.
        g.fillStyle(COLORS.button, stock > 0 ? 0.35 : 0.12);
        g.fillCircle(this.buttonX, this.buttonY, BUTTON_RADIUS);
        g.lineStyle(3, COLORS.button, stock > 0 ? 0.9 : 0.4);
        g.strokeCircle(this.buttonX, this.buttonY, BUTTON_RADIUS);
        this.buttonText.setText(String(stock));
    }
}
