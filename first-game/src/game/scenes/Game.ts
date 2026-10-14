import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { generateStage } from '../core/generator';
import { moveByDelta, chordAtPlayer, movePlayer, toggleFlag } from '../core/rules';
import { inBounds, indexOf } from '../core/board';
import { analyzeCurrentState } from '../core/solver';
import type { LogicalAnalysis } from '../core/solver';
import type { Position, Stage } from '../core/types';
import { REFERENCE_CELL } from '../core/title';
import { BoardView } from './boardView';
import { PressTracker, StageFlow, gameOverKeyAction } from '../core/flow';
import {
    GRAVE_ART_FONT,
    GRAVE_DIM_ALPHA,
    GRAVE_DIM_COLOR,
    GRAVE_DIM_DEPTH,
    GRAVE_PLATE_ALPHA,
    GRAVE_PLATE_COLOR,
    GRAVE_PLATE_DEPTH,
    GRAVE_RECORD_COLOR,
    GRAVE_TEXT_COLOR,
    GRAVE_TEXT_DEPTH,
    graveCauseOf,
    graveLocked,
    gravePanelLayout,
    gravePlateWidth,
    graveRowParts,
    isNewRecord,
    type GraveInfo
} from '../core/gravePanel';
import { restartButtonAt, restartButtonLayout, type ButtonBox, type RestartButtonLayout, type RestartChoice } from '../core/restartButtons';
import { browserStore, createSessionBest, currentHighScore, recordScore, safeGetItem, safeSetItem } from '../core/highScore';
import { STAGE_MAX, parseStagePrompt, resolveStartStage } from '../core/startStage';
import {
    FLAG_OFF_STROKE_WIDTH,
    FLAG_ON_STROKE_WIDTH,
    FLAG_ON_FILL,
    FLAG_ON_LABEL_COLOR,
    FLAG_ON_STROKE,
    PAD_COLORS,
    PAD_DIRECTION_THRESHOLD,
    flagCircleSize,
    padSectorAlpha,
    padSectorArc,
    padSectorOf,
    padThemeOf,
    sectorOfAngle
} from '../core/padFeedback';
import {
    DEFAULT_STAGE_BUTTON_WIDTH,
    HUD_BAND_ALPHA,
    HUD_BAND_COLOR,
    HUD_BAND_DEPTH,
    HUD_GAP,
    HUD_LEFT,
    HUD_LEGEND_FONT,
    HUD_MESSAGE_FONT,
    HUD_MESSAGE_Y,
    HUD_TEXT_DEPTH,
    hudBandHeight,
    LEGEND_TEXT,
    fitFontSize,
    flagMessage,
    flagModeMessage,
    hudLegendTop,
    hudRowWidth,
    initialInputKind,
    inputKindOfKey,
    inputKindOfPointer,
    invalidStageMessage,
    jumpMessage,
    resultMessage,
    stageStartMessage,
    statusLine,
    STATUS_FONT_MAX,
    type InputKind
} from '../core/hudText';

const CELL_SIZE = REFERENCE_CELL;
const BOARD_ORIGIN_X = 20;
const BOARD_ORIGIN_Y = 80;
const CAMERA_FOLLOW_MARGIN_CELLS = 4;
const SCROLL_THRESHOLD = 8;
const INPUT_LOCK_MS = 100;
const HIGHSCORE_KEY = 'minefield-rogue-highscore';
const START_STAGE_KEY = 'minefield-rogue-start-stage';
const DEATH_DELAY_MS = 600;
const CLEAR_DELAY_MS = 250;
/** The STAGE button (and its prompt) exists only on the dev server, never in the production build. */
const STAGE_BUTTON_ENABLED = import.meta.env.DEV;

// True until the first Game of this page is created: only that game reads `?stage=` (docs/spec.md "開始ステージの決め方").
let firstGameOfPage = true;

// Best score of this page's session: lives outside the Scene so NEW GAME / RETRY keep it.
const sessionBest = createSessionBest();

// Last input kind of this page (keys / touch): outside the Scene so NEW GAME and Title keep it. Not stored.
let sessionInputKind: InputKind | undefined;

type JoystickState = {
    active: boolean;
    pointerId: number;
    startX: number;
    startY: number;
};

const JOYSTICK_BASE_RADIUS = 52;
const JOYSTICK_THUMB_RADIUS = 20;
const JOYSTICK_TAP_THRESHOLD = PAD_DIRECTION_THRESHOLD;
const JOYSTICK_REPEAT_DELAY = 380;  // ms until first repeat
const JOYSTICK_REPEAT_INTERVAL = 180; // ms between subsequent repeats

const JOYSTICK_DIRS: Position[] = [
    { x: 1,  y: 0  }, // 0 E
    { x: 1,  y: 1  }, // 1 SE
    { x: 0,  y: 1  }, // 2 S
    { x: -1, y: 1  }, // 3 SW
    { x: -1, y: 0  }, // 4 W
    { x: -1, y: -1 }, // 5 NW
    { x: 0,  y: -1 }, // 6 N
    { x: 1,  y: -1 }  // 7 NE
];

type DragState = {
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
};

