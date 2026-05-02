import * as Phaser from 'phaser';
const { Scene } = Phaser;
import {
    GAME_WIDTH, GAME_HEIGHT,
    PLAYER_RADIUS, PLAYER_SPEED,
    BULLET_RADIUS, ENEMY_RADIUS,
    MINE_RADIUS, MINE_EXPLODE_RADIUS,
    MINE_TIMEOUT_SEC, MINE_BLINK_SEC, MINE_PLACE_GRACE_SEC,
    MINE_INITIAL_COUNT, SCORE_MULTIPLIER,
    FORMATION_INTERVAL_SEC, ENEMY_SPEED
} from '../core/constants';
import {
    circlesOverlap, getTargetsInExplosion,
    clampPosition, inputToVelocity, joystickToVelocity,
    angleToVec, angleTo, calcNWayAngles, calcScore
} from '../core/physics';
import { getDifficultyParams, type BulletType } from '../core/difficulty';
import { calcRowFormation, calcVFormation } from '../core/formation';
import { canPlaceMine, placeMine, replenishMine, createMineState, type MineState } from '../core/mine';

// --- 型定義 ---
type Bullet = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gfx: Phaser.GameObjects.Arc;
};

type Enemy = {
    x: number;
    y: number;
    vy: number;
    vx: number;
    fireTimer: number;
    bulletType: BulletType;
    gfx: Phaser.GameObjects.Arc;
};

type Mine = {
    x: number;
    y: number;
    age: number;          // 設置からの経過秒
    gfx: Phaser.GameObjects.Arc;
};

// ジョイスティック状態
type JoystickState = {
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
};

const JOYSTICK_BASE_RADIUS = 56;
const JOYSTICK_THUMB_RADIUS = 22;
const JOYSTICK_DEADZONE = 8;
const BOMB_BTN_RADIUS = 36;

export class Game extends Scene {
    // ゲームオブジェクト
    private playerGfx!: Phaser.GameObjects.Arc;
    private bullets: Bullet[] = [];
    private enemies: Enemy[] = [];
    private mines: Mine[] = [];

    // 状態
    private mineState!: MineState;
    private startTime = 0;
    private gameOver = false;
    private formationTimer = 0;

    // キー入力
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keyW!: Phaser.Input.Keyboard.Key;
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyS!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;
    private keySpace!: Phaser.Input.Keyboard.Key;
    private keyZ!: Phaser.Input.Keyboard.Key;

    // HUD
    private hudText!: Phaser.GameObjects.Text;
    private mineText!: Phaser.GameObjects.Text;

    // 仮想コントローラ
    private isTouchDevice = false;
    private joystickBase!: Phaser.GameObjects.Arc;
    private joystickThumb!: Phaser.GameObjects.Arc;
    private joystickState: JoystickState = { active: false, pointerId: -1, startX: 0, startY: 0, currentX: 0, currentY: 0 };
    private bombBtnGfx!: Phaser.GameObjects.Arc;
    private bombBtnLabel!: Phaser.GameObjects.Text;
    private bombBtnPointerId = -1;

    // プレイヤー座標
    private px = GAME_WIDTH / 2;
    private py = GAME_HEIGHT - 80;

    constructor() {
        super('Game');
    }

    create() {
        this.gameOver = false;
        this.bullets = [];
        this.enemies = [];
        this.mines = [];
        this.mineState = createMineState(MINE_INITIAL_COUNT);
        this.startTime = this.time.now;
        this.formationTimer = 0;
        this.px = GAME_WIDTH / 2;
        this.py = GAME_HEIGHT - 80;

        // 背景
        this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

        // プレイヤー
        this.playerGfx = this.add.circle(this.px, this.py, PLAYER_RADIUS, 0x00e5ff);

        // キー設定
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyA = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyS = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.keyD = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyZ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z);

        // HUD
        this.hudText = this.add.text(10, 10, '', {
            fontFamily: 'monospace', fontSize: 20, color: '#ffffff'
        }).setDepth(10);
        this.mineText = this.add.text(10, 36, '', {
            fontFamily: 'monospace', fontSize: 20, color: '#ffdd00'
        }).setDepth(10);

        // タッチデバイス判定
        this.isTouchDevice = this.sys.game.device.input.touch;
        this.setupVirtualController();

