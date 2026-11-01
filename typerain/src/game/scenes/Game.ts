import { type GameObjects, Scale, Scene, type Time, type Types } from 'phaser';
import {
    CLEAR_POP_MS,
    CLEAR_POP_SCALE,
    COMBO_Y,
    FLOOR_GLOW_MS,
    FLOOR_SHAKE_INTENSITY,
    FLOOR_SHAKE_MS,
    FONT_COMBO,
    FONT_HINT,
    FONT_HUD,
    FONT_POP,
    FONT_WORD,
    HEART_LOSE_MS,
    HUD_Y,
    LAND_FLASH_MS,
    LOCK_BAND_ALPHA,
    MISS_SHAKE_INTENSITY,
    MISS_SHAKE_MS,
    RESULT_DELAY,
    SCORE_POP_MS,
    SCORE_POP_RISE,
    SCREEN_WIDTH,
    WORD_H,
} from '../params';
import { clampPopX, heartsLost, lockBandRect, popText } from '../logic/effects';
import { Round, type Word } from '../logic/round';
import { fallDistanceFor, floorYFor, wordYFor } from '../logic/screen';
import { COLOR, DEPTH, MONO_FONT, RotateGuard, SceneExit } from './ui';
import { typingInput } from './typingInput';
import type { ResultData } from './Result';

interface WordView {
    base: GameObjects.Text;
    typed: GameObjects.Text;
    /** Whether `base` is drawn in the locked-on colour (redrawing a Text is costly, so only on change). */
    locked: boolean;
}

const HUD_MARGIN = 8;
const HINT_TEXT = 'タップでキーボードを出す';

export class Game extends Scene {
    private round!: Round;
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private views = new Map<number, WordView>();
    private floorLine!: GameObjects.Rectangle;
    private lockBand!: GameObjects.Rectangle;
    private scoreText!: GameObjects.Text;
    private livesText!: GameObjects.Text;
    private comboText!: GameObjects.Text;
    private hint!: GameObjects.Text;
    private endTimer = 0;
    private offFocus: (() => void) | null = null;
    /** Timed effects playing right now (clear / pop-up / landed flash / floor glow / lost heart). */
    private effects = 0;
    private glowTimer: Time.TimerEvent | null = null;
    private heart = { w: 0, h: 0 };
    /** Left edge of the lock-on band relative to its word (set when the lock-on starts). */
    private bandDx = 0;

    constructor() {
        super('Game');
    }

    create() {
        this.round = new Round(Math.random);
        this.views.clear();
        this.endTimer = 0;
        this.effects = 0;
        this.glowTimer = null;
        const { width } = this.scale.gameSize;
        this.floorLine = this.add.rectangle(width / 2, 0, width, 3, COLOR.floor).setDepth(DEPTH.base);
        this.lockBand = this.add
            .rectangle(0, 0, 10, WORD_H, COLOR.lockBand, LOCK_BAND_ALPHA)
            .setOrigin(0)
            .setDepth(DEPTH.band)
            .setVisible(false);
        this.hint = this.add
            .text(width / 2, 0, HINT_TEXT, { fontFamily: 'sans-serif', fontSize: `${FONT_HINT}px`, color: COLOR.sub })
            .setOrigin(0.5)
            .setDepth(DEPTH.base);
        const hud = { fontFamily: MONO_FONT, fontSize: `${FONT_HUD}px`, color: COLOR.text };
        this.scoreText = this.add.text(HUD_MARGIN, HUD_Y, '', hud).setDepth(DEPTH.hud);
        this.livesText = this.add.text(SCREEN_WIDTH - HUD_MARGIN, HUD_Y, '', hud).setOrigin(1, 0).setDepth(DEPTH.hud);
        this.comboText = this.add
            .text(HUD_MARGIN, COMBO_Y, '', { ...hud, fontSize: `${FONT_COMBO}px`, color: COLOR.accent })
            .setOrigin(0, 0.5)
            .setDepth(DEPTH.hud);
        // One heart's size, to place the heart that shrinks away when a life is lost.
        const probe = this.add.text(0, 0, '♥', hud);
        this.heart = { w: probe.width, h: probe.height };
        probe.destroy();
        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);

