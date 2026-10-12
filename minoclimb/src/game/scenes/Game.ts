import { GameObjects, Scene } from 'phaser';
import { HEIGHT, P, WIDTH } from '../params';
import { InputArbiter, START_KEYS, wasPressed, type StickView } from '../logic/input';
import { Round } from '../logic/round';
import { BoardView } from './BoardView';
import type { ResultData } from './Result';
import { SceneInput } from './SceneInput';

export interface GameInitData {
    /** Retry: skip the ready overlay and start playing at once. */
    autoStart?: boolean;
}

type Phase = 'ready' | 'playing' | 'ended';

/** Extra time to keep redrawing after the shake, so its last frame is shown. */
const RENDER_MARGIN_MS = 100;

const READY_LINES: readonly { text: string; size: number; y: number }[] = [
    { text: 'MINOCLIMB', size: 40, y: HEIGHT * 0.38 },
    { text: '←→ 移動 / ジャンプ', size: 18, y: HEIGHT * 0.5 },
    { text: '左ドラッグ = 移動 / 右タップ = ジャンプ', size: 16, y: HEIGHT * 0.56 },
    { text: 'タップまたはスペースで開始', size: 20, y: HEIGHT * 0.66 },
];

/** Plays one attempt: ready overlay, then the round until it is cleared or lost. */
export class Game extends Scene {
    private autoStart = false;
    private phase: Phase = 'ready';
    private round!: Round;
    private view!: BoardView;
    private controls!: SceneInput;
    private arbiter!: InputArbiter;
    private overlay: GameObjects.GameObject[] = [];
    /** Frame clock (ms) while playing; frozen once the round ends so the landing frame stops pulsing. */
    private clock = 0;
    /** Milliseconds since the round ended. */
    private sinceEnd = 0;

    constructor() {
        super('Game');
    }

    init(data: GameInitData): void {
        this.autoStart = data?.autoStart === true;
    }

    create(): void {
        // The Scene instance is reused on retry, so every per-run field is reset here.
        this.phase = 'ready';
        this.overlay = [];
        this.clock = 0;
        this.sinceEnd = 0;
        this.round = new Round(Math.random);
        this.view = new BoardView(this);
        this.controls = new SceneInput(this);
        this.arbiter = new InputArbiter(WIDTH / 2, P.STICK_DEADZONE, P.STICK_RING_RADIUS);

        if (this.autoStart) {
            this.beginPlaying();
        } else {
            this.overlay = this.buildReadyOverlay();
        }
        this.view.draw(this.round, null, 0, 0, false);
    }

    update(time: number, deltaMs: number): void {
        if (this.phase === 'ended') {
            // The round is over: only the shake needs frames; afterwards the picture is static.
            this.sinceEnd += deltaMs;
            if (this.sinceEnd <= P.RESULT_SHAKE_TIME * 1000 + RENDER_MARGIN_MS) {
                this.view.draw(this.round, null, this.clock, 0, false);
            }
            return;
        }
        const raw = this.controls.read();
        let stick: StickView | null = null;

        let dtForEffects = deltaMs;
        if (this.phase === 'ready') {
            if (wasPressed(raw, START_KEYS)) {
                this.beginPlaying();
                dtForEffects = 0; // the trigger frame is time 0 for hints and flashes
            }
        } else if (this.phase === 'playing') {
            const read = this.arbiter.read(raw);
            stick = read.stick;
            this.clock = time;
            this.round.step(deltaMs / 1000, read.move);
            if (this.round.status !== 'playing') this.finish();
        }
        // After the round ends the scene keeps running (so the shake plays) but nothing advances.
        const playing = this.phase === 'playing';
        this.view.draw(this.round, playing ? stick : null, this.clock, dtForEffects, playing);

        if (import.meta.env.DEV && (this.phase as Phase) !== 'ended') {
            // QA only (not in the production bundle): lets browser scenarios wait for a state, and
            // gives them the Round to stage rare situations such as reaching the goal.
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Game',
                phase: this.phase,
                status: this.round.status,
                flow: this.round.flow.kind,
                height: this.round.height,
                player: { x: this.round.player.x, y: this.round.player.y },
                round: this.round,
            };
        }
    }

    /** Starts the round; keys and fingers held right now stay ignored until released. */
    private beginPlaying(): void {
        this.arbiter.blockHeld(this.controls.read());
        this.overlay.forEach((o) => o.destroy());
        this.overlay = [];
        this.phase = 'playing';
    }

    private finish(): void {
        this.phase = 'ended';
        const data: ResultData = {
            status: this.round.status === 'cleared' ? 'cleared' : 'lost',
            reason: this.round.loseReason,
            maxHeight: this.round.maxHeight,
        };
        this.scene.launch('Result', data);
        if (data.status === 'lost') {
            this.cameras.main.shake(P.RESULT_SHAKE_TIME * 1000, P.RESULT_SHAKE_INTENSITY);
        }
    }

    private buildReadyOverlay(): GameObjects.GameObject[] {
        const dim = this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x000000, 0.6);
        const texts = READY_LINES.map(({ text, size, y }) =>
            this.add.text(WIDTH / 2, y, text, {
                fontFamily: 'sans-serif', fontSize: `${size}px`, color: '#ffffff', align: 'center',
            }).setOrigin(0.5));
        return [dim, ...texts];
    }
}
