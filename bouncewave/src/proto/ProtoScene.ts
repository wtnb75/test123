import { GameObjects, Scene, Types } from 'phaser';
import { PARAMS } from './params';
import {
    Ball,
    Rect,
    bounceOffRect,
    enemyShotVelocity,
    fireInterval,
    formationRects,
    hitsPaddle,
    isOut,
    paddleBounce,
    scoreForKill,
    stepBall,
} from './logic';

interface Enemy {
    baseX: number;
    rect: Rect;
    col: number;
    sprite: GameObjects.Image;
}

interface BallObj {
    ball: Ball;
    sprite: GameObjects.Image;
}

export class ProtoScene extends Scene {
    private paddle!: GameObjects.Image;
    private paddleX = PARAMS.width / 2;
    private enemies: Enemy[] = [];
    private balls: BallObj[] = [];
    private offsetX = 0;
    private dir = 1;
    private wave = 1;
    private score = 0;
    private lives: number = PARAMS.lives;
    private fireTimer = 0;
    private waveTimer = 0;
    private over = false;
    private hud!: GameObjects.Text;
    private msg!: GameObjects.Text;
    private keys!: Types.Input.Keyboard.CursorKeys;

    constructor() {
        super('Proto');
    }

    create() {
        this.enemies = [];
        this.balls = [];
        this.offsetX = 0;
        this.dir = 1;
        this.wave = 1;
        this.score = 0;
        this.lives = PARAMS.lives;
        this.fireTimer = fireInterval(1);
        this.waveTimer = 0;
        this.over = false;
        this.paddleX = PARAMS.width / 2;

        this.makeTextures();
        this.paddle = this.add.image(this.paddleX, PARAMS.paddleY, 'paddle');
        this.hud = this.add.text(12, 12, '', { fontFamily: 'Arial', fontSize: 26, color: '#ffffff' });
        this.msg = this.add
            .text(PARAMS.width / 2, PARAMS.height / 2, '', {
                fontFamily: 'Arial',
                fontSize: 40,
                color: '#ffffff',
                align: 'center',
            })
            .setOrigin(0.5);

        this.keys = this.input.keyboard!.createCursorKeys();
        this.input.on('pointermove', (p: { x: number }) => this.followPointer(p.x));
        this.input.on('pointerdown', (p: { x: number }) => {
            if (this.over) {
                this.scene.restart();
                return;
            }
            this.followPointer(p.x);
        });

        this.spawnFormation();
        this.updateHud();
    }

    private makeTextures() {
        if (this.textures.exists('paddle')) return;
        const g = this.add.graphics();
        const r = PARAMS.ballRadius;
        g.fillStyle(0xffffff).fillRect(0, 0, PARAMS.paddleWidth, PARAMS.paddleHeight);
        g.generateTexture('paddle', PARAMS.paddleWidth, PARAMS.paddleHeight);
        g.clear();
        g.fillStyle(0x7cd35a).fillRect(0, 0, PARAMS.enemyWidth, PARAMS.enemyHeight);
        g.generateTexture('enemy', PARAMS.enemyWidth, PARAMS.enemyHeight);
        g.clear();
        // Enemy ball: red diamond. Own ball: cyan circle.
        g.fillStyle(0xff4a4a);
        g.fillTriangle(r, 0, 2 * r, r, 0, r);
        g.fillTriangle(0, r, 2 * r, r, r, 2 * r);
        g.generateTexture('eball', 2 * r, 2 * r);
        g.clear();
        g.fillStyle(0x4ae0ff).fillCircle(r, r, r);
        g.generateTexture('mball', 2 * r, 2 * r);
        g.destroy();
    }

    private followPointer(x: number) {
        if (this.over) return;
        this.paddleX = this.clampPaddle(x);
    }

    private clampPaddle(x: number) {
        const half = PARAMS.paddleWidth / 2;
        return Math.max(half, Math.min(PARAMS.width - half, x));
    }

    private spawnFormation() {
        this.offsetX = 0;
        this.dir = 1;
        const cols = PARAMS.enemyCols;
        this.enemies = formationRects(this.wave, 0).map((rect, i) => ({
            baseX: rect.x,
            rect,
            col: i % cols,
            sprite: this.add.image(rect.x, rect.y, 'enemy'),
        }));
    }

    private addBall(ball: Ball) {
        const sprite = this.add.image(ball.x, ball.y, ball.owner === 'mine' ? 'mball' : 'eball');
        this.balls.push({ ball, sprite });
    }