export class Game extends Scene
{
    camera!: Phaser.Cameras.Scene2D.Camera;
    statusText!: Phaser.GameObjects.Text;
    messageText!: Phaser.GameObjects.Text;
    legendText!: Phaser.GameObjects.Text;
    /** Translucent band behind the HUD rows: keeps them readable when the board is scrolled under them. */
    private hudBand!: Phaser.GameObjects.Rectangle;
    /** The last message shown, so the HUD can be laid out again on resize. */
    private hudMessage = '';
    /** What the HUD texts were last drawn with (width|text): an unchanged row is not drawn again. */
    private messageKey = '';
    private statusKey = '';
    private legendKey = '';
    goalArrow!: Phaser.GameObjects.Text;
    view!: BoardView;
    stageData!: Stage;
    cameraBoundsWidth = 0;
    cameraBoundsHeight = 0;
    inputLockUntil = 0;
    flow = new StageFlow();
    presses = new PressTracker();
    store = browserStore();
    dragState: DragState = { active: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
    /** The part of the drag distance under one pixel that has not scrolled the camera yet (it is carried over). */
    dragCarryX = 0;
    dragCarryY = 0;
    virtualControlLayer?: Phaser.GameObjects.Container;
    joystickBase?: Phaser.GameObjects.Ellipse;
    joystickThumb?: Phaser.GameObjects.Ellipse;
    joystickHitArea?: Phaser.Geom.Circle;
    joystickState: JoystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
    joystickCurrentDir?: Position;
    joystickRepeatEvent?: Phaser.Time.TimerEvent;
    joystickHasFired = false;
    flagBg?: Phaser.GameObjects.Ellipse;
    flagLabel?: Phaser.GameObjects.Text;
    flagHitArea?: Phaser.Geom.Circle;
    stageSelectBg?: Phaser.GameObjects.Rectangle;
    stageSelectLabel?: Phaser.GameObjects.Text;
    stageSelectHitArea?: Phaser.Geom.Rectangle;
    flagMode = false;
    /** The lit sector of the pad (drawn over the base and the thumb) and the FLAG circle's size without its frame. */
    padSectorGraphics?: Phaser.GameObjects.Graphics;
    flagBaseSize = 52;
    gameOverLogical?: LogicalAnalysis;
    gameOverStageNo = 0;
    /** The game-over buttons (backgrounds and labels) while they are on screen. */
    restartButtons?: Record<keyof RestartButtonLayout, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }>;
    /** Where the game-over buttons are now (set when they appear, redone on every resize while shown). */
    restartLayout?: RestartButtonLayout;
    /** What the gravestone panel says (set at the death), and the objects of the gravestone screen while it is shown. */
    graveInfo?: GraveInfo;
    graveDim?: Phaser.GameObjects.Rectangle;
    gravePanel?: { bg: Phaser.GameObjects.Rectangle; rows: Phaser.GameObjects.Text[] };
    /** When the gravestone screen appeared (`time.now`): the inputs of the first `GRAVE_INPUT_LOCK_MS` are ignored. */
    graveEnteredAt = 0;

    constructor ()
    {
        super('Game');
    }

