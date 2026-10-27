import { Display, type GameObjects, type Scene, type Time, type Tweens } from 'phaser';
import {
    BALL_RADIUS,
    CATCH_FLASH_DURATION,
    CATCH_RING_DURATION,
    CATCH_RING_RADIUS,
    DAMAGE_FLASH_ALPHA,
    DAMAGE_FLASH_DURATION,
    HELP_FONT_SIZE,
    HINT_FADE,
    HUD_FONT_SIZE,
    KILL_FLASH_DURATION,
    KILL_FLASH_SCALE,
    LIFE_BLINK_DURATION,
    LIFE_BLINK_INTERVAL,
    LIVES,
    SCENE_FADE_DURATION,
    SCORE_BUMP_DURATION,
    SCORE_POP_DURATION,
    SCORE_POP_FONT_SIZE,
    SCORE_POP_RISE,
    SCORE_POP_STROKE,
    SCREEN_WIDTH,
    WAVE_TEXT_POP_DURATION,
    WAVE_TEXT_POP_FROM,
} from '../params';
import { blinkCount, lifeText } from '../logic/hud';
import { scoreBumpScale, scorePopFontSize, scorePopText, tierColor } from '../logic/combo';
import type { Catch, Kill } from '../logic/run';
import { addLabel, DEPTH, HUD_MARGIN, SHAKE_BLEED, UI_FONT } from './ui';

/** The paddle's catch flash stays this colour whatever the ball's tier. */
const CATCH_COLOR = 0x4ae0ff;
const cssColor = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
/** How many of each short-lived effect can play at once; the oldest is reused beyond that. */
const POOL_SIZE = 12;

/** A Scene starts by fading in from black; input is not held back. */
export const fadeInScene = (scene: Scene): void => {
    scene.cameras.main.fadeIn(SCENE_FADE_DURATION * 1000);
};

/** Round-robin pool of display objects created once per Scene. */
class Pool<T extends GameObjects.GameObject> {
    private next = 0;

    constructor(
        private readonly scene: Scene,
        private readonly items: T[],
    ) {}

    take(): T {
        const item = this.items[this.next];
        this.next = (this.next + 1) % this.items.length;
        this.scene.tweens.killTweensOf(item);
        return item;
    }
}

/** The Game Scene's effects and the LIFE row (docs/spec.md "演出・UI（Game）"). */
export class GameFx {
    private readonly flashes: Pool<GameObjects.Rectangle>;
    private readonly pops: Pool<GameObjects.Text>;
    private readonly rings: Pool<GameObjects.Arc>;
    private readonly overlay: GameObjects.Rectangle;
    private readonly life: GameObjects.Text;
    private paddleFlash?: Time.TimerEvent;
    private blink?: Time.TimerEvent;
    private blinking = 0;
    private bump?: Tweens.Tween;

    constructor(
        private readonly scene: Scene,
        private readonly paddle: GameObjects.Image,
        hudY: number,
    ) {
        const { height } = scene.scale.gameSize;
        const flash = () =>
            scene.add.rectangle(0, 0, 1, 1, 0xffffff).setDepth(DEPTH.effect).setVisible(false);
        const pop = () =>
            scene.add
                // Dark outline: the pop starts over the white kill flash.
                .text(0, 0, '', {
                    fontFamily: UI_FONT,
                    fontSize: `${SCORE_POP_FONT_SIZE}px`,
                    color: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: SCORE_POP_STROKE,
                })
                .setOrigin(0.5)
                .setDepth(DEPTH.pop)
                .setVisible(false);
        const ring = () =>
            scene.add
                .circle(0, 0, BALL_RADIUS)
                .setStrokeStyle(3, CATCH_COLOR)
                .setDepth(DEPTH.effect)
                .setVisible(false);
        this.flashes = new Pool(scene, Array.from({ length: POOL_SIZE }, flash));
        this.pops = new Pool(scene, Array.from({ length: POOL_SIZE }, pop));
        this.rings = new Pool(scene, Array.from({ length: POOL_SIZE }, ring));
        this.overlay = scene.add
            // Runs SHAKE_BLEED past every edge so a camera shake never shows its border.
            .rectangle(SCREEN_WIDTH / 2, height / 2, SCREEN_WIDTH + 2 * SHAKE_BLEED, height + 2 * SHAKE_BLEED, 0xff2020)
            .setAlpha(0)
            .setDepth(DEPTH.damage);

        // The LIFE row keeps its left end fixed so a blinking heart doesn't shift the others.
        this.life = scene.add
            .text(0, hudY, lifeText(LIVES, 0), { fontFamily: UI_FONT, fontSize: `${HUD_FONT_SIZE}px`, color: '#ffffff' })
            .setOrigin(0, 0.5) // hudY is the HUD row's centre line
            .setDepth(DEPTH.hud);
        this.life.setX(SCREEN_WIDTH - HUD_MARGIN - this.life.width);
    }