    update(_t: number, deltaMs: number) {
        if (this.over) return;
        const dt = Math.min(deltaMs / 1000, 0.05);
        this.movePaddle(dt);
        this.moveFormation(dt);
        this.fire(dt);
        this.moveBalls(dt);
        this.checkWave(dt);
        this.updateHud();
    }

    private movePaddle(dt: number) {
        if (this.keys.left.isDown) this.paddleX -= PARAMS.paddleKeySpeed * dt;
        if (this.keys.right.isDown) this.paddleX += PARAMS.paddleKeySpeed * dt;
        this.paddleX = this.clampPaddle(this.paddleX);
        this.paddle.x = this.paddleX;
    }

    private moveFormation(dt: number) {
        if (this.enemies.length === 0) return;
        this.offsetX += this.dir * PARAMS.formationSpeed * dt;
        const half = PARAMS.enemyWidth / 2;
        const minX = Math.min(...this.enemies.map((e) => e.baseX + this.offsetX)) - half;
        const maxX = Math.max(...this.enemies.map((e) => e.baseX + this.offsetX)) + half;
        if (minX < 0) {
            this.offsetX -= minX;
            this.dir = 1;
        } else if (maxX > PARAMS.width) {
            this.offsetX -= maxX - PARAMS.width;
            this.dir = -1;
        }
        for (const e of this.enemies) {
            e.rect.x = e.baseX + this.offsetX;
            e.sprite.x = e.rect.x;
        }
    }

    private fire(dt: number) {
        if (this.enemies.length === 0) return;
        this.fireTimer -= dt;
        if (this.fireTimer > 0) return;
        this.fireTimer = fireInterval(this.wave);
        // Shooters: the lowest living enemy of each column.
        const lowest = new Map<number, Enemy>();
        for (const e of this.enemies) {
            const cur = lowest.get(e.col);
            if (!cur || e.rect.y > cur.rect.y) lowest.set(e.col, e);
        }
        const shooters = [...lowest.values()];
        const s = shooters[Math.floor(Math.random() * shooters.length)];
        const v = enemyShotVelocity(Math.random());
        this.addBall({ x: s.rect.x, y: s.rect.y + s.rect.h / 2 + PARAMS.ballRadius, ...v, owner: 'enemy' });
    }

    private moveBalls(dt: number) {
        for (const o of this.balls) {
            const b = o.ball;
            stepBall(b, dt);
            if (hitsPaddle(b, this.paddleX)) {
                const offset = (b.x - this.paddleX) / (PARAMS.paddleWidth / 2);
                Object.assign(b, paddleBounce(offset, PARAMS.myBallSpeed));
                b.y = PARAMS.paddleY - PARAMS.paddleHeight / 2 - PARAMS.ballRadius;
                if (b.owner === 'enemy') {
                    b.owner = 'mine';
                    o.sprite.setTexture('mball');
                }
            }
            if (b.owner === 'mine') this.hitEnemies(b);
            o.sprite.setPosition(b.x, b.y);
        }
        this.balls = this.balls.filter((o) => {
            if (!isOut(o.ball)) return true;
            if (o.ball.owner === 'enemy' && o.ball.vy > 0) this.loseLife();
            o.sprite.destroy();
            return false;
        });
    }

    private hitEnemies(b: Ball) {
        const i = this.enemies.findIndex((e) => bounceOffRect(b, e.rect));
        if (i < 0) return;
        this.enemies[i].sprite.destroy();
        this.enemies.splice(i, 1);
        this.score += scoreForKill(this.wave);
    }

    private loseLife() {
        this.lives -= 1;
        this.cameras.main.shake(150, 0.01);
        if (this.lives <= 0) {
            this.over = true;
            this.msg.setText(`GAME OVER\nWAVE ${this.wave}  SCORE ${this.score}\n\nタップでもう一度`);
        }
    }

    private checkWave(dt: number) {
        if (this.enemies.length > 0) return;
        if (this.waveTimer <= 0) {
            this.waveTimer = PARAMS.waveDelay;
            this.msg.setText(`WAVE ${this.wave} CLEAR`);
            return;
        }
        this.waveTimer -= dt;
        if (this.waveTimer > 0) return;
        this.wave += 1;
        this.msg.setText('');
        for (const o of this.balls) if (o.ball.owner === 'enemy') o.sprite.destroy();
        this.balls = this.balls.filter((o) => o.ball.owner === 'mine');
        this.fireTimer = fireInterval(this.wave);
        this.spawnFormation();
    }

    private updateHud() {
        const mine = this.balls.filter((o) => o.ball.owner === 'mine').length;
        this.hud.setText(`WAVE ${this.wave}   SCORE ${this.score}   LIFE ${'♥'.repeat(Math.max(this.lives, 0))}   ●×${mine}`);
    }
}
