import { Scene, type GameObjects, type Input, type Time, type Tweens } from 'phaser';
import {
    CELL,
    CLEAR_MS,
    FALL_MS_PER_CELL,
    FONT_HUD_LABEL,
    FONT_HUD_VALUE,
    FONT_NOTICE,
    FONT_POP,
    HINT_DELAY_MS,
    HINT_HALF_MS,
    HINT_SCALE,
    PANEL_PAD,
    PANEL_RADIUS,
    POP_MS,
    POP_RISE,
    RESULT_DELAY_MS,
    SCORE_BUMP_MS,
    SCORE_BUMP_SCALE,
    SHUFFLE_NOTICE_MS,
    SWAP_MS,
} from '../params';
import { findMove, RAINBOW, type Kind, type Pos } from '../logic/board';
import { cellAt, initialInput, isBoardKey, pressKey, swipe, swipeFrom, tapStone, touchOutside } from '../logic/input';
import { boardRect, cellCenter, hudLayout, type HudLayout, type Rect } from '../logic/layout';
import { Round, type NextState, type Step } from '../logic/round';
import { centerOf, clampPopup, hudBest, movesWarning, popupLines, popupScale } from '../logic/score';
import { gemKey } from '../logic/special';
import {
    applyScreenSize,
    bestStore,
    BG_COLOR,
    COLOR,
    DEPTH,
    onKeyDown,
    RotateGuard,
    SceneExit,
    setClockPaused,
    STYLE,
    UI_FONT,
} from './ui';

/** The notice's background colour as `r, g, b` (from COLOR.noticeBg), for the Text style's CSS colour. */
const NOTICE_RGB = [COLOR.noticeBg >> 16, (COLOR.noticeBg >> 8) & 0xff, COLOR.noticeBg & 0xff].join(', ');

type Phase = 'idle' | 'swapping' | 'resolving' | 'shuffling' | 'ending';
type Gem = GameObjects.Image;

/** The kinds that keep their colour; the colour stone has its own texture. */
const COLOURED_KINDS: Kind[] = ['normal', 'lineRow', 'lineCol', 'bomb'];

/** Dev-only QA flag (`?qashuffle`); constant false in the production bundle. */
let qaForceShuffle = import.meta.env.DEV && new URLSearchParams(window.location.search).has('qashuffle');

export class Game extends Scene {
    private round!: Round;
    private phase: Phase = 'idle';
    private rect!: Rect;
    private hud!: HudLayout;
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private gems: (Gem | null)[][] = [];
    private inp = initialInput();
    /** The press in progress (one pointer at a time), or null when none counts. */
    private down: { id: number; pos: Pos; x: number; y: number } | null = null;
    private hintTimer: Time.TimerEvent | null = null;
    private hintGems: Gem[] = [];
    private scoreBump: Tweens.Tween | null = null;
    private shownScore = 0;
    private shownMoves = 0;
    private savedBest = bestStore.load();
    private scoreText!: GameObjects.Text;
    private movesText!: GameObjects.Text;
    private bestText!: GameObjects.Text;
    private selection!: GameObjects.Rectangle;
    private cursor!: GameObjects.Rectangle;
    private notice!: GameObjects.Text;

    constructor() {
        super('Game');
    }

    /** The stone textures are drawn once here (no files to load), so `create` only builds the scene. */
    preload() {
        this.makeTextures();
    }

