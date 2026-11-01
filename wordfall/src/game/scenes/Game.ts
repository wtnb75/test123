import { Scene, type GameObjects, type Input, type Time, type Tweens } from 'phaser';
import {
    COLUMNS,
    COMPLETE_FLASH_MS,
    FONT_HINT,
    FONT_HUD,
    FONT_LETTER,
    FONT_MEANING,
    FONT_POP,
    FONT_TARGET,
    FONT_TRAY,
    FULL_RIM_MS,
    FULL_SHAKE_INTENSITY,
    FULL_SHAKE_MS,
    HUD_Y,
    LETTER_SIZE,
    MEANING_OFFSET,
    RESULT_DELAY,
    SCREEN_WIDTH,
    SPAWN_INTERVAL_MS,
    TARGET_LETTER_STEP,
    TARGET_ROW_STEP,
    TARGET_Y0,
    TRAY_CAPACITY,
} from '../params';
import {
    bumpTween,
    effectCounts,
    flyPlan,
    ghostTween,
    isLowTime,
    popText,
    popTween,
    shouldBumpTime,
} from '../logic/effects';
import { fallDistance, hasLanded, stepSpawn } from '../logic/falling';
import { freeColumns, pickColumn, pickLetter } from '../logic/letters';
import { columnX, fieldGeometry, traySlotAt, traySlotRect, type FieldGeometry } from '../logic/layout';
import { buildResultList } from '../logic/results';
import { Round } from '../logic/round';
import { scoreFor } from '../logic/scoring';
import { letterAtPoint, lowestLetterWithChar, type FallingLetter } from '../logic/targeting';
import { matchedMask } from '../logic/tray';
import type { Word } from '../logic/words';
import {
    addLabel,
    applyScreenSize,
    BG_COLOR,
    COLOR,
    DEPTH,
    MONO_FONT,
    onKeyDown,
    POP_STROKE_WIDTH,
    RotateGuard,
    SceneExit,
    SLOT_STROKE,
    UI_FONT,
} from './ui';

interface Letter extends FallingLetter {
    col: number;
    obj: GameObjects.Container;
}

/** A target row's Text objects: its letters (and which are green now) and the meaning line. */
interface TargetRowView {
    en: string;
    letters: GameObjects.Text[];
    matched: boolean[];
    meaning: GameObjects.Text;
}

interface TraySlotView {
    box: GameObjects.Rectangle;
    label: GameObjects.Text;
    /** The letter shown ('' when empty). */
    ch: string;
}

export class Game extends Scene {
    private round!: Round;
    private geom!: FieldGeometry;
    private height = 0;
    private letters: Letter[] = [];
    private spawnAcc = 0;
    private endElapsed = 0;
    private guard!: RotateGuard;
    private exit!: SceneExit;
    private scoreText!: GameObjects.Text;
    private timeText!: GameObjects.Text;
    private targetRows: TargetRowView[] = [];
    private traySlots: TraySlotView[] = [];
    private shownScore = -1;
    private shownTime = -1;
    private timeBump?: Tweens.Tween;
    private rimTimer?: Time.TimerEvent;

    constructor() {
        super('Game');
    }

