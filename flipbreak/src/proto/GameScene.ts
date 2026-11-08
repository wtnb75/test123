// Throwaway prototype scene: one Scene holds start, play, clear and game over.
import { GameObjects, Input, Scene } from 'phaser';
import {
    WALLS,
    blockRect,
    flipperTip,
    isReady,
    launchSpeed,
    makeBall,
    makeWorld,
    stageCleared,
    stepWorld,
    type World,
} from './logic';
import { P } from './params';
import { STAGES } from './stages';

type Phase = 'play' | 'clear' | 'over';

const ROW_COLORS = [0xff5d5d, 0xffa24d, 0xffe14d, 0x7be26b, 0x4dc6ff, 0xa78bff];

export class GameScene extends Scene {
    private world!: World;
    private stage = 0;
    private lives: number = P.LIVES;
    private score = 0;
    private phase: Phase = 'play';
    private phaseTimer = 0;
    private charge = 0;
    private charging = false;
    private acc = 0;
    private g!: GameObjects.Graphics;
    private hud!: GameObjects.Text;
    private msg!: GameObjects.Text;
    private hint!: GameObjects.Text;
    private keys!: Record<string, Input.Keyboard.Key>;

    constructor() {
        super('Game');
    }

    create() {
        this.stage = 0;
        this.lives = P.LIVES;
        this.score = 0;
        this.phase = 'play';
        this.charge = 0;
        this.charging = false;
        this.acc = 0;
        this.world = makeWorld(0);

        this.cameras.main.setBackgroundColor('#10162b');
        this.input.addPointer(2);
        const kb = this.input.keyboard!;
        const K = Input.Keyboard.KeyCodes;
        this.keys = kb.addKeys({
            left: K.LEFT,
            z: K.Z,
            right: K.RIGHT,
            slash: K.FORWARD_SLASH,
            down: K.DOWN,
            space: K.SPACE,
            enter: K.ENTER,
            r: K.R,
        }) as Record<string, Input.Keyboard.Key>;

        this.g = this.add.graphics();
        const base = { fontFamily: 'sans-serif', color: '#ffffff' };
        this.hud = this.add.text(6, 4, '', { ...base, fontSize: '14px' }).setDepth(10);
        this.msg = this.add
            .text(P.FIELD_W / 2, 330, '', { ...base, fontSize: '24px', align: 'center', stroke: '#000', strokeThickness: 5 })
            .setOrigin(0.5)
            .setDepth(10);
        this.hint = this.add
            .text(P.FIELD_W / 2, 610, '', { ...base, fontSize: '12px', align: 'center', color: '#aab' })
            .setOrigin(0.5)
            .setDepth(10);
    }

    update(_time: number, delta: number) {
        if (this.phase === 'over') {
            if (this.anyPress()) this.scene.restart();
            this.draw();
            return;
        }
        if (this.phase === 'clear') {
            this.phaseTimer -= delta / 1000;
            if (this.phaseTimer <= 0) this.nextStage();
            this.draw();
            return;
        }

        const { left, right, hold, touchHold } = this.readInput();
        const ready = isReady(this.world.ball);
        const dtFrame = Math.min(delta, 50) / 1000;

        // Plunger: charge while held, launch on release.
        const charging = ready && (hold || touchHold);
        if (charging) this.charge = Math.min(1, this.charge + dtFrame / P.CHARGE_TIME);
        if (this.charging && !charging && ready) {
            this.world.ball.vy = -launchSpeed(this.charge);
            this.world.ball.vx = 0;
        }
        if (!charging) this.charge = 0;
        this.charging = charging;
        if (Input.Keyboard.JustDown(this.keys.r)) this.world.ball = makeBall();

        this.acc += dtFrame;
        while (this.acc >= P.PHYSICS_DT) {
            this.acc -= P.PHYSICS_DT;
            const ev = stepWorld(this.world, [left, right && !touchHold], P.PHYSICS_DT);
            this.score += ev.blocks.length * P.SCORE_BLOCK + ev.bumpers.length * P.BUMPER_SCORE;
            if (ev.drained) {
                this.onDrain();
                break;
            }
            if (stageCleared(this.world)) {
                this.phase = 'clear';
                this.phaseTimer = P.CLEAR_PAUSE;
                break;
            }
        }
        this.draw();
    }

