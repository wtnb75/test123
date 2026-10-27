import * as Phaser from 'phaser';
const { Scene } = Phaser;
import {
    GAME_WIDTH, GAME_HEIGHT,
    PLAYER_RADIUS, PLAYER_SPEED,
    BULLET_RADIUS, ENEMY_RADIUS,
    MINE_RADIUS, MINE_EXPLODE_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER,
    MINE_TIMEOUT_SEC, MINE_BLINK_SEC, MINE_PLACE_GRACE_SEC,
    MINE_INITIAL_COUNT, SCORE_MULTIPLIER,
    MINE_RIPPLE_START_RADIUS, MINE_RIPPLE_ALPHA,
    ENEMY_SPEED,
    ITEM_RADIUS, BARRIER_RING_MARGIN,
    BG_STAR_COUNT, BG_STAR_SPEED_MIN, BG_STAR_SPEED_MAX, BG_SCANLINE_GAP, BG_SCANLINE_ALPHA
} from '../core/constants';
import { advanceStar, backdropColorOf, ENEMY_SHAPE, PLAYER_SHAPE } from '../core/look';
import { bulletRotation, countdownRingRadius, isInBlastWarning, rippleState } from '../core/visuals';
import { bulletTextureKey } from './bulletTextures';
import {
    circlesOverlap, getTargetsInExplosion,
    clampPosition, inputToVelocity, joystickToVelocity,
    angleToVec, angleTo, calcNWayAngles, calcScore, calcChainExplosionRadius
} from '../core/physics';
import { getDifficultyParams, type BulletType, type DifficultyParams } from '../core/difficulty';
import { advanceFormationTimer, calcRowFormation, calcVFormation, pickFormationType } from '../core/formation';
import { canPlaceMine, placeMine, replenishMine, createMineState, type MineState } from '../core/mine';
import {
    addMine, advanceBarrier, advanceItemY, createBarrierState, graceAlpha, isItemGone, itemSpawnX,
    itemTouchesPlayer, mineDots, pickUpBarrier, resolveFailure, rollItemDrop,
    type BarrierState, type ItemKind
} from '../core/powerup';
import {
    advanceStopper, isRushGone, isStopperGone, rushTouchesPlayer, rushVelocity,
    soloKindOf, soloSpawnDue, soloSpawnX, type SoloKind, type StopPhase
} from '../core/soloEnemy';

// --- 型定義 ---
type Bullet = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    gfx: Phaser.GameObjects.Image;
};

type Enemy = {
    kind: 'formation' | SoloKind;
    x: number;
    y: number;
    vy: number;
    vx: number;
    phase: StopPhase;     // 停止して撃つ敵のみ使う（それ以外は 'descend' のまま）
    holdLeft: number;     // 停止の残り秒（停止中のみ）
    fireTimer: number;
    bulletType: BulletType;
    gfx: Phaser.GameObjects.Graphics;
};

type Mine = {
    x: number;
    y: number;
    age: number;          // 設置からの経過秒
    gfx: Phaser.GameObjects.Arc;
    ripple: Phaser.GameObjects.Arc | null;     // placement ripple
    countdown: Phaser.GameObjects.Arc | null;  // shrinking countdown ring
    warning: Phaser.GameObjects.Arc | null;    // blast warning ring
};