    create ()
    {
        this.camera = this.cameras.main;
        this.camera.setBackgroundColor(0x0a1f2f);
        this.view = new BoardView(this, { originX: BOARD_ORIGIN_X, originY: BOARD_ORIGIN_Y, cell: CELL_SIZE });

        this.hudBand = this.add.rectangle(0, 0, this.camera.width, 0, HUD_BAND_COLOR, HUD_BAND_ALPHA)
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(HUD_BAND_DEPTH)
            .setVisible(false);

        this.messageText = this.add.text(HUD_LEFT, HUD_MESSAGE_Y, '', {
            fontFamily: 'monospace',
            fontSize: HUD_MESSAGE_FONT,
            color: '#c6deff'
        }).setScrollFactor(0).setDepth(HUD_TEXT_DEPTH);

        this.statusText = this.add.text(HUD_LEFT, 0, '', {
            fontFamily: 'monospace',
            fontSize: STATUS_FONT_MAX,
            color: '#ffffff'
        }).setScrollFactor(0).setDepth(HUD_TEXT_DEPTH);

        // Phaser reuses this instance on scene.start: the new Text objects have not been drawn with any key yet.
        this.messageKey = '';
        this.statusKey = '';
        this.legendKey = '';
        this.legendText = this.add.text(HUD_LEFT, 0, LEGEND_TEXT, {
            fontFamily: 'monospace',
            fontSize: HUD_LEGEND_FONT,
            color: '#c6deff'
        }).setScrollFactor(0).setDepth(HUD_TEXT_DEPTH).setVisible(false);

        this.goalArrow = this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: 20,
            fontStyle: 'bold',
            color: '#ffa502',
            stroke: '#0b1220',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(10);

        // Phaser reuses this instance on scene.start: a new game starts with FLAG off and no input lock.
        this.flagMode = false;
        this.inputLockUntil = 0;
        this.startFirstStage();
        this.createVirtualControls();

        this.input.keyboard?.on('keydown', this.onKeyDown, this);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.scale.on('resize', this.onResize, this);

        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown, this);
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.scale.off('resize', this.onResize, this);
            this.virtualControlLayer?.destroy(true);
            this.virtualControlLayer = undefined;
            this.joystickBase = undefined;
            this.joystickThumb = undefined;
            this.joystickHitArea = undefined;
            this.flagBg = undefined;
            this.flagLabel = undefined;
            this.flagHitArea = undefined;
            this.stageSelectBg = undefined;
            this.stageSelectLabel = undefined;
            this.stageSelectHitArea = undefined;
            this.padSectorGraphics = undefined;
            this.joystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
            this.cancelJoystickRepeat();
            this.joystickCurrentDir = undefined;
            this.joystickHasFired = false;
            this.view.destroy();
            this.restartButtons = undefined;
            this.restartLayout = undefined;
            this.graveDim = undefined;
            this.gravePanel = undefined;
            this.graveInfo = undefined;
        });
    }

    private startStage (stageNo: number): void
    {
        this.flow.reset();
        this.presses.clear();
        this.gameOverLogical = undefined;
        this.graveInfo = undefined;
        this.view.setPlayerGlyph('@');
        this.stageData = generateStage(stageNo);
        this.renderBoard();
        this.legendText.setVisible(false);
        this.refreshHud(stageStartMessage(this.inputKind(), this.stageData.stageNo));
        this.centerCameraOnPlayer(true);
    }

    private startFirstStage (): void
    {
        // `?stage=` counts for the first game of the page only; the saved start stage is read (and written) on dev only.
        const first = firstGameOfPage;
        firstGameOfPage = false;
        const start = resolveStartStage(
            new URLSearchParams(window.location.search).get('stage'),
            STAGE_BUTTON_ENABLED ? safeGetItem(this.store, START_STAGE_KEY) : null,
            { first, useSaved: STAGE_BUTTON_ENABLED }
        );
        this.startStage(start.stage);
        // Saved only once the stage has started, so an oversized value can never block later launches.
        if (start.fromQuery && STAGE_BUTTON_ENABLED) {
            safeSetItem(this.store, START_STAGE_KEY, String(start.stage));
        }
    }

    private renderBoard (): void
    {
        this.view.render(this.stageData, this.gameOverLogical);
        this.updateCameraBounds();
    }

    private collectChangedCellIndices (prevStage: Stage, nextStage: Stage): number[]
    {
        if (prevStage.cells === nextStage.cells) {
            return [];
        }

        const changed: number[] = [];
        const len = Math.min(prevStage.cells.length, nextStage.cells.length);
        for (let i = 0; i < len; i += 1) {
            const prev = prevStage.cells[i];
            const next = nextStage.cells[i];
            if (
                prev.revealed !== next.revealed ||
                prev.flagged !== next.flagged ||
                prev.hasBomb !== next.hasBomb ||
                prev.hint !== next.hint
            ) {
                changed.push(i);
            }
        }
        return changed;
    }

    private updateCameraBounds (): void
    {
        const boardWidth = this.stageData.width * CELL_SIZE + BOARD_ORIGIN_X * 2;
        const boardHeight = this.stageData.height * CELL_SIZE + BOARD_ORIGIN_Y + 40;
        this.cameraBoundsWidth = Math.max(boardWidth, this.camera.width);
        this.cameraBoundsHeight = Math.max(boardHeight, this.camera.height);
        this.camera.setBounds(0, 0, this.cameraBoundsWidth, this.cameraBoundsHeight);
    }

    private onResize (gameSize: Phaser.Structs.Size): void
    {
        this.camera.setSize(gameSize.width, gameSize.height);
        this.updateCameraBounds();
        this.centerCameraOnPlayer(true);
        this.updateGoalArrow();
        this.layoutVirtualControls();
        this.relayoutRestartButtons(gameSize.width, gameSize.height);
    }

    private createVirtualControls (): void
    {
        this.virtualControlLayer?.destroy(true);
        this.virtualControlLayer = this.add.container(0, 0).setScrollFactor(0).setDepth(30);

        // --- Joystick base (outer ring) ---
        this.joystickBase = this.add.ellipse(0, 0, JOYSTICK_BASE_RADIUS * 2, JOYSTICK_BASE_RADIUS * 2, 0x071a33, 0.55)
            .setStrokeStyle(2, 0x3b82f6, 0.65)
            .setScrollFactor(0)
            .setDepth(31);

        // --- Lit sector of the pad (over the base and the thumb: the thumb would hide most of it) ---
        this.padSectorGraphics = this.add.graphics().setScrollFactor(0).setDepth(34);

        // --- Joystick thumb ---
        this.joystickThumb = this.add.ellipse(0, 0, JOYSTICK_THUMB_RADIUS * 2, JOYSTICK_THUMB_RADIUS * 2, 0x2563eb, 0.92)
            .setStrokeStyle(2, 0x93c5fd, 0.95)
            .setScrollFactor(0)
            .setDepth(33);

        // --- FLAG button ---
        this.flagBg = this.add.ellipse(0, 0, 52, 52, 0x071a33, 0.82)
            .setStrokeStyle(2, 0x22c55e, 0.9)
            .setScrollFactor(0)
            .setDepth(31);

        this.flagLabel = this.add.text(0, 0, 'FLAG', {
            fontFamily: 'monospace',
            fontSize: 11,
            fontStyle: 'bold',
            color: '#86efac',
            stroke: '#0b1220',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

        this.virtualControlLayer.add(this.joystickBase);
        this.virtualControlLayer.add(this.joystickThumb);
        this.virtualControlLayer.add(this.padSectorGraphics);
        this.virtualControlLayer.add(this.flagBg);
        this.virtualControlLayer.add(this.flagLabel);

        if (STAGE_BUTTON_ENABLED) {
            this.stageSelectBg = this.add.rectangle(0, 0, 90, 34, 0x071a33, 0.88)
                .setStrokeStyle(2, 0xf59e0b, 0.95)
                .setScrollFactor(0)
                .setDepth(31);

            this.stageSelectLabel = this.add.text(0, 0, 'STAGE', {
                fontFamily: 'monospace',
                fontSize: 12,
                fontStyle: 'bold',
                color: '#fbbf24',
                stroke: '#0b1220',
                strokeThickness: 3,
                align: 'center'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

            this.virtualControlLayer.add(this.stageSelectBg);
            this.virtualControlLayer.add(this.stageSelectLabel);
        }

        this.updateFlagButtonVisual();
        this.layoutVirtualControls();
    }

    private updateFlagButtonVisual (): void
    {
        if (!this.flagBg || !this.flagLabel) {
            return;
        }
        if (this.flagMode) {
            this.flagBg.setFillStyle(FLAG_ON_FILL, 1);
            this.flagBg.setStrokeStyle(FLAG_ON_STROKE_WIDTH, FLAG_ON_STROKE, 1.0);
            this.flagLabel.setText('FLAG\nON').setColor(FLAG_ON_LABEL_COLOR).setStroke('#0b1220', 0);
        } else {
            this.flagBg.setFillStyle(0x071a33, 0.82);
            this.flagBg.setStrokeStyle(FLAG_OFF_STROKE_WIDTH, 0x22c55e, 0.9);
            this.flagLabel.setText('FLAG').setColor('#86efac').setStroke('#0b1220', 3);
        }
        // The frame is drawn inside the circle, so the outline (and the hit area) stays the same.
        const size = flagCircleSize(this.flagBaseSize, this.flagMode);
        this.flagBg.setSize(size, size);
        this.applyPadTheme();
    }

    /** Pad frame and thumb: blue while FLAG is off, green while it is on; the lit sector follows. */
    private applyPadTheme (): void
    {
        const colors = PAD_COLORS[padThemeOf(this.flagMode)];
        this.joystickBase?.setStrokeStyle(2, colors.frame, 0.65);
        this.joystickThumb?.setFillStyle(colors.thumbFill, 0.92);
        this.joystickThumb?.setStrokeStyle(2, colors.thumbStroke, 0.95);
        this.drawPadSector();
    }

    /** Lights the sector of the held direction (thin until the first repeat fired, thick after); clears it otherwise. */
    private drawPadSector (): void
    {
        const g = this.padSectorGraphics;
        const base = this.joystickBase;
        if (!g || !base) {
            return;
        }
        g.clear();
        const dir = this.joystickCurrentDir;
        if (!this.joystickState.active || !dir) {
            return;
        }
        const sector = JOYSTICK_DIRS.findIndex((d) => d.x === dir.x && d.y === dir.y);
        if (sector < 0) {
            return;
        }
        const arc = padSectorArc(sector);
        g.fillStyle(PAD_COLORS[padThemeOf(this.flagMode)].sector, padSectorAlpha(this.joystickHasFired));
        g.beginPath();
        g.moveTo(base.x, base.y);
        g.arc(base.x, base.y, base.width / 2, arc.start, arc.end);
        g.closePath();
        g.fillPath();
    }

    private layoutVirtualControls (): void
    {
        if (!this.joystickBase || !this.joystickThumb || !this.flagBg || !this.flagLabel) {
            return;
        }

        const W = this.camera.width;
        const H = this.camera.height;
        const compact = H <= 520 || W <= 400;
        const margin = 20;

        const baseR = compact ? Math.round(JOYSTICK_BASE_RADIUS * 0.78) : JOYSTICK_BASE_RADIUS;
        const thumbR = compact ? Math.round(JOYSTICK_THUMB_RADIUS * 0.78) : JOYSTICK_THUMB_RADIUS;
        const flagSize = compact ? 44 : 52;
        const flagFontSize = 11;

        // Joystick: bottom-left
        const jsX = margin + baseR;
        const jsY = H - margin - baseR;
        this.joystickBase.setPosition(jsX, jsY).setSize(baseR * 2, baseR * 2);
        if (!this.joystickState.active) {
            this.joystickThumb.setPosition(jsX, jsY);
        }
        this.joystickThumb.setSize(thumbR * 2, thumbR * 2);
        this.joystickHitArea = new Phaser.Geom.Circle(jsX, jsY, baseR + 14);

        // FLAG button: bottom-right
        const flagX = W - margin - flagSize / 2;
        const flagY = H - margin - flagSize / 2;
        this.flagBaseSize = flagSize;
        this.flagBg.setPosition(flagX, flagY);
        this.flagLabel.setPosition(flagX, flagY).setFontSize(flagFontSize);
        this.flagHitArea = new Phaser.Geom.Circle(flagX, flagY, flagSize / 2 + 10);

        if (this.stageSelectBg && this.stageSelectLabel) {
            const stageW = compact ? 82 : 90;
            const stageH = compact ? 30 : 34;
            const stageX = W - margin - stageW / 2;
            const stageY = margin + stageH / 2;
            this.stageSelectBg.setPosition(stageX, stageY).setSize(stageW, stageH);
            this.stageSelectLabel.setPosition(stageX, stageY).setFontSize(compact ? 11 : 12);
            this.stageSelectHitArea = new Phaser.Geom.Rectangle(stageX - stageW / 2, stageY - stageH / 2, stageW, stageH);
        }

        // The FLAG circle (its frame is inside it), the pad colours and the lit sector follow the new layout.
        this.updateFlagButtonVisual();

        // The HUD rows stay left of the STAGE button (when there is one): lay them out again with its size.
        this.layoutHud();
    }

    private promptAndStartStage (): void
    {
        if (!STAGE_BUTTON_ENABLED) {
            return;
        }
        const current = Math.min(this.stageData?.stageNo ?? 1, STAGE_MAX);
        const answer = parseStagePrompt(window.prompt(`Start stage number (1-${STAGE_MAX})`, String(current)));
        if (answer.kind === 'cancel') {
            return;
        }
        if (answer.kind === 'invalid') {
            this.refreshHud(invalidStageMessage(STAGE_MAX));
            return;
        }

        const selected = answer.stage;
        this.hideRestartButtons();
        this.discardPointerState();
        this.time.removeAllEvents();
        this.startStage(selected);
        safeSetItem(this.store, START_STAGE_KEY, String(selected));
        this.refreshHud(jumpMessage(selected));
    }

    private updateJoystickThumb (px: number, py: number): void
    {
        if (!this.joystickBase || !this.joystickThumb) {
            return;
        }
        const baseR = this.joystickBase.width / 2;
        const maxR = baseR - this.joystickThumb.width / 2 - 2;
        const dx = px - this.joystickBase.x;
        const dy = py - this.joystickBase.y;
        const dist = Math.hypot(dx, dy);
        const ratio = dist > 0 ? Math.min(1, maxR / dist) : 0;
        this.joystickThumb.setPosition(
            this.joystickBase.x + dx * ratio,
            this.joystickBase.y + dy * ratio
        );

        // Repeat input when stick is held in a direction
        const sector = padSectorOf(dx, dy);
        if (sector !== null) {
            const dir = JOYSTICK_DIRS[sector];
            const dirChanged = !this.joystickCurrentDir ||
                this.joystickCurrentDir.x !== dir.x ||
                this.joystickCurrentDir.y !== dir.y;
            if (dirChanged) {
                this.joystickCurrentDir = dir;
                this.cancelJoystickRepeat();
                this.joystickRepeatEvent = this.time.addEvent({
                    delay: JOYSTICK_REPEAT_DELAY,
                    callback: () => {
                        this.fireJoystickDirection();
                        if (!this.joystickCurrentDir || !this.flow.playing) {
                            // The first repeat step ended the stage (death / goal) and released the pad.
                            return;
                        }
                        this.joystickRepeatEvent = this.time.addEvent({
                            delay: JOYSTICK_REPEAT_INTERVAL,
                            callback: this.fireJoystickDirection,
                            callbackScope: this,
                            loop: true
                        });
                    },
                    callbackScope: this
                });
            }
        } else {
            this.cancelJoystickRepeat();
            this.joystickCurrentDir = undefined;
        }
        this.drawPadSector();
    }

    private fireJoystickDirection (): void
    {
        if (!this.joystickCurrentDir || !this.flow.playing) {
            return;
        }
        this.joystickHasFired = true;
        this.drawPadSector();
        this.applyDirectionInput(this.joystickCurrentDir, this.flagMode);
    }

    private cancelJoystickRepeat (): void
    {
        this.joystickRepeatEvent?.remove(false);
        this.joystickRepeatEvent = undefined;
    }

    /** Death, goal and the STAGE jump: forget every press and the pad, so nothing acts on a later release. */
    private discardPointerState (): void
    {
        this.presses.clear();
        this.resetJoystickThumb();
        this.dragState.active = false;
    }

    private resetJoystickThumb (): void
    {
        this.cancelJoystickRepeat();
        this.joystickCurrentDir = undefined;
        this.joystickHasFired = false;
        this.joystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
        if (this.joystickBase && this.joystickThumb) {
            this.joystickThumb.setPosition(this.joystickBase.x, this.joystickBase.y);
        }
        this.drawPadSector();
    }

    private resolveJoystick (upX: number, upY: number): void
    {
        if (!this.flow.playing || this.time.now < this.inputLockUntil) {
            return;
        }

        // Already moved via repeat: don't fire again on release
        if (this.joystickHasFired) {
            return;
        }

        const dx = upX - this.joystickState.startX;
        const dy = upY - this.joystickState.startY;
        const dist = Math.hypot(dx, dy);

        if (dist < JOYSTICK_TAP_THRESHOLD) {
            // Tap → Chord
            const out = chordAtPlayer(this.stageData);
            if (out.result.status === 'alive' && out.stage === this.stageData) {
                this.refreshHud(this.messageOf(out));
                return;
            }
            this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message);
            return;
        }

        // Short drag released before first repeat: fire once
        const sector = sectorOfAngle((Math.atan2(dy, dx) * 180) / Math.PI);
        this.applyDirectionInput(JOYSTICK_DIRS[sector], this.flagMode);
    }

    /** HUD wording of a move / chord result (spec "メッセージの文言"). */
    private messageOf (out: { result: { status: 'alive' | 'dead' | 'goal'; message?: string }; changedCellIndices?: number[] }): string
    {
        return resultMessage(out.result.status, out.result.message, out.changedCellIndices?.length ?? 0, this.inputKind());
    }

    /** The input kind (keys / touch) the HUD wording follows; the first value comes from the device. */
    private inputKind (): InputKind
    {
        sessionInputKind ??= initialInputKind(typeof navigator === 'undefined' ? undefined : navigator.maxTouchPoints);
        return sessionInputKind;
    }

    /** Puts `message` on the message line and rebuilds the status line from the current stage and high score. */
    private refreshHud (message: string): void
    {
        this.hudMessage = message;
        this.layoutHud();

        if (import.meta.env.DEV) {
            // QA only: a read-only view of the state (never part of the production bundle).
            const flow = this.flow;
            const stage = this.stageData;
            (window as unknown as { __qa?: unknown }).__qa = {
                get phase () { return flow.phase; },
                message,
                status: this.statusText.text,
                stage: stage.stageNo,
                width: stage.width,
                height: stage.height,
                player: { x: stage.player.x, y: stage.player.y },
                goal: { x: stage.goal.x, y: stage.goal.y },
                bombs: stage.cells.map((cell) => cell.hasBomb)
            };
        }
    }

    /**
     * Lays the HUD rows out (spec "HUD のメッセージとステータス"): message, status, then the legend (game over).
     * Message and status stay left of the STAGE button; the legend sits below the button.
     */
    private layoutHud (): void
    {
        const area = this.stageSelectHitArea;
        const rowWidth = hudRowWidth(this.camera.width, STAGE_BUTTON_ENABLED ? (area?.width ?? DEFAULT_STAGE_BUTTON_WIDTH) : null);

        // Redrawing a Text re-uploads its texture: only rows whose width or text changed are drawn again.
        const messageKey = `${rowWidth}|${this.hudMessage}`;
        if (messageKey !== this.messageKey) {
            this.messageKey = messageKey;
            this.messageText.setWordWrapWidth(rowWidth, true).setText(this.hudMessage);
        }
        this.messageText.setPosition(HUD_LEFT, HUD_MESSAGE_Y);

        const highscore = currentHighScore(this.store, HIGHSCORE_KEY, sessionBest);
        const status = statusLine(this.stageData.stageNo, highscore);
        const statusKey = `${rowWidth}|${status}`;
        if (statusKey !== this.statusKey) {
            this.statusKey = statusKey;
            this.statusText.setWordWrapWidth(0);
            this.statusText.setText(status);
            const fit = fitFontSize((size) => this.statusText.setFontSize(size).width, rowWidth);
            this.statusText.setFontSize(fit.size);
            if (fit.wrap) {
                this.statusText.setWordWrapWidth(rowWidth, true);
            }
        }
        this.statusText.setPosition(HUD_LEFT, this.messageText.y + this.messageText.height + HUD_GAP);

        if (this.legendText.visible) {
            const statusBottom = this.statusText.y + this.statusText.height;
            const legendKey = `${this.camera.width}`;
            if (legendKey !== this.legendKey) {
                this.legendKey = legendKey;
                this.legendText.setWordWrapWidth(this.camera.width - 2 * HUD_LEFT, true);
            }
            this.legendText.setPosition(HUD_LEFT, hudLegendTop(statusBottom, area ? area.bottom : null, HUD_GAP));
        }

        // The band covers every visible row: it follows wraps, the legend row and resizes.
        const bottoms = [this.messageText.y + this.messageText.height, this.statusText.y + this.statusText.height];
        if (this.legendText.visible) {
            bottoms.push(this.legendText.y + this.legendText.height);
        }
        const bandHeight = hudBandHeight(bottoms);
        this.hudBand.setSize(this.camera.width, bandHeight).setVisible(bandHeight > 0);
    }

    private revealAllBombs (): void
    {
        for (const cell of this.stageData.cells) {
            if (cell.hasBomb) {
                cell.revealed = true;
            }
        }
    }

    private centerCameraOnPlayer (force = false): void
    {
        const px = BOARD_ORIGIN_X + this.stageData.player.x * CELL_SIZE + CELL_SIZE / 2;
        const py = BOARD_ORIGIN_Y + this.stageData.player.y * CELL_SIZE + CELL_SIZE / 2;

        if (!force) {
            const margin = CAMERA_FOLLOW_MARGIN_CELLS * CELL_SIZE;
            const left = this.camera.scrollX + margin;
            const top = this.camera.scrollY + margin;
            const right = this.camera.scrollX + this.camera.width - margin;
            const bottom = this.camera.scrollY + this.camera.height - margin;
            if (px >= left && px <= right && py >= top && py <= bottom) {
                this.updateGoalArrow();
                return;
            }
        }

        const halfW = this.camera.width / 2;
        const halfH = this.camera.height / 2;
        const minX = halfW;
        const minY = halfH;
        const maxX = Math.max(halfW, this.cameraBoundsWidth - halfW);
        const maxY = Math.max(halfH, this.cameraBoundsHeight - halfH);
        const clampedX = Math.min(maxX, Math.max(minX, px));
        const clampedY = Math.min(maxY, Math.max(minY, py));

        this.camera.centerOn(clampedX, clampedY);
        this.roundCameraScroll();
        this.updateGoalArrow();
    }

    /**
     * Keeps the camera on whole pixels: an odd screen width puts the scroll on a half pixel, which shifts
     * the cell edges of the board's render textures against the rest of the picture (docs/spec/board-render.md).
     */
    private roundCameraScroll (): void
    {
        this.camera.setScroll(Math.round(this.camera.scrollX), Math.round(this.camera.scrollY));
    }

    private updateGoalArrow (): void
    {
        if (!this.stageData) {
            return;
        }

        const goal = this.stageData.goal;
        const gx = BOARD_ORIGIN_X + goal.x * CELL_SIZE + CELL_SIZE / 2;
        const gy = BOARD_ORIGIN_Y + goal.y * CELL_SIZE + CELL_SIZE / 2;

        const camLeft = this.camera.scrollX;
        const camTop = this.camera.scrollY;
        const camRight = camLeft + this.camera.width;
        const camBottom = camTop + this.camera.height;

        const visible = gx >= camLeft && gx <= camRight && gy >= camTop && gy <= camBottom;
        if (visible) {
            this.goalArrow.setText('');
            return;
        }

        const PAD = 30;
        const screenW = this.camera.width;
        const screenH = this.camera.height;

        // Direction from screen center to goal in screen-space
        const goalScreenX = gx - camLeft;
        const goalScreenY = gy - camTop;
        const dx = goalScreenX - screenW / 2;
        const dy = goalScreenY - screenH / 2;

        // Arrow character: atan2(dy, dx), 0° = right
        const angle = Math.atan2(dy, dx);
        const deg = ((angle * 180 / Math.PI) + 360) % 360;
        const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
        const arrow = ARROWS[Math.round(deg / 45) % 8];

        // Intersect ray from screen center toward goal with screen border
        const tx = dx !== 0
            ? (dx > 0 ? (screenW - PAD - screenW / 2) / dx : (PAD - screenW / 2) / dx)
            : Infinity;
        const ty = dy !== 0
            ? (dy > 0 ? (screenH - PAD - screenH / 2) / dy : (PAD - screenH / 2) / dy)
            : Infinity;
        const t = Math.min(tx, ty);

        const edgeX = Math.min(screenW - PAD, Math.max(PAD, screenW / 2 + dx * t));
        const edgeY = Math.min(screenH - PAD, Math.max(PAD, screenH / 2 + dy * t));

        this.goalArrow.setText(`GOAL ${arrow}`);
        this.goalArrow.setPosition(edgeX, edgeY).setOrigin(0.5);
    }

    private onKeyDown (event: KeyboardEvent): void
    {
        sessionInputKind = inputKindOfKey();
        if (this.flow.awaitingRestart) {
            if (this.flow.onGrave && graveLocked(this.time.now, this.graveEnteredAt)) {
                return;
            }
            const action = gameOverKeyAction(this.flow.onGrave ? 'grave' : 'gameover', event.code, event.repeat);
            if (action === 'grave') {
                this.enterGrave();
            } else if (action !== 'none') {
                this.doRestart(action);
            }
            return;
        }

        if (!this.flow.playing) {
            return;
        }

        if (event.repeat || this.time.now < this.inputLockUntil) {
            return;
        }

        const direction = this.mapDirection(event.code);
        if (!direction) {
            if (event.code === 'KeyS' || event.code === 'Numpad5') {
                const out = chordAtPlayer(this.stageData);
                if (out.result.status === 'alive' && out.stage === this.stageData) {
                    this.refreshHud(this.messageOf(out));
                    return;
                }
                this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message);
            }
            return;
        }

        this.applyDirectionInput(direction, event.shiftKey);
    }

    private applyDirectionInput (direction: Position, asFlag: boolean): void
    {
        if (asFlag) {
            const target = {
                x: this.stageData.player.x + direction.x,
                y: this.stageData.player.y + direction.y
            };
            const nextStage = toggleFlag(this.stageData, target);
            const changedCellIndices = nextStage === this.stageData ? [] : [indexOf(this.stageData, target)];
            const after = nextStage === this.stageData ? null : nextStage.cells[indexOf(nextStage, target)].flagged;
            this.applyResult(nextStage, 'alive', flagMessage(after), changedCellIndices);
            return;
        }

        const out = moveByDelta(this.stageData, direction.x, direction.y);
        this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message);
    }

    private mapDirection (code: string): Position | null
    {
        const mapping: Record<string, Position> = {
            ArrowUp: { x: 0, y: -1 },
            ArrowDown: { x: 0, y: 1 },
            ArrowLeft: { x: -1, y: 0 },
            ArrowRight: { x: 1, y: 0 },
            KeyW: { x: 0, y: -1 },
            KeyX: { x: 0, y: 1 },
            KeyA: { x: -1, y: 0 },
            KeyD: { x: 1, y: 0 },
            KeyQ: { x: -1, y: -1 },
            KeyE: { x: 1, y: -1 },
            KeyZ: { x: -1, y: 1 },
            KeyC: { x: 1, y: 1 },
            Numpad8: { x: 0, y: -1 },
            Numpad2: { x: 0, y: 1 },
            Numpad4: { x: -1, y: 0 },
            Numpad6: { x: 1, y: 0 },
            Numpad7: { x: -1, y: -1 },
            Numpad9: { x: 1, y: -1 },
            Numpad1: { x: -1, y: 1 },
            Numpad3: { x: 1, y: 1 }
        };

        return mapping[code] ?? null;
    }

    private hasVisibleStageChange (prevStage: Stage, nextStage: Stage, changedCellIndices?: number[]): boolean
    {
        if (prevStage === nextStage) {
            return false;
        }

        if (
            prevStage.stageNo !== nextStage.stageNo ||
            prevStage.width !== nextStage.width ||
            prevStage.height !== nextStage.height ||
            prevStage.start.x !== nextStage.start.x ||
            prevStage.start.y !== nextStage.start.y ||
            prevStage.goal.x !== nextStage.goal.x ||
            prevStage.goal.y !== nextStage.goal.y
        ) {
            return true;
        }

        if (changedCellIndices != null) {
            return changedCellIndices.length > 0;
        }

        if (prevStage.cells === nextStage.cells) {
            return false;
        }

        const len = prevStage.cells.length;
        if (len !== nextStage.cells.length) {
            return true;
        }

        for (let i = 0; i < len; i += 1) {
            const prev = prevStage.cells[i];
            const next = nextStage.cells[i];
            if (prev.revealed !== next.revealed || prev.flagged !== next.flagged) {
                return true;
            }
        }

        return false;
    }

    private applyResult (
        nextStage: Stage,
        status: 'alive' | 'dead' | 'goal',
        message: string,
        changedCellIndices?: number[],
        ruleMessage?: string
    ): void
    {
        if (!this.flow.playing) {
            return;
        }

        const prevStage = this.stageData;
        const hasVisibleChange = this.hasVisibleStageChange(prevStage, nextStage, changedCellIndices);
        const useDiffRender = status === 'alive' && hasVisibleChange && this.view.canDiff(prevStage, nextStage, this.gameOverLogical);
        this.stageData = nextStage;

        if (status === 'goal') {
            this.renderBoard();
        } else if (status === 'alive' && useDiffRender) {
            const changedIndices = changedCellIndices ?? this.collectChangedCellIndices(prevStage, nextStage);
            this.view.renderChanged(this.stageData, changedIndices, this.gameOverLogical);
        } else if (status === 'alive' && hasVisibleChange) {
            this.renderBoard();
        }

        this.view.updatePlayer(this.stageData);
        this.centerCameraOnPlayer();

        if (status === 'dead') {
            this.flow.die();
            this.discardPointerState();
            this.gameOverStageNo = this.stageData.stageNo;
            const score = this.stageData.stageNo - 1;
            const previousHigh = currentHighScore(this.store, HIGHSCORE_KEY, sessionBest);
            recordScore(this.store, HIGHSCORE_KEY, sessionBest, score);
            this.graveInfo = {
                stageNo: this.stageData.stageNo,
                cause: graveCauseOf(ruleMessage),
                high: currentHighScore(this.store, HIGHSCORE_KEY, sessionBest),
                record: isNewRecord(score, previousHigh)
            };
            this.view.setPlayerGlyph('†');
            this.gameOverLogical = analyzeCurrentState(this.stageData);
            this.revealAllBombs();
            this.renderBoard();
            this.centerCameraOnPlayer(true);
            this.legendText.setVisible(true);
            this.refreshHud(resultMessage('dead', undefined, 0, this.inputKind()));
            // After DeathDelay the revealed bombs take input; the buttons come with the gravestone screen.
            this.time.delayedCall(DEATH_DELAY_MS, () => {
                this.flow.showRestart();
            });
            return;
        }

        if (status === 'goal') {
            this.flow.reachGoal();
            this.discardPointerState();
            this.refreshHud(resultMessage('goal', undefined, 0, this.inputKind()));
            this.time.delayedCall(CLEAR_DELAY_MS, () => this.startStage(this.stageData.stageNo + 1));
            return;
        }

        this.refreshHud(message);
    }

    /** Second stage of the game over: dims the board, puts the panel over it and shows the three buttons. */
    private enterGrave (): void
    {
        if (!this.flow.showGrave()) {
            return;
        }
        // A finger that went down on the revealed bombs does nothing when it lifts (spec: only presses after this one act).
        this.presses.clear();
        this.graveEnteredAt = this.time.now;
        this.showGravePanel();
        this.showRestartButtons();
    }

    private showGravePanel (): void
    {
        this.graveDim = this.add.rectangle(0, 0, this.camera.width, this.camera.height, GRAVE_DIM_COLOR, GRAVE_DIM_ALPHA)
            .setOrigin(0).setScrollFactor(0).setDepth(GRAVE_DIM_DEPTH);
        this.gravePanel = {
            bg: this.add.rectangle(0, 0, 1, 1, GRAVE_PLATE_COLOR, GRAVE_PLATE_ALPHA)
                .setScrollFactor(0).setDepth(GRAVE_PLATE_DEPTH),
            rows: []
        };
        this.layoutGravePanel();
    }

    /** Sizes the dim to the screen and puts the tombstone art (rows of one monospace font) and its plate where the layout says. */
    private layoutGravePanel (): void
    {
        const panel = this.gravePanel;
        const info = this.graveInfo;
        if (!panel || !info || !this.graveDim) {
            return;
        }
        this.graveDim.setSize(this.camera.width, this.camera.height);
        const layout = gravePanelLayout(this.camera.width, this.camera.height, this.hudBand.height, info);
        for (const text of panel.rows) {
            text.destroy();
        }
        // A row with "New record!" is two lines of equal length drawn over each other (body colour, accent words),
        // so the walls beside the words keep the body colour. `rows` keeps every Text, the base of row 0 first.
        const drawLine = (text: string, y: number, color: string): Phaser.GameObjects.Text => this.add.text(layout.centerX, y, text, {
            fontFamily: 'monospace',
            fontSize: GRAVE_ART_FONT,
            color
        }).setOrigin(0.5).setScrollFactor(0).setDepth(GRAVE_TEXT_DEPTH);
        panel.rows = [];
        layout.rows.forEach((row, i) => {
            const parts = graveRowParts(row);
            panel.rows.push(drawLine(parts.base, layout.rowCenterY[i], GRAVE_TEXT_COLOR));
            if (parts.accent !== null) {
                panel.rows.push(drawLine(parts.accent, layout.rowCenterY[i], GRAVE_RECORD_COLOR));
            }
        });
        // Every row has the same number of characters, so one measured row gives the width of one character.
        const first = panel.rows[0];
        const charWidth = first && first.text.length > 0 ? first.width / first.text.length : 0;
        panel.bg.setSize(gravePlateWidth(layout.rows, charWidth), layout.height)
            .setPosition(layout.centerX, layout.top + layout.height / 2);
    }

    private hideGravePanel (): void
    {
        this.graveDim?.destroy();
        this.graveDim = undefined;
        this.gravePanel?.bg.destroy();
        for (const text of this.gravePanel?.rows ?? []) {
            text.destroy();
        }
        this.gravePanel = undefined;
    }

    private showRestartButtons (): void
    {
        const layout = restartButtonLayout(this.camera.width, this.camera.height);
        this.restartLayout = layout;
        this.restartButtons = {
            retry: this.makeRestartButton(layout.retry, 'RETRY [R]', 0x1e3a5f, 0x60a5fa, '#93c5fd'),
            newGame: this.makeRestartButton(layout.newGame, 'NEW GAME', 0x1a1a2e, 0x6b7280, '#9ca3af'),
            title: this.makeRestartButton(layout.title, 'TITLE [T]', 0x1a1a2e, 0x6b7280, '#9ca3af')
        };
    }

    /**
     * Moves the shown game-over buttons for the new screen size; does nothing while they are not shown
     * (before `DeathDelay` ends, or after they were taken away).
     */
    private relayoutRestartButtons (width: number, height: number): void
    {
        this.layoutGravePanel();
        const buttons = this.restartButtons;
        if (!buttons) {
            return;
        }
        const layout = restartButtonLayout(width, height);
        this.restartLayout = layout;
        for (const key of ['retry', 'newGame', 'title'] as const) {
            buttons[key].bg.setPosition(layout[key].x, layout[key].y);
            buttons[key].label.setPosition(layout[key].x, layout[key].y);
        }
    }

    private makeRestartButton (
        box: ButtonBox, text: string, fill: number, stroke: number, color: string
    ): { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }
    {
        const bg = this.add.rectangle(box.x, box.y, box.width, box.height, fill, 0.95)
            .setStrokeStyle(2, stroke)
            .setScrollFactor(0).setDepth(50).setOrigin(0.5, 0.5);
        const label = this.add.text(box.x, box.y, text, {
            fontFamily: 'monospace', fontSize: 15, fontStyle: 'bold', color
        }).setScrollFactor(0).setDepth(51).setOrigin(0.5, 0.5);
        return { bg, label };
    }

    private hideRestartButtons (): void
    {
        if (this.restartButtons) {
            for (const { bg, label } of Object.values(this.restartButtons)) {
                bg.destroy();
                label.destroy();
            }
        }
        this.restartButtons = undefined;
        this.restartLayout = undefined;
        this.hideGravePanel();
    }

    private doRestart (choice: RestartChoice): void
    {
        if (!this.flow.beginRestart()) {
            return;
        }
        this.hideRestartButtons();
        if (choice === 'retry') {
            this.startStage(this.gameOverStageNo);
        } else if (choice === 'title') {
            this.scene.start('Title');
        } else {
            this.scene.start('Game');
        }
    }

    private onPointerDown (pointer: Phaser.Input.Pointer): void
    {
        sessionInputKind = inputKindOfPointer(pointer.wasTouch);
        if (this.stageSelectHitArea && Phaser.Geom.Rectangle.Contains(this.stageSelectHitArea, pointer.x, pointer.y)) {
            this.presses.begin(pointer.id, 'button');
            this.promptAndStartStage();
            return;
        }

        if (this.flow.awaitingRestart) {
            // Only a press that starts after the screen took input (and after the gravestone lock) can act.
            if (!this.flow.onGrave || !graveLocked(this.time.now, this.graveEnteredAt)) {
                this.presses.begin(pointer.id, 'restart');
            }
            return;
        }

        if (!this.flow.playing) {
            return;
        }

        // FLAG button
        if (this.flagHitArea && Phaser.Geom.Circle.Contains(this.flagHitArea, pointer.x, pointer.y)) {
            this.presses.begin(pointer.id, 'button');
            this.flagMode = !this.flagMode;
            this.updateFlagButtonVisual();
            this.refreshHud(flagModeMessage(this.flagMode));
            return;
        }

        // Joystick area
        if (this.joystickHitArea && Phaser.Geom.Circle.Contains(this.joystickHitArea, pointer.x, pointer.y)) {
            this.presses.begin(pointer.id, 'pad');
            this.joystickState = {
                active: true,
                pointerId: pointer.id,
                startX: pointer.x,
                startY: pointer.y
            };
            this.updateJoystickThumb(pointer.x, pointer.y);
            return;
        }

        this.presses.begin(pointer.id, 'board');
        this.dragState = {
            active: false,
            startX: pointer.x,
            startY: pointer.y,
            lastX: pointer.x,
            lastY: pointer.y
        };
    }

    private onPointerMove (pointer: Phaser.Input.Pointer): void
    {
        if (!this.flow.playing) {
            return;
        }

        // Update joystick thumb
        if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
            if (pointer.isDown) {
                this.updateJoystickThumb(pointer.x, pointer.y);
            }
            return;
        }

        // Only a press accepted on the board may scroll (a finger held across a death / goal / jump may not).
        if (!pointer.isDown || !this.presses.holds(pointer.id, 'board')) {
            return;
        }

        const dxFromStart = pointer.x - this.dragState.startX;
        const dyFromStart = pointer.y - this.dragState.startY;
        const distance = Math.hypot(dxFromStart, dyFromStart);

        if (!this.dragState.active && distance >= SCROLL_THRESHOLD) {
            this.dragState.active = true;
            this.dragCarryX = 0;
            this.dragCarryY = 0;
        }

        if (this.dragState.active) {
            // Whole pixels only (see roundCameraScroll); the fraction of a pointer move is carried to the next one.
            this.dragCarryX += pointer.x - this.dragState.lastX;
            this.dragCarryY += pointer.y - this.dragState.lastY;
            const stepX = Math.trunc(this.dragCarryX);
            const stepY = Math.trunc(this.dragCarryY);
            this.dragCarryX -= stepX;
            this.dragCarryY -= stepY;
            this.camera.scrollX -= stepX;
            this.camera.scrollY -= stepY;
            this.roundCameraScroll();
            this.updateGoalArrow();
        }

        this.dragState.lastX = pointer.x;
        this.dragState.lastY = pointer.y;
    }

    private onPointerUp (pointer: Phaser.Input.Pointer): void
    {
        if (pointer.wasCanceled) {
            // A touch the system cancelled never acts: drop what it started.
            const ownsDrag = this.presses.holds(pointer.id, 'board');
            this.presses.cancel(pointer.id);
            if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
                this.resetJoystickThumb();
            }
            if (ownsDrag) {
                this.dragState.active = false;
            }
            return;
        }

        const press = this.presses.end(pointer.id);
        if (press === null) {
            return;
        }

        if (press === 'restart') {
            if (!this.flow.awaitingRestart) {
                return;
            }
            if (!this.flow.onGrave) {
                // A release on the revealed bombs goes on to the gravestone screen, wherever it is.
                this.enterGrave();
                return;
            }
            // The release position chooses: TITLE, RETRY, or (anywhere else, NEW GAME included) a new game.
            if (this.restartLayout) {
                this.doRestart(restartButtonAt(this.restartLayout, pointer.x, pointer.y));
            }
            return;
        }

        if (!this.flow.playing) {
            return;
        }

        // Resolve joystick
        if (press === 'pad') {
            if (this.joystickState.active && pointer.id === this.joystickState.pointerId) {
                this.resolveJoystick(pointer.x, pointer.y);
                this.resetJoystickThumb();
            }
            return;
        }

        if (this.dragState.active) {
            this.inputLockUntil = this.time.now + INPUT_LOCK_MS;
            return;
        }

        if (this.time.now < this.inputLockUntil) {
            return;
        }

        const world = pointer.positionToCamera(this.camera) as Phaser.Math.Vector2;
        const gx = Math.floor((world.x - BOARD_ORIGIN_X) / CELL_SIZE);
        const gy = Math.floor((world.y - BOARD_ORIGIN_Y) / CELL_SIZE);
        const target = { x: gx, y: gy };

        if (!inBounds(this.stageData, target)) {
            return;
        }

        const dx = Math.abs(target.x - this.stageData.player.x);
        const dy = Math.abs(target.y - this.stageData.player.y);
        if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
            return;
        }

        const out = movePlayer(this.stageData, target);
        this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message);
    }
}
