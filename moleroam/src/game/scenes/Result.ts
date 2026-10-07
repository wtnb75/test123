import { Scene } from 'phaser';
import { PARAMS } from '../params';
import { addButton, addLabel, drawBackdrop, fadeInScene } from './ui';

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
        const cx = PARAMS.viewW / 2;
        // Ignore buttons and keys right after arriving, so the last whack does not trigger a retry.
        this.ready = false;
        this.time.delayedCall(PARAMS.inputGuardMs, () => (this.ready = true));
        fadeInScene(this);
        drawBackdrop(this);
        addLabel(this, cx, 130, 'タイムアップ！', 64);
        addLabel(this, cx, 230, 'スコア', 36, '#e8f5e9');
        addLabel(this, cx, 330, String(this.score), 140, '#ffee58');
        addButton(this, cx, 500, 'もう一度', () => this.retry());
        addButton(this, cx, 620, 'タイトルへ', () => this.toTitle());
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
