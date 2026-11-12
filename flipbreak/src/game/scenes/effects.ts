// The Game Scene's effects (docs/spec.md "演出・UI（Game）"). Presentation only: nothing here changes the
// rules, and every display object is made once (pools) and reused, never created per frame.
import { type GameObjects, type Scene } from 'phaser';
import {
    BALL_BLINK_DURATION,
    BALL_R,
    BREAK_FLASH_DURATION,
    BREAK_FLASH_SCALE,
    BUMPER_PULSE_DURATION,
    BUMPER_PULSE_SCALE,
    BUMPER_R,
    DAMAGE_FLASH_ALPHA,
    DAMAGE_FLASH_DURATION,
    FIELD_W,
    H,
    SCORE_BLOCK,
    SCORE_BUMP_DURATION,
    SCORE_POP_DURATION,
    SCORE_POP_FONT_SIZE,
    SCORE_POP_RISE,
    SHAKE_DURATION,
    SHAKE_INTENSITY,
    W,
} from '../params';
import { ghostBall, scoreBumpScale } from '../logic/hud';
import { blockRect, type World } from '../logic/physics';
import { STAGES, type Block, type Bumper } from '../logic/stages';
import { TrailSet, trailAlpha } from '../logic/trail';
import { DEPTH, UI_FONT } from './ui';

/** How many white squares / "+100" texts can play at once (a frame breaks a handful of blocks at most). */
const POOL_SIZE = 16;
/** The "+100" text keeps its centre this far from the sides of the table. */
const POP_MARGIN = 26;
/** The red overlay runs this far past every edge so a camera shake never uncovers one. */
const SHAKE_BLEED = 8;
const BUMPER_COLOR = 0xff4da6;
const MAX_BUMPERS = Math.max(...STAGES.map((s) => s.bumpers.length));

export class GameEffects {
    private readonly flashes: GameObjects.Rectangle[] = [];
    private readonly pops: GameObjects.Text[] = [];
    private readonly bumpers: GameObjects.Container[] = [];
    private readonly overlay: GameObjects.Rectangle;
    private readonly trailGfx: GameObjects.Graphics;
    private readonly trails = new TrailSet();
    private trailDirty = false;
    private nextFlash = 0;
    private nextPop = 0;
    private blinkT = -1;
    private bumpT = -1;

    constructor(private readonly scene: Scene) {
        for (let i = 0; i < POOL_SIZE; i++) {
            this.flashes.push(scene.add.rectangle(0, 0, 1, 1, 0xffffff).setDepth(DEPTH.breakFlash).setVisible(false));
            this.pops.push(
                scene.add
                    .text(0, 0, `+${SCORE_BLOCK}`, {
                        fontFamily: UI_FONT,
                        fontSize: `${SCORE_POP_FONT_SIZE}px`,
                        color: '#ffffff',
                        stroke: '#000000',
                        strokeThickness: 4,
                    })
                    .setOrigin(0.5)
                    .setDepth(DEPTH.pop)
                    .setVisible(false),
            );
        }
        for (let i = 0; i < MAX_BUMPERS; i++) {
            const body = scene.add.circle(0, 0, BUMPER_R, BUMPER_COLOR);
            const dot = scene.add.circle(0, 0, BUMPER_R * 0.45, 0xffffff);
            this.bumpers.push(scene.add.container(0, 0, [body, dot]).setDepth(DEPTH.bumpers).setVisible(false));
        }
        // Invisible until a ball is lost: the object's alpha is animated (its fill stays fully opaque).
        this.overlay = scene.add
            .rectangle(W / 2, H / 2, W + 2 * SHAKE_BLEED, H + 2 * SHAKE_BLEED, 0xff3b3b)
            .setAlpha(0)
            .setDepth(DEPTH.damage);
        this.trailGfx = scene.add.graphics().setDepth(DEPTH.trail);
    }

    /** Put the stage's bumpers in place (hide the unused ones). */
    setBumpers(bumpers: readonly Bumper[]): void {
        this.bumpers.forEach((c, i) => {
            this.scene.tweens.killTweensOf(c);
            c.setScale(1);
            const bu = bumpers[i];
            c.setVisible(bu !== undefined);
            if (bu) c.setPosition(bu.x, bu.y);
        });
    }

