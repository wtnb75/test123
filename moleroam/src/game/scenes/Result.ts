import { Scene } from 'phaser';
import { PARAMS } from '../params';
import { addButton, addLabel, applyLayout, drawBackdrop, fadeInScene } from './ui';

/** Vertical positions of the result screen (see docs/spec.md and docs/spec/portrait.md "レイアウト方針"). */
const POSITIONS = {
    landscape: { title: 130, label: 230, score: 330, retry: 500, toTitle: 620 },
    portrait: { title: 250, label: 380, score: 520, retry: 760, toTitle: 890 },
} as const;

export class Result extends Scene {
    private score = 0;
    private ready = false;

    constructor() {
        super('Result');
    }

    init(data: { score?: number }) {
        this.score = data.score ?? 0;
    }

    create() {
        const layout = applyLayout(this);
        const pos = layout.viewH > layout.viewW ? POSITIONS.portrait : POSITIONS.landscape;
        const cx = layout.viewW / 2;
        // Ignore buttons and keys right after arriving, so the last whack does not trigger a retry.
        this.ready = false;
        this.time.delayedCall(PARAMS.inputGuardMs, () => (this.ready = true));
        fadeInScene(this);
        drawBackdrop(this, layout);
        addLabel(this, cx, pos.title, 'タイムアップ！', 64);
        addLabel(this, cx, pos.label, 'スコア', 36, '#e8f5e9');
        addLabel(this, cx, pos.score, String(this.score), 140, '#ffee58');
        addButton(this, cx, pos.retry, 'もう一度', () => this.retry());
        addButton(this, cx, pos.toTitle, 'タイトルへ', () => this.toTitle());
        this.input.keyboard?.on('keydown-ENTER', this.onRetryKey, this);
        this.input.keyboard?.on('keydown-SPACE', this.onRetryKey, this);
        this.input.keyboard?.on('keydown-ESC', this.onTitleKey, this);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown-ENTER', this.onRetryKey, this);
            this.input.keyboard?.off('keydown-SPACE', this.onRetryKey, this);
            this.input.keyboard?.off('keydown-ESC', this.onTitleKey, this);
        });
    }

    private onRetryKey(event: KeyboardEvent) {
        if (!event.repeat) this.retry();
    }

    private onTitleKey(event: KeyboardEvent) {
        if (!event.repeat) this.toTitle();
    }

    private retry() {
        if (this.ready) this.scene.start('Game');
    }

    private toTitle() {
        if (this.ready) this.scene.start('Title');
    }
}
