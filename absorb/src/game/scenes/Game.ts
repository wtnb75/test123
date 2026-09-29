import { Core, GameObjects, Input, Math as PhaserMath, Scene, type Types } from 'phaser';
import {
    AbsorbEffects, absorbRingProgress, absorbRingRadius, edgeAlpha, edgeWidth, lerpColor, suckCoord, suckProgress,
    suckRadius, trailAlpha, trailProgress, type Suck
} from '../logic/absorbFx';
import { bossScore } from '../logic/boss';
import {
    ButtonEffects, buttonColor, buttonFillAlpha, buttonPressKind, buttonRadius, buttonStrokeAlpha
} from '../logic/buttonFx';
import {
    ABSORB_RING_WIDTH, ABSORB_TRAIL_COUNT, BOSS_BAR_HEIGHT, BUTTON_INSET, BOSS_BAR_WIDTH_RATIO, BOSS_HIT_FLASH_WIDTH, BOSS_LABEL_SIZE,
    DEBRIS_COUNT, ENDING_DURATION,
    ENEMY_BULLET_RADIUS, FIELD_RADIUS, GRUNT_WARN, HUD_HEIGHT, PLAYER_RADIUS, READY_DURATION, RELEASE_RADIUS,
    HIT_RING_WIDTH, MULTIKILL_FONT_BASE, PAUSE_DIM_ALPHA, RELEASE_SHAKE_AMPLITUDE, RELEASE_SHAKE_DURATION, SPLIT_RING_WIDTH,
    SPLITTER_CHILD_OUTLINE_ALPHA, SPLITTER_CHILD_OUTLINE_WIDTH, STOCK_MAX, type DefeatKind
} from '../logic/constants';
import { PauseState } from '../logic/pause';
import { SplitEffects, childFlashesWhite, splitRingProgress, splitRingRadius } from '../logic/splitFx';
import { DropFlashes } from '../logic/carrierFx';
import {
    DebrisEffects, debrisColor, debrisPieceX, debrisPieceY, debrisProgress, debrisRadius
} from '../logic/debrisFx';
import {
    ReleaseEffects, releaseRingProgress, releaseRingRadius, releaseRingWidth, startsShake
} from '../logic/releaseFx';
import {
    MultiKillEffects, counterCenter, counterFontSize, counterLabel, multiKillColor, popScale, resultFontSize, resultLabel,
    resultProgress, resultRise, resultStart, reusesCounterSpot, topLimit, type KillCounter, type KillResult
} from '../logic/multikillFx';
import { HitEffects, edgeFrames, hitEdgeFade, hitRingAlpha, hitRingProgress, hitRingRadius, hitTintAlpha } from '../logic/hitFx';
import {
    announceAlpha, bossEvent, defeatRingProgress, defeatRingRadius, fadeAlpha, hitFlashVisible, scorePopupProgress,
    scorePopupRise
} from '../logic/effects';
import { heavyPhase, type Enemy } from '../logic/enemy';
import { TouchRoles, pointersToAdd } from '../logic/touchRoles';
import { computeScreenSize } from '../logic/screen';
import { World, type Input as WorldInput } from '../logic/world';
import { KIND_COLORS, cssColor } from './colors';
import { normalizeBreakdown } from '../logic/breakdown';

const COLORS = {
    player: 0xffffff,
    text: 0xffffff,
    field: 0x4dd0e1,
    enemyBullet: 0xff5252,
    releaseBullet: 0x80ffea,
    ...KIND_COLORS,
    bossCore: 0x5d4037,
    warn: 0xffffff,
    gaugeBack: 0x263238,
    gaugeFill: 0x4dd0e1,
    explosion: 0xffcc80,
    childOutline: 0xffffff
};

/** Hit tint / edge band sit over every play-area layer (popups at 5) and under the HUD and release button (10, 11). */
const HIT_LAYER_DEPTH = 8;
/** The pause veil and texts sit over everything, the HUD and release button (10, 11) included. */
const PAUSE_LAYER_DEPTH = 20;
const PAUSE_TITLE_CSS_COLOR = '#ffffff';
const PAUSE_HINT_CSS_COLOR = '#aaaaaa';
/** Pause texts: sizes as on the game-over screen, centred just around the middle of the screen. */
const PAUSE_TITLE_SIZE = 56;
const PAUSE_HINT_SIZE = 22;
const PAUSE_TITLE_OFFSET_Y = -20;
const PAUSE_HINT_OFFSET_Y = 40;

const GAUGE_WIDTH = 160;
const GAUGE_HEIGHT = 14;
const GAUGE_RIGHT_MARGIN = 20;
const GAUGE_Y = 22;

/** Debris colors per enemy kind, worked out once. */
const DEBRIS_COLORS: Record<DefeatKind, number> = {
    grunt: debrisColor('grunt', COLORS.grunt),
    shooter: debrisColor('shooter', COLORS.shooter),
    heavy: debrisColor('heavy', COLORS.heavy),
    rammer: debrisColor('rammer', COLORS.rammer),
    splitter: debrisColor('splitter', COLORS.splitter),
    carrier: debrisColor('carrier', COLORS.carrier)
};