        const typing = typingInput();
        typing.setHandler((ch) => this.onChar(ch));
        this.offFocus = typing.onFocusChange(() => this.refreshHint());
        // A tap brings the keyboard back if it was closed.
        // On release, not press: iOS only opens the keyboard from the end of a tap.
        this.input.on('pointerup', this.onTap, this);
        this.scale.on(Scale.Events.RESIZE, this.layout, this);
        this.events.once('shutdown', () => {
            typing.setHandler(null);
            this.offFocus?.();
            this.input.off('pointerup', this.onTap, this);
            this.scale.off(Scale.Events.RESIZE, this.layout, this);
        });
        this.layout();
        this.refreshHud();

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Game' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                guard: { get: () => this.guard.active },
                phase: { get: () => this.round.phase },
                score: { get: () => this.round.score },
                lives: { get: () => this.round.lives },
                combo: { get: () => this.round.combo },
                words: { get: () => this.round.words.map((w) => ({ text: w.text, typed: w.typed, p: w.p })) },
                effects: { get: () => this.effects },
                lockBand: { get: () => this.lockBand.visible },
                type: { value: (text: string) => [...text].forEach((c) => this.onChar(c)) },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }

    update(_time: number, delta: number) {
        if (this.guard.active) return; // the rotate notice holds the clock
        const dt = delta / 1000;
        if (this.round.ended) {
            this.endTimer += dt;
            if (this.endTimer >= RESULT_DELAY) this.finish();
            return;
        }
        const fallDistance = fallDistanceFor(this.scale.gameSize.height);
        const livesBefore = this.round.lives;
        const step = this.round.step(dt, fallDistance);
        if (step.spawned) this.addView(step.spawned);
        if (step.floorHits > 0) this.onLanded(step.landed, heartsLost(livesBefore, this.round.lives), fallDistance);
        if (this.round.ended) typingInput().blur();
        this.placeViews();
    }

    private onChar(ch: string) {
        if (this.guard.active) return;
        const outcome = this.round.typeChar(ch);
        if (outcome.kind === 'miss') this.cameras.main.shake(MISS_SHAKE_MS, MISS_SHAKE_INTENSITY);
        if (outcome.kind === 'clear') this.popCleared(outcome.word, outcome.points);
        if (outcome.kind !== 'ignored') {
            this.refreshHud();
            this.placeViews();
        }
    }

    private onTap() {
        if (!this.guard.active && this.round.phase === 'playing') typingInput().focus();
    }

    private finish() {
        const data: ResultData = { score: this.round.score, cleared: this.round.cleared };
        this.exit.to('Result', data);
    }

    private addView(word: Word) {
        const style = { fontFamily: MONO_FONT, fontSize: `${FONT_WORD}px` };
        this.views.set(word.id, {
            base: this.add.text(word.x, 0, word.text, { ...style, color: COLOR.word }).setDepth(DEPTH.word),
            typed: this.add.text(word.x, 0, '', { ...style, color: COLOR.typed }).setDepth(DEPTH.typed),
            locked: false,
        });
    }

    /** Takes a word's views out of the play (it is no longer in the Round); the caller animates the base text. */
    private takeView(id: number): GameObjects.Text | null {
        const view = this.views.get(id);
        if (!view) return null;
        this.views.delete(id);
        view.typed.destroy();
        return view.base;
    }

    /** Runs a tween as a counted effect; `done` runs when it ends. */
    private play(config: Types.Tweens.TweenBuilderConfig, done: () => void) {
        this.effects += 1;
        this.tweens.add({
            ...config,
            onComplete: () => {
                this.effects -= 1;
                done();
            },
        });
    }

    /** A typed-out word grows and fades in yellow; its score rises from where it was. */
    private popCleared(word: Word, points: number) {
        const base = this.takeView(word.id);
        if (!base) return;
        const centerX = base.x + base.width / 2;
        const top = base.y;
        base.setColor(COLOR.typed)
            .setOrigin(0.5)
            .setPosition(centerX, top + base.height / 2)
            .setDepth(DEPTH.fx);
        this.play({ targets: base, scale: CLEAR_POP_SCALE, alpha: 0, duration: CLEAR_POP_MS }, () => base.destroy());
        const pop = this.add
            .text(0, top, popText(points), { fontFamily: MONO_FONT, fontSize: `${FONT_POP}px`, color: COLOR.typed })
            .setOrigin(0.5, 0)
            .setDepth(DEPTH.pop);
        pop.setX(clampPopX(centerX, pop.width));
        this.play({ targets: pop, y: top - SCORE_POP_RISE, alpha: 0, duration: SCORE_POP_MS }, () => pop.destroy());
    }

    /** Words reached the floor: each flashes red where it landed, the floor glows, lost hearts shrink away. */
    private onLanded(landed: readonly Word[], lostHearts: number, fallDistance: number) {
        this.cameras.main.shake(FLOOR_SHAKE_MS, FLOOR_SHAKE_INTENSITY);
        for (const w of landed) {
            const base = this.takeView(w.id);
            if (!base) continue;
            base.setColor(COLOR.warn).setPosition(w.x, wordYFor(1, fallDistance)).setDepth(DEPTH.fx);
            this.play({ targets: base, alpha: 0, duration: LAND_FLASH_MS }, () => base.destroy());
        }
        this.glowFloor();
        this.loseHearts(lostHearts);
        this.refreshHud();
    }

    /** The floor line turns white and fades back to red; a new landing restarts the count. */
    private glowFloor() {
        if (this.glowTimer) this.glowTimer.remove(false);
        else this.effects += 1;
        this.floorLine.setFillStyle(COLOR.floorGlow);
        this.glowTimer = this.time.delayedCall(FLOOR_GLOW_MS, () => {
            this.floorLine.setFillStyle(COLOR.floor);
            this.glowTimer = null;
            this.effects -= 1;
        });
    }

    /** Hearts just lost shrink away to the left of the remaining ones (from the right edge when none remain). */
    private loseHearts(count: number) {
        const remaining = this.round.lives;
        const style = { fontFamily: MONO_FONT, fontSize: `${FONT_HUD}px`, color: COLOR.text };
        for (let i = 0; i < count; i++) {
            const x = SCREEN_WIDTH - HUD_MARGIN - remaining * this.heart.w - (i + 0.5) * this.heart.w;
            const lost = this.add
                .text(x, HUD_Y + this.heart.h / 2, '♥', style)
                .setOrigin(0.5)
                .setDepth(DEPTH.hud);
            this.play({ targets: lost, scale: 0, duration: HEART_LOSE_MS }, () => lost.destroy());
        }
    }

    private placeViews() {
        const fallDistance = fallDistanceFor(this.scale.gameSize.height);
        let banded = false;
        for (const w of this.round.words) {
            const view = this.views.get(w.id);
            if (!view) continue;
            const y = wordYFor(w.p, fallDistance);
            view.base.setPosition(w.x, y);
            view.typed.setPosition(w.x, y);
            const locked = w.id === this.round.targetId;
            if (locked !== view.locked) {
                view.locked = locked;
                view.base.setColor(locked ? COLOR.locked : COLOR.word);
                if (locked) {
                    // The band's size and its offset from the word are fixed once the lock-on starts.
                    const band = lockBandRect(w.x, w.text.length);
                    this.lockBand.setSize(band.width, WORD_H);
                    this.bandDx = band.x - w.x;
                }
            }
            if (view.typed.text.length !== w.typed) view.typed.setText(w.text.slice(0, w.typed));
            if (locked) {
                this.lockBand.setPosition(w.x + this.bandDx, y);
                banded = true;
            }
        }
        if (this.lockBand.visible !== banded) this.lockBand.setVisible(banded);
    }

    private refreshHud() {
        const r = this.round;
        this.scoreText.setText(`SCORE ${r.score}`);
        this.livesText.setText('♥'.repeat(r.lives));
        this.comboText.setText(`COMBO x${r.combo}`).setVisible(r.combo >= 2);
    }

    private refreshHint() {
        this.hint.setVisible(!typingInput().focused);
    }

    /** The logical height changed (keyboard opened or closed, device turned): re-place the floor and words. */
    private layout() {
        const { width, height } = this.scale.gameSize;
        const floorY = floorYFor(height);
        this.floorLine.setPosition(width / 2, floorY);
        this.hint.setY((floorY + height) / 2);
        this.refreshHint();
        this.placeViews();
    }
}
