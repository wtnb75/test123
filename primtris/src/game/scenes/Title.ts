import { Scene, type GameObjects } from 'phaser';
import { DemoDirector } from 'title-demo';

import { boxCapacityFor, stackDigits, type BoxKey } from '../logic/primtris';
import {
    DEMO_BOX_HEIGHT,
    DEMO_FADE_MS,
    DEMO_WAIT_MS,
    SELECTOR_HEIGHT,
    SELECTOR_Y_RATIO,
    START_HEIGHT,
    START_Y_RATIO,
    SelectionFade,
    TITLE_DEMO_OPTIONS,
    createTitleDemoGame,
    demoLayout,
    hesitationStart,
    tileStateAt,
    type DemoIntent,
    type DemoLayout,
    type DemoSchedule,
    type TitleDemoDetail,
    type TitleDemoState
} from '../logic/titleDemo';
import { BoxesView } from './boxesView';

const DIGIT_OPTIONS = [2, 3, 4] as const;

/** Box text sizes and offsets of the demo (docs/spec/title-demo.md "レイアウト"). */
const DEMO_BOX_STYLE = {
    height: DEMO_BOX_HEIGHT,
    labelOffset: 8,
    labelFont: 18,
    digitsOffset: 34,
    digitsFont: 18,
    digitsLineSpacing: -2,
    capacityOffset: 116,
    capacityFont: 14
} as const;

type Director = DemoDirector<TitleDemoState, DemoIntent, TitleDemoDetail>;

export class Title extends Scene
{
    private selectedDigitIndex = 0;

    // The demo (all rebuilt in create: Phaser reuses Scene instances).
    private clock = 0;
    private frozenAt = 0;
    private director?: Director;
    private directorStart = 0;
    private waitStart = 0;
    private layout!: DemoLayout;
    private boxesView?: BoxesView;
    private tileText?: GameObjects.Text;
    private schedule: DemoSchedule | null = null;
    private lastDetail: TitleDemoDetail | null = null;
    private landedHandled = false;
    private fade = new SelectionFade();
    private starting = false;

    constructor ()
    {
        super('Title');
    }

