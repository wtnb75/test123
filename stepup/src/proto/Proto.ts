import { GameObjects, Input, Scene, Types } from 'phaser';
import { P } from './params';
import {
    Bullet,
    Platform,
    Player,
    agePlatforms,
    bulletHitsPlayer,
    bulletSpeed,
    bulletsPerSpawn,
    clampToView,
    isCleared,
    isLeftBehind,
    pickBulletVx,
    pressAction,
    scrollSpeed,
    spawnInterval,
    stepPlayer,
    swipeStep,
} from './logic';

// One entry per finger (pointer) that is down.
// candidate: may still become a tap or a swipe; move: swiping; ignored: does nothing (already acted / retry).
interface Touch {
    sx: number;
    sy: number;
    t: number;
    role: 'candidate' | 'move' | 'ignored';
    anchor: number;
    dir: number;
}

interface Warn {
    x: number;
    vx: number;
    t: number;
}

export class Proto extends Scene {
    private gfx!: GameObjects.Graphics;
    private hud!: GameObjects.Text;
    private msg!: GameObjects.Text;
    private cursors!: Types.Input.Keyboard.CursorKeys;
    private spaceKey!: Input.Keyboard.Key;
    private player!: Player;
    private platforms: Platform[] = [];
    private bullets: Bullet[] = [];
    private warns: Warn[] = [];
    private viewTop = 0;
    private spawnTimer = 0;
    private bestY = 0;
    private dead = false;
    private startY = 0;
    private goalY = 0;
    private touches = new Map<number, Touch>();