        // タッチ入力
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.input.on('pointercancel', this.onPointerUp, this);
        this.input.on('gameout', this.onInputLost, this);
        this.input.on('gameblur', this.onInputLost, this);
    }

    private setupVirtualController() {
        const jx = 80;
        const jy = GAME_HEIGHT - 90;
        this.joystickBase = this.add.circle(jx, jy, JOYSTICK_BASE_RADIUS, 0x444466, 0.5).setDepth(20);
        this.joystickThumb = this.add.circle(jx, jy, JOYSTICK_THUMB_RADIUS, 0x8888cc, 0.8).setDepth(21);

        const bx = GAME_WIDTH - 80;
        const by = GAME_HEIGHT - 90;
        this.bombBtnGfx = this.add.circle(bx, by, BOMB_BTN_RADIUS, 0xcc4400, 0.7).setDepth(20);
        this.bombBtnLabel = this.add.text(bx, by, 'BOMB', {
            fontFamily: 'monospace', fontSize: 14, color: '#ffffff'
        }).setOrigin(0.5).setDepth(21);

        const visible = this.isTouchDevice;
        this.joystickBase.setVisible(visible);
        this.joystickThumb.setVisible(visible);
        this.bombBtnGfx.setVisible(visible);
        this.bombBtnLabel.setVisible(visible);
    }

    private onPointerDown(pointer: Phaser.Input.Pointer) {
        if (!this.isTouchDevice) return;

        const bx = GAME_WIDTH - 80;
        const by = GAME_HEIGHT - 90;
        const dx = pointer.x - bx;
        const dy = pointer.y - by;
        if (dx * dx + dy * dy < BOMB_BTN_RADIUS * BOMB_BTN_RADIUS) {
            // ボムボタン: このポインタを記録して地雷設置（ジョイスティックとは独立して処理）
            this.bombBtnPointerId = pointer.id;
            this.tryPlaceMine();
            return;
        }

        // ジョイスティック: すでに別の指で動いている場合は新規タッチで上書きしない
        if (!this.joystickState.active) {
            this.joystickState = {
                active: true,
                pointerId: pointer.id,
                startX: pointer.x,
                startY: pointer.y,
                currentX: pointer.x,
                currentY: pointer.y
            };
            this.joystickBase.setPosition(pointer.x, pointer.y);
            this.joystickThumb.setPosition(pointer.x, pointer.y);
        }
    }

    private onPointerMove(pointer: Phaser.Input.Pointer) {
        if (!this.isTouchDevice) return;
        if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
            this.joystickState.currentX = pointer.x;
            this.joystickState.currentY = pointer.y;

            const dx = pointer.x - this.joystickState.startX;
            const dy = pointer.y - this.joystickState.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const clamped = Math.min(dist, JOYSTICK_BASE_RADIUS);
            const thumbX = this.joystickState.startX + (dist > 0 ? (dx / dist) * clamped : 0);
            const thumbY = this.joystickState.startY + (dist > 0 ? (dy / dist) * clamped : 0);
            this.joystickThumb.setPosition(thumbX, thumbY);
        }
    }

    private onPointerUp(pointer: Phaser.Input.Pointer) {
        if (!this.isTouchDevice) return;
        if (pointer.id === this.joystickState.pointerId) {
            this.joystickState.active = false;
            this.joystickState.pointerId = -1;
            const jx = 80;
            const jy = GAME_HEIGHT - 90;
            this.joystickBase.setPosition(jx, jy);
            this.joystickThumb.setPosition(jx, jy);
        }
        if (pointer.id === this.bombBtnPointerId) {
            this.bombBtnPointerId = -1;
        }
    }

    private onInputLost() {
        if (!this.isTouchDevice) return;

        // フォーカス喪失時にポインタIDが残ると、再利用されたIDで入力不能になることがある
        this.bombBtnPointerId = -1;
        this.joystickState.active = false;
        this.joystickState.pointerId = -1;

        const jx = 80;
        const jy = GAME_HEIGHT - 90;
        this.joystickBase.setPosition(jx, jy);
        this.joystickThumb.setPosition(jx, jy);
    }

    private tryPlaceMine() {
        if (!canPlaceMine(this.mineState)) return;

        // 既存の地雷と重なる位置には設置しない
        for (const m of this.mines) {
            if (circlesOverlap(this.px, this.py, MINE_RADIUS, m.x, m.y, MINE_RADIUS)) return;
        }

        const gfx = this.add.circle(this.px, this.py, MINE_RADIUS, 0xffdd00).setDepth(5);
        this.mines.push({ x: this.px, y: this.py, age: 0, gfx });
        this.mineState = placeMine(this.mineState);
    }

    private spawnFormation() {
        const elapsedSec = (this.time.now - this.startTime) / 1000;
        const params = getDifficultyParams(elapsedSec);
        const count = params.formationSize;
        const useV = Math.random() < 0.5;
        const centerX = Phaser.Math.Between(80, GAME_WIDTH - 80);
        const spacing = 52;

        const positions = useV
            ? calcVFormation(count, centerX, -20, spacing)
            : calcRowFormation(count, centerX, -20, spacing);

        const bulletType: BulletType = useV ? 'aimed' : 'straight';

        for (const pos of positions) {
            const gfx = this.add.circle(pos.x, pos.y, ENEMY_RADIUS, 0xff4444).setDepth(4);
            this.enemies.push({
                x: pos.x,
                y: pos.y,
                vx: 0,
                vy: ENEMY_SPEED,
                fireTimer: 0.5 + Math.random() * 0.5,
                bulletType,
                gfx
            });
        }
    }

    private spawnBullet(x: number, y: number, vx: number, vy: number) {
        const gfx = this.add.circle(x, y, BULLET_RADIUS, 0xff8800).setDepth(3);
        this.bullets.push({ x, y, vx, vy, gfx });
    }

    private fireEnemy(enemy: Enemy) {
        const elapsedSec = (this.time.now - this.startTime) / 1000;
        const params = getDifficultyParams(elapsedSec);
        const speed = params.bulletSpeed;
        const bt = enemy.bulletType;

        if (bt === 'straight') {
            this.spawnBullet(enemy.x, enemy.y, 0, speed);
        } else if (bt === 'aimed') {
            const angle = angleTo(enemy.x, enemy.y, this.px, this.py);
            const v = angleToVec(angle);
            this.spawnBullet(enemy.x, enemy.y, v.x * speed, v.y * speed);
        } else if (bt === 'nway3' || bt === 'nway5') {
            const n = bt === 'nway3' ? 3 : 5;
            const base = angleTo(enemy.x, enemy.y, this.px, this.py);
            const angles = calcNWayAngles(base, n, Math.PI / 5);
            for (const a of angles) {
                const v = angleToVec(a);
                this.spawnBullet(enemy.x, enemy.y, v.x * speed, v.y * speed);
            }
        } else if (bt === 'spread8') {
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const v = angleToVec(a);
                this.spawnBullet(enemy.x, enemy.y, v.x * speed, v.y * speed);
            }
        } else if (bt === 'fast') {
            this.spawnBullet(enemy.x, enemy.y, 0, speed * 2);
        }
    }

    private triggerExplosion(mine: Mine, removeMineFromList = true) {
        // 爆発ビジュアル
        const circle = this.add.circle(mine.x, mine.y, MINE_EXPLODE_RADIUS, 0xff8800, 0.5).setDepth(6);
        this.tweens.add({
            targets: circle,
            alpha: 0,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 400,
            onComplete: () => circle.destroy()
        });
        this.cameras.main.shake(250, 0.008);

        // 巻き込み: 敵機
        const enemyPositions = this.enemies.map(e => ({ x: e.x, y: e.y }));
        const hitEnemies = getTargetsInExplosion(mine.x, mine.y, MINE_EXPLODE_RADIUS, enemyPositions);
        for (const idx of hitEnemies.slice().reverse()) {
            this.enemies[idx].gfx.destroy();
            this.enemies.splice(idx, 1);
        }

        // 巻き込み: 弾
        const bulletPositions = this.bullets.map(b => ({ x: b.x, y: b.y }));
        const hitBullets = getTargetsInExplosion(mine.x, mine.y, MINE_EXPLODE_RADIUS, bulletPositions);
        for (const idx of hitBullets.slice().reverse()) {
            this.bullets[idx].gfx.destroy();
            this.bullets.splice(idx, 1);
        }

        mine.gfx.destroy();
        if (removeMineFromList) {
            const idx = this.mines.indexOf(mine);
            if (idx !== -1) this.mines.splice(idx, 1);
        }
        // 爆発後に残弾数を1つ復活
        this.mineState = replenishMine(this.mineState);
    }

    private triggerGameOver() {
        this.gameOver = true;
        const elapsedMs = this.time.now - this.startTime;
        const score = calcScore(elapsedMs, SCORE_MULTIPLIER);
        this.scene.start('GameOver', { score });
    }

    update(_time: number, delta: number) {
        if (this.gameOver) return;

        const dt = delta / 1000;
        const elapsedSec = (this.time.now - this.startTime) / 1000;

        // --- プレイヤー移動 ---
        let vx: number;
        let vy: number;

        if (this.isTouchDevice && this.joystickState.active) {
            const dx = this.joystickState.currentX - this.joystickState.startX;
            const dy = this.joystickState.currentY - this.joystickState.startY;
            const vel = joystickToVelocity(dx, dy, JOYSTICK_DEADZONE, JOYSTICK_BASE_RADIUS, PLAYER_SPEED);
            vx = vel.x;
            vy = vel.y;
        } else {
            const left  = this.cursors.left.isDown  || this.keyA.isDown;
            const right = this.cursors.right.isDown || this.keyD.isDown;
            const up    = this.cursors.up.isDown    || this.keyW.isDown;
            const down  = this.cursors.down.isDown  || this.keyS.isDown;
            const vel = inputToVelocity(left, right, up, down, PLAYER_SPEED);
            vx = vel.x;
            vy = vel.y;
        }

        this.px += vx * dt;
        this.py += vy * dt;
        const clamped = clampPosition(this.px, this.py, PLAYER_RADIUS, GAME_WIDTH, GAME_HEIGHT);
        this.px = clamped.x;
        this.py = clamped.y;
        this.playerGfx.setPosition(this.px, this.py);

        // --- 地雷設置（キーボード）---
        if (Phaser.Input.Keyboard.JustDown(this.keySpace) || Phaser.Input.Keyboard.JustDown(this.keyZ)) {
            this.tryPlaceMine();
        }

        // --- 編隊出現 ---
        this.formationTimer += dt;
        if (this.formationTimer >= FORMATION_INTERVAL_SEC) {
            this.formationTimer = 0;
            this.spawnFormation();
        }

        // --- 敵機更新 ---
        const params = getDifficultyParams(elapsedSec);
        for (const enemy of this.enemies) {
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;
            enemy.gfx.setPosition(enemy.x, enemy.y);

            enemy.fireTimer -= dt;
            if (enemy.fireTimer <= 0) {
                enemy.fireTimer = params.fireIntervalSec + Math.random() * 0.3;
                const types = params.bulletTypes;
                enemy.bulletType = types[Math.floor(Math.random() * types.length)];
                this.fireEnemy(enemy);
            }
        }
        // 画面外の敵機を削除
        this.enemies = this.enemies.filter(e => {
            if (e.y > GAME_HEIGHT + 40) {
                e.gfx.destroy();
                return false;
            }
            return true;
        });

        // --- 弾更新 ---
        for (const b of this.bullets) {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.gfx.setPosition(b.x, b.y);
        }
        this.bullets = this.bullets.filter(b => {
            if (b.x < -20 || b.x > GAME_WIDTH + 20 || b.y < -20 || b.y > GAME_HEIGHT + 20) {
                b.gfx.destroy();
                return false;
            }
            return true;
        });

        // --- 地雷更新 ---
        const minesToExplode: Mine[] = [];
        for (const mine of this.mines) {
            mine.age += dt;

            // タイムアウト爆発
            if (mine.age >= MINE_TIMEOUT_SEC) {
                minesToExplode.push(mine);
                continue;
            }

            // 点滅（残り MINE_BLINK_SEC 秒）
            const remaining = MINE_TIMEOUT_SEC - mine.age;
            if (remaining <= MINE_BLINK_SEC) {
                const freq = 2 + (1 - remaining / MINE_BLINK_SEC) * 8;
                mine.gfx.setVisible(Math.sin(mine.age * freq * Math.PI) > 0);
            }

            // 敵機との判定
            for (const enemy of this.enemies) {
                if (circlesOverlap(mine.x, mine.y, MINE_RADIUS, enemy.x, enemy.y, ENEMY_RADIUS)) {
                    minesToExplode.push(mine);
                    break;
                }
            }

            // 自機との判定（設置直後は無効）
            if (mine.age > MINE_PLACE_GRACE_SEC) {
                if (circlesOverlap(mine.x, mine.y, MINE_RADIUS, this.px, this.py, PLAYER_RADIUS)) {
                    this.triggerExplosion(mine, false);
                    this.triggerGameOver();
                    return;
                }
            }
        }
        // まとめて爆発
        for (const mine of minesToExplode) {
            this.triggerExplosion(mine, false);
        }
        this.mines = this.mines.filter(m => !minesToExplode.includes(m));

        // --- 弾と自機の当たり判定 ---
        for (const b of this.bullets) {
            if (circlesOverlap(b.x, b.y, BULLET_RADIUS, this.px, this.py, PLAYER_RADIUS)) {
                this.triggerGameOver();
                return;
            }
        }

        // --- HUD 更新 ---
        const score = calcScore(this.time.now - this.startTime, SCORE_MULTIPLIER);
        this.hudText.setText(`SCORE: ${score}`);
        this.mineText.setText(`MINE: ${'●'.repeat(this.mineState.count)}${'○'.repeat(this.mineState.maxCount - this.mineState.count)}`);
    }
}
