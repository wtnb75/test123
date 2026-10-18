import { Scene } from 'phaser';
import { P, WIDTH } from '../params';
import { InputArbiter, type StickView } from '../logic/input';
import type { MoveInput } from '../logic/player';
import { Round } from '../logic/round';
import { BoardView, type BoardViewOptions } from './BoardView';
import type { ResultData } from './Result';
import { SceneInput } from './SceneInput';

type Phase = 'playing' | 'ended';

/** Extra time to keep redrawing after the shake, so its last frame is shown. */
const RENDER_MARGIN_MS = 100;

/** One frame's worth of control: the moves and, for the touch stick, what to draw. */
export interface Control {
    move: MoveInput;
    stick: StickView | null;
}

/**
 * Plays one attempt, from the first frame, until it is cleared or lost. The Title starts it, and so does
 * a retry from the Result. `Demo` is a subclass that lets a bot play behind the Title; the hooks below are
 * the only places it differs (the normal path is the default of each).
 */
export class Game extends Scene {
    protected phase: Phase = 'playing';
    /** True for the demo behind the Title: its dev-only state goes to its own global, not the game's. */
    protected readonly isDemo: boolean = false;
    protected round!: Round;
    protected view!: BoardView;
    private controls: SceneInput | null = null;
    private arbiter: InputArbiter | null = null;
    /** Frame clock (ms) while playing; frozen once the round ends so the landing frame stops pulsing. */
    private clock = 0;
    /** Seconds of play so far (dt capped at MAX_DT like the round's). */
    protected playSec = 0;
    /** Milliseconds since the round ended. */
    private sinceEnd = 0;

    constructor(key = 'Game') {
        super(key);
    }

    create(): void {
        // The Scene instance is reused on retry, so every per-run field is reset here.
        this.phase = 'playing';
        this.clock = 0;
        this.playSec = 0;
        this.sinceEnd = 0;
        this.round = new Round(Math.random);
        this.view = new BoardView(this, this.viewOptions());
        this.setupControls();
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

        const control = this.readControl();
        this.clock = time;
        this.playSec += Math.min(deltaMs / 1000, P.MAX_DT);
        this.round.step(deltaMs / 1000, control.move);
        if (this.round.status !== 'playing') this.finish();
        // After the round ends the scene keeps running (so the shake plays) but nothing advances.
        const playing = this.phase === 'playing';
        this.view.draw(this.round, playing ? control.stick : null, this.clock, deltaMs, playing);

        if (import.meta.env.DEV && (this.phase as Phase) !== 'ended') {
            // QA only (not in the production bundle): lets browser scenarios wait for a state, and
            // gives them the Round to stage rare situations such as reaching the goal. The demo behind
            // the Title writes its own global so it never hides the Title's or the game's.
            (window as unknown as Record<string, unknown>)[this.isDemo ? '__qaDemo' : '__qa'] = {
                scene: this.sys.settings.key,
                phase: this.phase,
                status: this.round.status,
                flow: this.round.flow.kind,
                height: this.round.height,
                player: { x: this.round.player.x, y: this.round.player.y },
                round: this.round,
            };
        }
    }

    /** What the Scene shows: hints and the touch tint are for the player, not for the demo. */
    protected viewOptions(): BoardViewOptions {
        return { hints: true, touchTint: true };
    }

    /** Listens to the player. Keys and fingers held right now stay ignored until released. */
    protected setupControls(): void {
        this.controls = new SceneInput(this);
        this.arbiter = new InputArbiter(
            WIDTH / 2, P.STICK_DEADZONE, P.STICK_RING_RADIUS, P.STICK_JUMP_FLICK, P.STICK_JUMP_RELEASE,
        );
        this.arbiter.blockHeld(this.controls.read());
    }

    /** This frame's moves: the keyboard and the touch stick. */
    protected readControl(): Control {
        // The arbiter returns one reused object (same shape as Control): nothing is allocated per frame.
        return this.arbiter!.read(this.controls!.read());
    }

    /** The round is over: show the result (the demo has none). */
    protected onRoundEnd(): void {
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

    private finish(): void {
        this.phase = 'ended';
        this.onRoundEnd();
    }
}