    constructor() {
        super('Proto');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1b2540');
        this.gfx = this.add.graphics();
        this.hud = this.add.text(8, 6, '', { fontSize: '22px', color: '#ffffff' }).setScrollFactor(0).setDepth(10);
        this.msg = this.add
            .text(P.width / 2, P.height / 2 - 40, '', { fontSize: '28px', color: '#ffe066', align: 'center' })
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(10);
        this.cursors = this.input.keyboard!.createCursorKeys();
        this.spaceKey = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.SPACE);
        this.input.addPointer(2);
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointermove', this.onMove, this);
        this.input.on('pointerup', this.onUp, this);
        this.input.on('pointerupoutside', this.onUp, this);
        this.reset();
    }

    private reset() {
        this.startY = P.height - P.groundH;
        this.viewTop = this.startY - P.height * P.startScreenRatio;
        this.cameras.main.scrollY = this.viewTop;
        this.goalY = this.startY - P.goalMeters / P.metersPerPx;
        this.player = { x: P.width / 2, y: this.startY, vy: 0, onGround: true, lock: 0 };
        this.platforms = [
            { x: P.width / 2, y: this.startY, w: P.width * 2, age: 0, life: Infinity },
            { x: P.width / 2, y: this.goalY, w: P.width * 2, age: 0, life: Infinity },
        ];
        this.bullets = [];
        this.warns = [];
        this.spawnTimer = 1;
        this.bestY = this.startY;
        this.dead = false;
        this.msg.setText('');
    }

    // Touch: swipe = move, tap = action. A second finger going down while another is
    // already down (and not yet used) acts immediately, so you can jump mid-swipe.
    private onDown(p: Input.Pointer) {
        const t: Touch = { sx: p.x, sy: p.y, t: this.time.now, role: 'candidate', anchor: p.x, dir: 0 };
        if (this.dead) {
            t.role = 'ignored';
            this.onAction(); // retry
        } else if ([...this.touches.values()].some((o) => o.role !== 'ignored')) {
            t.role = 'ignored';
            this.onAction();
        }
        this.touches.set(p.id, t);
    }

    private onMove(p: Input.Pointer) {
        const t = this.touches.get(p.id);
        if (!t) return;
        if (t.role === 'candidate' && Math.hypot(p.x - t.sx, p.y - t.sy) > P.tapMaxMove) {
            t.role = 'move';
            t.anchor = t.sx;
        }
        if (t.role === 'move') {
            const s = swipeStep(t.anchor, p.x);
            t.anchor = s.anchor;
            t.dir = s.dir;
        }
    }

    private onUp(p: Input.Pointer) {
        const t = this.touches.get(p.id);
        this.touches.delete(p.id);
        if (t && t.role === 'candidate' && this.time.now - t.t <= P.tapMaxMs) this.onAction();
    }

    private onAction() {
        if (this.dead) {
            this.reset();
            return;
        }
        pressAction(this.player, this.platforms);
    }

    private readDir(): number {
        let dir = 0;
        if (this.cursors.left.isDown) dir -= 1;
        if (this.cursors.right.isDown) dir += 1;
        for (const t of this.touches.values()) if (t.role === 'move') dir += t.dir;
        return Math.max(-1, Math.min(1, dir));
    }

    update(_t: number, deltaMs: number) {
        const dt = Math.min(deltaMs / 1000, 1 / 30);
        if (Input.Keyboard.JustDown(this.spaceKey) || Input.Keyboard.JustDown(this.cursors.up)) this.onAction();
        if (!this.dead) this.step(dt);
        this.draw();
    }

    private step(dt: number) {
        const meters = Math.max(0, (this.startY - this.bestY) * P.metersPerPx);
        this.viewTop = Math.max(this.goalY - P.goalViewMargin, this.viewTop - scrollSpeed(meters) * dt);
        this.cameras.main.scrollY = this.viewTop;

        agePlatforms(this.platforms, dt);
        stepPlayer(this.player, this.readDir(), dt, this.platforms);
        clampToView(this.player, this.viewTop);
        this.bestY = Math.min(this.bestY, this.player.y);

        // bullets
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnTimer = spawnInterval(meters);
            for (let i = 0; i < bulletsPerSpawn(meters); i++) {
                this.warns.push({
                    x: P.bulletR + Math.random() * (P.width - 2 * P.bulletR),
                    vx: pickBulletVx(meters, Math.random(), Math.random()),
                    t: P.warnTime,
                });
            }
        }
        for (let i = this.warns.length - 1; i >= 0; i--) {
            this.warns[i].t -= dt;
            if (this.warns[i].t <= 0) {
                this.bullets.push({
                    x: this.warns[i].x,
                    y: this.viewTop - P.bulletR,
                    vx: this.warns[i].vx,
                    vy: bulletSpeed(meters),
                });
                this.warns.splice(i, 1);
            }
        }
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const b = this.bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y > this.viewTop + P.height + 20 || b.x < -20 || b.x > P.width + 20) this.bullets.splice(i, 1);
            else if (bulletHitsPlayer(b, this.player)) this.die('HIT!');
        }
        if (isLeftBehind(this.player, this.viewTop + P.height)) this.die('LEFT BEHIND');
        if (!this.dead && isCleared(this.player, this.goalY)) this.clear();
    }

    private clear() {
        this.dead = true;
        this.msg.setText('STAGE 1 CLEAR!\ntap / Space to retry');
    }

    private die(reason: string) {
        if (this.dead) return;
        this.dead = true;
        const meters = Math.round((this.startY - this.bestY) * P.metersPerPx);
        this.msg.setText(`${reason}\n${meters} m\ntap / Space to retry`);
    }

    private draw() {
        const g = this.gfx;
        g.clear();
        for (const p of this.platforms) {
            const alpha = Number.isFinite(p.life) ? 1 - (p.age / p.life) * 0.7 : 1;
            const isGoal = p.y === this.goalY;
            g.fillStyle(isGoal ? 0x66ff99 : Number.isFinite(p.life) ? 0x66d9ef : 0x445577, alpha);
            g.fillRect(p.x - p.w / 2, p.y, p.w, isGoal ? P.goalH : P.platH);
        }
        g.fillStyle(0xffe066, 1);
        g.fillRect(this.player.x - P.playerW / 2, this.player.y - P.playerH, P.playerW, P.playerH);
        g.fillStyle(0xff5566, 1);
        for (const b of this.bullets) g.fillCircle(b.x, b.y, P.bulletR);
        g.fillStyle(0xff5566, 0.6);
        for (const w of this.warns) {
            // triangle pointing the way the bullet will fly (down = vertical, tilted = diagonal)
            const a = Math.atan2(w.vx, P.bulletSpeedBase); // 0 = straight down
            const cx = w.x;
            const cy = this.viewTop + 16;
            const pt = (fx: number, fy: number) => {
                // (fx: sideways, fy: forward) in the bullet's frame -> screen
                const sx = cx + fx * Math.cos(a) + fy * Math.sin(a);
                const sy = cy - fx * Math.sin(a) + fy * Math.cos(a);
                return [sx, sy] as const;
            };
            const [x1, y1] = pt(-9, -9);
            const [x2, y2] = pt(9, -9);
            const [x3, y3] = pt(0, 11);
            g.fillTriangle(x1, y1, x2, y2, x3, y3);
        }

        const meters = Math.max(0, Math.round((this.startY - this.bestY) * P.metersPerPx));
        this.hud.setText(`${meters} / ${P.goalMeters} m`);
    }
}