const TEXT_CSS_COLOR = cssColor(COLORS.text);
const BOSS_CSS_COLOR = cssColor(COLORS.boss);
const DEFEAT_RING_LINE = 6;
/** Carrier hexagon: half-height relative to its half-width (the hit radius), and the cargo mark's radius within it. */
const CARRIER_HEIGHT_RATIO = 0.55;
/** HP pip spacing; the carrier's 12 pips are packed a little tighter to stay within its hull width. */
const PIP_PITCH = 6;
const CARRIER_PIP_PITCH = 5;
/** Half-width of the carrier's flat top and bottom edges relative to its half-width. */
const CARRIER_TOP_RATIO = 0.5;
const CARRIER_MARK_RATIO = 0.6;
/** Half-width of the splitter diamond relative to its (vertical) half-height, the hit radius. */
const DIAMOND_WIDTH_RATIO = 0.8;
const SCORE_POPUP_FONT_SIZE = 32;

/** A counter's bound text, the kill count it shows and where it was last drawn. */
interface CounterView {
    text: GameObjects.Text;
    kills: number;
    x: number;
    y: number;
}

/** A result's bound text and its start centre. */
interface ResultView {
    text: GameObjects.Text;
    x: number;
    y: number;
}

interface TextLook {
    text: string;
    fontSize: number;
    color: number;
}

function hasCounter(counters: readonly KillCounter[], id: number): boolean {
    for (const c of counters) if (c.id === id) return true;
    return false;
}

type Keys = Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'x' | 'enter' | 'space', Input.Keyboard.Key>;

export class Game extends Scene {
    private world: World;
    private keys: Keys;
    private gfx: GameObjects.Graphics;
    private hudGfx: GameObjects.Graphics;
    private scoreText: GameObjects.Text;
    private livesText: GameObjects.Text;
    private stockText: GameObjects.Text;
    private centerText: GameObjects.Text;
    private buttonText: GameObjects.Text | null;
    private bossGfx: GameObjects.Graphics;
    private bossLabel: GameObjects.Text;
    /** Defeat rings, drawn over the play area but under the HUD. */
    private fxGfx: GameObjects.Graphics;
    private popupText: GameObjects.Text;
    /** The boss and its HP as of the previous frame, to spot hits and the kill. */
    private lastBoss: Enemy | null = null;
    private lastBossHp = 0;
    private readonly absorbFx = new AbsorbEffects();
    private readonly debrisFx = new DebrisEffects();
    private readonly releaseFx = new ReleaseEffects();
    private readonly splitFx = new SplitEffects();
    private readonly dropFlashes = new DropFlashes();
    private readonly multiKillFx = new MultiKillEffects();
    private readonly hitFx = new HitEffects();
    private readonly buttonFx = new ButtonEffects();
    /** Whether the last frame drew the button mid-feedback, so the frame it ends is redrawn once more. */
    private buttonFxShown = false;
    /** Red hit tint and edge band: over the whole play area, under the HUD. */
    private hitTintGfx: GameObjects.Graphics;
    private hitEdgeGfx: GameObjects.Graphics;
    /**
     * Multi-kill texts, each bound to one counter (by release id) or one result for as long as it shows,
     * so a text is only restyled when its own counter's kill count changes. Freed texts wait in `spareTexts`.
     */
    private readonly counterViews = new Map<number, CounterView>();
    private readonly resultViews = new Map<KillResult, ResultView>();
    private spareTexts: GameObjects.Text[] = [];
    private readonly textLooks = new Map<GameObjects.Text, TextLook>();
    /** Measured metrics per font size, so restyling to a known size needs no canvas scan. */
    private readonly fontMetrics = new Map<number, Types.GameObjects.Text.TextMetrics>();
    /** Camera shake strength as fractions of the view, so both axes move RELEASE_SHAKE_AMPLITUDE px. */
    private readonly shakeIntensity = new PhaserMath.Vector2();
    /** Seconds since the last boss hit / kill; Infinity when nothing is playing. */
    private hitFlashAge = Infinity;
    private defeatAge = Infinity;
    private defeatX = 0;
    private defeatY = 0;
    private shownScore = -1;
    private shownLives = -1;
    private shownStock = -1;
    private shownBossHp = -1;
    private finished = false;
    private touchUi = false;
    private buttonX = 0;
    private buttonY = 0;
    private readonly touchRoles = new TouchRoles();
    private dragLastX = 0;
    private dragLastY = 0;
    private releaseQueued = false;
    /** A release finger touched since the last update, so the button shows its feedback. */
    private touchPressQueued = false;
    private readonly input_: WorldInput = { moveX: 0, moveY: 0, dragX: 0, dragY: 0, release: false };
    private pause = new PauseState();
    /** Seconds of unpaused play in this run, driving the boss spin. */
    private spinClock = 0;
    /** Veil and texts shown over everything while auto-paused. */
    private pauseLayer: GameObjects.Container;

    constructor() {
        super('Game');
    }