    create() {
        const { width, height } = applyScreenSize(this);
        this.rect = boardRect(height);
        this.hud = hudLayout(height);
        this.cameras.main.setBackgroundColor(BG_COLOR);

        this.round = new Round(Math.random);
        if (import.meta.env.DEV) {
            // Dev-only QA aid: `?qamoves=<n>` starts with n moves so the ending can be reached quickly.
            const n = Number(new URLSearchParams(window.location.search).get('qamoves'));
            if (n > 0) this.round.moves = n;
        }
        this.phase = 'idle';
        this.inp = initialInput();
        this.down = null;
        this.hintTimer = null;
        this.hintGems = [];
        this.savedBest = bestStore.load();
        this.shownScore = 0;
        this.shownMoves = this.round.moves;

        this.gems = [];
        this.scoreBump = null;
        this.buildPanel();
        this.buildGems();
        // Refilled stones fall in from above the board: this cover (the HUD's background) hides them above the plate.
        this.add
            .rectangle(0, 0, width, this.rect.y - PANEL_PAD, BG_COLOR)
            .setOrigin(0, 0)
            .setDepth(DEPTH.cover);
        this.buildHud();
        this.cursor = this.add
            .rectangle(0, 0, CELL - STYLE.cursorInset, CELL - STYLE.cursorInset)
            .setStrokeStyle(STYLE.cursorWidth, COLOR.cursor)
            .setVisible(false)
            .setDepth(DEPTH.cursor);
        this.selection = this.add
            .rectangle(0, 0, CELL, CELL)
            .setStrokeStyle(STYLE.selectionWidth, COLOR.selection)
            .setVisible(false)
            .setDepth(DEPTH.selection);
        this.notice = this.add
            .text(width / 2, this.rect.y + this.rect.h / 2, '', {
                fontFamily: UI_FONT,
                fontSize: `${FONT_NOTICE}px`,
                color: COLOR.text,
                align: 'center',
                backgroundColor: `rgba(${NOTICE_RGB}, ${STYLE.noticeBgAlpha})`,
                padding: { x: STYLE.noticePadX, y: STYLE.noticePadY },
            })
            .setOrigin(0.5)
            .setDepth(DEPTH.notice)
            .setVisible(false);

        // The notice first: it freezes the clock (tweens and timers) while it shows.
        this.guard = new RotateGuard(this, (active) => {
            setClockPaused(this, active);
            if (active) this.down = null;
        });
        this.exit = new SceneExit(this);

        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointermove', this.onMove, this);
        this.input.on('pointerup', this.onUp, this);
        this.input.on('pointerupoutside', this.cancelDown, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerdown', this.onDown, this);
            this.input.off('pointermove', this.onMove, this);
            this.input.off('pointerup', this.onUp, this);
            this.input.off('pointerupoutside', this.cancelDown, this);
        });
        onKeyDown(this, (key) => this.onKey(key));

