// Throwaway prototype Scene: one Scene covers play and result.
import { GameObjects, Scene } from 'phaser';
import {
    COLUMNS,
    FALL_TOP,
    FLOOR_Y,
    HUD_Y,
    LETTER_SIZE,
    ROW_Y,
    SPAWN_INTERVAL_MS,
    START_TIME_SEC,
    TRAY_CAPACITY,
    TRAY_Y,
    WORLD_H,
    WORLD_W,
} from './params';
import {
    bonusFor,
    consume,
    fallSpeed,
    findCompletable,
    initialTargets,
    matchedMask,
    pickLetter,
    pickWord,
    scoreFor,
} from './logic';
import type { Word } from './words';

interface Falling {
    ch: string;
    obj: GameObjects.Text;
}

const FONT = 'monospace';

export class Play extends Scene {
    private falling: Falling[] = [];
    private tray: string[] = [];
    private targets: Word[] = [];
    private seen: { word: Word; done: boolean }[] = [];
    private score = 0;
    private timeLeft = START_TIME_SEC;
    private elapsed = 0;
    private spawnAcc = 0;
    private over = false;
    private hud!: GameObjects.Text;
    private dyn: GameObjects.GameObject[] = [];
    private overlay: GameObjects.GameObject[] = [];

    constructor() {
        super('Play');
    }

