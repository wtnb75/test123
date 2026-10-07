import { Scene, GameObjects, Input, Types } from 'phaser';
import { P } from './params';
import { Kind, Pop, Pt, applyScore, edgeArrow, edgeScrollDir, findHit, holePos, isUp, pickCombo, pickSpawn, scoreFor } from './logic';

interface Live extends Pop {
    dust: GameObjects.Ellipse;
    body: GameObjects.Arc | null;
}

export class ProtoScene extends Scene {
    private holes: Pt[] = [];
    private live: Live[] = [];
    private arrows: GameObjects.Triangle[] = [];
    private score = 0;
    private timeLeftMs = 0;
    private nextSpawnAt = 0;
    private playing = false;
    private hud!: GameObjects.Text;
    private msg!: GameObjects.Text;
    private keys!: Types.Input.Keyboard.CursorKeys;
    private space!: Input.Keyboard.Key;
    private dragFrom: Pt | null = null;
    private mouse: Pt | null = null;

    constructor() {
        super('ProtoScene');
    }

    create() {
        const boardW = P.boardCols * P.holeSpacing;
        const boardH = P.boardRows * P.holeSpacing;
        const cam = this.cameras.main;
        cam.setBounds(0, 0, boardW, boardH);
        this.add.rectangle(boardW / 2, boardH / 2, boardW, boardH, 0x3a8f3f);
        for (let i = 0; i < P.boardCols * P.boardRows; i++) {
            const h = holePos(i, P.boardCols, P.holeSpacing);
            this.holes.push(h);
            this.add.ellipse(h.x, h.y + 20, 150, 60, 0x3e2723);
        }
        this.hud = this.add.text(16, 12, '', { fontSize: '28px', color: '#fff', stroke: '#000', strokeThickness: 4 }).setScrollFactor(0).setDepth(100);
        this.add.circle(P.viewW / 2, P.viewH / 2, 14).setStrokeStyle(3, 0xffffff).setScrollFactor(0).setDepth(100);
        this.msg = this.add.text(P.viewW / 2, P.viewH / 2 - 120, '', { fontSize: '40px', color: '#fff', stroke: '#000', strokeThickness: 6, align: 'center' }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
        for (let i = 0; i < P.maxActive; i++) {
            this.arrows.push(this.add.triangle(0, 0, 0, -16, 40, 0, 0, 16, 0xffeb3b).setScrollFactor(0).setDepth(90).setVisible(false));
        }
        this.keys = this.input.keyboard!.createCursorKeys();
        this.space = this.input.keyboard!.addKey(Input.Keyboard.KeyCodes.SPACE);
        this.input.on('pointerdown', (p: Input.Pointer) => (this.dragFrom = { x: p.x, y: p.y }));
        this.input.on('pointermove', (p: Input.Pointer) => this.onMove(p));
        this.input.on('pointerup', (p: Input.Pointer) => this.onUp(p));
        this.input.on('gameout', () => (this.mouse = null));
        this.space.on('down', () => this.onSpace());
        cam.scrollX = (boardW - P.viewW) / 2;
        cam.scrollY = (boardH - P.viewH) / 2;
        this.showStart();
    }

    private showStart() {
        this.playing = false;
        this.msg.setText("Drag / arrow keys / mouse at screen edge: scroll\nTap / click / Space: whack\nDon't hit the cats!\n\nTap to start");
    }

    private start(time: number) {
        this.live.forEach((l) => this.destroyLive(l));
        this.live = [];
        this.score = 0;
        this.timeLeftMs = P.gameSeconds * 1000;
        this.nextSpawnAt = time + 500;
        this.playing = true;
        this.msg.setText('');
    }

    private onMove(p: Input.Pointer) {
        this.mouse = p.wasTouch ? null : { x: p.x, y: p.y };
        if (!p.isDown || !this.dragFrom || !this.playing) return;
        if (Math.hypot(p.x - this.dragFrom.x, p.y - this.dragFrom.y) < P.dragThresholdPx) return;
        const cam = this.cameras.main;
        cam.scrollX -= p.x - p.prevPosition.x;
        cam.scrollY -= p.y - p.prevPosition.y;
    }

    private onUp(p: Input.Pointer) {
        if (!this.playing) {
            if (this.time.now > 300) this.start(this.time.now);
            return;
        }
        if (p.getDistance() < P.dragThresholdPx) this.strike(p.worldX, p.worldY);
    }

    // Space hits under the mouse cursor if there is one, otherwise at the screen centre.
    private onSpace() {
        const cam = this.cameras.main;
        const at = this.mouse ?? { x: P.viewW / 2, y: P.viewH / 2 };
        this.strike(cam.scrollX + at.x, cam.scrollY + at.y);
    }

    private strike(wx: number, wy: number) {
        if (!this.playing) return;
        const now = this.time.now;
        const ups = this.live.filter((l) => isUp(l, now, P.telegraphMs));
        const hit = findHit({ x: wx, y: wy }, ups, this.holes, P.hitRadius);
        if (!hit) {
            this.fxMiss(wx, wy);
            return;
        }
        const delta = scoreFor(hit.kind, P.scoreMole, P.scoreFriend);
        this.score = applyScore(this.score, delta);
        if (hit.kind === 'mole') this.fxHit(hit, delta);
        else this.fxCat(hit, delta);
        this.live = this.live.filter((x) => x !== hit);
    }

    // Whacked a mole: squash, star burst, "+10".
    private fxHit(l: Live, delta: number) {
        const h = this.holes[l.hole];
        this.cameras.main.shake(70, 0.003);
        this.floatText(h.x, h.y - 90, `+${delta}`, '#ffee58');
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const s = this.add.circle(h.x, h.y - 10, 7, 0xffee58).setDepth(50);
            this.tweens.add({ targets: s, x: h.x + Math.cos(a) * 90, y: h.y - 10 + Math.sin(a) * 90, alpha: 0, duration: 350, onComplete: () => s.destroy() });
        }
        if (l.body) this.tweens.add({ targets: l.body, scaleY: 0.2, scaleX: 1.4, alpha: 0, duration: 160, onComplete: () => this.destroyLive(l) });
        else this.destroyLive(l);
    }

