import { Scene, type GameObjects } from 'phaser';
import { DemoDirector } from 'title-demo';
import {
    CELL_FILL, CELL_FONT_FAMILY, CELL_LABEL_COLOR, CELL_STROKE, CELL_STROKE_WIDTH, cellLabelSize, COLORS
} from '../logic/boardStyle';
import { createRng } from '../logic/primes';
import { digitFromKey, modeFromData } from '../logic/selectLayout';
import {
    createDemoGame, DEMO_ATTEMPTS, DEMO_DIGITS, DEMO_OPTIONS, isJudged, typedDigits,
    type DemoDetail, type DemoState
} from '../logic/titleDemo';
import { computeTitleLayout, TITLE_NAME_FONT, type DemoLayout } from '../logic/titleLayout';
import type { DigitOption, GameMode, GameStartData, TitleData } from '../types';
import {
    BACKGROUND_COLOR, BUTTON_STROKE, createButton, createHomeIcon, createText, detectLocale, translate, type Locale
} from './ui';

const MODE_STROKE: Record<GameMode, number> = { normal: 0x38bdf8, hard: 0xf59e0b };
const NAME_COLOR = '#f9fafb';

interface DemoCell {
    box: GameObjects.Rectangle;
    label: GameObjects.Text;
    digit: string;
    fill: number;
}

export class Title extends Scene {
    private mode: GameMode = 'normal';
    private locale: Locale = 'ja';
    private uiObjects: GameObjects.GameObject[] = [];
    private director: DemoDirector<DemoState, string, DemoDetail> | null = null;
    private clock = 0;
    /** The `clock` value at which each row of the current round was guessed. */
    private rowStartedAt: number[] = [];
    private demoObjects: GameObjects.GameObject[] = [];
    private demoCells: DemoCell[][] = [];
    private demoAlpha = 1;
    private modeBoxes: Partial<Record<GameMode, GameObjects.Rectangle>> = {};
    private starting = false;
    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const digit = digitFromKey(event.key);

