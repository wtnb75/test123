import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { generateFloor } from '../core/generator';
import { CORRIDOR_GLYPH, advanceCorridor, corridorCellAt, corridorReach, corridorState } from '../core/corridor';
import { cellAtWorld, exitMarkers, type ExitTarget, type FloorMap } from '../core/floorLayout';
import {
    BOARD_AREA_SIDE,
    BOARD_AREA_TOP,
    PAD_BASE_RADIUS,
    PAD_COMPACT_SCALE,
    boardArea,
    boardCell,
    cameraScrollRange,
    centerScroll,
    followScroll,
    padBaseRadius,
    roomFits,
    type BoardArea,
    type ScrollRange
} from '../core/boardFit';
import { FloorState, type DoorRoute } from '../core/floor';
import type { FloorGraph } from '../core/floorGraph';
import { moveByDelta, chordAtPlayer, movePlayer, toggleFlag } from '../core/rules';
import { RUN_STEP_MS, flagWaitAction, isDoorExit, runBlockAt, runSteps } from '../core/run';
import { inBounds, indexOf } from '../core/board';
import { analyzeCurrentState } from '../core/solver';
import { GLYPH_OUTLINE_COLOR, scaledDimension, scaledFont } from '../core/cellAppearance';
import { roomExits } from '../core/exits';
import { isBlockedViKey, isRepeatedPress, viKeyDirection, type KeyPress } from '../core/moveKeys';
import {
    CONTROL_MARGIN,
    controlsLayout,
    mapAccepted,
    mapAlpha,
    mapKeyPressed,
    mapShapes,
    mapView,
    type MapView
} from '../core/mapOverlay';
import type { LogicalAnalysis } from '../core/solver';
import type { Position, Stage } from '../core/types';
import { REFERENCE_CELL } from '../core/title';
import { BoardView } from './boardView';
import { PressTracker, StageFlow, gameOverKeyAction } from '../core/flow';
import {
    GRAVE_ART_FONT,
    GRAVE_CHAR_WIDTH,
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
    ENTER_ROOM_MESSAGE,
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
    FLAG_WAIT_MESSAGE,
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

const BOARD_ORIGIN_X = BOARD_AREA_SIDE;
const BOARD_ORIGIN_Y = BOARD_AREA_TOP;
/** Space under the floor's last row that the camera may show (px). */
const BOARD_BOTTOM_MARGIN = 40;
const CAMERA_FOLLOW_MARGIN_CELLS = 4;
const SCROLL_THRESHOLD = 8;
const INPUT_LOCK_MS = 100;
const HIGHSCORE_KEY = 'minefield-rogue-highscore';
const START_STAGE_KEY = 'minefield-rogue-start-stage';
const DEATH_DELAY_MS = 600;
const CLEAR_DELAY_MS = 250;
/** The corridor's "#" marks sit above the board layers and under the player's highlight (depth 5). */
const CORRIDOR_MARK_DEPTH = 3;
/** Exit arrows: how many at most (a room's entry, two exits and two loop doors), and the gap below the HUD band (spec `ExitArrowTopGap`). */
const EXIT_ARROW_COUNT = 5;
const EXIT_ARROW_TOP_GAP = 18;
/** The STAGE button (and its prompt) exists only on the dev server, never in the production build. */
const STAGE_BUTTON_ENABLED = import.meta.env.DEV;
/** The floor map sits above the "@" mark (depth 6) and under the HUD band (7); its "?" and stairs signs just over it. */
const MAP_DEPTH = 6.2;
const MAP_TEXT_DEPTH = 6.3;
/** The player's dot is the front-most part of the map (over the signs). */
const MAP_DOT_DEPTH = 6.4;
const MAP_COLORS = {
    panel: 0x0a1f2f,
    panelAlpha: 0.88,
    room: 0x1f3b57,
    roomCurrent: 0x2f6fa3,
    outline: 0x6f8197,
    corridor: 0xa4b0be,
    door: 0x74b9ff,
    line: 0xffd166,
    player: 0xffffff,
    up: '#7bed9f',
    down: '#ffa502',
    question: '#ffd166'
} as const;

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

const JOYSTICK_BASE_RADIUS = PAD_BASE_RADIUS;
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
    /** The exit arrows (docs/spec/rooms-and-floors.md: up to three, a branching room's entry and two exits). */
    exitArrows: Phaser.GameObjects.Text[] = [];
    /** The board drawings: room A from the start, room B once the player has entered it (each room keeps its own). */
    private views: Array<BoardView | undefined> = [];
    /** Where the rooms and the corridors sit on the floor's grid. */
    private layout!: FloorMap;
    stageData!: Stage;
    /** The three rooms of the floor (A, B, C) and the one the player is in (docs/spec/rooms-and-floors.md). */
    floorState = new FloorState([]);
    /** The "#" marks of each corridor (made at the first walk through it), the time walked and which way. */
    private corridorMarks: Array<Phaser.GameObjects.Text[] | undefined> = [];
    /** The walk in progress: which corridor, which way and which door of the room it started from. */
    private corridorRoute: DoorRoute & { doorIndex: number } = { corridor: 0, forward: true, to: 1, toDoor: 0, doorIndex: 0 };
    private corridorElapsed = 0;
    /** The cell of the walk the player is drawn on (`-1`: none yet), so an unchanged cell is not drawn again. */
    private corridorDrawn = -1;
    /** The last press handled (its code and time stamp), so a second report of it is not handled again. */
    private lastKeyPress?: KeyPress;
    /** True when the walk goes from room A to room B (first cell to last), false on the way back. */
    private corridorForward = true;
    /** The size of one cell (px) on this floor and screen, the play area, and the scrolls the camera may take (docs/spec/board-render.md "盤面の大きさと位置"). */
    private cell = REFERENCE_CELL;
    private floorNo = 1;
    private area: BoardArea = boardArea(0, 0);
    /** The range the camera may take (the floor's, widened to the centring scrolls: a drag and the centring), and the floor's own (the follow). */
    private scrollRange: ScrollRange = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    private followRange: ScrollRange = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
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
    /** The run in progress (docs/spec.md "走る"): its direction and the time of its next step. */
    private run?: { dir: Position; left: number; nextAt: number };
    /** `f` was pressed: the next move key sets the flag of that neighbour; the message to restore if it is cancelled. */
    private flagWait = false;
    private messageBeforeWait = '';
    /** The lit sector of the pad (drawn over the base and the thumb) and the FLAG circle's size without its frame. */
    padSectorGraphics?: Phaser.GameObjects.Graphics;
    flagBaseSize = 52;
    /** The floor map (docs/spec/floor-map.md): its drawing, its signs, the time since it was shown (`null`: hidden). */
    private mapGraphics?: Phaser.GameObjects.Graphics;
    private mapDotGraphics?: Phaser.GameObjects.Graphics;
    private mapTexts: Phaser.GameObjects.Text[] = [];
    private mapElapsed: number | null = null;
    /** True for the update of the frame the map was shown in: that frame's delta is not counted. */
    private mapSkipDelta = false;
    private mapPlace?: MapView;
    /** `''`: the map has to be drawn again; otherwise what it was last drawn with is in `mapStamp`. */
    private mapKey = '';
    private mapStamp = { progress: -1, room: -1, x: -1, y: -1 };
    private mapRooms: Stage[] = [];
    private mapGraph: FloorGraph = { startRoom: 0, corridors: [] };
    mapBg?: Phaser.GameObjects.Ellipse;
    mapLabel?: Phaser.GameObjects.Text;
    mapHitArea?: Phaser.Geom.Circle;
    gameOverLogical?: LogicalAnalysis;
    gameOverStageNo = 0;
    /** The game-over buttons (backgrounds and labels) while they are on screen. */
    restartButtons?: Record<keyof RestartButtonLayout, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }>;
    /** Where the game-over buttons are now (set when they appear, redone on every resize while shown). */
    restartLayout?: RestartButtonLayout;
    /** What the gravestone panel says (set at the death), and the objects of the gravestone screen while it is shown. */
    graveInfo?: GraveInfo;
    /** The measured width of one character at the base size (0: not measured yet). */
    private graveCharWidth = 0;
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

        const makeArrow = (): Phaser.GameObjects.Text => this.add.text(0, 0, '', {
            fontFamily: 'monospace',
            fontSize: 20,
            fontStyle: 'bold',
            color: '#ffa502',
            stroke: '#0b1220',
            strokeThickness: 3
        }).setScrollFactor(0).setDepth(10);
        this.exitArrows = Array.from({ length: EXIT_ARROW_COUNT }, makeArrow);
        // Phaser reuses this instance on scene.start: the map starts hidden, with its own new drawing.
        this.mapGraphics = this.add.graphics().setScrollFactor(0).setDepth(MAP_DEPTH).setVisible(false);
        this.mapDotGraphics = this.add.graphics().setScrollFactor(0).setDepth(MAP_DOT_DEPTH).setVisible(false);
        this.mapTexts = [];
        this.mapElapsed = null;
        this.mapSkipDelta = false;
        this.mapPlace = undefined;
        this.mapKey = '';

        // Phaser reuses this instance on scene.start: a new game starts with FLAG off and no input lock.
        this.flagMode = false;
        this.run = undefined;
        this.flagWait = false;
        this.inputLockUntil = 0;
        this.startFirstStage();
        this.createVirtualControls();

        this.input.keyboard?.on('keydown', this.onKeyDown, this);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.scale.on('resize', this.onResize, this);
        // Phaser pauses the loop while the page is hidden, so the run is stopped by the event, not by update().
        this.game.events.on(Phaser.Core.Events.HIDDEN, this.stopRun, this);

        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown', this.onKeyDown, this);
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.scale.off('resize', this.onResize, this);
            this.game.events.off(Phaser.Core.Events.HIDDEN, this.stopRun, this);
            this.virtualControlLayer?.destroy(true);
            this.virtualControlLayer = undefined;
            this.joystickBase = undefined;
            this.joystickThumb = undefined;
            this.joystickHitArea = undefined;
            this.flagBg = undefined;
            this.flagLabel = undefined;
            this.flagHitArea = undefined;
            this.mapBg = undefined;
            this.mapLabel = undefined;
            this.mapHitArea = undefined;
            this.mapGraphics = undefined;
            this.mapDotGraphics = undefined;
            this.mapTexts = [];
            this.mapElapsed = null;
            this.stageSelectBg = undefined;
            this.stageSelectLabel = undefined;
            this.stageSelectHitArea = undefined;
            this.padSectorGraphics = undefined;
            this.joystickState = { active: false, pointerId: -1, startX: 0, startY: 0 };
            this.cancelJoystickRepeat();
            this.joystickCurrentDir = undefined;
            this.joystickHasFired = false;
            this.cancelCorridor();
            this.destroyViews();
            this.restartButtons = undefined;
            this.restartLayout = undefined;
            this.graveDim = undefined;
            this.gravePanel = undefined;
            this.graveInfo = undefined;
        });
    }

    private startStage (stageNo: number): void
    {
        this.hideMap();
        this.flow.reset();
        this.presses.clear();
        this.run = undefined;
        this.flagWait = false;
        this.gameOverLogical = undefined;
        this.graveInfo = undefined;
        this.cancelCorridor();
        this.destroyViews();
        this.floorNo = stageNo;
        this.refreshBoardFit();
        const floor = generateFloor(stageNo);
        this.floorState = new FloorState(floor.rooms, floor.graph);
        this.mapRooms = floor.rooms;
        this.mapGraph = floor.graph;
        this.layout = floor.layout;
        this.views = floor.rooms.map(() => undefined);
        this.views[this.floorState.roomIndex] = this.makeView(this.floorState.roomIndex);
        this.view.setPlayerGlyph('@');
        this.stageData = this.floorState.current;
        this.renderBoard();
        this.legendText.setVisible(false);
        this.refreshHud(stageStartMessage(this.inputKind(), this.stageData.stageNo));
        this.placeCameraInRoom();
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

    /** The board drawing of room `index`, placed where the floor's grid puts the room (docs/spec/rooms-and-floors.md). */
    private makeView (index: number): BoardView
    {
        const origin = this.roomOriginPx(index);
        return new BoardView(this, { originX: origin.x, originY: origin.y, cell: this.cell });
    }

    /** The room the player is in. */
    private get view (): BoardView
    {
        return this.views[this.floorState.roomIndex] as BoardView;
    }

    private destroyViews (): void
    {
        for (const view of this.views) {
            view?.destroy();
        }
        this.views = [];
    }

    /** The world position (px) of the top-left of room `index`'s first cell. */
    private roomOriginPx (index: number): Position
    {
        const origin = this.layout.roomOrigin[index];
        return { x: BOARD_ORIGIN_X + origin.x * this.cell, y: BOARD_ORIGIN_Y + origin.y * this.cell };
    }

    private renderBoard (): void
    {
        this.view.render(this.stageData, this.gameOverLogical);
        this.updateCameraRange();
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

    /** Works out the play area and the cell for this screen and floor. True when the cell changed. */
    private refreshBoardFit (): boolean
    {
        this.area = boardArea(this.camera.width, this.camera.height);
        const cell = boardCell(this.floorNo, this.area);
        const changed = cell !== this.cell;
        this.cell = cell;
        return changed;
    }

    /** The scroll that puts room `index`'s board in the middle of the play area; null when the board does not fit it. */
    private roomCenterScroll (index: number): Position | null
    {
        const room = this.mapRooms[index];
        if (!room || !roomFits(room.width, room.height, this.cell, this.area)) {
            return null;
        }
        return centerScroll(this.roomOriginPx(index), room.width, room.height, this.cell, this.area);
    }

    /** The camera on the room the player is in: in the middle of the play area when it fits, else on the player. */
    private placeCameraInRoom (): void
    {
        const scroll = this.roomCenterScroll(this.floorState.roomIndex);
        if (!scroll) {
            this.centerCameraOnPlayer(true);
            return;
        }
        this.camera.setScroll(scroll.x, scroll.y);
        this.roundCameraScroll();
        this.updateGoalArrow();
    }

    private updateCameraRange (): void
    {
        const centers: Position[] = [];
        for (let index = 0; index < this.mapRooms.length; index += 1) {
            const scroll = this.roomCenterScroll(index);
            if (scroll) {
                centers.push(scroll);
            }
        }
        const margins = { side: BOARD_ORIGIN_X, top: BOARD_ORIGIN_Y, bottom: BOARD_BOTTOM_MARGIN };
        this.followRange = cameraScrollRange(this.layout.cols, this.layout.rows, this.cell, margins, this.camera, []);
        this.scrollRange = cameraScrollRange(this.layout.cols, this.layout.rows, this.cell, margins, this.camera, centers);
        const { minX, maxX, minY, maxY } = this.scrollRange;
        this.camera.setBounds(minX, minY, maxX - minX + this.camera.width, maxY - minY + this.camera.height);
    }

    /** The style of a corridor's "#" at the current cell size. */
    private corridorMarkStyle (): Phaser.Types.GameObjects.Text.TextStyle
    {
        return {
            fontFamily: 'monospace',
            fontSize: scaledFont(CORRIDOR_GLYPH.size, this.cell),
            fontStyle: 'bold',
            color: CORRIDOR_GLYPH.color,
            stroke: GLYPH_OUTLINE_COLOR,
            strokeThickness: scaledDimension(CORRIDOR_GLYPH.stroke, this.cell)
        };
    }

    /** The cell size changed: every room drawn so far, the corridors' "#" and the walk are drawn again at the new size. */
    private relayoutBoard (): void
    {
        const current = this.floorState.roomIndex;
        this.views.forEach((old, index) => {
            if (!old) {
                return;
            }
            old.destroy();
            const view = this.makeView(index);
            this.views[index] = view;
            if (index === current) {
                view.render(this.stageData, this.gameOverLogical);
                view.setPlayerGlyph(this.gameOverLogical ? '†' : '@');
            } else {
                view.render(this.floorState.roomAt(index));
                view.setPlayerVisible(false);
            }
        });
        const style = this.corridorMarkStyle();
        this.corridorMarks.forEach((marks, corridor) => {
            marks?.forEach((mark, i) => {
                const at = this.layout.corridors[corridor][i];
                mark
                    .setPosition(BOARD_ORIGIN_X + at.x * this.cell + this.cell / 2, BOARD_ORIGIN_Y + at.y * this.cell + this.cell / 2)
                    .setFontSize(style.fontSize as number)
                    .setStroke(GLYPH_OUTLINE_COLOR, style.strokeThickness as number);
            });
        });
        if (this.flow.inCorridor) {
            this.corridorDrawn = -1;
            this.placeCorridorPlayer(corridorState(this.corridorElapsed, this.walkedCorridor.length).index);
        }
    }

    private onResize (gameSize: Phaser.Structs.Size): void
    {
        this.camera.setSize(gameSize.width, gameSize.height);
        if (this.refreshBoardFit()) {
            this.relayoutBoard();
        }
        this.updateCameraRange();
        if (this.flow.inCorridor) {
            this.followCorridor(this.corridorElapsed);
        } else {
            this.placeCameraInRoom();
        }
        this.updateGoalArrow();
        this.layoutVirtualControls();
        this.relayoutRestartButtons(gameSize.width, gameSize.height);
        // The map's area depends on the screen and the HUD band: place it again.
        this.mapPlace = undefined;
        this.mapKey = '';
        this.drawMap();
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

        // --- MAP button (above FLAG; docs/spec/floor-map.md): same size, a blue frame ---
        this.mapBg = this.add.ellipse(0, 0, 52, 52, 0x071a33, 0.82)
            .setStrokeStyle(2, 0x38bdf8, 0.9)
            .setScrollFactor(0)
            .setDepth(31);
        this.mapLabel = this.add.text(0, 0, 'MAP', {
            fontFamily: 'monospace',
            fontSize: 11,
            fontStyle: 'bold',
            color: '#7dd3fc',
            stroke: '#0b1220',
            strokeThickness: 3,
            align: 'center'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(32);

        this.virtualControlLayer.add(this.joystickBase);
        this.virtualControlLayer.add(this.joystickThumb);
        this.virtualControlLayer.add(this.padSectorGraphics);
        this.virtualControlLayer.add(this.flagBg);
        this.virtualControlLayer.add(this.flagLabel);
        this.virtualControlLayer.add(this.mapBg);
        this.virtualControlLayer.add(this.mapLabel);

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
        const controls = controlsLayout(W, H);
        const compact = controls.compact;
        const margin = CONTROL_MARGIN;

        const baseR = padBaseRadius(compact);
        const thumbR = compact ? Math.round(JOYSTICK_THUMB_RADIUS * PAD_COMPACT_SCALE) : JOYSTICK_THUMB_RADIUS;
        const flagSize = controls.flag.size;
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
        const flagX = controls.flag.x;
        const flagY = controls.flag.y;
        this.flagBaseSize = flagSize;
        this.flagBg.setPosition(flagX, flagY);
        this.flagLabel.setPosition(flagX, flagY).setFontSize(flagFontSize);
        this.flagHitArea = new Phaser.Geom.Circle(flagX, flagY, controls.flag.hitRadius);

        // MAP button: right above FLAG, the same size; its hit circle only touches FLAG's.
        if (this.mapBg && this.mapLabel) {
            this.mapBg.setPosition(controls.map.x, controls.map.y).setSize(controls.map.size, controls.map.size);
            this.mapLabel.setPosition(controls.map.x, controls.map.y);
            this.mapHitArea = new Phaser.Geom.Circle(controls.map.x, controls.map.y, controls.map.hitRadius);
        }

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

    /** Death, goal, a door (the corridor starts) and the STAGE jump: forget every press and the pad, so nothing acts on a later release. */
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
            this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message, out.result.doorIndex);
            return;
        }

        // Short drag released before first repeat: fire once
        const sector = sectorOfAngle((Math.atan2(dy, dx) * 180) / Math.PI);
        this.applyDirectionInput(JOYSTICK_DIRS[sector], this.flagMode);
    }

    /** HUD wording of a move / chord result (spec "メッセージの文言"). */
    private messageOf (out: { result: { status: 'alive' | 'dead' | 'goal' | 'door'; message?: string }; changedCellIndices?: number[] }): string
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
            const mapElapsedNow = (): number | null => this.mapElapsed;
            const flagModeNow = (): boolean => this.flagMode;
            const camera = this.camera;
            const cellNow = (): number => this.cell;
            const areaNow = (): BoardArea => this.area;
            const originNow = (): Position => this.roomOriginPx(this.floorState.roomIndex);
            const graveNow = (): { charWidth: number; layout: ReturnType<typeof gravePanelLayout>; rowWidth: number; rowLength: number } | null => {
                const info = this.graveInfo;
                const first = this.gravePanel?.rows[0];
                if (!info || !first) {
                    return null;
                }
                return {
                    charWidth: this.graveCharWidth,
                    layout: gravePanelLayout(this.camera.width, this.camera.height, this.hudBand.height, info, this.graveCharWidth),
                    rowWidth: first.width,
                    rowLength: first.text.length
                };
            };
            (window as unknown as { __qa?: unknown }).__qa = {
                get phase () { return flow.phase; },
                get mapAlpha () { return mapElapsedNow() === null ? 0 : mapAlpha(mapElapsedNow() as number); },
                get flagMode () { return flagModeNow(); },
                message,
                get cell () { return cellNow(); },
                get origin () { return originNow(); },
                get grave () {
                    const g = graveNow();
                    return g ? { charWidth: g.charWidth, variant: g.layout.variant, fontPx: g.layout.fontPx, rowHeight: g.layout.rowHeight, rowWidth: g.rowWidth, rowLength: g.rowLength } : null;
                },
                get scroll () { return { x: camera.scrollX, y: camera.scrollY }; },
                get area () { return { ...areaNow() }; },
                room: String.fromCharCode(65 + this.floorState.roomIndex),
                doorSide: stage.doorSide,
                doors: (stage.doors ?? []).map((door) => ({ x: door.cell.x, y: door.cell.y, side: door.side })),
                corridorLengths: this.layout.corridors.map((cells) => cells.length),
                hudBandHeight: this.hudBand.height,
                arrows: this.exitArrows.filter((arrow) => arrow.text !== '').map((arrow) => ({ text: arrow.text, x: arrow.x, y: arrow.y })),
                goalKind: stage.goalKind,
                status: this.statusText.text,
                stage: stage.stageNo,
                width: stage.width,
                height: stage.height,
                player: { x: stage.player.x, y: stage.player.y },
                goal: { x: stage.goal.x, y: stage.goal.y },
                bombs: stage.cells.map((cell) => cell.hasBomb),
                revealed: stage.cells.map((cell) => cell.revealed),
                flagged: stage.cells.map((cell) => cell.flagged)
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
        // The arrows keep below the band: a band that grew (the HUD wrapped) moves them.
        this.updateGoalArrow();
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
        const origin = this.roomOriginPx(this.floorState.roomIndex);
        // A room that fits the play area stays where it was put: the whole board is in view (docs/spec/board-render.md).
        if (this.roomCenterScroll(this.floorState.roomIndex)) {
            this.updateGoalArrow();
            return;
        }

        const px = origin.x + this.stageData.player.x * this.cell + this.cell / 2;
        const py = origin.y + this.stageData.player.y * this.cell + this.cell / 2;

        if (!force) {
            const margin = CAMERA_FOLLOW_MARGIN_CELLS * this.cell;
            const left = this.camera.scrollX + margin;
            const top = this.camera.scrollY + margin;
            const right = this.camera.scrollX + this.camera.width - margin;
            const bottom = this.camera.scrollY + this.camera.height - margin;
            if (px >= left && px <= right && py >= top && py <= bottom) {
                this.updateGoalArrow();
                return;
            }
        }

        this.centerCameraOnPoint(px, py);
    }

    /** Puts the camera's centre on a world point, as near as the floor's bounds allow. */
    private centerCameraOnPoint (px: number, py: number): void
    {
        const scroll = followScroll({ x: px, y: py }, this.camera, this.followRange);

        this.camera.setScroll(scroll.x, scroll.y);
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

    /** The exits to point at from the room the player is in (docs/spec/rooms-and-floors.md "画面外の出口の矢印"). */
    private exitTargets (): ExitTarget[]
    {
        return roomExits(this.stageData, this.floorState.roomIndex, this.roomOriginPx(this.floorState.roomIndex), this.cell);
    }

    private updateGoalArrow (): void
    {
        if (!this.stageData) {
            return;
        }
        const markers = this.flow.inCorridor
            ? []
            : exitMarkers(
                this.exitTargets(),
                { left: this.camera.scrollX, top: this.camera.scrollY, width: this.camera.width, height: this.camera.height },
                undefined,
                // Below the HUD band (it grows when the HUD wraps): the arrows never sit on the status line.
                this.hudBand.height > 0 ? this.hudBand.height + EXIT_ARROW_TOP_GAP : 0
            );
        this.exitArrows.forEach((arrow, i) => {
            const marker = markers[i];
            if (!marker) {
                arrow.setText('');
                return;
            }
            arrow.setText(marker.text);
            // The word is centred on the point: keep the whole word on the screen (a few px from the border).
            const half = arrow.width / 2 + 4;
            const x = Math.min(this.camera.width - half, Math.max(half, marker.x));
            arrow.setPosition(x, marker.y).setOrigin(0.5);
        });
    }

    private onKeyDown (event: KeyboardEvent): void
    {
        // One press is handled once, even if the browser reports the same keydown twice (docs/spec.md "移動キーの対応").
        if (isRepeatedPress(this.lastKeyPress, event)) {
            return;
        }
        this.lastKeyPress = { code: event.code, timeStamp: event.timeStamp };
        sessionInputKind = inputKindOfKey();
        if (mapKeyPressed(event.code, event.repeat, event) && mapAccepted(this.flow.phase)) {
            this.showMap();
            return;
        }
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
        // A new press stops a run and is not carried out (a repeat, from a held key, does not stop it).
        if (this.run) {
            this.stopRun();
            return;
        }

        // Ctrl, Alt or Meta with h j k l y u b n: no move and no flag, and the browser keeps its own action.
        const blocked = isBlockedViKey(event.code, event);
        const direction = blocked ? null : this.mapDirection(event.code);
        if (this.flagWait) {
            this.flagWait = false;
            const action = flagWaitAction(direction, event.shiftKey);
            if (action.kind === 'run') {
                this.startRun(action.dir);
            } else if (action.kind === 'toggle') {
                this.toggleFlagAt(action.dir);
            } else {
                this.refreshHud(this.messageBeforeWait);
            }
            return;
        }
        if (blocked) {
            return;
        }
        if (event.code === 'KeyF') {
            this.messageBeforeWait = this.hudMessage;
            this.flagWait = true;
            this.refreshHud(FLAG_WAIT_MESSAGE);
            return;
        }
        if (!direction) {
            if (event.code === 'KeyS' || event.code === 'Numpad5') {
                const out = chordAtPlayer(this.stageData);
                if (out.result.status === 'alive' && out.stage === this.stageData) {
                    this.refreshHud(this.messageOf(out));
                    return;
                }
                this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message, out.result.doorIndex);
            }
            return;
        }

        if (event.shiftKey) {
            this.startRun(direction);
            return;
        }
        this.applyDirectionInput(direction, false);
    }

    private applyDirectionInput (direction: Position, asFlag: boolean): void
    {
        if (asFlag) {
            this.toggleFlagAt(direction);
            return;
        }

        const out = moveByDelta(this.stageData, direction.x, direction.y);
        this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message, out.result.doorIndex);
    }

    /** Toggles the flag of the neighbour in `direction` (the flag key's second stroke, and the FLAG mode of the pad). */
    private toggleFlagAt (direction: Position): void
    {
        const target = {
            x: this.stageData.player.x + direction.x,
            y: this.stageData.player.y + direction.y
        };
        const nextStage = toggleFlag(this.stageData, target);
        const changedCellIndices = nextStage === this.stageData ? [] : [indexOf(this.stageData, target)];
        const after = nextStage === this.stageData ? null : nextStage.cells[indexOf(nextStage, target)].flagged;
        this.applyResult(nextStage, 'alive', flagMessage(after), changedCellIndices);
    }

    /** Shift + a move key: a run (docs/spec.md "走る"). The first step is taken at once, the next ones every RUN_STEP_MS. */
    private startRun (direction: Position): void
    {
        const stage = this.stageData;
        const next = { x: stage.player.x + direction.x, y: stage.player.y + direction.y };
        if (isDoorExit(stage, next)) {
            // Out through the door: a plain move, the corridor starts.
            this.applyDirectionInput(direction, false);
            return;
        }
        const steps = runSteps(stage, direction);
        if (steps === 0) {
            // The wall gives its message; the down-stairs take one ordinary step (the run cannot enter them, but the
            // key still moves); a cell not open yet gives nothing.
            const block = runBlockAt(stage, next);
            if (block === 'edge' || block === 'goal') {
                this.applyDirectionInput(direction, false);
            }
            return;
        }
        this.run = { dir: direction, left: steps, nextAt: this.time.now + RUN_STEP_MS };
        this.stepRun();
    }

    private stepRun (): void
    {
        if (!this.run) {
            return;
        }
        this.run.left -= 1;
        this.applyDirectionInput(this.run.dir, false);
        // The last cell of the run is taken: from now on the next press acts normally.
        if (this.run && this.run.left === 0) {
            this.stopRun();
        }
    }

    /** The later steps of a run, each RUN_STEP_MS after the previous due time, until the cells it may enter are used up. */
    private advanceRun (): void
    {
        if (!this.run || this.time.now < this.run.nextAt) {
            return;
        }
        // The cadence is kept from the due time, so a late frame does not stretch it; a long stall starts it again
        // from now (no burst of catch-up steps).
        const due = this.run.nextAt + RUN_STEP_MS;
        this.run.nextAt = due < this.time.now ? this.time.now + RUN_STEP_MS : due;
        this.stepRun();
    }

    private stopRun (): void
    {
        this.run = undefined;
    }

    /** Ends a flag wait without changing any flag, and puts back the message it covered. */
    private cancelFlagWait (): void
    {
        if (!this.flagWait) {
            return;
        }
        this.flagWait = false;
        this.refreshHud(this.messageBeforeWait);
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

        return mapping[code] ?? viKeyDirection(code);
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
        status: 'alive' | 'dead' | 'goal' | 'door',
        message: string,
        changedCellIndices?: number[],
        ruleMessage?: string,
        doorIndex?: number
    ): void
    {
        // Anything but a plain step (death, the goal, a door) ends a run.
        if (status !== 'alive') {
            this.run = undefined;
        }
        if (!this.flow.playing) {
            return;
        }

        const prevStage = this.stageData;
        const hasVisibleChange = this.hasVisibleStageChange(prevStage, nextStage, changedCellIndices);
        // A move onto a door redraws the room like a plain move (the corridor starts after it).
        const moved = status === 'alive' || status === 'door';
        const useDiffRender = moved && hasVisibleChange && this.view.canDiff(prevStage, nextStage, this.gameOverLogical);
        this.stageData = nextStage;

        if (status === 'goal') {
            this.renderBoard();
        } else if (moved && useDiffRender) {
            const changedIndices = changedCellIndices ?? this.collectChangedCellIndices(prevStage, nextStage);
            this.view.renderChanged(this.stageData, changedIndices, this.gameOverLogical);
        } else if (moved && hasVisibleChange) {
            this.renderBoard();
        }

        this.view.updatePlayer(this.stageData);
        this.centerCameraOnPlayer();

        if (status === 'dead') {
            this.hideMap();
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
            this.hideMap();
            this.flow.reachGoal();
            this.discardPointerState();
            this.refreshHud(resultMessage('goal', undefined, 0, this.inputKind()));
            this.time.delayedCall(CLEAR_DELAY_MS, () => this.startStage(this.stageData.stageNo + 1));
            return;
        }

        if (status === 'door') {
            this.startCorridor(message, doorIndex ?? 0);
            return;
        }

        this.refreshHud(message);
    }

    /** The player went out through a door: the room is kept as it is and the player walks the corridor to the other room. */
    private startCorridor (message: string, doorIndex: number): void
    {
        this.flow.enterCorridor();
        this.discardPointerState();
        this.floorState.commit(this.stageData);
        this.corridorRoute = { ...this.floorState.route(doorIndex), doorIndex };
        this.corridorForward = this.corridorRoute.forward;
        this.corridorElapsed = 0;
        this.corridorDrawn = -1;
        const walked = this.corridorRoute.corridor;
        if (!this.corridorMarks[walked]) {
            const marks: Phaser.GameObjects.Text[] = [];
            this.corridorMarks[walked] = marks;
            for (const cell of this.layout.corridors[walked]) {
                marks.push(
                    this.add.text(
                        BOARD_ORIGIN_X + cell.x * this.cell + this.cell / 2,
                        BOARD_ORIGIN_Y + cell.y * this.cell + this.cell / 2,
                        '#',
                        this.corridorMarkStyle()
                    ).setOrigin(0.5).setDepth(CORRIDOR_MARK_DEPTH)
                );
            }
        }
        this.placeCorridorPlayer(0);
        this.followCorridor(0);
        this.updateGoalArrow();
        this.refreshHud(message);
    }

    /** Shows the floor map from the start of its time (docs/spec/floor-map.md): in play and in a corridor walk only. */
    private showMap (): void
    {
        if (!mapAccepted(this.flow.phase)) {
            return;
        }
        // The map (M, MAP) stops a run or a flag wait, and is shown as usual (docs/spec.md "走る").
        this.run = undefined;
        this.cancelFlagWait();
        this.mapElapsed = 0;
        this.mapSkipDelta = true;
        this.mapPlace = undefined;
        this.mapKey = '';
        this.drawMap();
    }

    private hideMap (): void
    {
        this.mapElapsed = null;
        this.mapSkipDelta = false;
        this.mapPlace = undefined;
        this.mapKey = '';
        this.mapGraphics?.clear().setVisible(false);
        this.mapDotGraphics?.clear().setVisible(false);
        for (const text of this.mapTexts) {
            text.setVisible(false);
        }
    }

    /**
     * Counts the map's time (the frame it was shown in is not counted). Like a corridor walk, one frame counts at
     * most `CORRIDOR_MAX_FRAME_MS` (spec "時間と状態"), so a long frame (a tab coming back) does not eat the display time.
     */
    private advanceMapClock (delta: number): void
    {
        if (this.mapElapsed === null) {
            return;
        }
        if (this.mapSkipDelta) {
            this.mapSkipDelta = false;
        } else {
            this.mapElapsed = advanceCorridor(this.mapElapsed, delta);
        }
    }

    /** How many rooms the player has entered and how many corridors they have started to walk (they only grow). */
    private mapProgress (): number
    {
        let count = 0;
        for (const view of this.views) {
            count += view ? 1 : 0;
        }
        for (const marks of this.corridorMarks) {
            count += marks ? 1000 : 0;
        }
        return count;
    }

    /** The floor map as it stands: redrawn when what it shows changes, and its opacity follows the time. */
    private drawMap (): void
    {
        const g = this.mapGraphics;
        if (this.mapElapsed === null || !g || !this.layout) {
            return;
        }
        const alpha = mapAlpha(this.mapElapsed);
        if (alpha === null) {
            this.hideMap();
            return;
        }
        const layout = this.layout;
        if (!this.mapPlace) {
            this.mapPlace = mapView(layout.cols, layout.rows, this.camera.width, this.camera.height, this.hudBand.height);
        }
        const current = this.floorState.roomIndex;
        const origin = layout.roomOrigin[current];
        // The player's cell on the floor's grid: on the corridor cell being walked, else in the room.
        const inWalk = this.flow.inCorridor && this.corridorDrawn >= 0;
        const walkedAt = inWalk ? corridorCellAt(this.walkedCorridor, this.corridorDrawn, this.corridorForward) : undefined;
        const px = walkedAt ? walkedAt.x : origin.x + this.stageData.player.x;
        const py = walkedAt ? walkedAt.y : origin.y + this.stageData.player.y;
        g.setVisible(true).setAlpha(alpha);
        this.mapDotGraphics?.setVisible(true).setAlpha(alpha);
        for (const text of this.mapTexts) {
            text.setAlpha(alpha);
        }
        // Redrawn only when what it shows changed (numbers only here: this runs every frame while the map is up).
        const progress = this.mapProgress();
        if (
            this.mapKey !== '' &&
            progress === this.mapStamp.progress &&
            current === this.mapStamp.room &&
            px === this.mapStamp.x &&
            py === this.mapStamp.y
        ) {
            return;
        }
        this.mapKey = 'drawn';
        this.mapStamp = { progress, room: current, x: px, y: py };
        const walkedCell = { x: px, y: py };
        const entered = this.views.map((view) => view !== undefined);
        const walked = layout.corridors.map((_, k) => this.corridorMarks[k] !== undefined);

        const shapes = mapShapes({
            roomOrigin: layout.roomOrigin,
            corridors: layout.corridors,
            rooms: this.mapRooms,
            graph: this.mapGraph,
            entered,
            walked,
            current,
            player: walkedCell,
            view: this.mapPlace
        });
        const area = this.mapPlace.area;
        g.clear();
        g.fillStyle(MAP_COLORS.panel, MAP_COLORS.panelAlpha);
        g.fillRect(area.left, area.top, area.width, area.height);
        for (const room of shapes.rooms) {
            g.fillStyle(room.current ? MAP_COLORS.roomCurrent : MAP_COLORS.room, 1);
            g.fillRect(room.x, room.y, room.width, room.height);
            g.lineStyle(room.current ? 2 : 1, room.current ? MAP_COLORS.door : MAP_COLORS.outline, 1);
            g.strokeRect(room.x, room.y, room.width, room.height);
        }
        g.fillStyle(MAP_COLORS.corridor, 1);
        for (const cell of shapes.corridors) {
            g.fillRect(cell.x, cell.y, cell.size, cell.size);
        }
        for (const stub of shapes.stubs) {
            g.lineStyle(stub.thickness, MAP_COLORS.line, 1);
            g.lineBetween(stub.x1, stub.y1, stub.x2, stub.y2);
        }
        g.fillStyle(MAP_COLORS.door, 1);
        for (const door of shapes.doors) {
            g.fillRect(door.x, door.y, door.size, door.size);
        }
        const dot = this.mapDotGraphics;
        if (dot) {
            dot.clear();
            dot.fillStyle(MAP_COLORS.player, 1);
            dot.fillCircle(shapes.player.x, shapes.player.y, shapes.player.size / 2);
        }

        // The signs (the stairs and the "?" of each unwalked door): a small pool of Text objects, reused.
        const signs = [
            ...shapes.stairs.map((s) => ({
                x: s.x, y: s.y, text: s.glyph, color: s.glyph === '▲' ? MAP_COLORS.up : MAP_COLORS.down
            })),
            ...shapes.stubs.map((s) => ({ x: s.qx, y: s.qy, text: '?', color: MAP_COLORS.question }))
        ];
        while (this.mapTexts.length < signs.length) {
            this.mapTexts.push(
                this.add.text(0, 0, '', {
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontStyle: 'bold',
                    stroke: '#0b1220',
                    strokeThickness: 3
                }).setOrigin(0.5).setScrollFactor(0).setDepth(MAP_TEXT_DEPTH)
            );
        }
        this.mapTexts.forEach((text, i) => {
            const sign = signs[i];
            if (!sign) {
                text.setVisible(false);
                return;
            }
            text.setText(sign.text).setColor(sign.color).setPosition(sign.x, sign.y).setAlpha(alpha).setVisible(true);
        });
    }

    /** The walk's progress: one corridor cell per `CORRIDOR_STEP_MS` (the walk takes as long as the corridor is long), then the other room is entered. */
    update (_time: number, delta: number): void
    {
        this.advanceMapClock(delta);
        this.advanceRun();
        this.advanceWalk(delta);
        // After the walk, so the map shows the cell and the room of this frame.
        this.drawMap();
    }

    private advanceWalk (delta: number): void
    {
        if (!this.flow.inCorridor) {
            return;
        }
        this.corridorElapsed = advanceCorridor(this.corridorElapsed, delta);
        const state = corridorState(this.corridorElapsed, this.walkedCorridor.length);
        if (state.done) {
            this.finishCorridor();
            return;
        }
        this.placeCorridorPlayer(state.index);
        this.followCorridor(this.corridorElapsed);
    }

    /** The cells of the corridor being walked, on the floor's grid. */
    private get walkedCorridor (): Position[]
    {
        return this.layout.corridors[this.corridorRoute.corridor];
    }

    /** The world position (px) of the centre of the `index`-th cell of the walk. */
    private corridorPointPx (index: number): Position
    {
        const cell = corridorCellAt(this.walkedCorridor, index, this.corridorForward);
        return { x: BOARD_ORIGIN_X + cell.x * this.cell + this.cell / 2, y: BOARD_ORIGIN_Y + cell.y * this.cell + this.cell / 2 };
    }

    /** The highlight and the mark on the `index`-th cell of the walk (room A to B: first to last; back: last to first). */
    private placeCorridorPlayer (index: number): void
    {
        if (index === this.corridorDrawn) {
            return;
        }
        this.corridorDrawn = index;
        const cell = corridorCellAt(this.walkedCorridor, index, this.corridorForward);
        const origin = this.layout.roomOrigin[this.floorState.roomIndex];
        this.view.updatePlayer({ ...this.stageData, player: { x: cell.x - origin.x, y: cell.y - origin.y } });
    }

    /** The camera glides along the corridor: its centre is on the point the walk has reached between two cells. */
    private followCorridor (elapsedMs: number): void
    {
        const { index, fraction } = corridorReach(elapsedMs, this.walkedCorridor.length);
        const from = this.corridorPointPx(index);
        const to = this.corridorPointPx(index + 1);
        this.centerCameraOnPoint(from.x + (to.x - from.x) * fraction, from.y + (to.y - from.y) * fraction);
    }

    /** The walk is over: the player is in the other room, on its door cell (where they left it, or the entry of room B). */
    private finishCorridor (): void
    {
        if (!this.flow.leaveCorridor()) {
            return;
        }
        this.view.setPlayerVisible(false);
        this.stageData = this.floorState.cross(this.corridorRoute.doorIndex);
        const index = this.floorState.roomIndex;
        if (!this.views[index]) {
            this.views[index] = this.makeView(index);
        }
        this.view.setPlayerVisible(true);
        this.renderBoard();
        this.placeCameraInRoom();
        this.refreshHud(ENTER_ROOM_MESSAGE);
    }

    /** Drops a corridor walk in progress and the marks (a new floor starts, or the Scene ends). */
    private cancelCorridor (): void
    {
        for (const marks of this.corridorMarks) {
            for (const mark of marks ?? []) {
                mark.destroy();
            }
        }
        this.corridorMarks = [];
        this.corridorElapsed = 0;
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
        const charWidth = this.graveCharWidthAtBase();
        const layout = gravePanelLayout(this.camera.width, this.camera.height, this.hudBand.height, info, charWidth);
        for (const text of panel.rows) {
            text.destroy();
        }
        // A row with "New record!" is two lines of equal length drawn over each other (body colour, accent words),
        // so the walls beside the words keep the body colour. `rows` keeps every Text, the base of row 0 first.
        const drawLine = (text: string, y: number, color: string): Phaser.GameObjects.Text => this.add.text(layout.centerX, y, text, {
            fontFamily: 'monospace',
            fontSize: layout.fontPx,
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
        // The plate is as wide as the art at the size it was drawn: every row has the same number of characters, so one drawn
        // row gives the width of one character (the scaled probe width when it reads 0).
        const first = panel.rows[0];
        const drawn = first && first.text.length > 0 && first.width > 0 ? first.width / first.text.length : (charWidth * layout.fontPx) / GRAVE_ART_FONT;
        panel.bg.setSize(gravePlateWidth(layout.rows, drawn, layout.platePadX), layout.height)
            .setPosition(layout.centerX, layout.top + layout.height / 2);
    }

    /** One character's width (px) of the art's monospace font at the base size, measured once with a probe text (the assumed width, not kept, when it reads 0). */
    private graveCharWidthAtBase (): number
    {
        if (this.graveCharWidth <= 0) {
            const probeLength = 20;
            const probe = this.add.text(0, 0, 'M'.repeat(probeLength), { fontFamily: 'monospace', fontSize: GRAVE_ART_FONT });
            const measured = probe.width / probeLength;
            probe.destroy();
            if (measured <= 0) {
                return GRAVE_CHAR_WIDTH;
            }
            this.graveCharWidth = measured;
        }
        return this.graveCharWidth;
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

        // MAP button (docs/spec/floor-map.md): taken in play and while a corridor is walked; FLAG's circle goes first.
        const onFlag = this.flagHitArea !== undefined && Phaser.Geom.Circle.Contains(this.flagHitArea, pointer.x, pointer.y);
        if (
            !onFlag &&
            mapAccepted(this.flow.phase) &&
            this.mapHitArea &&
            Phaser.Geom.Circle.Contains(this.mapHitArea, pointer.x, pointer.y)
        ) {
            this.presses.begin(pointer.id, 'button');
            this.showMap();
            return;
        }

        // A press during a run or a flag wait stops it (or cancels the wait) and is not carried out.
        if (this.run || this.flagWait) {
            this.stopRun();
            this.cancelFlagWait();
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
        const origin = this.roomOriginPx(this.floorState.roomIndex);
        const target = cellAtWorld(world.x, world.y, origin.x, origin.y, this.cell);

        if (!inBounds(this.stageData, target)) {
            return;
        }

        const dx = Math.abs(target.x - this.stageData.player.x);
        const dy = Math.abs(target.y - this.stageData.player.y);
        if (dx > 1 || dy > 1 || (dx === 0 && dy === 0)) {
            return;
        }

        const out = movePlayer(this.stageData, target);
        this.applyResult(out.stage, out.result.status, this.messageOf(out), out.changedCellIndices, out.result.message, out.result.doorIndex);
    }
}
