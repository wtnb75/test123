import { Scene } from 'phaser';
import { FONT_RESULT, FONT_RESULT_TITLE } from '../params';
import { resultInputOpen, resultLayout, resultTexts } from '../logic/layout';
import type { Outcome } from '../logic/sim';
import { addButton, addLabel, BG_CSS, type ButtonHandle, COLOR, onKeyDown, RotateGuard, SceneExit } from './ui';

export interface ResultData {
    outcome: Outcome;
    /** Truncated height (already capped at the goal height). */
    meters: number;
}

export class Result extends Scene {
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private startedAt = 0;

    constructor() {
        super('Result');
    }

    create(data: Partial<ResultData>) {
        const outcome = data.outcome ?? 'hit';
        const { width, height } = this.scale.gameSize;
        this.cameras.main.setBackgroundColor(BG_CSS);
        this.startedAt = this.time.now;
        const cx = width / 2;
        const layout = resultLayout(height);
        const texts = resultTexts(outcome, data.meters ?? 0);
        addLabel(this, cx, layout.stageY, 'ステージ 1', FONT_RESULT, COLOR.sub);
        addLabel(this, cx, layout.titleY, texts.title, FONT_RESULT_TITLE, outcome === 'clear' ? COLOR.goalText : COLOR.accent);
        addLabel(this, cx, layout.reasonY, texts.reason, FONT_RESULT);
        addLabel(this, cx, layout.heightY, texts.height, FONT_RESULT);

        const buttons: ButtonHandle[] = [];
        this.guard = new RotateGuard(this, () => buttons.forEach((b) => b.reset()));
        this.exit = new SceneExit(this);
        const accepting = () => !this.guard.active && resultInputOpen(this.time.now - this.startedAt);
        buttons.push(addButton(this, cx, layout.retryY, 'もう一度', () => this.exit.to('Game'), accepting));
        buttons.push(addButton(this, cx, layout.titleButtonY, 'タイトルへ', () => this.exit.to('Title'), accepting));
        onKeyDown(this, (key) => {
            if ((key === ' ' || key === 'Enter') && accepting()) this.exit.to('Game');
        });

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Result' },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                guard: { get: () => this.guard.active },
                outcome: { get: () => outcome },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }
}