        if (digit !== null) {
            this.startGame(digit);
        }
    };
    private readonly onResize = (): void => {
        this.build();
    };

    constructor() {
        super('Title');
    }

    init(data?: TitleData): void {
        this.mode = modeFromData(data);
        this.starting = false;
        this.uiObjects = [];
        this.demoObjects = [];
        this.demoCells = [];
    }

    create(): void {
        this.cameras.main.setBackgroundColor(BACKGROUND_COLOR);
        this.locale = detectLocale();

        this.input.keyboard?.on('keydown', this.onKeyDown);
        this.scale.on('resize', this.onResize);

        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown);
            this.scale.off('resize', this.onResize);
        });

        this.clock = 0;
        this.rowStartedAt = [];
        this.director = new DemoDirector(createDemoGame({ rng: createRng() }), DEMO_OPTIONS, 0);

        this.build();
    }

    update(_time: number, delta: number): void {
        const director = this.director;

        if (this.starting || director === null) {
            return;
        }

        this.clock += delta;
        const event = director.tick(this.clock);

        if (event?.kind === 'action') {
            this.rowStartedAt[event.detail.row] = this.clock;
        } else if (event?.kind === 'advance' || event?.kind === 'fade-in') {
            this.rowStartedAt = [];
        }

        this.renderDemo();

        if (import.meta.env.DEV) {
            // QA only: a read-only view of the Title and its demo (never part of the production bundle).
            (window as unknown as { __qa?: unknown }).__qa = {
                scene: 'Title',
                mode: this.mode,
                demoVisible: this.demoCells.length > 0,
                demoPhase: director.phase,
                demoRounds: director.rounds,
                demoRows: director.state.rows.length
            };
        }
    }

    private build(): void {
        for (const obj of [...this.uiObjects, ...this.demoObjects]) {
            obj.destroy();
        }
        this.uiObjects = [];
        this.demoObjects = [];
        this.demoCells = [];

        createHomeIcon(this, this.uiObjects);

        const { width, height } = this.scale.gameSize;
        const layout = computeTitleLayout(width, height);

        createText(this, layout.name.x, layout.name.y, 'digdle', TITLE_NAME_FONT, NAME_COLOR, 0.5, this.uiObjects);

        const { normal, hard } = layout.modeButtons;
        const normalButton = createButton(
            this, normal.x, normal.y, normal.width, normal.height, translate(this.locale, 'normalMode'),
            () => this.setMode('normal'), this.uiObjects
        );
        const hardButton = createButton(
            this, hard.x, hard.y, hard.width, hard.height, translate(this.locale, 'hardMode'),
            () => this.setMode('hard'), this.uiObjects
        );
        this.modeBoxes = { normal: normalButton.box, hard: hardButton.box };
        this.highlightMode();

        for (const { digit, rect } of layout.digitButtons) {
            createButton(
                this, rect.x, rect.y, rect.width, rect.height, String(digit),
                () => this.startGame(digit), this.uiObjects
            );
        }

        this.buildDemo(layout.demo);
        this.renderDemo();
    }

    /** The empty board; nothing is drawn when the free area is too small (`layout` is null). */
    private buildDemo(layout: DemoLayout | null): void {
        if (layout === null) {
            return;
        }

        const labelSize = cellLabelSize(layout.cell);

        for (let row = 0; row < DEMO_ATTEMPTS; row += 1) {
            const rowCells: DemoCell[] = [];

            for (let col = 0; col < DEMO_DIGITS; col += 1) {
                const x = layout.left + col * (layout.cell + layout.gap);
                const y = layout.top + row * (layout.cell + layout.gap);
                const box = this.add.rectangle(x, y, layout.cell, layout.cell, CELL_FILL)
                    .setOrigin(0, 0)
                    .setStrokeStyle(CELL_STROKE_WIDTH, CELL_STROKE);
                const label = this.add.text(x + layout.cell / 2, y + layout.cell / 2, '', {
                    fontFamily: CELL_FONT_FAMILY,
                    fontSize: labelSize,
                    color: CELL_LABEL_COLOR
                }).setOrigin(0.5);

                this.demoObjects.push(box, label);
                rowCells.push({ box, label, digit: '', fill: CELL_FILL });
            }

            this.demoCells.push(rowCells);
        }

        this.demoAlpha = 1;
    }

    /** Draws the demo state: typed digits, colours once a row is judged, and the fade of a run's rebuild. */
    private renderDemo(): void {
        const director = this.director;

        if (director === null || this.demoCells.length === 0) {
            return;
        }

        const alpha = director.opacity(this.clock);
        const { rows } = director.state;

        for (let rowIndex = 0; rowIndex < this.demoCells.length; rowIndex += 1) {
            const row = rows[rowIndex];
            const startedAt = this.rowStartedAt[rowIndex];
            const elapsed = startedAt === undefined ? -1 : this.clock - startedAt;
            const typed = row === undefined ? 0 : typedDigits(row, elapsed);
            const judged = row !== undefined && isJudged(row, elapsed);

            for (let col = 0; col < this.demoCells[rowIndex].length; col += 1) {
                const cell = this.demoCells[rowIndex][col];
                const digit = row !== undefined && col < typed ? row.guess[col] : '';
                const fill = row !== undefined && judged ? COLORS[row.colors[col]] : CELL_FILL;

                if (digit !== cell.digit) {
                    cell.digit = digit;
                    cell.label.setText(digit);
                }

                if (fill !== cell.fill) {
                    cell.fill = fill;
                    cell.box.setFillStyle(fill);
                }

                if (alpha !== this.demoAlpha) {
                    cell.box.setAlpha(alpha);
                    cell.label.setAlpha(alpha);
                }
            }
        }

        this.demoAlpha = alpha;
    }

    private setMode(mode: GameMode): void {
        this.mode = mode;
        this.highlightMode();
    }

    private highlightMode(): void {
        if (import.meta.env.DEV) {
            // QA only: a read-only view of the Title (never part of the production bundle).
            const qa = window as unknown as { __qa?: Record<string, unknown> };
            qa.__qa = { ...qa.__qa, scene: 'Title', mode: this.mode };
        }

        for (const mode of ['normal', 'hard'] as const) {
            const selected = this.mode === mode;

            this.modeBoxes[mode]?.setStrokeStyle(selected ? 3 : 2, selected ? MODE_STROKE[mode] : BUTTON_STROKE);
        }
    }

    private startGame(digits: DigitOption): void {
        if (this.starting) {
            return;
        }

        this.starting = true;
        const data: GameStartData = { digits, mode: this.mode };
        this.scene.start('Game', data);
    }
}
