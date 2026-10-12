import { GameObjects, Scene } from 'phaser';
import type { LoseReason } from '../logic/round';
import { RETRY_KEYS, wasPressed } from '../logic/input';
import { HEIGHT, P, WIDTH } from '../params';
import { SceneInput } from './SceneInput';

export interface ResultData {
    status: 'cleared' | 'lost';
    reason: LoseReason | null;
    maxHeight: number;
}

const REASON_TEXT: Record<LoseReason, string> = {
    crushed: 'ミノに潰された',
    toppedOut: '積み上がりすぎた',
};

/** Shown over the Game scene, which keeps running behind it (no progress, effects only): outcome and retry. */
export class Result extends Scene {
    private outcome: ResultData = { status: 'lost', reason: null, maxHeight: 0 };
    private elapsed = 0;
    private controls!: SceneInput;
    private retryHint!: GameObjects.Text;

    constructor() {
        super('Result');
    }

    init(data: ResultData): void {
        this.outcome = data;
    }

    create(): void {
        this.elapsed = 0;
        this.controls = new SceneInput(this);

        this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.65);
        const style = { fontFamily: 'sans-serif', color: '#ffffff', align: 'center' };
        const cleared = this.outcome.status === 'cleared';

        this.add.text(WIDTH / 2, HEIGHT / 3, cleared ? 'クリア！' : 'ゲームオーバー', {
            ...style, fontSize: '40px',
        }).setOrigin(0.5);
        if (!cleared) {
            const reason = this.outcome.reason ? REASON_TEXT[this.outcome.reason] : '';
            const goal = P.ROWS - P.GOAL_ROW;
            this.add.text(WIDTH / 2, HEIGHT / 3 + 56, `${reason}\n高さ ${this.outcome.maxHeight} / ${goal}`, {
                ...style, fontSize: '22px', lineSpacing: 8,
            }).setOrigin(0.5, 0);
        }
        this.retryHint = this.add.text(WIDTH / 2, (HEIGHT * 2) / 3, 'タップ / R / スペースでリトライ', {
            ...style, fontSize: '20px',
        }).setOrigin(0.5).setVisible(false);

        if (import.meta.env.DEV) {
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Result', status: this.outcome.status, reason: this.outcome.reason, maxHeight: this.outcome.maxHeight,
            };
        }
    }

    update(_time: number, deltaMs: number): void {
        this.elapsed += deltaMs / 1000;
        // Presses are always consumed, so one made during the lockout can't fire a retry afterwards.
        const pressed = wasPressed(this.controls.read(), RETRY_KEYS);
        if (this.elapsed < P.RETRY_LOCKOUT) return;
        this.retryHint.setVisible(true);
        if (pressed) {
            this.scene.start('Game', { autoStart: true });
        }
    }
}