    create() {
        // The logical size is re-decided every time a play starts, and kept until its Result.
        const size = applyScreenSize(this);
        this.height = size.height;
        this.geom = fieldGeometry(size.height);
        this.round = new Round(Math.random);
        if (import.meta.env.DEV) {
            // Dev-only QA aid: `?qatime=<seconds>` shortens the clock (set before the HUD is first drawn).
            const qaTime = Number(new URLSearchParams(window.location.search).get('qatime'));
            if (qaTime > 0) this.round.timeLeft = qaTime;
        }
        this.letters = [];
        this.spawnAcc = 0;
        this.endElapsed = 0;
        this.shownScore = -1;
        this.shownTime = -1;
        this.timeBump = undefined; // the Scene instance is reused: nothing from the last play survives
        this.rimTimer = undefined;
        this.cameras.main.setBackgroundColor(BG_COLOR);

        this.scoreText = this.add
            .text(10, HUD_Y, '', { fontFamily: UI_FONT, fontSize: `${FONT_HUD}px`, color: COLOR.text })
            .setOrigin(0, 0)
            .setDepth(DEPTH.hud);
        this.timeText = this.add
            .text(SCREEN_WIDTH - 10, HUD_Y, '', { fontFamily: UI_FONT, fontSize: `${FONT_HUD}px`, color: COLOR.text })
            .setOrigin(1, 0)
            .setDepth(DEPTH.hud);
        this.add.rectangle(SCREEN_WIDTH / 2, this.geom.floorY, SCREEN_WIDTH, 2, COLOR.floor);
        addLabel(this, SCREEN_WIDTH / 2, this.geom.hintY, 'トレイの文字をタップで捨てる', FONT_HINT, COLOR.muted);
        this.targetRows = [];
        this.buildTray();
        this.refreshTargets();
        this.refreshTray();
        this.updateHud();

        this.guard = new RotateGuard(this);
        this.exit = new SceneExit(this);
        this.input.on('pointerdown', this.onPointer, this);
        onKeyDown(this, (key) => this.onKey(key));
        this.events.once('shutdown', () => this.input.off('pointerdown', this.onPointer, this));

        this.spawn(); // the first letter appears when play starts

        if (import.meta.env.DEV) {
            // Dev-only QA hook: a read-only view of the play.
            const qa = {};
            Object.defineProperties(qa, {
                scene: { get: () => 'Game' },
                phase: { get: () => this.round.phase },
                size: { get: () => ({ w: this.scale.gameSize.width, h: this.scale.gameSize.height }) },
                timeLeft: { get: () => this.round.timeLeft },
                score: { get: () => this.round.score },
                tray: { get: () => [...this.round.tray] },
                targets: { get: () => this.round.targets.map((t) => t.en) },
                letters: { get: () => this.letters.map((l) => ({ ch: l.ch, x: l.x, y: l.y })) },
                guard: { get: () => this.guard.active },
            });
            (window as unknown as { __qa: unknown }).__qa = qa;
        }
    }

    update(_time: number, delta: number) {
        if (this.guard.active) return; // the rotate notice holds the whole Scene
        if (this.round.isOver) {
            this.endElapsed += delta / 1000;
            if (this.endElapsed >= RESULT_DELAY) this.toResult();
            return;
        }
        const dt = delta / 1000;
        this.round.tick(dt);
        // The TIME pulse for a drop in the warning range; not for the drop that ends the play. (Checked only when
        // the displayed seconds changed, so no object is built on most frames.)
        const shown = this.round.timeShown;
        if (
            shown !== this.shownTime &&
            shouldBumpTime({ completed: false, prevShown: this.shownTime, shown, entersEnding: this.round.isOver })
        ) {
            this.bumpTime();
        }
        this.updateHud();
        if (this.round.isOver) {
            this.clearLetters();
            return;
        }
        const due = stepSpawn(this.spawnAcc, delta, SPAWN_INTERVAL_MS);
        this.spawnAcc = due.accMs;
        for (let i = 0; i < due.count; i++) this.spawn();
        this.fall(dt);
    }

    // ---- input -------------------------------------------------------------------------------------

    private onPointer(p: Input.Pointer) {
        if (this.guard.active || this.round.phase !== 'playing') return;
        const slot = traySlotAt(p.x, p.y, this.height);
        if (slot >= 0) {
            if (this.round.discardAt(slot)) this.refreshAfterTrayChange();
            return;
        }
        const letter = letterAtPoint(this.letters, p.x, p.y);
        if (letter) this.take(letter);
    }

    private onKey(key: string) {
        if (this.guard.active || this.round.phase !== 'playing') return;
        if (key === 'Backspace') {
            if (this.round.discardLast()) this.refreshAfterTrayChange();
            return;
        }
        if (!/^[a-zA-Z]$/.test(key)) return;
        const letter = lowestLetterWithChar(this.letters, key.toUpperCase());
        if (letter) this.take(letter);
    }

    private take(letter: Letter) {
        const trayBefore = this.round.tray.length;
        const result = this.round.pick(letter.ch);
        const fx = effectCounts(result);
        if (fx.shake > 0) this.cameras.main.shake(FULL_SHAKE_MS, FULL_SHAKE_INTENSITY);
        if (fx.fullHint > 0) this.showFullRim();
        if (result.kind !== 'picked') return;
        if (fx.fly > 0) this.flyLetter(letter, trayBefore);
        letter.obj.destroy();
        this.letters.splice(this.letters.indexOf(letter), 1);
        this.refreshAfterTrayChange();
        this.updateHud();
        if (fx.flash > 0) this.cameras.main.flash(COMPLETE_FLASH_MS); // ignored while a flash is still playing
        for (let k = 0; k < fx.ghosts; k++) this.spawnGhost(result.rows[k], result.completed[k]);
        for (let k = 0; k < fx.pops; k++) this.spawnPop(k, result.completed[k].en.length);
        // The TIME pulse after a completion goes through the same rule as the warning pulse in update().
        const timeUp = shouldBumpTime({
            completed: fx.ghosts > 0,
            prevShown: this.shownTime,
            shown: this.round.timeShown,
            entersEnding: false,
        });
        if (timeUp) this.bumpTime();
    }