    /** A ball was lost: shake, red flash, and start the blink of the lost dot. */
    ballLost(): void {
        // force: a shake already running is restarted, like the overlay and the blink.
        this.scene.cameras.main.shake(SHAKE_DURATION * 1000, SHAKE_INTENSITY, true);
        this.scene.tweens.killTweensOf(this.overlay);
        this.overlay.setAlpha(DAMAGE_FLASH_ALPHA);
        this.scene.tweens.add({ targets: this.overlay, alpha: 0, duration: DAMAGE_FLASH_DURATION * 1000, ease: 'Linear' });
        this.blinkT = 0;
    }

    /** A block broke: a white square where it was, and "+100" rising from it. */
    blockBroken(block: Block): void {
        const r = blockRect(block);
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;
        const flash = this.flashes[this.nextFlash];
        this.nextFlash = (this.nextFlash + 1) % POOL_SIZE;
        this.scene.tweens.killTweensOf(flash);
        flash.setPosition(cx, cy).setSize(r.w, r.h).setScale(1).setAlpha(1).setVisible(true);
        this.scene.tweens.add({
            targets: flash,
            scale: BREAK_FLASH_SCALE,
            alpha: 0,
            duration: BREAK_FLASH_DURATION * 1000,
            ease: 'Linear',
            onComplete: () => flash.setVisible(false),
        });

        const pop = this.pops[this.nextPop];
        this.nextPop = (this.nextPop + 1) % POOL_SIZE;
        this.scene.tweens.killTweensOf(pop);
        pop.setPosition(Math.min(Math.max(cx, POP_MARGIN), FIELD_W - POP_MARGIN), cy)
            .setAlpha(1)
            .setVisible(true);
        this.scene.tweens.add({
            targets: pop,
            y: cy - SCORE_POP_RISE,
            alpha: 0,
            duration: SCORE_POP_DURATION * 1000,
            ease: 'Linear',
            onComplete: () => pop.setVisible(false),
        });
    }

    /** A bumper was hit: it swells and settles back (restarting if it was already pulsing). */
    bumperHit(index: number): void {
        const c = this.bumpers[index];
        this.scene.tweens.killTweensOf(c);
        c.setScale(1);
        this.scene.tweens.add({
            targets: c,
            scale: BUMPER_PULSE_SCALE,
            duration: (BUMPER_PULSE_DURATION / 2) * 1000,
            ease: 'Linear',
            yoyo: true,
        });
    }

    /** The score grew: restart the SCORE enlargement. */
    scoreGained(): void {
        this.bumpT = 0;
    }

    /** Advance the effects that are timed by hand (the HUD ones) by `dt` seconds. */
    tick(dt: number): void {
        if (this.blinkT >= 0) {
            this.blinkT += dt;
            if (this.blinkT >= BALL_BLINK_DURATION) this.blinkT = -1;
        }
        if (this.bumpT >= 0) {
            this.bumpT += dt;
            if (this.bumpT >= SCORE_BUMP_DURATION) this.bumpT = -1;
        }
    }

    /** 1 while the lost ball's dot is shown during its blink, else 0. */
    get ghost(): 0 | 1 {
        return this.blinkT >= 0 ? ghostBall(this.blinkT) : 0;
    }

    /** Scale of the SCORE text. */
    get scoreScale(): number {
        return this.bumpT >= 0 ? scoreBumpScale(this.bumpT) : 1;
    }

    /** Record every ball for its trail (call once per frame while playing). */
    recordTrail(world: World): void {
        this.trails.record(world);
        this.trailDirty = true;
    }

    /** Draw the trail dots, newest first, fading (only when it was recorded since the last draw). */
    drawTrail(): void {
        if (!this.trailDirty) return;
        this.trailDirty = false;
        const g = this.trailGfx;
        g.clear();
        for (const trail of this.trails.buffers) {
            for (let i = 0; i < trail.size; i++) {
                g.fillStyle(0xffffff, trailAlpha(i));
                g.fillCircle(trail.x(i), trail.y(i), BALL_R * 0.8);
            }
        }
    }
}
