import { GameObjects, Scene } from 'phaser';
import type { LoseReason } from '../logic/round';
import { lockoutOver, resultAction, RESULT_TITLE_RECT } from '../logic/resultInput';
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

const TITLE_BUTTON_FILL = 0x3a4a6b;
const TITLE_BUTTON_STROKE = 0xffffff;
const TITLE_BUTTON_RADIUS = 12;

/**
 * Shown over the Game scene, which keeps running behind it (no progress, effects only): outcome, retry
 * and the way back to the Title.
 */
export class Result extends Scene {
    private outcome: ResultData = { status: 'lost', reason: null, maxHeight: 0 };
    private elapsed = 0;
    private controls!: SceneInput;
    private retryHint!: GameObjects.Text;
    private titleButton!: GameObjects.Container;
    private leaving = false;

    constructor() {
        super('Result');
    }

    init(data: ResultData): void {
        this.outcome = data;
    }

    create(): void {
        this.elapsed = 0;
        this.leaving = false;
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
        this.titleButton = this.createTitleButton(style).setVisible(false);

        if (import.meta.env.DEV) {
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Result', status: this.outcome.status, reason: this.outcome.reason, maxHeight: this.outcome.maxHeight,
            };
        }
    }

    update(_time: number, deltaMs: number): void {
        this.elapsed += deltaMs / 1000;
        // Presses are always consumed, so one made during the lockout can't fire an action afterwards.
        const accepting = lockoutOver(this.elapsed);
        const action = resultAction(this.controls.read(), accepting);
        if (!accepting) return;
        this.retryHint.setVisible(true);
        this.titleButton.setVisible(true);
        if (action === null || this.leaving) return;
        this.leaving = true;
        if (action === 'retry') {
            this.scene.start('Game');
        } else {
            // Game runs on behind the Result: stop it so nothing of the finished run outlives the Title.
            this.scene.stop('Game');
            this.scene.start('Title');
        }
    }

    /** The "back to Title" button (docs/spec.md "Result Scene"): a drawing only, the press is routed by `resultAction`. */
    private createTitleButton(style: { fontFamily: string; color: string; align: string }): GameObjects.Container {
        const r = RESULT_TITLE_RECT;
        const box = this.add.graphics()
            .fillStyle(TITLE_BUTTON_FILL, 1)
            .fillRoundedRect(r.x, r.y, r.width, r.height, TITLE_BUTTON_RADIUS)
            .lineStyle(2, TITLE_BUTTON_STROKE, 1)
            .strokeRoundedRect(r.x, r.y, r.width, r.height, TITLE_BUTTON_RADIUS);
        const label = this.add.text(P.RESULT_TITLE_X, P.RESULT_TITLE_Y, 'タイトルへ（T）', {
            ...style, fontSize: '24px',
        }).setOrigin(0.5);
        return this.add.container(0, 0, [box, label]);
    }
}