    // ---- effects (docs/spec.md "演出・UI（Game）"); none of them waits on input ---------------------------

    /** The TIME text pulses (restarting from normal size if one is still playing). */
    private bumpTime() {
        this.timeBump?.stop();
        this.timeText.setScale(1);
        const bump = bumpTween();
        this.timeBump = this.tweens.add({ targets: this.timeText, scale: bump.scaleTo, duration: bump.halfMs, yoyo: true });
    }

    /** The tray's slot borders turn red for FULL_RIM_MS; a new refusal restarts the count. */
    private showFullRim() {
        this.rimTimer?.remove(false);
        this.traySlots.forEach((s) => s.box.setStrokeStyle(SLOT_STROKE.full.width, SLOT_STROKE.full.color));
        this.rimTimer = this.time.delayedCall(FULL_RIM_MS, () => {
            this.traySlots.forEach((s) => s.box.setStrokeStyle(SLOT_STROKE.normal.width, SLOT_STROKE.normal.color));
        });
    }

    /** The picked letter's tile flies from where it was to the tray slot it lands in. */
    private flyLetter(letter: Letter, trayBefore: number) {
        const plan = flyPlan(trayBefore, this.height);
        const tile = this.add.rectangle(0, 0, LETTER_SIZE, LETTER_SIZE, COLOR.tile);
        const label = this.add
            .text(0, 0, letter.ch, { fontFamily: MONO_FONT, fontSize: `${FONT_LETTER}px`, color: COLOR.tileText })
            .setOrigin(0.5);
        const flying = this.add.container(letter.x, letter.y, [tile, label]).setDepth(DEPTH.fly);
        this.tweens.add({
            targets: flying,
            x: plan.toX,
            y: plan.toY,
            scale: plan.scaleTo,
            duration: plan.durationMs,
            onComplete: () => flying.destroy(),
        });
    }

    /** A completed word's letters, drawn in green over its row, grow and fade out. */
    private spawnGhost(row: number, word: Word) {
        const ghost = ghostTween();
        const n = word.en.length;
        const letters = [...word.en].map((c, i) =>
            addLabel(this, (i - (n - 1) / 2) * TARGET_LETTER_STEP, 0, c, FONT_TARGET, COLOR.good, MONO_FONT),
        );
        const y = TARGET_Y0 + TARGET_ROW_STEP * row;
        const shape = this.add.container(SCREEN_WIDTH / 2, y, letters).setDepth(DEPTH.ghost).setAlpha(ghost.alphaFrom);
        this.tweens.add({
            targets: shape,
            scale: ghost.scaleTo,
            alpha: ghost.alphaTo,
            duration: ghost.durationMs,
            onComplete: () => shape.destroy(),
        });
    }

    /** `+170  +7s` rises near the top of the field (the k-th pop-up of one pick starts later and lower). */
    private spawnPop(k: number, length: number) {
        const pop = popTween(k);
        const text = addLabel(this, SCREEN_WIDTH / 2, pop.fromY, popText(length), FONT_POP, COLOR.accent)
            .setDepth(DEPTH.pop)
            .setStroke(COLOR.popStroke, POP_STROKE_WIDTH)
            .setVisible(false); // nothing shows during the start delay
        this.tweens.add({
            targets: text,
            y: pop.toY,
            alpha: { from: pop.alphaFrom, to: pop.alphaTo },
            duration: pop.durationMs,
            delay: pop.delayMs,
            onStart: () => text.setVisible(true),
            onComplete: () => text.destroy(),
        });
    }

    // ---- falling letters -----------------------------------------------------------------------------

    private spawn() {
        const col = pickColumn(Math.random, freeColumns(this.letters, this.geom.spawnY));
        if (col < 0) return;
        const ch = pickLetter(Math.random, this.round.tray, this.round.targets);
        const x = columnX(col, COLUMNS);
        const y = this.geom.spawnY;
        const tile = this.add.rectangle(0, 0, LETTER_SIZE, LETTER_SIZE, COLOR.tile);
        const label = this.add
            .text(0, 0, ch, { fontFamily: MONO_FONT, fontSize: `${FONT_LETTER}px`, color: COLOR.tileText })
            .setOrigin(0.5);
        const obj = this.add.container(x, y, [tile, label]).setDepth(DEPTH.letters);
        this.letters.push({ ch, x, y, col, obj });
    }