        if (import.meta.env.DEV) {
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Game' },
                phase: { get: () => this.phase },
                moves: { get: () => this.shownMoves },
                score: { get: () => this.shownScore },
                board: { get: () => this.round.board.map((row) => [...row]) },
                kinds: { get: () => this.round.kinds.map((row) => [...row]) },
                // Replaces the board (and the kinds, normal when omitted) so QA can set up a hand-made position.
                load: {
                    value: (rows: number[][], kinds?: Kind[][]) => {
                        rows.forEach((row, r) =>
                            row.forEach((v, c) => {
                                this.round.board[r][c] = v;
                                this.round.kinds[r][c] = kinds?.[r][c] ?? 'normal';
                            }),
                        );
                        this.clearHint();
                        this.buildGems();
                        this.scheduleHint();
                    },
                },
                rect: { get: () => ({ ...this.rect }) },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                guard: { get: () => this.guard.active },
                hinting: { get: () => this.hintGems.length > 0 },
                move: { get: () => findMove(this.round.board) },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
            if (new URLSearchParams(window.location.search).has('qapopups')) {
                // Dev-only QA aid: `?qapopups` shows the biggest pop-up (chain 6, three lines) at the four corners.
                for (const [r, c] of [[0, 0], [0, 7], [7, 0], [7, 7]]) {
                    const cleared = Array.from({ length: 5 }, () => ({ r, c }));
                    this.popup({ chain: 6, gain: 270, cleared, spawned: [], count: cleared.length, falls: [], added: [] });
                }
            }
        }
        this.scheduleHint();
    }

    // ---- building --------------------------------------------------------------------------------------

    /**
     * One texture per (colour, kind): a circle with a highlight, plus the mark of a special stone (a bar for a
     * line, a ring for a bomb), and one colour wheel for the colour stone. Made once and kept for the whole page.
     */
    private makeTextures() {
        const make = (key: string, draw: (g: GameObjects.Graphics) => void) => {
            if (this.textures.exists(key)) return;
            const g = this.add.graphics();
            draw(g);
            g.generateTexture(key, CELL, CELL);
            g.destroy();
        };
        const mid = CELL / 2;
        COLOR.gems.forEach((color, i) => {
            for (const kind of COLOURED_KINDS) {
                make(gemKey(i, kind), (g) => {
                    g.fillStyle(color, 1).fillCircle(mid, mid, mid - STYLE.gemInset);
                    g.fillStyle(0xffffff, STYLE.gemShineAlpha).fillCircle(
                        mid - STYLE.gemShineOffset,
                        mid - STYLE.gemShineOffset,
                        STYLE.gemShineRadius,
                    );
                    this.drawMark(g, kind);
                });
            }
        });
        make(gemKey(RAINBOW, 'rainbow'), (g) => {
            const radius = mid - STYLE.gemInset;
            const slice = (Math.PI * 2) / COLOR.gems.length;
            COLOR.gems.forEach((color, i) => {
                const from = -Math.PI / 2 + i * slice;
                g.fillStyle(color, 1).slice(mid, mid, radius, from, from + slice, false).fillPath();
            });
            g.lineStyle(STYLE.wheelRim, COLOR.mark, 1).strokeCircle(mid, mid, radius - STYLE.wheelRim / 2);
        });
    }

    /** The white mark (with a dark outline, so it reads on every colour) of a line or bomb stone. */
    private drawMark(g: GameObjects.Graphics, kind: Kind) {
        const mid = CELL / 2;
        const { markLength: len, markThickness: thick, markOutline: out } = STYLE;
        const bar = (w: number, h: number, color: number, grow: number) =>
            g.fillStyle(color, 1).fillRect(mid - w / 2 - grow, mid - h / 2 - grow, w + 2 * grow, h + 2 * grow);
        if (kind === 'lineRow' || kind === 'lineCol') {
            const [w, h] = kind === 'lineRow' ? [len, thick] : [thick, len];
            bar(w, h, COLOR.markOutline, out);
            bar(w, h, COLOR.mark, 0);
        } else if (kind === 'bomb') {
            g.lineStyle(thick + 2 * out, COLOR.markOutline, 1).strokeCircle(mid, mid, STYLE.markRingRadius);
            g.lineStyle(thick, COLOR.mark, 1).strokeCircle(mid, mid, STYLE.markRingRadius);
        }
    }

    /** The plate behind the board: it shows where the board is. */
    private buildPanel() {
        const r = this.rect;
        this.add
            .graphics()
            .fillStyle(COLOR.panel, 1)
            .fillRoundedRect(r.x - PANEL_PAD, r.y - PANEL_PAD, r.w + 2 * PANEL_PAD, r.h + 2 * PANEL_PAD, PANEL_RADIUS)
            .setDepth(DEPTH.panel);
    }

    private buildGems() {
        this.gems.flat().forEach((g) => g?.destroy());
        this.gems = this.round.board.map((row, r) =>
            row.map((color, c) => this.spawn(r, c, color as number, this.round.kinds[r][c])),
        );
    }

    /** A stone of `color` in column `c`, drawn at the height of `row` (a row above the board for refills). */
    private spawn(row: number, c: number, color: number, kind: Kind = 'normal'): Gem {
        const at = cellCenter(this.rect, { r: row, c });
        return this.add.image(at.x, at.y, gemKey(color, kind)).setDepth(DEPTH.gems);
    }

    private buildHud() {
        const h = this.hud;
        const label = (x: number, text: string, originX: number) =>
            this.add
                .text(x, h.labelY, text, { fontFamily: UI_FONT, fontSize: `${FONT_HUD_LABEL}px`, color: COLOR.muted })
                .setOrigin(originX, 0.5)
                .setDepth(DEPTH.hud);
        const value = (x: number, originX: number) =>
            this.add
                .text(x, h.valueY, '', { fontFamily: UI_FONT, fontSize: `${FONT_HUD_VALUE}px`, color: COLOR.text })
                .setOrigin(originX, 0.5)
                .setDepth(DEPTH.hud);
        label(h.leftX, 'SCORE', 0);
        label(h.rightX, 'MOVES', 1);
        this.scoreText = value(h.leftX, 0);
        this.movesText = value(h.rightX, 1);
        this.bestText = this.add
            .text(h.centerX, h.bestY, '', { fontFamily: UI_FONT, fontSize: `${FONT_HUD_LABEL}px`, color: COLOR.muted })
            .setOrigin(0.5)
            .setDepth(DEPTH.hud);
        this.refreshHud();
    }

    private refreshHud() {
        this.scoreText.setText(String(this.shownScore));
        this.movesText.setText(String(this.shownMoves));
        this.movesText.setColor(movesWarning(this.shownMoves) ? COLOR.warn : COLOR.text);
        this.bestText.setText(hudBest(this.savedBest, this.shownScore));
    }

    // ---- input -----------------------------------------------------------------------------------------

    /** Input is ignored under the rotate notice and while anything is animating. */
    private blocked(): boolean {
        return this.guard.active || this.phase !== 'idle';
    }

    private syncMarkers() {
        const { selected, cursor, cursorVisible } = this.inp;
        this.selection.setVisible(selected !== null);
        if (selected) {
            const at = cellCenter(this.rect, selected);
            this.selection.setPosition(at.x, at.y);
        }
        this.cursor.setVisible(cursorVisible);
        if (cursorVisible) {
            const at = cellCenter(this.rect, cursor);
            this.cursor.setPosition(at.x, at.y);
        }
    }

    private onDown(p: Input.Pointer) {
        // A press that starts while input is refused never acts, not even when released after input returns.
        if (this.blocked()) {
            this.down = null;
            return;
        }
        if (this.down) return; // one finger at a time
        this.clearHint();
        const pos = cellAt(p.x, p.y, this.rect);
        if (!pos) {
            this.inp = touchOutside(this.inp);
            this.syncMarkers();
            this.scheduleHint(); // a press off the board still counts as the last input
            return;
        }
        this.down = { id: p.id, pos, x: p.x, y: p.y };
    }

    private onMove(p: Input.Pointer) {
        const d = this.down;
        if (!d || p.id !== d.id || !p.isDown || this.blocked()) return;
        const s = swipe(d.pos, p.x - d.x, p.y - d.y);
        if (s === 'pending') return;
        this.down = null;
        this.inp = swipeFrom(this.inp, d.pos);
        this.syncMarkers();
        if (s.to) void this.attempt(d.pos, s.to);
        else this.scheduleHint();
    }

    private onUp(p: Input.Pointer) {
        const d = this.down;
        if (!d || p.id !== d.id) return;
        this.down = null;
        if (p.wasCanceled || this.blocked()) {
            this.scheduleHint();
            return;
        }
        const out = tapStone(this.inp, d.pos);
        this.inp = out.state;
        this.syncMarkers();
        if (out.swap) void this.attempt(out.swap[0], out.swap[1]);
        else this.scheduleHint();
    }

    /** The pointer was released outside the canvas: the press is dropped. */
    private cancelDown(p: Input.Pointer) {
        if (this.down && p.id === this.down.id) {
            this.down = null;
            this.scheduleHint();
        }
    }

    private onKey(key: string) {
        if (this.blocked() || !isBoardKey(key)) return;
        this.clearHint();
        const out = pressKey(this.inp, key);
        this.inp = out.state;
        this.syncMarkers();
        if (out.swap) void this.attempt(out.swap[0], out.swap[1]);
        else this.scheduleHint();
    }

    // ---- hint ------------------------------------------------------------------------------------------

    private scheduleHint() {
        this.clearHint();
        if (this.phase !== 'idle') return;
        this.hintTimer = this.time.delayedCall(HINT_DELAY_MS, () => this.showHint());
    }

    private clearHint() {
        this.hintTimer?.remove();
        this.hintTimer = null;
        for (const g of this.hintGems) {
            this.tweens.killTweensOf(g);
            g.setScale(1);
        }
        this.hintGems = [];
    }

    /** Pulses the two stones of the first available move until the player acts. */
    private showHint() {
        this.hintTimer = null;
        const move = this.phase === 'idle' ? findMove(this.round.board) : null;
        if (!move) return;
        this.hintGems = move.map((p) => this.gems[p.r][p.c] as Gem);
        this.tweens.add({ targets: this.hintGems, scale: HINT_SCALE, duration: HINT_HALF_MS, yoyo: true, repeat: -1 });
    }

    // ---- a turn ----------------------------------------------------------------------------------------

    private tween(targets: object | object[], props: object, duration: number): Promise<void> {
        return new Promise((resolve) => {
            this.tweens.add({ targets, ...props, duration, onComplete: () => resolve() });
        });
    }

    private wait(ms: number): Promise<void> {
        return new Promise((resolve) => {
            this.time.delayedCall(ms, () => resolve());
        });
    }

    private async attempt(from: Pos, to: Pos) {
        if (this.phase !== 'idle') return;
        this.phase = 'swapping';
        this.clearHint();
        const outcome = this.round.swap(from, to);
        await this.animateSwap(from, to);
        if (!outcome.accepted) {
            await this.animateSwap(from, to); // no match: it goes back and costs nothing
            this.goIdle();
            return;
        }
        this.shownMoves = this.round.moves;
        this.refreshHud();
        this.phase = 'resolving';
        for (const step of outcome.steps) await this.playStep(step);
        await this.finishTurn(outcome.next);
    }

    /** Swaps the two stones on screen (calling it again undoes it). */
    private async animateSwap(a: Pos, b: Pos) {
        const ga = this.gems[a.r][a.c] as Gem;
        const gb = this.gems[b.r][b.c] as Gem;
        this.gems[a.r][a.c] = gb;
        this.gems[b.r][b.c] = ga;
        const toB = cellCenter(this.rect, b);
        const toA = cellCenter(this.rect, a);
        await Promise.all([this.tween(ga, toB, SWAP_MS), this.tween(gb, toA, SWAP_MS)]);
    }

    /** The SCORE number swells and settles (a new gain restarts it from the normal size). */
    private bumpScore() {
        this.scoreBump?.remove();
        this.scoreText.setScale(1);
        this.scoreBump = this.tweens.add({
            targets: this.scoreText,
            scale: SCORE_BUMP_SCALE,
            duration: SCORE_BUMP_MS / 2,
            yoyo: true,
            onComplete: () => {
                this.scoreBump = null; // a finished tween is destroyed: don't keep its handle
            },
        });
    }

    private async playStep(step: Step) {
        this.shownScore += step.gain;
        this.refreshHud();
        this.bumpScore();
        this.popup(step);
        // The stones that turn into special stones stay; they change their look at the moment the others shrink.
        for (const s of step.spawned) (this.gems[s.r][s.c] as Gem).setTexture(gemKey(s.color, s.kind));
        const dying = step.cleared.map((p) => this.gems[p.r][p.c] as Gem);
        step.cleared.forEach((p) => (this.gems[p.r][p.c] = null));
        await this.tween(dying, { scale: 0, alpha: 0 }, CLEAR_MS);
        dying.forEach((g) => g.destroy());

        const jobs: Promise<void>[] = [];
        for (const f of step.falls) {
            const g = this.gems[f.from][f.c] as Gem;
            this.gems[f.from][f.c] = null;
            this.gems[f.to][f.c] = g;
            const y = cellCenter(this.rect, { r: f.to, c: f.c }).y;
            jobs.push(this.tween(g, { y, ease: 'Quad.easeIn' }, FALL_MS_PER_CELL * (f.to - f.from)));
        }
        const perColumn = new Array<number>(this.round.board[0].length).fill(0);
        step.added.forEach((a) => perColumn[a.c]++);
        for (const a of step.added) {
            const g = this.spawn(a.r - perColumn[a.c], a.c, a.color);
            this.gems[a.r][a.c] = g;
            const y = cellCenter(this.rect, a).y;
            jobs.push(this.tween(g, { y, ease: 'Quad.easeIn' }, FALL_MS_PER_CELL * perColumn[a.c]));
        }
        await Promise.all(jobs);
    }

    /** `CHAIN xn` / `BONUS` / `+points` floating up from the middle of the cleared stones. */
    private popup(step: Step) {
        const mid = centerOf([...step.cleared, ...step.spawned].map((p) => cellCenter(this.rect, p)));
        const size = popupScale(step.chain);
        const at = clampPopup(mid.x, mid.y, this.rect.y, this.rect.y + this.rect.h, size);
        const text = this.add
            .text(at.x, at.y, popupLines(step.count, step.chain, step.gain).join('\n'), {
                fontFamily: UI_FONT,
                fontSize: `${Math.round(FONT_POP * size)}px`,
                color: step.chain >= 2 ? COLOR.accent : COLOR.text,
                stroke: COLOR.popStroke,
                strokeThickness: STYLE.popStrokeWidth,
                align: 'center',
            })
            .setOrigin(0.5)
            .setDepth(DEPTH.pop);
        this.tweens.add({
            targets: text,
            y: at.y - POP_RISE,
            alpha: 0,
            duration: POP_MS,
            onComplete: () => text.destroy(),
        });
    }

    private async finishTurn(resolved: NextState) {
        let next = resolved;
        if (import.meta.env.DEV && qaForceShuffle && next === 'idle') {
            // Dev-only QA aid: `?qashuffle` sends the first idle turn through the stuck-board path.
            qaForceShuffle = false;
            next = 'shuffle';
        }
        if (next === 'ending') {
            this.phase = 'ending';
            this.showNotice('FINISH');
            await this.wait(RESULT_DELAY_MS);
            this.exit.to('Result', { score: this.round.score });
            return;
        }
        if (next === 'shuffle') {
            this.phase = 'shuffling';
            this.round.reshuffle();
            this.buildGems();
            this.showNotice('NO MOVES\nSHUFFLE');
            await this.wait(SHUFFLE_NOTICE_MS);
            this.notice.setVisible(false);
        }
        this.goIdle();
    }

    private showNotice(text: string) {
        this.notice.setText(text).setVisible(true);
    }

    private goIdle() {
        this.phase = 'idle';
        this.scheduleHint();
    }
}