    create() {
        this.cameras.main.setBackgroundColor('#101a2e');
        this.falling = [];
        this.tray = [];
        this.score = 0;
        this.timeLeft = START_TIME_SEC;
        this.elapsed = 0;
        this.spawnAcc = 0;
        this.over = false;
        this.dyn = [];
        this.overlay = [];
        this.seen = [];

        this.targets = initialTargets(Math.random);
        this.targets.forEach((w) => this.seen.push({ word: w, done: false }));

        this.hud = this.add.text(8, HUD_Y, '', { fontFamily: FONT, fontSize: '18px', color: '#ffffff' });
        this.add.line(0, 0, 0, FLOOR_Y, WORLD_W, FLOOR_Y, 0x445577).setOrigin(0, 0);

        this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));
        this.redraw();
    }

    update(_time: number, delta: number) {
        if (this.over) return;
        const dt = delta / 1000;
        this.elapsed += dt;
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.finish();
            return;
        }

        this.spawnAcc += delta;
        while (this.spawnAcc >= SPAWN_INTERVAL_MS) {
            this.spawnAcc -= SPAWN_INTERVAL_MS;
            this.spawn();
        }

        const v = fallSpeed(this.elapsed);
        for (let i = this.falling.length - 1; i >= 0; i--) {
            const f = this.falling[i];
            f.obj.y += v * dt;
            if (f.obj.y > FLOOR_Y) {
                f.obj.destroy();
                this.falling.splice(i, 1);
            }
        }
        this.hud.setText(`SCORE ${this.score}   TIME ${Math.ceil(this.timeLeft)}`);
    }

    private spawn() {
        const ch = pickLetter(Math.random, this.tray, this.targets);
        const colW = WORLD_W / COLUMNS;
        const col = Math.floor(Math.random() * COLUMNS);
        const obj = this.add
            .text(colW * col + colW / 2, FALL_TOP - LETTER_SIZE, ch, {
                fontFamily: FONT,
                fontSize: '26px',
                color: '#101a2e',
                backgroundColor: '#ffd166',
                fixedWidth: LETTER_SIZE,
                fixedHeight: LETTER_SIZE,
                align: 'center',
                padding: { top: 4 },
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        const f: Falling = { ch, obj };
        obj.on('pointerdown', () => this.pick(f));
        this.falling.push(f);
    }

    private pick(f: Falling) {
        if (this.over) return;
        const i = this.falling.indexOf(f);
        if (i < 0) return;
        if (this.tray.length >= TRAY_CAPACITY) {
            this.cameras.main.shake(80, 0.004);
            return;
        }
        this.falling.splice(i, 1);
        f.obj.destroy();
        this.tray.push(f.ch);
        this.checkComplete();
        this.redraw();
    }

    private onKey(key: string) {
        if (this.over) {
            if (key === ' ' || key === 'Enter') this.scene.restart();
            return;
        }
        const ch = key.toUpperCase();
        let best: Falling | undefined;
        for (const f of this.falling) {
            if (f.ch === ch && (!best || f.obj.y > best.obj.y)) best = f;
        }
        if (best) this.pick(best);
    }

    private discard(index: number) {
        if (this.over) return;
        this.tray.splice(index, 1);
        this.redraw();
    }

    private checkComplete() {
        for (;;) {
            const i = findCompletable(this.tray, this.targets);
            if (i < 0) return;
            const w = this.targets[i];
            this.tray = consume(this.tray, w.en);
            this.score += scoreFor(w.en.length);
            this.timeLeft += bonusFor(w.en.length);
            const rec = this.seen.find((s) => s.word.en === w.en && !s.done);
            if (rec) rec.done = true;
            const next = pickWord(
                Math.random,
                this.targets.map((t) => t.en),
            );
            this.targets[i] = next;
            this.seen.push({ word: next, done: false });
            this.cameras.main.flash(120, 255, 255, 255);
        }
    }

    /** Rebuild targets + tray (prototype: cheap and simple). */
    private redraw() {
        this.dyn.forEach((o) => o.destroy());
        this.dyn = [];

        this.targets.forEach((w, row) => {
            const y = ROW_Y[row];
            const mask = matchedMask(this.tray, w.en);
            const step = 26;
            const x0 = WORLD_W / 2 - (w.en.length * step) / 2 + step / 2;
            [...w.en].forEach((c, i) => {
                this.dyn.push(
                    this.add
                        .text(x0 + i * step, y, c, {
                            fontFamily: FONT,
                            fontSize: '24px',
                            color: mask[i] ? '#06d6a0' : '#8899aa',
                        })
                        .setOrigin(0.5),
                );
            });
            this.dyn.push(
                this.add
                    .text(WORLD_W / 2, y + 24, `${w.ja}  (${w.en.length}文字 +${scoreFor(w.en.length)})`, {
                        fontFamily: FONT,
                        fontSize: '13px',
                        color: '#ccd6e0',
                    })
                    .setOrigin(0.5),
            );
        });

        const slotW = WORLD_W / TRAY_CAPACITY;
        for (let i = 0; i < TRAY_CAPACITY; i++) {
            const x = slotW * i + slotW / 2;
            const ch = this.tray[i];
            const t = this.add
                .text(x, TRAY_Y, ch ?? '', {
                    fontFamily: FONT,
                    fontSize: '22px',
                    color: '#ffffff',
                    backgroundColor: ch ? '#3a5a8a' : '#1a2540',
                    fixedWidth: slotW - 3,
                    fixedHeight: 40,
                    align: 'center',
                    padding: { top: 6 },
                })
                .setOrigin(0.5);
            if (ch) {
                t.setInteractive({ useHandCursor: true });
                t.on('pointerdown', () => this.discard(i));
            }
            this.dyn.push(t);
        }
        this.dyn.push(
            this.add
                .text(WORLD_W / 2, TRAY_Y + 34, 'トレイの文字をタップで捨てる', {
                    fontFamily: FONT,
                    fontSize: '12px',
                    color: '#667788',
                })
                .setOrigin(0.5),
        );
    }

    private finish() {
        this.over = true;
        this.falling.forEach((f) => f.obj.destroy());
        this.falling = [];
        this.dyn.forEach((o) => o.destroy());
        this.dyn = [];

        const mk = (o: GameObjects.GameObject) => {
            this.overlay.push(o);
            return o;
        };
        mk(this.add.rectangle(0, 0, WORLD_W, WORLD_H, 0x101a2e).setOrigin(0, 0));
        mk(
            this.add
                .text(WORLD_W / 2, 24, `RESULT  ${this.score}`, { fontFamily: FONT, fontSize: '26px', color: '#ffd166' })
                .setOrigin(0.5),
        );
        const list = this.seen.slice(0, 20);
        list.forEach((s, i) => {
            mk(
                this.add.text(
                    16,
                    56 + i * 24,
                    `${s.done ? '✓' : '・'} ${s.word.en.padEnd(9)} ${s.word.ja}`,
                    { fontFamily: FONT, fontSize: '16px', color: s.done ? '#06d6a0' : '#8899aa' },
                ),
            );
        });
        const retry = mk(
            this.add
                .text(WORLD_W / 2, WORLD_H - 40, 'TAP / SPACE でもう一度', {
                    fontFamily: FONT,
                    fontSize: '18px',
                    color: '#ffffff',
                    backgroundColor: '#3a5a8a',
                    padding: { x: 12, y: 8 },
                })
                .setOrigin(0.5),
        ) as GameObjects.Text;
        retry.setInteractive({ useHandCursor: true });
        retry.on('pointerdown', () => this.scene.restart());
    }
}