    private fall(dt: number) {
        const step = fallDistance(this.round.fallSpeed, this.geom.fieldHeight, dt);
        for (let i = this.letters.length - 1; i >= 0; i--) {
            const l = this.letters[i];
            l.y += step;
            if (hasLanded(l.y, this.geom.removeY)) {
                l.obj.destroy();
                this.letters.splice(i, 1);
            } else {
                l.obj.y = l.y;
            }
        }
    }

    private clearLetters() {
        this.letters.forEach((l) => l.obj.destroy());
        this.letters = [];
    }

    // ---- drawing -------------------------------------------------------------------------------------

    private updateHud() {
        if (this.round.score !== this.shownScore) {
            this.shownScore = this.round.score;
            this.scoreText.setText(`SCORE ${this.round.score}`);
        }
        if (this.round.timeShown !== this.shownTime) {
            this.shownTime = this.round.timeShown;
            this.timeText.setText(`TIME ${this.round.timeShown}`);
            this.timeText.setColor(isLowTime(this.round.timeShown) ? COLOR.warn : COLOR.text);
        }
    }

    /** The tray changed: refresh it and the targets (their letter colours depend on the tray). */
    private refreshAfterTrayChange() {
        this.refreshTray();
        this.refreshTargets();
    }

    /**
     * The three targets: letters green where the tray covers them, grey otherwise, and the meaning line.
     * A row's Text objects are rebuilt only when its word changes; otherwise only colours that changed are set.
     */
    private refreshTargets() {
        this.round.targets.forEach((word, row) => {
            let view = this.targetRows[row];
            if (!view || view.en !== word.en) {
                view?.letters.forEach((t) => t.destroy());
                view?.meaning.destroy();
                view = this.buildTargetRow(row, word);
                this.targetRows[row] = view;
            }
            const mask = matchedMask(this.round.tray, word.en);
            view.letters.forEach((t, i) => {
                if (view.matched[i] === mask[i]) return;
                view.matched[i] = mask[i];
                t.setColor(mask[i] ? COLOR.good : COLOR.muted);
            });
        });
    }

    private buildTargetRow(row: number, word: Word): TargetRowView {
        const y = TARGET_Y0 + TARGET_ROW_STEP * row;
        const x0 = SCREEN_WIDTH / 2 - (word.en.length * TARGET_LETTER_STEP) / 2 + TARGET_LETTER_STEP / 2;
        const letters = [...word.en].map((c, i) =>
            addLabel(this, x0 + i * TARGET_LETTER_STEP, y, c, FONT_TARGET, COLOR.muted, MONO_FONT).setDepth(DEPTH.targets),
        );
        const meaning = addLabel(
            this,
            SCREEN_WIDTH / 2,
            y + MEANING_OFFSET,
            `${word.ja}（${word.en.length}文字 +${scoreFor(word.en.length)}）`,
            FONT_MEANING,
            COLOR.sub,
        ).setDepth(DEPTH.targets);
        return { en: word.en, letters, matched: letters.map(() => false), meaning };
    }

    /** The tray's slots exist from the start; a slot is updated only when its letter changed. */
    private buildTray() {
        this.traySlots = [];
        for (let i = 0; i < TRAY_CAPACITY; i++) {
            const r = traySlotRect(i, this.height);
            const cx = r.x + r.w / 2;
            const cy = r.y + r.h / 2;
            const box = this.add
                .rectangle(cx, cy, r.w, r.h, COLOR.slot)
                .setStrokeStyle(SLOT_STROKE.normal.width, SLOT_STROKE.normal.color)
                .setDepth(DEPTH.tray);
            const label = addLabel(this, cx, cy, '', FONT_TRAY, COLOR.text, MONO_FONT).setDepth(DEPTH.tray);
            this.traySlots.push({ box, label, ch: '' });
        }
    }

    private refreshTray() {
        this.traySlots.forEach((slot, i) => {
            const ch = this.round.tray[i] ?? '';
            if (slot.ch === ch) return;
            slot.ch = ch;
            slot.label.setText(ch);
            slot.box.setFillStyle(ch ? COLOR.slotFilled : COLOR.slot);
        });
    }

    // ---- ending --------------------------------------------------------------------------------------

    private toResult() {
        this.exit.to('Result', {
            score: this.round.score,
            completedCount: this.round.completedCount,
            rows: buildResultList(this.round.appeared, this.round.completedWords),
        });
    }
}