    // Hit a cat: red flash, hard shake, "-20", cat bounces away.
    private fxCat(l: Live, delta: number) {
        const h = this.holes[l.hole];
        this.cameras.main.flash(180, 255, 40, 40);
        this.cameras.main.shake(260, 0.012);
        this.floatText(h.x, h.y - 90, `${delta}`, '#ff5252');
        l.body?.setFillStyle(0xff1744);
        if (l.body) this.tweens.add({ targets: l.body, y: l.body.y - 160, alpha: 0, angle: 180, duration: 400, onComplete: () => this.destroyLive(l) });
        else this.destroyLive(l);
    }

    // Whiffed: dust ring and a small "miss" where the player tapped.
    private fxMiss(wx: number, wy: number) {
        const ring = this.add.circle(wx, wy, 20).setStrokeStyle(4, 0xffffff).setDepth(50);
        this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
        this.floatText(wx, wy - 30, 'miss', '#cfd8dc', 22);
    }

    private floatText(x: number, y: number, text: string, color: string, size = 40) {
        const t = this.add.text(x, y, text, { fontSize: `${size}px`, color, stroke: '#000', strokeThickness: 5 }).setOrigin(0.5).setDepth(60);
        this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 600, onComplete: () => t.destroy() });
    }

    private destroyLive(l: Live) {
        this.tweens.killTweensOf(l.dust);
        l.dust.destroy();
        l.body?.destroy();
    }

    private spawn(hole: number, kind: Kind, time: number) {
        const h = this.holes[hole];
        const dust = this.add.ellipse(h.x, h.y + 10, 120, 50, 0xd7ccc8, 0.8).setDepth(10);
        this.tweens.add({ targets: dust, x: h.x + 6, scaleX: 1.2, duration: 70, yoyo: true, repeat: -1 });
        this.live.push({ hole, kind, startAt: time, expiresAt: time + P.telegraphMs + P.popLifetimeMs, dust, body: null });
    }

    private rise(l: Live) {
        const h = this.holes[l.hole];
        this.tweens.killTweensOf(l.dust);
        l.dust.setVisible(false);
        l.body = this.add.circle(h.x, h.y - 10, 50, l.kind === 'mole' ? 0x8d6e63 : 0xffb74d).setDepth(20).setScale(1, 0.1);
        this.tweens.add({ targets: l.body, scaleY: 1, duration: 150, ease: 'Back.Out' });
    }

    update(time: number, delta: number) {
        const cam = this.cameras.main;
        const v = (P.scrollSpeed * delta) / 1000;
        if (this.keys.left.isDown) cam.scrollX -= v;
        if (this.keys.right.isDown) cam.scrollX += v;
        if (this.keys.up.isDown) cam.scrollY -= v;
        if (this.keys.down.isDown) cam.scrollY += v;
        if (this.mouse && !this.input.activePointer.isDown) {
            const d = edgeScrollDir(this.mouse, P.viewW, P.viewH, P.edgeScrollZonePx);
            cam.scrollX += (d.x * P.edgeScrollSpeed * delta) / 1000;
            cam.scrollY += (d.y * P.edgeScrollSpeed * delta) / 1000;
        }
        if (!this.playing) return;

        this.timeLeftMs -= delta;
        if (this.timeLeftMs <= 0) {
            this.timeLeftMs = 0;
            this.playing = false;
            this.arrows.forEach((a) => a.setVisible(false));
            this.live.forEach((l) => this.destroyLive(l));
            this.live = [];
            this.msg.setText(`Time up!\nScore: ${this.score}\n\nTap to retry`);
            return;
        }
        for (const l of [...this.live]) {
            if (!l.body && isUp(l, time, P.telegraphMs)) this.rise(l);
            if (time >= l.expiresAt) {
                this.destroyLive(l);
                this.live = this.live.filter((x) => x !== l);
            }
        }
        if (time >= this.nextSpawnAt) this.trySpawn(time);
        this.updateArrows();
        this.hud.setText(`Score ${this.score}   Time ${Math.ceil(this.timeLeftMs / 1000)}`);
    }

    private trySpawn(time: number) {
        this.nextSpawnAt = time + P.spawnIntervalMs;
        const room = P.maxActive - this.live.length;
        if (room <= 0) return;
        if (room >= P.comboSize && Math.random() < P.comboRate) {
            const holes = pickCombo(this.holes.length, P.boardCols, this.live, P.comboSize, Math.random);
            holes.forEach((hole) => this.spawn(hole, Math.random() < P.friendRate ? 'friend' : 'mole', time));
            return;
        }
        const s = pickSpawn(this.holes.length, this.live, P.friendRate, Math.random);
        if (s) this.spawn(s.hole, s.kind, time);
    }

    private updateArrows() {
        const cam = this.cameras.main;
        const view = { x: cam.scrollX, y: cam.scrollY, w: P.viewW, h: P.viewH };
        const moles = this.live.filter((l) => l.kind === 'mole');
        this.arrows.forEach((a, i) => {
            const m = moles[i];
            const e = m ? edgeArrow(this.holes[m.hole], view, P.arrowMargin) : null;
            a.setVisible(!!e);
            if (e) a.setPosition(e.x - view.x, e.y - view.y).setRotation(e.angle);
        });
    }
}