    private anyPress(): boolean {
        const k = this.keys;
        const ptr = this.input.manager.pointers.some((p) => p.isDown);
        return ptr || Input.Keyboard.JustDown(k.space) || Input.Keyboard.JustDown(k.enter);
    }

    private readInput() {
        const k = this.keys;
        let left = k.left.isDown || k.z.isDown;
        let right = k.right.isDown || k.slash.isDown;
        const hold = k.down.isDown || k.space.isDown;
        const ready = isReady(this.world.ball);
        let touchHold = false;
        for (const p of this.input.manager.pointers) {
            if (!p.isDown) continue;
            if (ready) touchHold = true;
            else if (p.x < P.W / 2) left = true;
            else right = true;
        }
        return { left, right, hold, touchHold };
    }

    private onDrain() {
        this.lives -= 1;
        this.charge = 0;
        this.charging = false;
        this.acc = 0;
        if (this.lives <= 0) {
            this.phase = 'over';
            return;
        }
        this.world.ball = makeBall();
    }

    private nextStage() {
        this.stage += 1;
        this.acc = 0;
        if (this.stage >= STAGES.length) {
            this.phase = 'over';
            return;
        }
        this.world = makeWorld(this.stage);
        this.phase = 'play';
    }

    private draw() {
        const g = this.g;
        const w = this.world;
        g.clear();

        // Table
        g.lineStyle(2, 0x5566aa, 1);
        for (const [ax, ay, bx, by] of WALLS) g.lineBetween(ax, ay, bx, by);

        // Blocks
        for (const b of w.blocks) {
            if (!b.alive) continue;
            const r = blockRect(b);
            g.fillStyle(ROW_COLORS[b.row % ROW_COLORS.length], 1);
            g.fillRect(r.x, r.y, r.w, r.h);
        }
        // Bumpers
        for (const bu of w.bumpers) {
            g.fillStyle(0xff4da6, 1);
            g.fillCircle(bu.x, bu.y, P.BUMPER_R);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(bu.x, bu.y, P.BUMPER_R * 0.45);
        }
        // Flippers
        g.lineStyle(P.FLIPPER_R * 2, 0xffd84d, 1);
        for (const f of w.flippers) {
            const [tx, ty] = flipperTip(f);
            g.lineBetween(f.px, f.py, tx, ty);
            g.fillStyle(0xffd84d, 1);
            g.fillCircle(f.px, f.py, P.FLIPPER_R);
            g.fillCircle(tx, ty, P.FLIPPER_R);
        }
        // Plunger charge bar (in the lane)
        if (this.charge > 0) {
            g.fillStyle(0x4dffb0, 1);
            const h = 120 * this.charge;
            g.fillRect(P.LANE_X + 3, P.LANE_FLOOR_Y - h, 4, h);
        }
        // Ball
        g.fillStyle(0xffffff, 1);
        g.fillCircle(w.ball.x, w.ball.y, P.BALL_R);

        this.hud.setText(`SCORE ${this.score}   BALLS ${this.lives}   STAGE ${Math.min(this.stage + 1, STAGES.length)}`);
        this.hint.setText(isReady(w.ball) && this.phase === 'play' ? 'hold SPACE / touch to charge, release to launch' : '');
        if (this.phase === 'clear') this.msg.setText(`STAGE ${this.stage + 1} CLEAR`);
        else if (this.phase === 'over') {
            const cleared = this.stage >= STAGES.length;
            this.msg.setText(`${cleared ? 'ALL CLEAR' : 'GAME OVER'}\nSCORE ${this.score}\ntap / SPACE to retry`);
        } else this.msg.setText('');
    }
}