    create ()
    {
        const { width, height } = this.cameras.main;

        this.clock = 0;
        this.frozenAt = 0;
        this.director = undefined;
        this.boxesView = undefined;
        this.tileText = undefined;
        this.schedule = null;
        this.lastDetail = null;
        this.landedHandled = false;
        this.fade = new SelectionFade();
        this.starting = false;

        this.cameras.main.setBackgroundColor('#101820');

        this.add.text(width / 2, height * 0.2, 'PRIMTRIS', {
            color: '#f8f4e3',
            fontFamily: 'sans-serif',
            fontSize: '48px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const selectorBackground = this.add.rectangle(width / 2, height * SELECTOR_Y_RATIO, width * 0.7, SELECTOR_HEIGHT, 0x1d3557)
            .setStrokeStyle(2, 0xa8dadc);
        const leftArrow = this.add.text(selectorBackground.x - selectorBackground.width / 2 + 28, selectorBackground.y, '◀', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const rightArrow = this.add.text(selectorBackground.x + selectorBackground.width / 2 - 28, selectorBackground.y, '▶', {
            color: '#f1faee',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        const digitText = this.add.text(width / 2, selectorBackground.y, '', {
            color: '#ffd166',
            fontFamily: 'sans-serif',
            fontSize: '30px',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        const updateDigitText = () => {
            digitText.setText(`${DIGIT_OPTIONS[this.selectedDigitIndex]}桁`);
        };

        const moveSelection = (delta: number) => {
            const maxIndex = DIGIT_OPTIONS.length - 1;
            const nextIndex = Math.min(maxIndex, Math.max(0, this.selectedDigitIndex + delta));
            if (nextIndex === this.selectedDigitIndex) {
                return;
            }
            this.selectedDigitIndex = nextIndex;
            updateDigitText();
            // The demo fades out (from its current opacity) and a new run with the new digit count fades in.
            this.fade.change(DIGIT_OPTIONS[nextIndex], this.director?.opacity(this.frozenAt) ?? 1);
        };

        leftArrow.on('pointerdown', () => {
            moveSelection(-1);
        });
        rightArrow.on('pointerdown', () => {
            moveSelection(1);
        });

        // One hint line under START (the 4-line explanation is replaced by the demo).
        this.add.text(width / 2, demoLayout(width, height, DIGIT_OPTIONS[this.selectedDigitIndex]).hintY, 'ドラッグで移動 / 離して投入', {
            align: 'center',
            color: '#d7e3fc',
            fontFamily: 'sans-serif',
            fontSize: '16px'
        }).setOrigin(0.5);

        const startButton = this.add.rectangle(width / 2, height * START_Y_RATIO, width * 0.68, START_HEIGHT, 0xffd166)
            .setInteractive({ useHandCursor: true });
        const startLabel = this.add.text(width / 2, height * START_Y_RATIO, 'START', {
            color: '#222222',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        const startGame = () => {
            if (this.starting) {
                return;
            }

            this.starting = true;
            this.scene.start('Game', {
                digitCount: DIGIT_OPTIONS[this.selectedDigitIndex]
            });

            // If scene transition does not happen, allow retrying START (and the demo moves again).
            this.time.delayedCall(200, () => {
                if (this.scene.isActive('Title')) {
                    this.starting = false;
                }
            });
        };

        updateDigitText();
        startButton.on('pointerdown', startGame);
        startLabel.on('pointerdown', startGame);
        this.input.keyboard?.on('keydown-LEFT', () => moveSelection(-1));
        this.input.keyboard?.on('keydown-RIGHT', () => moveSelection(1));
        this.input.keyboard?.on('keydown-ENTER', startGame);

        this.buildDemo(DIGIT_OPTIONS[this.selectedDigitIndex], 0);
    }

    update (_time: number, delta: number)
    {
        if (import.meta.env.DEV && this.director) {
            // QA only: a read-only view of the demo (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Title',
                digitCount: DIGIT_OPTIONS[this.selectedDigitIndex],
                phase: this.director.phase,
                rounds: this.director.rounds,
                selectionFade: this.fade.active,
                boxCount: this.layout.boxes.length
            };
        }

        if (this.starting || !this.director) {
            return;
        }

        this.clock += delta;

        const swapTo = this.fade.active ? this.fade.update(delta) : null;
        if (swapTo !== null) {
            // The director is created for `now` one fade-in later, and is not ticked before that.
            this.buildDemo(swapTo, this.clock + DEMO_FADE_MS);
        }

        const director = this.director;
        const frozen = this.fade.fadingOut;
        if (!frozen) {
            this.frozenAt = this.clock;
        }

        if (!frozen && this.clock >= this.directorStart) {
            this.handleEvent(director.tick(this.clock));
        }

        this.readIntent(director);
        this.render(director, this.frozenAt);
    }

    private buildDemo (digitCount: number, startAt: number)
    {
        const { width, height } = this.cameras.main;

        this.boxesView?.destroy();
        this.tileText?.destroy();

        this.layout = demoLayout(width, height, digitCount);
        this.boxesView = new BoxesView(
            this,
            this.layout.boxes.map((box) => box.key),
            width,
            { ...DEMO_BOX_STYLE, top: this.layout.boxRowTop },
            boxCapacityFor(digitCount)
        );

        this.director = new DemoDirector(createTitleDemoGame(digitCount), TITLE_DEMO_OPTIONS, startAt);
        this.directorStart = startAt;
        this.waitStart = startAt;
        this.schedule = null;
        this.lastDetail = null;
        this.landedHandled = false;
        this.frozenAt = this.clock;

        this.tileText = this.add.text(this.layout.tileX, this.layout.tileTop, '', {
            align: 'center',
            color: '#f8f4e3',
            fontFamily: 'sans-serif',
            fontSize: '28px',
            fontStyle: 'bold',
            lineSpacing: 2
        }).setOrigin(0.5, 0);

        this.showNumber(this.director.state.queue.current);
        this.boxesView.update(this.director.state.boxes);
        this.boxesView.setAlpha(this.fade.active ? this.fade.opacity : 1);
        this.tileText.setAlpha(this.fade.active ? this.fade.opacity : 1);
    }

    private showNumber (value: number)
    {
        const tile = this.tileText;
        if (!tile) {
            return;
        }

        tile.setText(stackDigits(value));
        tile.setScale(1);
        // The stacked digits must fit between the region top and the box row (a 4-digit number is the tallest).
        const available = this.layout.boxRowTop - this.layout.tileTop - 4;
        if (tile.height > available) {
            tile.setScale(available / tile.height);
        }
        tile.setPosition(this.layout.tileX, this.layout.tileTop);
        tile.setVisible(true);
    }

    private handleEvent (event: ReturnType<Director['tick']>)
    {
        const director = this.director;
        if (!event || !director) {
            return;
        }

        if (event.kind === 'action') {
            // A very late first tick can bring the plan and the action together: build the motion now.
            if (!this.schedule) {
                this.schedule = this.buildSchedule(event.detail.box, null, this.clock, this.clock);
            }
            this.lastDetail = event.detail;
            this.landedHandled = false;
        } else if (event.kind === 'fade-out') {
            // Drop what is still moving: the result is shown and nothing stays lit.
            this.applyLanding();
        } else if (event.kind === 'advance') {
            this.applyLanding();
            this.waitStart = this.clock;
            this.schedule = null;
            this.lastDetail = null;
            this.showNumber(director.state.queue.current);
        } else if (event.kind === 'fade-in') {
            // A new run is in place (fully transparent): empty boxes and a new number.
            this.landedHandled = true;
            this.waitStart = this.clock + DEMO_FADE_MS;
            this.schedule = null;
            this.lastDetail = null;
            this.boxesView?.update(director.state.boxes);
            this.boxesView?.setHighlight(null);
            this.showNumber(director.state.queue.current);
        }
    }

    /** Shows the result of the last move if no frame has shown it yet (after a long frame). */
    private applyLanding ()
    {
        if (this.lastDetail && !this.landedHandled) {
            this.boxesView?.update(this.lastDetail.boxes);
        }
        this.landedHandled = true;
        this.boxesView?.setHighlight(null);
    }

    /** The bot's move is known after the first tick of a wait: plan the tile's motion (hesitation included). */
    private readIntent (director: Director)
    {
        const intent = director.state.intent;
        if (!intent || this.schedule) {
            return;
        }

        this.schedule = this.buildSchedule(intent.box, intent.decoy, this.waitStart + DEMO_WAIT_MS, this.clock);
    }

    /** The tile's motion for the current number: `knownAt` is when the move became known. */
    private buildSchedule (box: BoxKey, decoy: BoxKey | null, actAt: number, knownAt: number): DemoSchedule
    {
        const lane = (key: BoxKey): number => this.layout.boxes.find((candidate) => candidate.key === key)?.centerX ?? this.layout.tileX;

        return {
            actAt,
            hesitateAt: hesitationStart(actAt, knownAt, decoy !== null),
            startX: this.layout.tileX,
            decoyX: decoy === null ? null : lane(decoy),
            targetX: lane(box),
            tileTop: this.layout.tileTop,
            // The stacked digits are measured, so the bottom lands exactly on the box row whatever the line height.
            tileHeight: this.tileText?.displayHeight ?? 0,
            landBottom: this.layout.boxRowTop,
            box,
            decoy
        };
    }

    private render (director: Director, now: number)
    {
        const alpha = this.fade.active ? this.fade.opacity : director.opacity(now);
        this.boxesView?.setAlpha(alpha);
        this.tileText?.setAlpha(alpha);

        if (!this.schedule || !this.tileText) {
            return;
        }

        const state = tileStateAt(now, this.schedule);
        this.boxesView?.setHighlight(state.highlight);

        if (state.landed) {
            // The tile arrived: the boxes show the new state, the number is gone.
            if (!this.landedHandled) {
                this.applyLanding();
            }
            this.tileText.setVisible(false);
            return;
        }

        this.tileText.setPosition(state.x, state.top);
    }
}