    create() {
        const size = computeScreenSize(window.innerWidth, window.innerHeight);
        if (this.scale.width !== size.width || this.scale.height !== size.height) {
            this.scale.setGameSize(size.width, size.height);
        }
        this.cameras.main.setSize(size.width, size.height);

        this.world = new World(size);
        this.finished = false;
        this.shownScore = this.shownLives = this.shownStock = this.shownBossHp = -1;
        this.touchRoles.clear();
        this.releaseQueued = false;
        this.touchPressQueued = false;
        this.lastBoss = null;
        this.lastBossHp = 0;
        this.hitFlashAge = this.defeatAge = Infinity;
        this.defeatX = this.defeatY = 0;
        this.absorbFx.clear();
        this.debrisFx.clear();
        this.releaseFx.clear();
        this.splitFx.clear();
        this.dropFlashes.clear();
        this.multiKillFx.clear();
        this.hitFx.clear();
        this.buttonFx.clear();
        this.buttonFxShown = false;
        // The previous run's texts were destroyed with the scene.
        this.counterViews.clear();
        this.resultViews.clear();
        this.spareTexts = [];
        this.textLooks.clear();
        this.shakeIntensity.set(RELEASE_SHAKE_AMPLITUDE / size.width, RELEASE_SHAKE_AMPLITUDE / size.height);
        this.touchUi = this.sys.game.device.input.touch;
        this.buttonX = size.width - BUTTON_INSET;
        this.buttonY = size.height - BUTTON_INSET;

        this.pause = new PauseState();
        this.spinClock = 0;

        this.createHud(size.width, size.height);
        this.createPauseLayer(size.width, size.height);
        this.setupKeyboard();
        this.setupPointer();
        this.setupPauseTriggers();
    }

    private createPauseLayer(width: number, height: number) {
        const veil = this.add.graphics().fillStyle(0x000000, PAUSE_DIM_ALPHA).fillRect(0, 0, width, height);
        const title = this.add.text(width / 2, height / 2 + PAUSE_TITLE_OFFSET_Y, 'PAUSED', {
            fontFamily: 'monospace', fontSize: PAUSE_TITLE_SIZE, color: PAUSE_TITLE_CSS_COLOR
        }).setOrigin(0.5);
        const hint = this.add.text(width / 2, height / 2 + PAUSE_HINT_OFFSET_Y, 'Tap or press SPACE to resume', {
            fontFamily: 'monospace', fontSize: PAUSE_HINT_SIZE, color: PAUSE_HINT_CSS_COLOR
        }).setOrigin(0.5);
        this.pauseLayer = this.add.container(0, 0, [veil, title, hint]).setDepth(PAUSE_LAYER_DEPTH).setVisible(false);
    }

    /** The page going hidden or the window losing focus pauses the run until the player resumes it. */
    private setupPauseTriggers() {
        const events = this.game.events;
        const trigger = () => this.pause.trigger();
        events.on(Core.Events.HIDDEN, trigger);
        events.on(Core.Events.BLUR, trigger);
        this.events.once('shutdown', () => {
            events.off(Core.Events.HIDDEN, trigger);
            events.off(Core.Events.BLUR, trigger);
        });
    }

    private createHud(width: number, height: number) {
        this.gfx = this.add.graphics();
        this.hudGfx = this.add.graphics().setDepth(10);
        const style = { fontFamily: 'monospace', fontSize: 22, color: TEXT_CSS_COLOR };
        this.scoreText = this.add.text(20, 16, '', style).setDepth(10);
        this.livesText = this.add.text(width / 2, 16, '', style).setOrigin(0.5, 0).setDepth(10);
        this.stockText = this.add.text(this.gaugeX() - 10, 16, '', style).setOrigin(1, 0).setDepth(10);
        this.centerText = this.add.text(width / 2, height / 2, '', {
            fontFamily: 'monospace', fontSize: 96, color: TEXT_CSS_COLOR
        }).setOrigin(0.5).setDepth(10);
        this.buttonText = this.touchUi
            ? this.add.text(this.buttonX, this.buttonY, '', { fontFamily: 'monospace', fontSize: 28, color: TEXT_CSS_COLOR })
                .setOrigin(0.5).setDepth(11)
            : null;
        this.bossGfx = this.add.graphics().setDepth(10);
        this.bossLabel = this.add.text(this.bossBarX() - 8, HUD_HEIGHT + BOSS_BAR_HEIGHT / 2, 'BOSS', {
            fontFamily: 'monospace', fontSize: BOSS_LABEL_SIZE, color: BOSS_CSS_COLOR
        }).setOrigin(1, 0.5).setDepth(10).setVisible(false);
        this.fxGfx = this.add.graphics().setDepth(5);
        this.createHitLayers(width, height);
        this.popupText = this.add.text(0, 0, '', {
            fontFamily: 'monospace', fontSize: SCORE_POPUP_FONT_SIZE, color: BOSS_CSS_COLOR
        }).setOrigin(0.5).setDepth(5).setVisible(false);
    }

    private bossBarX(): number {
        return (this.world.screen.width * (1 - BOSS_BAR_WIDTH_RATIO)) / 2;
    }

    private gaugeX(): number {
        return this.world.screen.width - GAUGE_WIDTH - GAUGE_RIGHT_MARGIN;
    }

    private setupKeyboard() {
        const K = Input.Keyboard.KeyCodes;
        this.keys = this.input.keyboard!.addKeys({
            up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
            w: K.W, a: K.A, s: K.S, d: K.D, x: K.X, enter: K.ENTER, space: K.SPACE
        }) as Keys;
        // Queue the release on the key's down event rather than polling JustDown in update():
        // a tap shorter than one frame is released before update() runs, and Phaser clears the
        // just-down flag on key up, so polling would drop it.
        // The pause decides: a key taken to resume, or auto-repeat, never releases. (Repeats also reach a new
        // run from a key held on the game-over screen; they arrive during ready, which ignores release anyway.)
        const queueRelease = (_key: Input.Keyboard.Key, event: KeyboardEvent) => {
            if (this.pause.releaseKeyDown(event.keyCode, event.repeat)) this.releaseQueued = true;
        };
        this.keys.x.on('down', queueRelease);
        this.keys.enter.on('down', queueRelease);
        this.keys.space.on('down', queueRelease);
        // Destroying the keys also removes their listeners.
        this.events.once('shutdown', () => this.input.keyboard?.removeAllKeys(true));
    }

