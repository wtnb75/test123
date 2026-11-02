import { Scene, type GameObjects } from 'phaser';
import {
    BEST_BLINK_ALPHA,
    BEST_BLINK_COUNT,
    BEST_BLINK_MS,
    COUNT_UP_MS,
    FONT_HUD_LABEL,
    FONT_RESULT,
    FONT_RESULT_SCORE,
    FONT_RESULT_TITLE,
    RESULT_BUTTON_W,
    RESULT_INPUT_GUARD_MS,
} from '../params';
import { resultInputBlocked } from '../logic/buttons';
import { resultLayout } from '../logic/layout';
import { bestLabel, countUpValue, formatBest, isNewBest } from '../logic/score';
import {
    addButton,
    addLabel,
    BG_COLOR,
    bestStore,
    type ButtonHandle,
    COLOR,
    onKeyDown,
    RotateGuard,
    SceneExit,
    setClockPaused,
} from './ui';

export interface ResultData {
    score: number;
}

export class Result extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private readonly buttons: ButtonHandle[] = [];
    /** Whether input was blocked in the previous frame (to notice the moment it stops being). */
    private wasBlocked = true;
    /** Milliseconds since Result started, summed from frame deltas (held while the rotate notice shows). */
    private sinceStartMs = 0;

    constructor() {
        super('Result');
    }

    create(data: ResultData) {
        // The logical size is not re-decided here: it stays what the play used.
        const { width, height } = this.scale.gameSize;
        const layout = resultLayout(height);
        const cx = width / 2;
        this.cameras.main.setBackgroundColor(BG_COLOR);
        this.sinceStartMs = 0;

        // The new-best check uses the best from before this play; a score of 0 is never recorded.
        const previous = bestStore.load();
        const isNew = isNewBest(previous?.score ?? null, data.score);
        if (isNew) bestStore.record(data.score, bestLabel(data.score));
        const best = bestStore.load();

        addLabel(this, cx, layout.titleY, 'RESULT', FONT_RESULT_TITLE);
        addLabel(this, cx, layout.scoreLabelY, 'SCORE', FONT_HUD_LABEL, COLOR.muted);
        const scoreText = addLabel(this, cx, layout.scoreY, String(data.score), FONT_RESULT_SCORE, COLOR.accent);
        const bestText = isNew
            ? addLabel(this, cx, layout.bestY, 'NEW BEST!', FONT_RESULT, COLOR.accent)
            : addLabel(this, cx, layout.bestY, formatBest(best), FONT_RESULT);
        this.playScoreEffects(scoreText, isNew ? bestText : null, data.score);

        // The notice first: it reports to the buttons below when it appears or goes away.
        const buttons = this.buttons;
        buttons.length = 0; // the Scene instance is reused
        this.wasBlocked = true;
        this.guard = new RotateGuard(this, (active) => {
            setClockPaused(this, active);
            buttons.forEach((b) => b.reset());
        });
        this.exit = new SceneExit(this);
        const accepting = () => !this.blocked();
        buttons.push(
            addButton(this, layout.leftButtonX, layout.buttonY, 'もう一度', () => this.exit.to('Game'), RESULT_BUTTON_W, accepting),
            addButton(this, layout.rightButtonX, layout.buttonY, 'タイトルへ', () => this.exit.to('Title'), RESULT_BUTTON_W, accepting),
        );
        onKeyDown(this, (key) => {
            if (this.blocked()) return;
            if (key === ' ' || key === 'Enter') this.exit.to('Game');
        });

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Result' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                score: { get: () => data.score },
                blocked: { get: () => this.blocked() },
                guard: { get: () => this.guard.active },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }

    /** Buttons and keys do nothing while the rotate notice shows or just after Result started. */
    private blocked(): boolean {
        return this.guard.active || resultInputBlocked(this.sinceStartMs, RESULT_INPUT_GUARD_MS);
    }

    update(_time: number, delta: number) {
        if (!this.guard.active) this.sinceStartMs += delta;
        // When input starts being accepted (the guard time ends), a mouse resting on a button shows its hover look:
        // no pointer event will announce it.
        const blocked = this.blocked();
        if (this.wasBlocked && !blocked) this.buttons.forEach((b) => b.refresh());
        this.wasBlocked = blocked;
    }

    /**
     * The score counts up from 0, then NEW BEST! blinks (docs/spec.md "演出・UI（Result）"). Both are Phaser
     * tweens; they don't take input, and they are destroyed with the Scene.
     */
    private playScoreEffects(scoreText: GameObjects.Text, newBest: GameObjects.Text | null, score: number) {
        if (score > 0) {
            scoreText.setText('0');
            this.tweens.addCounter({
                from: 0,
                to: COUNT_UP_MS,
                duration: COUNT_UP_MS,
                onUpdate: (tween) => scoreText.setText(String(countUpValue(tween.getValue() ?? COUNT_UP_MS, score))),
                onComplete: () => scoreText.setText(String(score)),
            });
        }
        if (newBest) {
            this.tweens.add({
                targets: newBest,
                alpha: BEST_BLINK_ALPHA,
                duration: BEST_BLINK_MS / 2,
                yoyo: true,
                repeat: BEST_BLINK_COUNT - 1,
                delay: COUNT_UP_MS,
            });
        }
    }
}