type Item = {
    kind: ItemKind;
    x: number;
    y: number;
    gfx: Phaser.GameObjects.Graphics;
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
const MINE_RING_DEPTH = 4.5;
const ITEM_DEPTH = 3.5;
const BARRIER_RING_DEPTH = 0.5;
const BARRIER_COLOR = 0x00e5ff;

// Fills a convex polygon given as offsets from the origin (a fan of triangles from the first vertex).
function drawPolygon(g: Phaser.GameObjects.Graphics, shape: ReadonlyArray<readonly [number, number]>, color: number): void {
    g.fillStyle(color, 1);
    for (let i = 1; i < shape.length - 1; i += 1) {
        g.fillTriangle(shape[0][0], shape[0][1], shape[i][0], shape[i][1], shape[i + 1][0], shape[i + 1][1]);
    }
}

export class Game extends Scene {
    // ゲームオブジェクト
    private playerGfx!: Phaser.GameObjects.Graphics;
    private backdrop!: Phaser.GameObjects.Rectangle;
    private backdropColor = -1;
    private stars: { gfx: Phaser.GameObjects.Arc; speed: number }[] = [];
    private bullets: Bullet[] = [];
    private enemies: Enemy[] = [];
    private mines: Mine[] = [];
    private items: Item[] = [];

    // 状態
    private mineState!: MineState;
    private barrier: BarrierState = createBarrierState();
    private startTime = 0;
    private gameOver = false;
    private formationTimer = Infinity;
    private soloSpawnedCount = 0;

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
    private barrierText!: Phaser.GameObjects.Text;
    private barrierRing!: Phaser.GameObjects.Arc;

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
        this.items = [];
        this.barrier = createBarrierState();
        this.mineState = createMineState(MINE_INITIAL_COUNT);
        // time.now is stale until the first update after a scene restart, so the clock starts there
        this.startTime = -1;
        // start past any interval so the first formation spawns on the first update
        this.formationTimer = Infinity;
        this.soloSpawnedCount = 0;
        this.px = GAME_WIDTH / 2;
        this.py = GAME_HEIGHT - 80;

        // 背景（下地・走査線・流れる星。すべて他の描画より下）
        this.backdropColor = -1;
        this.backdrop = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a).setDepth(-10);
        const scanlines = this.add.graphics().setDepth(-9);
        scanlines.lineStyle(1, 0xffffff, BG_SCANLINE_ALPHA);
        for (let y = 0; y < GAME_HEIGHT; y += BG_SCANLINE_GAP) {
            scanlines.lineBetween(0, y, GAME_WIDTH, y);
        }
        this.stars = [];
        for (let i = 0; i < BG_STAR_COUNT; i += 1) {
            const x = Math.random() * GAME_WIDTH;
            const y = Math.random() * GAME_HEIGHT;
            const speed = BG_STAR_SPEED_MIN + Math.random() * (BG_STAR_SPEED_MAX - BG_STAR_SPEED_MIN);
            this.stars.push({ gfx: this.add.circle(x, y, 1, 0xffffff, 0.6).setDepth(-9), speed });
        }

        // プレイヤー（頂点が上の三角形。当たり判定は円のまま）
        this.playerGfx = this.add.graphics({ x: this.px, y: this.py });
        drawPolygon(this.playerGfx, PLAYER_SHAPE, 0x00e5ff);

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
        this.barrierText = this.add.text(10, 62, 'BARRIER', {
            fontFamily: 'monospace', fontSize: 20, color: '#00e5ff'
        }).setDepth(10).setVisible(false);
        this.barrierRing = this.add.circle(this.px, this.py, PLAYER_RADIUS + BARRIER_RING_MARGIN)
            .setStrokeStyle(2, BARRIER_COLOR).setDepth(BARRIER_RING_DEPTH).setVisible(false);

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
        const ripple = this.add.circle(this.px, this.py, MINE_RIPPLE_START_RADIUS)
            .setStrokeStyle(2, 0xffdd00, MINE_RIPPLE_ALPHA).setDepth(MINE_RING_DEPTH);
        this.mines.push({ x: this.px, y: this.py, age: 0, gfx, ripple, countdown: null, warning: null });
        this.mineState = placeMine(this.mineState);
    }

    private destroyMineRings(mine: Mine) {
        mine.ripple?.destroy();
        mine.countdown?.destroy();
        mine.warning?.destroy();
        mine.ripple = null;
        mine.countdown = null;
        mine.warning = null;
    }

    private updateMineRings(mine: Mine) {
        const ripple = rippleState(mine.age);
        if (mine.ripple && ripple) {
            mine.ripple.setRadius(ripple.radius);
            mine.ripple.setStrokeStyle(2, 0xffdd00, ripple.alpha);
        } else if (mine.ripple) {
            mine.ripple.destroy();
            mine.ripple = null;
        }

        const countdownRadius = countdownRingRadius(mine.age);
        if (countdownRadius !== null) {
            mine.countdown ??= this.add.circle(mine.x, mine.y, countdownRadius)
                .setStrokeStyle(2, 0xffee99, 0.7).setDepth(MINE_RING_DEPTH);
            mine.countdown.setRadius(countdownRadius);
        }

        const inBlast = isInBlastWarning(mine.x, mine.y, this.px, this.py);
        if (inBlast) {
            mine.warning ??= this.add.circle(mine.x, mine.y, MINE_EXPLODE_RADIUS)
                .setStrokeStyle(3, 0xff3333, 0.85).setDepth(MINE_RING_DEPTH + 0.1);
        }
        mine.warning?.setVisible(inBlast);
    }

    private spawnFormation() {
        const elapsedSec = (this.time.now - this.startTime) / 1000;
        const params = getDifficultyParams(elapsedSec);
        const count = params.formationSize;
        const useV = pickFormationType(params.formationShapes, Math.random()) === 'v';
        const centerX = Phaser.Math.Between(80, GAME_WIDTH - 80);
        const spacing = 52;

        const positions = useV
            ? calcVFormation(count, centerX, -20, spacing)
            : calcRowFormation(count, centerX, -20, spacing);

        const bulletType: BulletType = useV ? 'aimed' : 'straight';

        for (const pos of positions) {
            // 敵機は菱形で描く（当たり判定は ENEMY_RADIUS の円のまま）
            const gfx = this.add.graphics({ x: pos.x, y: pos.y }).setDepth(4);
            drawPolygon(gfx, ENEMY_SHAPE, 0xff4444);
            this.enemies.push({
                kind: 'formation',
                x: pos.x,
                y: pos.y,
                vx: 0,
                vy: ENEMY_SPEED,
                phase: 'descend',
                holdLeft: 0,
                fireTimer: 0.5 + Math.random() * 0.5,
                bulletType,
                gfx
            });
        }
    }

    // 単体の敵（突進する敵・停止して撃つ敵）。上端の外から出す
    private spawnSolo(kind: SoloKind) {
        const x = soloSpawnX(Math.random());
        const y = -ENEMY_RADIUS;
        if (kind === 'rush') {
            const v = rushVelocity(x, y, this.px, this.py);
            // 頂点（ENEMY_SHAPE の上の頂点）を、進む向きに合わせる
            const gfx = this.add.graphics({ x, y }).setDepth(4).setRotation(Math.atan2(v.vy, v.vx) + Math.PI / 2);
            drawPolygon(gfx, ENEMY_SHAPE, 0xff4444);
            this.enemies.push({ kind, x, y, vx: v.vx, vy: v.vy, phase: 'descend', holdLeft: 0, fireTimer: 0, bulletType: 'straight', gfx });
        } else {
            // 停止して撃つ敵: 赤い円に白い点（当たり判定は ENEMY_RADIUS の円）
            const gfx = this.add.graphics({ x, y }).setDepth(4);
            gfx.fillStyle(0xff4444, 1).fillCircle(0, 0, ENEMY_RADIUS);
            gfx.fillStyle(0xffffff, 1).fillCircle(0, 0, 2);
            this.enemies.push({ kind, x, y, vx: 0, vy: 0, phase: 'descend', holdLeft: 0, fireTimer: 0, bulletType: 'straight', gfx });
        }
    }

    private updateEnemyFire(enemy: Enemy, dt: number, params: DifficultyParams) {
        enemy.fireTimer -= dt;
        if (enemy.fireTimer > 0) return;
        enemy.fireTimer = params.fireIntervalSec + Math.random() * 0.3;
        const types = params.bulletTypes;
        enemy.bulletType = types[Math.floor(Math.random() * types.length)];
        this.fireEnemy(enemy);
    }

    private spawnBullet(x: number, y: number, vx: number, vy: number, type: BulletType) {
        const gfx = this.add.image(x, y, bulletTextureKey(type)).setDepth(3).setRotation(bulletRotation(vx, vy));
        this.bullets.push({ x, y, vx, vy, gfx });
    }

    private fireEnemy(enemy: Enemy) {
        const elapsedSec = (this.time.now - this.startTime) / 1000;
        const params = getDifficultyParams(elapsedSec);
        const speed = params.bulletSpeed;
        const bt = enemy.bulletType;

        if (bt === 'straight') {
            this.spawnBullet(enemy.x, enemy.y, 0, speed, bt);
        } else if (bt === 'aimed') {
            const angle = angleTo(enemy.x, enemy.y, this.px, this.py);
            const v = angleToVec(angle);
            this.spawnBullet(enemy.x, enemy.y, v.x * speed, v.y * speed, bt);
        } else if (bt === 'nway3' || bt === 'nway5') {
            const n = bt === 'nway3' ? 3 : 5;
            const base = angleTo(enemy.x, enemy.y, this.px, this.py);
            const angles = calcNWayAngles(base, n, Math.PI / 5);
            for (const a of angles) {
                const v = angleToVec(a);
                this.spawnBullet(enemy.x, enemy.y, v.x * speed, v.y * speed, bt);
            }
        } else if (bt === 'spread8') {
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                const v = angleToVec(a);
                this.spawnBullet(enemy.x, enemy.y, v.x * speed, v.y * speed, bt);
            }
        } else if (bt === 'fast') {
            this.spawnBullet(enemy.x, enemy.y, 0, speed * 2, bt);
        }
    }

    private triggerExplosion(mine: Mine, visited: Set<Mine>, chainCount = 0): boolean {
        if (visited.has(mine)) return false;
        visited.add(mine);

        const radius = calcChainExplosionRadius(MINE_EXPLODE_RADIUS, MINE_CHAIN_RADIUS_MULTIPLIER, chainCount);

        // 地雷を即座にリストから除去
        mine.gfx.destroy();
        this.destroyMineRings(mine);
        const mineIdx = this.mines.indexOf(mine);
        if (mineIdx !== -1) this.mines.splice(mineIdx, 1);
        this.mineState = replenishMine(this.mineState);

        // 連鎖対象の地雷を先に収集（リスト変更前）
        const chainMines: Mine[] = [];
        for (const other of this.mines) {
            if (!visited.has(other)) {
                const dx = mine.x - other.x;
                const dy = mine.y - other.y;
                if (dx * dx + dy * dy <= radius * radius) {
                    chainMines.push(other);
                }
            }
        }

        // 巻き込み: 敵機
        const enemyPositions = this.enemies.map(e => ({ x: e.x, y: e.y }));
        const hitEnemies = getTargetsInExplosion(mine.x, mine.y, radius, enemyPositions);
        // each removed enemy may drop an item, rolled in the enemy list's order (docs/spec/power-ups.md)
        for (const idx of hitEnemies) this.maybeDropItem(enemyPositions[idx].x, enemyPositions[idx].y);
        for (const idx of hitEnemies.slice().reverse()) {
            this.enemies[idx].gfx.destroy();
            this.enemies.splice(idx, 1);
        }

        // 巻き込み: 弾
        const bulletPositions = this.bullets.map(b => ({ x: b.x, y: b.y }));
        const hitBullets = getTargetsInExplosion(mine.x, mine.y, radius, bulletPositions);
        for (const idx of hitBullets.slice().reverse()) {
            this.bullets[idx].gfx.destroy();
            this.bullets.splice(idx, 1);
        }

        // 自機への爆風判定
        const playerHitByBlast = circlesOverlap(mine.x, mine.y, radius, this.px, this.py, PLAYER_RADIUS);

        // 爆発ビジュアル（連鎖回数で色・シェイク強度を変化）
        const EXPLOSION_COLORS = [0xff8800, 0xff4400, 0xff0000, 0x9900ff];
        const color = EXPLOSION_COLORS[Math.min(chainCount, EXPLOSION_COLORS.length - 1)];
        const delayMs = chainCount * 100;
        const shakeIntensity = 0.008 + chainCount * 0.004;
        const shakeDuration = 250 + chainCount * 100;
        this.time.delayedCall(delayMs, () => {
            const circle = this.add.circle(mine.x, mine.y, radius, color, 0.5).setDepth(6);
            this.tweens.add({
                targets: circle,
                alpha: 0,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 400,
                onComplete: () => circle.destroy()
            });
            this.cameras.main.shake(shakeDuration, shakeIntensity);
        });

        // 連鎖爆発（再帰）
        let chainPlayerHit = false;
        for (const cm of chainMines) {
            if (this.triggerExplosion(cm, visited, chainCount + 1)) {
                chainPlayerHit = true;
            }
        }

        return playerHitByBlast || chainPlayerHit;
    }

    /** A game-over cause happened: true when the game ends; false when the barrier (or its grace window) took it. */
    private fail(cause: string): boolean {
        const result = resolveFailure(this.barrier);
        this.barrier = result.state;
        if (result.outcome !== 'gameover') return false;
        this.triggerGameOver(cause);
        return true;
    }

    private maybeDropItem(x: number, y: number) {
        const kind = rollItemDrop(Math.random);
        if (kind === null) return;
        const ix = itemSpawnX(x);
        const gfx = this.add.graphics({ x: ix, y }).setDepth(ITEM_DEPTH);
        if (kind === 'mine') {
            gfx.fillStyle(0xffdd00, 1);
            gfx.fillCircle(0, 0, ITEM_RADIUS);
            gfx.lineStyle(2, 0x000000, 1);
            const arm = ITEM_RADIUS * 0.6;
            gfx.lineBetween(-arm, 0, arm, 0);
            gfx.lineBetween(0, -arm, 0, arm);
        } else {
            gfx.lineStyle(3, BARRIER_COLOR, 1);
            gfx.strokeCircle(0, 0, ITEM_RADIUS);
        }
        this.items.push({ kind, x: ix, y, gfx });
    }

    /** Items fall, leave below the screen, and are picked up by touching the player (oldest first). */
    private updateItems(dt: number) {
        for (const item of this.items) {
            item.y = advanceItemY(item.y, dt);
            item.gfx.setPosition(item.x, item.y);
        }
        this.items = this.items.filter((item) => {
            if (isItemGone(item.y)) {
                item.gfx.destroy();
                return false;
            }
            if (!itemTouchesPlayer(item.x, item.y, this.px, this.py)) return true;
            if (item.kind === 'mine') this.mineState = addMine(this.mineState);
            else this.barrier = pickUpBarrier(this.barrier);
            item.gfx.destroy();
            return false;
        });
    }

    private triggerGameOver(cause = '') {
        this.gameOver = true;
        const elapsedMs = this.time.now - this.startTime;
        const score = calcScore(elapsedMs, SCORE_MULTIPLIER);

        // プレイヤーを非表示
        this.playerGfx.setVisible(false);

        // 白フラッシュ（中心から拡散）
        const burst = this.add.circle(this.px, this.py, PLAYER_RADIUS, 0xffffff, 1).setDepth(15);
        this.tweens.add({
            targets: burst,
            scaleX: 6,
            scaleY: 6,
            alpha: 0,
            duration: 600,
            ease: 'Power2',
            onComplete: () => burst.destroy()
        });

        // シアンリング
        const ring = this.add.circle(this.px, this.py, PLAYER_RADIUS * 2, 0x00e5ff, 0.7).setDepth(14);
        this.tweens.add({
            targets: ring,
            scaleX: 5,
            scaleY: 5,
            alpha: 0,
            duration: 500,
            ease: 'Power1',
            onComplete: () => ring.destroy()
        });

        this.cameras.main.shake(300, 0.015);

        // 死因テキスト
        if (cause) {
            const causeText = this.add.text(this.px, this.py - 30, cause, {
                fontFamily: 'monospace', fontSize: 24, color: '#ff4444',
                stroke: '#000000', strokeThickness: 4
            }).setOrigin(0.5).setDepth(16);
            this.tweens.add({
                targets: causeText,
                y: this.py - 90,
                alpha: 0,
                duration: 700,
                ease: 'Power1',
                onComplete: () => causeText.destroy()
            });
        }

        // 800ms 後にゲームオーバー画面へ
        this.time.delayedCall(800, () => {
            this.scene.start('GameOver', { score });
        });
    }

    update(_time: number, delta: number) {
        if (this.gameOver) return;

        if (this.startTime < 0) this.startTime = this.time.now;
        const dt = delta / 1000;
        const elapsedSec = (this.time.now - this.startTime) / 1000;
        this.barrier = advanceBarrier(this.barrier, dt);

        // --- 背景（段階が変わったときだけ下地色を変える。星は流す）---
        const stage = backdropColorOf(elapsedSec);
        if (stage !== this.backdropColor) {
            this.backdropColor = stage;
            this.backdrop.setFillStyle(stage);
        }
        for (const star of this.stars) {
            star.gfx.y = advanceStar(star.gfx.y, star.speed, dt, GAME_HEIGHT);
        }

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

        // --- アイテム（落下 → 画面外で消える → 取る）。このフレームの爆発で出たものは次のフレームから ---
        this.updateItems(dt);

        // --- 編隊出現 ---
        const params = getDifficultyParams(elapsedSec);
        const formation = advanceFormationTimer(this.formationTimer, dt, params.formationIntervalSec);
        this.formationTimer = formation.timer;
        if (formation.spawn) this.spawnFormation();

        // --- 単体の敵（突進・停止）---
        if (soloSpawnDue(elapsedSec, this.soloSpawnedCount)) {
            this.spawnSolo(soloKindOf(this.soloSpawnedCount));
            this.soloSpawnedCount += 1;
        }

        // --- 敵機更新 ---
        for (const enemy of this.enemies) {
            if (enemy.kind === 'stop') {
                // 停止の開始から 0〜0.3 秒後に最初の弾。停止中だけ撃つ
                if (advanceStopper(enemy, dt)) enemy.fireTimer = Math.random() * 0.3;
                if (enemy.phase === 'hold') this.updateEnemyFire(enemy, dt, params);
            } else {
                enemy.x += enemy.vx * dt;
                enemy.y += enemy.vy * dt;
                if (enemy.kind === 'formation') this.updateEnemyFire(enemy, dt, params);
            }
            enemy.gfx.setPosition(enemy.x, enemy.y);

            // 突進する敵が自機に触れるとゲームオーバー
            if (enemy.kind === 'rush' && rushTouchesPlayer(enemy.x, enemy.y, this.px, this.py)) {
                if (this.fail('突進 !')) return;
            }
        }
        // 画面外の敵機を削除
        this.enemies = this.enemies.filter(e => {
            const gone = e.kind === 'rush' ? isRushGone(e.x, e.y)
                : e.kind === 'stop' ? isStopperGone(e)
                : e.y > GAME_HEIGHT + 40;
            if (gone) {
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
        // a copy: a touched mine explodes inside the loop (and chains), and the player may survive it behind a barrier
        for (const mine of [...this.mines]) {
            if (!this.mines.includes(mine)) continue;
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

            this.updateMineRings(mine);

            // 敵機との判定
            for (const enemy of this.enemies) {
                if (circlesOverlap(mine.x, mine.y, MINE_RADIUS, enemy.x, enemy.y, ENEMY_RADIUS)) {
                    minesToExplode.push(mine);
                    break;
                }
            }

            // 自機との判定（設置直後は無効）
            // (touching a mine does nothing while the barrier's grace window runs)
            if (mine.age > MINE_PLACE_GRACE_SEC && this.barrier.graceElapsed === null) {
                if (circlesOverlap(mine.x, mine.y, MINE_RADIUS, this.px, this.py, PLAYER_RADIUS)) {
                    this.triggerExplosion(mine, new Set(), 0);
                    if (this.fail('地雷 !')) return;
                    continue;
                }
            }
        }
        // まとめて爆発（triggerExplosion が内部でリストから除去するため filter 不要）
        const visited = new Set<Mine>();
        let playerHitByBlast = false;
        for (const mine of minesToExplode) {
            // a mine that already went off (a touched one or its chain) must not explode twice
            if (!this.mines.includes(mine)) continue;
            if (!visited.has(mine)) {
                if (this.triggerExplosion(mine, visited, 0)) {
                    playerHitByBlast = true;
                }
            }
        }
        if (playerHitByBlast) {
            if (this.fail('爆風 !')) return;
        }

        // --- 弾と自機の当たり判定 ---
        for (const b of this.bullets) {
            if (circlesOverlap(b.x, b.y, BULLET_RADIUS, this.px, this.py, PLAYER_RADIUS)) {
                if (this.fail('被弾 !')) return;
                break;
            }
        }

        // --- HUD 更新 ---
        const score = calcScore(this.time.now - this.startTime, SCORE_MULTIPLIER);
        this.hudText.setText(`SCORE: ${score}`);
        this.mineText.setText(`MINE: ${mineDots(this.mineState.count)}`);
        this.barrierText.setVisible(this.barrier.owned);
        this.barrierRing.setPosition(this.px, this.py).setVisible(this.barrier.owned);
        this.playerGfx.setAlpha(graceAlpha(this.barrier.graceElapsed));
    }
}