    private setupPointer() {
        // One extra pointer so a second finger can release while the first one drags. Phaser keeps its
        // pointers across scene restarts, so only the missing ones are added.
        const missing = pointersToAdd(this.input.manager.pointersTotal);
        if (missing > 0) this.input.addPointer(missing);
        this.input.on('pointerdown', this.onPointerDown, this);
        this.input.on('pointermove', this.onPointerMove, this);
        this.input.on('pointerup', this.onPointerUp, this);
        this.input.on('pointerupoutside', this.onPointerUp, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onPointerDown, this);
            this.input.off('pointermove', this.onPointerMove, this);
            this.input.off('pointerup', this.onPointerUp, this);
            this.input.off('pointerupoutside', this.onPointerUp, this);
            this.touchRoles.clear();
        });
    }

    private onPointerDown(p: Input.Pointer) {
        const role = this.touchRoles.down(p.id, p.x, p.y, {
            paused: this.pause.pointerDown(), // a resume tap neither releases nor drags
            touchUi: this.touchUi,
            buttonX: this.buttonX,
            buttonY: this.buttonY
        });
        if (role === 'release') {
            this.releaseQueued = true;
            this.touchPressQueued = true;
        } else if (role === 'drag') {
            this.dragLastX = p.x;
            this.dragLastY = p.y;
        }
    }

    private onPointerMove(p: Input.Pointer) {
        if (this.touchRoles.roleOf(p.id) !== 'drag') return;
        this.input_.dragX += p.x - this.dragLastX;
        this.input_.dragY += p.y - this.dragLastY;
        this.dragLastX = p.x;
        this.dragLastY = p.y;
    }

    private onPointerUp(p: Input.Pointer) {
        this.touchRoles.up(p.id);
    }

    update(_time: number, delta: number) {
        const dt = this.pause.frame(delta);
        this.syncPauseLayer();
        if (this.pause.isPaused) return; // time stands still; the last frame stays on screen
        this.spinClock += dt;
        this.trackButton(dt);
        this.readKeys();
        this.world.step(dt, this.input_);
        this.input_.dragX = 0;
        this.input_.dragY = 0;
        this.trackBoss(dt);
        this.absorbFx.update(dt, this.world.absorbed, this.world.phase === 'playing');
        this.debrisFx.update(dt, this.world.defeated);
        this.releaseFx.update(dt, this.world.releases);
        this.splitFx.update(dt, this.world.splits);
        this.dropFlashes.update(dt, this.world.carrierDrops);
        this.multiKillFx.update(dt, this.world.killUpdates, this.world.settlements);
        this.hitFx.update(dt, this.world.hits);
        if (startsShake(this.world.releases)) {
            // force: a new full release restarts the shake instead of being ignored.
            this.cameras.main.shake(RELEASE_SHAKE_DURATION * 1000, this.shakeIntensity, true);
        }
        this.draw();
        this.drawBossEffects();
        this.drawMultiKills();
        this.drawHitFlash();
        this.drawHud();
        if (this.world.phase === 'over' && !this.finished) {
            this.finished = true;
            // A copy, so the game-over screen never shares state with this run's world.
            this.scene.start('GameOver', { score: this.world.score, breakdown: normalizeBreakdown(this.world.breakdown) });
        }
    }

    /** Shows the pause layer while paused; when the pause begins, drops the input in flight. */
    private syncPauseLayer() {
        this.pauseLayer.setVisible(this.pause.isPaused);
        // The countdown / boss announcement sits where "PAUSED" goes; hide it until play resumes.
        this.centerText.setVisible(!this.pause.isPaused);
        if (!this.pause.pausedThisFrame) return;
        this.touchRoles.suspendDrag();
        this.world.dropDragTarget();
        this.releaseQueued = false;
        this.touchPressQueued = false;
        this.input_.dragX = this.input_.dragY = 0;
        this.input.keyboard?.resetKeys();
        // Cut a running release shake so the veil doesn't sit on a shifted view.
        this.cameras.main.shakeEffect.reset();
    }

    /** Starts the button feedback for a release finger, judged from the phase and stock before this frame's step. */
    private trackButton(dt: number) {
        const press = this.touchPressQueued ? buttonPressKind(this.world.phase, this.world.stock) : null;
        this.touchPressQueued = false;
        this.buttonFx.update(dt, press);
    }

    private readKeys() {
        const k = this.keys;
        const i = this.input_;
        i.moveX = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
        i.moveY = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
        i.release = this.releaseQueued;
        this.releaseQueued = false;
    }

    /** Starts the boss's hit flash or defeat effect for whatever happened to it this frame. */
    private trackBoss(dt: number) {
        this.hitFlashAge += dt;
        this.defeatAge += dt;
        const boss = this.world.boss;
        const last = this.lastBoss;
        const event = bossEvent(last, this.lastBossHp, boss);
        if (event === 'defeat' && last) {
            this.defeatAge = 0;
            this.defeatX = last.x;
            this.defeatY = last.y;
            this.popupText.setText(`+${bossScore(last)}`);
        } else if (event === 'hit') {
            this.hitFlashAge = 0;
        }
        this.lastBoss = boss;
        this.lastBossHp = boss ? boss.hp : 0;
    }

    /** Defeat rings and the score popup: above the player, below the HUD. */
    private drawBossEffects() {
        const g = this.fxGfx;
        g.clear();
        for (let i = 0; i < 2; i++) {
            const p = defeatRingProgress(this.defeatAge, i);
            if (p < 0) continue;
            g.lineStyle(DEFEAT_RING_LINE, COLORS.boss, fadeAlpha(p));
            g.strokeCircle(this.defeatX, this.defeatY, defeatRingRadius(p));
        }
        const p = scorePopupProgress(this.defeatAge);
        this.popupText.setVisible(p >= 0);
        if (p >= 0) this.popupText.setPosition(this.defeatX, this.defeatY - scorePopupRise(p)).setAlpha(fadeAlpha(p));
    }

    private draw() {
        const g = this.gfx;
        const w = this.world;
        g.clear();

        // Back to front: enemy bullets, enemies, release bullets, player.
        g.fillStyle(COLORS.enemyBullet, 1);
        for (const b of w.enemyBullets) g.fillCircle(b.x, b.y, ENEMY_BULLET_RADIUS);

        // Carriers go over every other enemy: their drops start at the hull centre and would hide the mark.
        for (const e of w.enemies) if (e.kind !== 'carrier') this.drawEnemy(e);
        if (w.carrier) this.drawEnemy(w.carrier);
        this.drawDebris();
        this.drawSplitRings();

        g.fillStyle(COLORS.releaseBullet, 1);
        for (const b of w.releaseBullets) g.fillCircle(b.x, b.y, RELEASE_RADIUS);
        this.drawReleaseRings();

        this.drawPlayer();
        this.drawHitRing();
    }

    /** Red ring where the player was hit: right after the player (or its explosion). */
    private drawHitRing() {
        const fx = this.hitFx;
        const p = hitRingProgress(fx.age);
        if (p < 0) return;
        this.gfx.lineStyle(HIT_RING_WIDTH, COLORS.enemyBullet, hitRingAlpha(p));
        this.gfx.strokeCircle(fx.x, fx.y, hitRingRadius(p));
    }

    /**
     * Red tint and edge band: both drawn once when the run starts (see createHitLayers) and faded as a
     * whole here, so a hit costs no redrawing.
     */
    private drawHitFlash() {
        const age = this.hitFx.age;
        const tint = hitTintAlpha(age);
        this.hitTintGfx.setAlpha(tint).setVisible(tint > 0);
        const edge = hitEdgeFade(age);
        this.hitEdgeGfx.setAlpha(edge).setVisible(edge > 0);
    }

    /** Paints the hit tint (full strength, faded by layer alpha) and the edge band for this run's screen size. */
    private createHitLayers(width: number, height: number) {
        const pad = RELEASE_SHAKE_AMPLITUDE;
        this.hitTintGfx = this.add.graphics().setDepth(HIT_LAYER_DEPTH).setVisible(false);
        this.hitTintGfx.fillStyle(COLORS.enemyBullet, 1);
        this.hitTintGfx.fillRect(-pad, -pad, width + pad * 2, height + pad * 2);
        this.hitEdgeGfx = this.add.graphics().setDepth(HIT_LAYER_DEPTH).setVisible(false);
        for (const r of edgeFrames(width, height, pad)) {
            this.hitEdgeGfx.fillStyle(COLORS.enemyBullet, r.alpha);
            this.hitEdgeGfx.fillRect(r.x, r.y, r.w, r.h);
        }
    }

    /** Debris of enemies release bullets killed: over the enemies, under the release bullets. */
    private drawDebris() {
        const g = this.gfx;
        // Finished bursts are dropped in DebrisEffects.update, so every burst here is showing.
        for (const b of this.debrisFx.bursts) {
            const p = debrisProgress(b.age);
            const r = debrisRadius(p);
            g.fillStyle(DEBRIS_COLORS[b.kind], 1);
            for (let i = 0; i < DEBRIS_COUNT; i++) g.fillCircle(debrisPieceX(b, i, p), debrisPieceY(b, i, p), r);
        }
    }

    /** Rings where splitters split: over the debris, under the release bullets. */
    private drawSplitRings() {
        const g = this.gfx;
        // Finished rings are dropped in SplitEffects.update, so every ring here is showing.
        for (const r of this.splitFx.rings) {
            const p = splitRingProgress(r.age);
            g.lineStyle(SPLIT_RING_WIDTH, COLORS.splitter, fadeAlpha(p));
            g.strokeCircle(r.x, r.y, splitRingRadius(p));
        }
    }

    /** Shockwave rings where releases fired: over the release bullets, under the player. */
    private drawReleaseRings() {
        const g = this.gfx;
        // Finished rings are dropped in ReleaseEffects.update, so every ring here is showing.
        for (const r of this.releaseFx.rings) {
            const p = releaseRingProgress(r.age);
            g.lineStyle(releaseRingWidth(r.count), COLORS.releaseBullet, fadeAlpha(p));
            g.strokeCircle(r.x, r.y, releaseRingRadius(r.count, p));
        }
    }

    /** Multi-kill counters and "+points" results: over the player, under the HUD (the boss popup's layer). */
    private drawMultiKills() {
        const fx = this.multiKillFx;
        const top = topLimit(this.world.boss !== null);
        // New results start where their counter was last drawn, so place them before dropping those counters.
        for (const r of fx.results) if (!this.resultViews.has(r)) this.resultViews.set(r, this.startResult(r, top));
        for (const [id, view] of this.counterViews) {
            if (!hasCounter(fx.counters, id)) this.freeText(view.text, () => this.counterViews.delete(id));
        }
        for (const [r, view] of this.resultViews) {
            if (!fx.results.includes(r)) this.freeText(view.text, () => this.resultViews.delete(r));
        }
        for (const c of fx.counters) this.drawCounter(c, top);
        for (const r of fx.results) {
            const view = this.resultViews.get(r);
            if (!view) continue;
            const p = resultProgress(r.age);
            view.text.setPosition(view.x, view.y - resultRise(p)).setAlpha(fadeAlpha(p)).setVisible(true);
        }
    }

    private drawCounter(c: KillCounter, top: number) {
        let view = this.counterViews.get(c.id);
        if (!view) {
            view = { text: this.takeText(), kills: 0, x: 0, y: 0 };
            this.counterViews.set(c.id, view);
        }
        const t = view.text;
        if (view.kills !== c.kills) {
            view.kills = c.kills;
            this.setLook(t, counterLabel(c.kills), counterFontSize(c.kills), multiKillColor(c.kills));
        }
        counterCenter(c.x, c.y, t.width, t.height, this.world.screen, top, view);
        t.setPosition(view.x, view.y).setScale(popScale(c.age)).setAlpha(1).setVisible(true);
    }

    /** A result's view: its counter's last drawn spot (measured now if the counter never showed), fitted to the result. */
    private startResult(r: KillResult, top: number): ResultView {
        const size = this.world.screen;
        const counter = this.counterViews.get(r.id);
        const t = this.takeText();
        let at: { x: number; y: number };
        if (counter && reusesCounterSpot(counter.kills, r.kills)) {
            at = { x: counter.x, y: counter.y };
        } else {
            this.setLook(t, counterLabel(r.kills), counterFontSize(r.kills), multiKillColor(r.kills));
            at = counterCenter(r.x, r.y, t.width, t.height, size, top);
        }
        this.setLook(t, resultLabel(r.score), resultFontSize(r.kills), multiKillColor(r.kills));
        t.setScale(1);
        const start = resultStart(at, r.lastIsBoss, t.width, t.height, size, top);
        return { text: t, x: start.x, y: start.y };
    }

    private takeText(): GameObjects.Text {
        return this.spareTexts.pop() ?? this.add.text(0, 0, '', {
            fontFamily: 'monospace', fontSize: MULTIKILL_FONT_BASE, color: TEXT_CSS_COLOR, stroke: '#000000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(5).setVisible(false);
    }

    private freeText(t: GameObjects.Text, unbind: () => void) {
        t.setVisible(false);
        this.spareTexts.push(t);
        unbind();
    }

    /**
     * Restyles a text only when its content, size or colour changes. Sizes already measured reuse their
     * metrics, so a change costs a single re-render (setText); a size seen for the first time measures once.
     */
    private setLook(t: GameObjects.Text, text: string, fontSize: number, color: number) {
        const look = this.textLooks.get(t);
        if (look && look.text === text && look.fontSize === fontSize && look.color === color) return;
        const metrics = this.fontMetrics.get(fontSize);
        const style = t.style;
        style.setStyle({ fontSize: `${fontSize}px`, color: cssColor(color), ...(metrics ? { metrics } : {}) }, false);
        if (!metrics) {
            style.update(true);
            this.fontMetrics.set(fontSize, style.getTextMetrics());
        }
        if (t.text !== text) t.setText(text);
        else if (metrics) t.updateText();
        if (look) {
            look.text = text;
            look.fontSize = fontSize;
            look.color = color;
        } else {
            this.textLooks.set(t, { text, fontSize, color });
        }
    }

    private drawPlayer() {
        const g = this.gfx;
        const w = this.world;
        const p = w.player;
        if (w.phase === 'ending' || w.phase === 'over') {
            const t = Math.min(w.phaseTime / ENDING_DURATION, 1);
            g.fillStyle(COLORS.explosion, 1 - t);
            g.fillCircle(p.x, p.y, PLAYER_RADIUS + t * 80);
            return;
        }
        if (w.phase === 'playing') {
            // The field glows brighter as the stock fills up.
            g.fillStyle(COLORS.field, 0.06 + 0.2 * (w.stock / STOCK_MAX));
            g.fillCircle(p.x, p.y, FIELD_RADIUS);
            const fx = this.absorbFx;
            g.lineStyle(edgeWidth(fx.pulseAge), COLORS.field, edgeAlpha(fx.pulseAge));
            g.strokeCircle(p.x, p.y, FIELD_RADIUS);
            const ring = absorbRingProgress(fx.ringAge);
            if (ring >= 0) {
                g.lineStyle(ABSORB_RING_WIDTH, COLORS.field, fadeAlpha(ring));
                g.strokeCircle(p.x, p.y, absorbRingRadius(ring));
            }
            this.drawSucks();
        }
        const blinkOff = p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0;
        if (!blinkOff) {
            g.fillStyle(COLORS.player, 1);
            g.fillCircle(p.x, p.y, PLAYER_RADIUS);
        }
    }

    /** Absorbed bullets being pulled into the player: every afterimage first, then the bullets in front. */
    private drawSucks() {
        const sucks = this.absorbFx.sucks;
        for (let k = ABSORB_TRAIL_COUNT; k >= 1; k--) {
            for (const s of sucks) this.drawSuckAt(s, trailProgress(s.age, k), trailAlpha(k));
        }
        for (const s of sucks) this.drawSuckAt(s, suckProgress(s.age), 1);
    }

    private drawSuckAt(s: Suck, progress: number, alpha: number) {
        if (progress < 0) return;
        const p = this.world.player;
        this.gfx.fillStyle(lerpColor(COLORS.enemyBullet, COLORS.field, progress), alpha);
        this.gfx.fillCircle(suckCoord(s.x, p.x, progress), suckCoord(s.y, p.y, progress), suckRadius(progress));
    }

    private drawEnemy(e: Enemy) {
        const g = this.gfx;
        const r = e.radius;
        switch (e.kind) {
            case 'grunt': {
                const shake = e.state === 'warn' ? Math.sin((e.stateTime / GRUNT_WARN) * Math.PI * 16) * 3 : 0;
                const x = e.x + shake;
                g.fillStyle(COLORS.grunt, 1);
                g.fillTriangle(x - r, e.y - r * 0.7, x + r, e.y - r * 0.7, x, e.y + r);
                break;
            }
            case 'shooter': {
                const blinking = e.state === 'sweep-warn' && Math.floor(e.stateTime * 10) % 2 === 0;
                g.fillStyle(blinking ? COLORS.warn : COLORS.shooter, 1);
                g.fillRect(e.x - r, e.y - r, r * 2, r * 2);
                break;
            }
            case 'heavy': {
                // All chasing heavies flash together from the warning until the charge ends.
                const t = this.world.elapsed;
                const blinking = e.state === 'chase' && heavyPhase(t) !== 'surround' && Math.floor(t * 10) % 2 === 0;
                g.fillStyle(blinking ? COLORS.warn : COLORS.heavy, 1);
                g.fillCircle(e.x, e.y, r);
                g.lineStyle(3, 0xffffff, 0.6);
                g.strokeCircle(e.x, e.y, r * 0.6);
                break;
            }
            case 'splitter':
            case 'splitterChild':
            {
                // Parent and children share the same diamond, the children just smaller. The fill stays within the
                // hit radius; a child's outline is centred on the edge, so half its width pokes out.
                const w = r * DIAMOND_WIDTH_RATIO;
                // A child blinks white just before its dash, and keeps a white outline so it stays visible.
                g.fillStyle(e.kind === 'splitterChild' && childFlashesWhite(e) ? COLORS.warn : COLORS.splitter, 1);
                g.fillTriangle(e.x, e.y - r, e.x + w, e.y, e.x - w, e.y);
                g.fillTriangle(e.x, e.y + r, e.x + w, e.y, e.x - w, e.y);
                if (e.kind === 'splitterChild') {
                    g.lineStyle(SPLITTER_CHILD_OUTLINE_WIDTH, COLORS.childOutline, SPLITTER_CHILD_OUTLINE_ALPHA);
                    g.beginPath();
                    g.moveTo(e.x, e.y - r);
                    g.lineTo(e.x + w, e.y);
                    g.lineTo(e.x, e.y + r);
                    g.lineTo(e.x - w, e.y);
                    g.closePath();
                    g.strokePath();
                }
                break;
            }
            case 'carrier': {
                // A wide grey hexagon with a mark in the colour of the kind it drops.
                const h = r * CARRIER_HEIGHT_RATIO;
                g.fillStyle(COLORS.carrier, 1);
                const top = r * CARRIER_TOP_RATIO;
                g.fillRect(e.x - top, e.y - h, top * 2, h * 2);
                g.fillTriangle(e.x - r, e.y, e.x - top, e.y - h, e.x - top, e.y + h);
                g.fillTriangle(e.x + r, e.y, e.x + top, e.y - h, e.x + top, e.y + h);
                g.fillStyle(this.dropFlashes.isFlashing(e) ? COLORS.warn : COLORS[e.cargo], 1);
                g.fillCircle(e.x, e.y, h * CARRIER_MARK_RATIO);
                break;
            }
            case 'boss':
                // The boss shows its HP on the HUD bar instead of pips.
                this.drawBoss(e);
                return;
            default: {
                const blinking = e.state === 'warn' && Math.floor(e.stateTime * 10) % 2 === 0;
                g.fillStyle(blinking ? COLORS.warn : COLORS.rammer, 1);
                // Arrow head pointing along the charge direction (straight down until it locks on).
                const h = e.state === 'dash' ? e.heading : Math.PI / 2;
                const cos = Math.cos(h);
                const sin = Math.sin(h);
                g.fillTriangle(
                    e.x + cos * r * 1.3, e.y + sin * r * 1.3,
                    e.x - cos * r + sin * r, e.y - sin * r - cos * r,
                    e.x - cos * r - sin * r, e.y - sin * r + cos * r
                );
            }
        }
        // Remaining HP as small pips under each enemy; the flat carrier hull keeps them snug and hull-wide.
        const carrier = e.kind === 'carrier';
        const below = carrier ? r * CARRIER_HEIGHT_RATIO : r;
        const pitch = carrier ? CARRIER_PIP_PITCH : PIP_PITCH;
        g.fillStyle(0xffffff, 0.8);
        for (let i = 0; i < e.hp; i++) g.fillRect(e.x - (e.hp * pitch) / 2 + i * pitch, e.y + below + 4, 4, 3);
    }

    /** A spiked gold disc with a dark core; flashes white while telegraphing a charge. */
    private drawBoss(e: Enemy) {
        const g = this.gfx;
        const r = e.radius;
        const blinking = e.state === 'warn' && Math.floor(e.stateTime * 10) % 2 === 0;
        g.fillStyle(blinking ? COLORS.warn : COLORS.boss, 1);
        const spikes = 10;
        // The scene's own clock keeps the spin going through ending (the world's playing clock stops there)
        // and holds it still while paused.
        const spin = this.spinClock * 0.5;
        for (let i = 0; i < spikes; i++) {
            const a = (Math.PI * 2 * i) / spikes + spin;
            const b = Math.PI / spikes;
            g.fillTriangle(
                e.x + Math.cos(a) * r * 1.25, e.y + Math.sin(a) * r * 1.25,
                e.x + Math.cos(a - b) * r * 0.8, e.y + Math.sin(a - b) * r * 0.8,
                e.x + Math.cos(a + b) * r * 0.8, e.y + Math.sin(a + b) * r * 0.8
            );
        }
        g.fillCircle(e.x, e.y, r);
        // The warning flash turns the whole boss white, core included.
        g.fillStyle(blinking ? COLORS.warn : COLORS.bossCore, 1);
        g.fillCircle(e.x, e.y, r * 0.45);
        if (hitFlashVisible(this.hitFlashAge)) {
            // On a white warning frame a white ring would vanish, so use the dark core color there.
            g.lineStyle(BOSS_HIT_FLASH_WIDTH, blinking ? COLORS.bossCore : COLORS.warn, 1);
            g.strokeCircle(e.x, e.y, r);
        }
    }

    /** The HP bar under the HUD band, shown only while a boss is on the field. */
    private drawBossBar() {
        const boss = this.world.boss;
        const hp = boss ? boss.hp : -1;
        if (hp === this.shownBossHp) return;
        this.shownBossHp = hp;
        const g = this.bossGfx;
        g.clear();
        this.bossLabel.setVisible(boss !== null);
        if (!boss) return;
        const x = this.bossBarX();
        const width = this.world.screen.width * BOSS_BAR_WIDTH_RATIO;
        g.fillStyle(COLORS.gaugeBack, 1);
        g.fillRect(x, HUD_HEIGHT, width, BOSS_BAR_HEIGHT);
        g.fillStyle(COLORS.boss, 1);
        g.fillRect(x, HUD_HEIGHT, width * (boss.hp / boss.maxHp), BOSS_BAR_HEIGHT);
    }

    private drawHud() {
        const w = this.world;
        if (w.score !== this.shownScore) {
            this.shownScore = w.score;
            this.scoreText.setText(`SCORE ${w.score}`);
        }
        if (w.player.lives !== this.shownLives) {
            this.shownLives = w.player.lives;
            this.livesText.setText(`LIFE ${'♥'.repeat(Math.max(w.player.lives, 0))}`);
        }
        if (w.stock !== this.shownStock) {
            this.shownStock = w.stock;
            this.stockText.setText(`${w.stock}/${STOCK_MAX}`);
            this.redrawGaugeAndButton();
        } else if (this.buttonFx.playing || this.buttonFxShown) {
            this.redrawGaugeAndButton();
        }
        this.buttonFxShown = this.buttonFx.playing;
        this.drawBossBar();
        const countdown = w.phase === 'ready';
        const center = countdown
            ? String(Math.max(1, Math.ceil(READY_DURATION - w.phaseTime)))
            : w.bossAnnounce > 0 ? 'BOSS' : '';
        if (this.centerText.text !== center) {
            this.centerText.setText(center).setColor(countdown ? TEXT_CSS_COLOR : BOSS_CSS_COLOR);
        }
        this.centerText.setAlpha(countdown ? 1 : announceAlpha(w.bossAnnounce, w.phase === 'ending' || w.phase === 'over'));
    }

    private redrawGaugeAndButton() {
        const g = this.hudGfx;
        const stock = this.world.stock;
        const x = this.gaugeX();
        g.clear();
        g.fillStyle(COLORS.gaugeBack, 1);
        g.fillRect(x, GAUGE_Y, GAUGE_WIDTH, GAUGE_HEIGHT);
        g.fillStyle(COLORS.gaugeFill, 1);
        g.fillRect(x, GAUGE_Y, GAUGE_WIDTH * (stock / STOCK_MAX), GAUGE_HEIGHT);
        if (!this.buttonText) return;
        // The release button brightens once there is something to release, and reacts to a press.
        const { age, kind } = this.buttonFx;
        const color = buttonColor(age, kind);
        const radius = buttonRadius(age, kind);
        g.fillStyle(color, buttonFillAlpha(age, kind, stock));
        g.fillCircle(this.buttonX, this.buttonY, radius);
        g.lineStyle(3, color, buttonStrokeAlpha(age, kind, stock));
        g.strokeCircle(this.buttonX, this.buttonY, radius);
        this.buttonText.setText(String(stock));
    }
}
