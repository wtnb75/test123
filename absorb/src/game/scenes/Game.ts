import { GameObjects, Input, Scene } from 'phaser';
import {
    ENDING_DURATION, FIELD_RADIUS, GAME_HEIGHT, GAME_WIDTH, GRUNT_WARN, PLAYER_RADIUS, READY_DURATION,
    ENEMY_BULLET_RADIUS, RELEASE_RADIUS, STOCK_MAX
} from '../logic/constants';
import type { Enemy } from '../logic/enemy';
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
    explosion: 0xffcc80
};

/** Longest frame step fed to the simulation, so a tab switch doesn't teleport everything. */
const MAX_DT = 0.05;

const GAUGE_WIDTH = 200;
const GAUGE_HEIGHT = 14;
const GAUGE_X = GAME_WIDTH - GAUGE_WIDTH - 20;
const GAUGE_Y = 22;

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'x' | 'enter', Input.Keyboard.Key>;

export class Game extends Scene {
    private world: World;
    private keys: Keys;
    private gfx: GameObjects.Graphics;
    private hudGfx: GameObjects.Graphics;
    private scoreText: GameObjects.Text;
    private livesText: GameObjects.Text;
    private stockText: GameObjects.Text;
    private centerText: GameObjects.Text;
    private shownScore = -1;
    private shownLives = -1;
    private shownStock = -1;
    private finished = false;
    private readonly input_: WorldInput = { moveX: 0, moveY: 0, release: false };

    constructor() {
        super('Game');
    }

    create() {
        this.world = new World();
        this.finished = false;
        this.shownScore = this.shownLives = this.shownStock = -1;

        this.gfx = this.add.graphics();
        this.hudGfx = this.add.graphics().setDepth(10);
        const style = { fontFamily: 'monospace', fontSize: 22, color: '#ffffff' };
        this.scoreText = this.add.text(20, 16, '', style).setDepth(10);
        this.livesText = this.add.text(GAME_WIDTH / 2, 16, '', style).setOrigin(0.5, 0).setDepth(10);
        this.stockText = this.add.text(GAUGE_X - 12, 16, '', style).setOrigin(1, 0).setDepth(10);
        this.centerText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', {
            fontFamily: 'monospace', fontSize: 96, color: '#ffffff'
        }).setOrigin(0.5).setDepth(10);

        const K = Input.Keyboard.KeyCodes;
        this.keys = this.input.keyboard!.addKeys({
            up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
            w: K.W, a: K.A, s: K.S, d: K.D, x: K.X, enter: K.ENTER
        }) as Keys;
        this.events.once('shutdown', () => this.input.keyboard?.removeAllKeys(true));
    }

    update(_time: number, delta: number) {
        const dt = Math.min(delta / 1000, MAX_DT);
        this.readInput();
        this.world.step(dt, this.input_);
        this.draw();
        this.drawHud();
        if (this.world.phase === 'over' && !this.finished) {
            this.finished = true;
            this.scene.start('GameOver', { score: this.world.score });
        }
    }

    private readInput() {
        const k = this.keys;
        const i = this.input_;
        i.moveX = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
        i.moveY = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
        // Evaluate both so neither key keeps a stale JustDown flag for a later frame.
        const x = Input.Keyboard.JustDown(k.x);
        const enter = Input.Keyboard.JustDown(k.enter);
        i.release = x || enter;
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
            this.stockText.setText(`STOCK ${w.stock}/${STOCK_MAX}`);
            const g = this.hudGfx;
            g.clear();
            g.fillStyle(COLORS.gaugeBack, 1);
            g.fillRect(GAUGE_X, GAUGE_Y, GAUGE_WIDTH, GAUGE_HEIGHT);
            g.fillStyle(COLORS.gaugeFill, 1);
            g.fillRect(GAUGE_X, GAUGE_Y, GAUGE_WIDTH * (w.stock / STOCK_MAX), GAUGE_HEIGHT);
        }
        const countdown = w.phase === 'ready' ? String(Math.max(1, Math.ceil(READY_DURATION - w.phaseTime))) : '';
        if (this.centerText.text !== countdown) this.centerText.setText(countdown);
    }
}