    kill(k: Kill): void {
        const sq = this.flashes.take().setPosition(k.x, k.y).setSize(k.w, k.h).setScale(1).setAlpha(1).setVisible(true);
        this.scene.tweens.add({
            targets: sq,
            scale: KILL_FLASH_SCALE,
            alpha: 0,
            duration: KILL_FLASH_DURATION * 1000,
            onComplete: () => sq.setVisible(false),
        });

        // White at tier 1, the tier's colour from tier 2; bigger with the tier.
        const t = this.pops
            .take()
            .setFontSize(scorePopFontSize(k.tier))
            .setColor(k.tier >= 2 ? cssColor(tierColor(k.tier)) : '#ffffff')
            .setText(scorePopText(k.score, k.tier))
            .setAlpha(1)
            .setVisible(true);
        const half = t.width / 2;
        t.setPosition(Math.max(half + 4, Math.min(SCREEN_WIDTH - half - 4, k.x)), k.y);
        this.scene.tweens.add({
            targets: t,
            y: k.y - SCORE_POP_RISE,
            alpha: 0,
            duration: SCORE_POP_DURATION * 1000,
            onComplete: () => t.setVisible(false),
        });
    }

    /** The balls caught this frame: one paddle flash (restarted), one ring per ball. */
    catches(caught: readonly Catch[]): void {
        if (caught.length === 0) return;
        this.paddle.setTint(CATCH_COLOR);
        this.paddleFlash?.remove();
        this.paddleFlash = this.scene.time.delayedCall(CATCH_FLASH_DURATION * 1000, () => this.paddle.clearTint());
        for (const c of caught) this.ring(c);
    }

    /** The HUD SCORE swells to SCORE_BUMP_SCALE and settles back; a tier 2+ kill also tints it with the tier colour. */
    scoreBump(score: GameObjects.Text, tier: number): void {
        this.bump?.stop();
        const tinted = tier >= 2;
        const fromColor = Display.Color.IntegerToColor(tinted ? tierColor(tier) : 0xffffff);
        const white = Display.Color.IntegerToColor(0xffffff);
        score.setColor(cssColor(tinted ? tierColor(tier) : 0xffffff));
        const apply = (elapsed: number) => {
            score.setScale(scoreBumpScale(elapsed));
            if (!tinted) return; // white to white: skip the text redraw
            const c = Display.Color.Interpolate.ColorWithColor(fromColor, white, SCORE_BUMP_DURATION, elapsed);
            score.setColor(Display.Color.RGBToString(c.r, c.g, c.b));
        };
        apply(0);
        this.bump = this.scene.tweens.addCounter({
            from: 0,
            to: SCORE_BUMP_DURATION,
            duration: SCORE_BUMP_DURATION * 1000,
            onUpdate: (tween) => apply(tween.getValue() ?? 0),
            onComplete: () => {
                score.setScale(1).setColor('#ffffff');
                this.bump = undefined;
            },
        });
    }

    private ring(c: Catch): void {
        const ring = this.rings
            .take()
            .setStrokeStyle(3, tierColor(c.tier))
            .setPosition(c.x, c.y)
            .setScale(1)
            .setAlpha(1)
            .setVisible(true);
        this.scene.tweens.add({
            targets: ring,
            scale: CATCH_RING_RADIUS / BALL_RADIUS,
            alpha: 0,
            duration: CATCH_RING_DURATION * 1000,
            onComplete: () => ring.setVisible(false),
        });
    }

    /** `lost` lives were lost this frame, leaving `remaining`. */
    livesLost(lost: number, remaining: number): void {
        this.scene.tweens.killTweensOf(this.overlay);
        this.overlay.setAlpha(DAMAGE_FLASH_ALPHA);
        this.scene.tweens.add({ targets: this.overlay, alpha: 0, duration: DAMAGE_FLASH_DURATION * 1000 });

        this.blinking = blinkCount(this.blink !== undefined, this.blinking, lost);
        this.blink?.remove();
        // The lost hearts start hidden at t = 0, then show, hide, show, and end hidden at LIFE_BLINK_DURATION.
        const ticks = Math.round(LIFE_BLINK_DURATION / LIFE_BLINK_INTERVAL);
        let tick = 0;
        this.life.setText(lifeText(remaining, 0));
        this.blink = this.scene.time.addEvent({
            delay: LIFE_BLINK_INTERVAL * 1000,
            repeat: ticks - 1,
            callback: () => {
                tick += 1;
                const shown = tick % 2 === 1 && tick < ticks;
                this.life.setText(lifeText(remaining, shown ? this.blinking : 0));
                if (tick >= ticks) this.blink = undefined;
            },
        });
    }

    /** WAVE n CLEAR grows in from WAVE_TEXT_POP_FROM. */
    popCenter(text: GameObjects.Text): void {
        this.scene.tweens.killTweensOf(text);
        text.setScale(WAVE_TEXT_POP_FROM);
        this.scene.tweens.add({ targets: text, scale: 1, duration: WAVE_TEXT_POP_DURATION * 1000, ease: 'Back.Out' });
    }

    /** Stops the WAVE n CLEAR pop (ending clears the text mid-pop). */
    stopCenter(text: GameObjects.Text): void {
        this.scene.tweens.killTweensOf(text);
    }

    /** The paddle hint under the paddle; returns a function that fades it out (safe to call again). */
    hint(y: number): () => void {
        const t = addLabel(this.scene, SCREEN_WIDTH / 2, y, '指・マウス・← → でパドルを左右に動かす', HELP_FONT_SIZE, '#a8b3c7')
            .setDepth(DEPTH.hud);
        return () => {
            this.scene.tweens.killTweensOf(t);
            this.scene.tweens.add({ targets: t, alpha: 0, duration: HINT_FADE * 1000, onComplete: () => t.setVisible(false) });
        };
    }
}
