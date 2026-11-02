import { GameObjects, Scene } from 'phaser';
import {
    BOARD_X, BOARD_Y, BONUS_PER_EXTRA_GEM, CELL, CLEAR_MS, COLORS, COLS, FALL_MS_PER_CELL, GEM_COLORS, HINT_DELAY_MS,
    MOVES, ROWS, SCORE_PER_GEM, SWAP_MS, SWIPE_RATIO, WIDTH,
} from './params';
import {
    Board, Pos, collapse, createBoard, findMatches, findValidMove, hasValidMove, isAdjacent, refill,
    scoreFor, shuffleBoard, swapCells,
} from './logic';

type Gem = GameObjects.Image;

export class Play extends Scene {
    private board: Board = [];
    private gems: (Gem | null)[][] = [];
    private selected: Pos | null = null;
    private marker!: GameObjects.Rectangle;
    private down: { pos: Pos; x: number; y: number } | null = null;
    private busy = false;
    private over = false;
    private moves = MOVES;
    private score = 0;
    private best = 0;
    private hintTimer: Phaser.Time.TimerEvent | null = null;
    private hintGems: Gem[] = [];
    private hud!: GameObjects.Text;
    private message!: GameObjects.Text;

    constructor() {
        super('Play');
    }

    create() {
        this.cameras.main.setBackgroundColor('#1b2230');
        this.makeTextures();
        this.hud = this.add.text(WIDTH / 2, 90, '', { fontSize: '36px', color: '#ffffff', align: 'center' }).setOrigin(0.5);
        this.message = this.add.text(WIDTH / 2, BOARD_Y + (ROWS * CELL) / 2, '', {
            fontSize: '44px', color: '#ffffff', backgroundColor: '#000000cc', align: 'center', padding: { x: 24, y: 16 },
        }).setOrigin(0.5).setDepth(10).setVisible(false);
        this.marker = this.add.rectangle(0, 0, CELL, CELL).setStrokeStyle(4, 0xffffff).setVisible(false).setDepth(5);
        this.input.on('pointerdown', this.onDown, this);
        this.input.on('pointermove', this.onMove, this);
        this.input.on('pointerup', this.onUp, this);
        this.events.once('shutdown', () => this.input.removeAllListeners());
        this.startRun();
    }

    private makeTextures() {
        GEM_COLORS.forEach((color, i) => {
            const g = this.add.graphics();
            g.fillStyle(color, 1).fillCircle(CELL / 2, CELL / 2, CELL / 2 - 5);
            g.fillStyle(0xffffff, 0.35).fillCircle(CELL / 2 - 8, CELL / 2 - 8, 8);
            g.generateTexture(`gem${i}`, CELL, CELL);
            g.destroy();
        });
    }

    private scheduleHint() {
        this.clearHint();
        if (this.over) return;
        this.hintTimer = this.time.delayedCall(HINT_DELAY_MS, () => this.showHint());
    }

    private clearHint() {
        this.hintTimer?.remove();
        this.hintTimer = null;
        this.hintGems.forEach((g) => { this.tweens.killTweensOf(g); g.setScale(1); });
        this.hintGems = [];
    }

    /** Pulse the two gems of one valid move. */
    private showHint() {
        const move = findValidMove(this.board);
        if (!move || this.busy || this.over) return;
        this.hintGems = move.map((p) => this.gems[p.r][p.c] as Gem);
        this.tweens.add({ targets: this.hintGems, scale: 1.25, duration: 350, yoyo: true, repeat: -1 });
    }

    private startRun() {
        this.clearHint();
        this.gems.flat().forEach((g) => g?.destroy());
        this.board = createBoard(ROWS, COLS, COLORS, Math.random);
        this.gems = this.board.map((row, r) => row.map((v, c) => this.spawn(r, c, v as number)));
        this.moves = MOVES;
        this.score = 0;
        this.selected = null;
        this.marker.setVisible(false);
        this.busy = false;
        this.over = false;
        this.message.setVisible(false);
        this.refreshHud();
        this.scheduleHint();
    }

    private cx(c: number) { return BOARD_X + c * CELL + CELL / 2; }
    private cy(r: number) { return BOARD_Y + r * CELL + CELL / 2; }

    private spawn(r: number, c: number, v: number, fromRow = r): Gem {
        return this.add.image(this.cx(c), this.cy(fromRow), `gem${v}`);
    }

    private refreshHud() {
        this.hud.setText(`SCORE ${this.score}   BEST ${this.best}\nMOVES ${this.moves}`);
    }

    private cellAt(x: number, y: number): Pos | null {
        const c = Math.floor((x - BOARD_X) / CELL);
        const r = Math.floor((y - BOARD_Y) / CELL);
        return r >= 0 && r < ROWS && c >= 0 && c < COLS ? { r, c } : null;
    }

    private onDown(p: Phaser.Input.Pointer) {
        if (this.over) {
            this.startRun();
            return;
        }
        if (this.busy) return;
        this.clearHint();
        const pos = this.cellAt(p.x, p.y);
        this.down = pos ? { pos, x: p.x, y: p.y } : null;
    }

    private onMove(p: Phaser.Input.Pointer) {
        if (!this.down || !p.isDown || this.busy) return;
        const dx = p.x - this.down.x;
        const dy = p.y - this.down.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < CELL * SWIPE_RATIO) return;
        const from = this.down.pos;
        const to = Math.abs(dx) > Math.abs(dy)
            ? { r: from.r, c: from.c + Math.sign(dx) }
            : { r: from.r + Math.sign(dy), c: from.c };
        this.down = null;
        this.clearSelection();
        if (to.r >= 0 && to.r < ROWS && to.c >= 0 && to.c < COLS) void this.trySwap(from, to);
    }

    private onUp() {
        if (!this.busy) this.scheduleHint();
        if (!this.down || this.busy) return;
        const pos = this.down.pos;
        this.down = null;
        if (this.selected && isAdjacent(this.selected, pos)) {
            const from = this.selected;
            this.clearSelection();
            void this.trySwap(from, pos);
        } else {
            this.selected = pos;
            this.marker.setPosition(this.cx(pos.c), this.cy(pos.r)).setVisible(true);
        }
    }

    private clearSelection() {
        this.selected = null;
        this.marker.setVisible(false);
    }

    private tween(targets: object | object[], props: object, duration: number): Promise<void> {
        return new Promise((resolve) => {
            this.tweens.add({ targets, ...props, duration, onComplete: () => resolve() });
        });
    }

    private async trySwap(a: Pos, b: Pos) {
        this.busy = true;
        this.clearHint();
        await this.animateSwap(a, b);
        if (findMatches(this.board).length === 0) {
            await this.animateSwap(a, b);
        } else {
            this.moves--;
            await this.resolve();
            if (this.moves > 0 && !hasValidMove(this.board)) await this.reshuffle();
        }
        this.refreshHud();
        if (this.moves <= 0) this.finish();
        this.busy = false;
        this.scheduleHint();
    }

    /** Swap in both the board and the sprites (calling twice undoes it). */
    private async animateSwap(a: Pos, b: Pos) {
        swapCells(this.board, a, b);
        const ga = this.gems[a.r][a.c] as Gem;
        const gb = this.gems[b.r][b.c] as Gem;
        this.gems[a.r][a.c] = gb;
        this.gems[b.r][b.c] = ga;
        await Promise.all([
            this.tween(ga, { x: this.cx(b.c), y: this.cy(b.r) }, SWAP_MS),
            this.tween(gb, { x: this.cx(a.c), y: this.cy(a.r) }, SWAP_MS),
        ]);
    }

    private async resolve() {
        for (let chain = 1; ; chain++) {
            const matches = findMatches(this.board);
            if (matches.length === 0) return;
            const gain = scoreFor(matches.length, chain, SCORE_PER_GEM, BONUS_PER_EXTRA_GEM);
            this.score += gain;
            if (this.score > this.best) this.best = this.score;
            this.popup(matches, gain, chain);
            this.refreshHud();
            const dying = matches.map((m) => this.gems[m.r][m.c] as Gem);
            matches.forEach((m) => { this.board[m.r][m.c] = null; this.gems[m.r][m.c] = null; });
            await this.tween(dying, { scale: 0, alpha: 0 }, CLEAR_MS);
            dying.forEach((g) => g.destroy());
            await this.dropAndRefill();
        }
    }

    /** Floating "+points" (and the chain multiplier) at the centre of the cleared cells. */
    private popup(cells: Pos[], gain: number, chain: number) {
        const x = cells.reduce((s, p) => s + this.cx(p.c), 0) / cells.length;
        const y = cells.reduce((s, p) => s + this.cy(p.r), 0) / cells.length;
        const lines = [];
        if (chain > 1) lines.push(`CHAIN x${chain}`);
        if (cells.length >= 4) lines.push('BONUS');
        lines.push(`+${gain}`);
        const label = lines.join('\n');
        const t = this.add.text(x, y, label, {
            fontSize: chain > 1 ? '40px' : '34px', color: chain > 1 ? '#ffe14d' : '#ffffff',
            stroke: '#000000', strokeThickness: 6, align: 'center',
        }).setOrigin(0.5).setDepth(8);
        this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 900, onComplete: () => t.destroy() });
    }

    private async dropAndRefill() {
        const jobs: Promise<void>[] = [];
        for (const f of collapse(this.board)) {
            const g = this.gems[f.from][f.c] as Gem;
            this.gems[f.from][f.c] = null;
            this.gems[f.to][f.c] = g;
            jobs.push(this.tween(g, { y: this.cy(f.to) }, FALL_MS_PER_CELL * (f.to - f.from)));
        }
        const added = refill(this.board, COLORS, Math.random);
        const perCol = new Array<number>(COLS).fill(0);
        added.forEach((p) => perCol[p.c]++);
        for (const p of added) {
            const g = this.spawn(p.r, p.c, this.board[p.r][p.c] as number, p.r - perCol[p.c]);
            this.gems[p.r][p.c] = g;
            jobs.push(this.tween(g, { y: this.cy(p.r) }, FALL_MS_PER_CELL * perCol[p.c]));
        }
        await Promise.all(jobs);
    }

    private async reshuffle() {
        this.message.setText('NO MOVES\nSHUFFLE').setVisible(true);
        shuffleBoard(this.board, Math.random);
        this.gems.flat().forEach((g) => g?.destroy());
        this.gems = this.board.map((row, r) => row.map((v, c) => this.spawn(r, c, v as number)));
        await this.tween(this.message, { alpha: 1 }, 700);
        this.message.setVisible(false);
    }

    private finish() {
        this.over = true;
        this.message.setText(`GAME OVER\nSCORE ${this.score}\n\ntap to retry`).setVisible(true);
        this.hud.setText(`SCORE ${this.score}   BEST ${this.best}\nMOVES 0`);
    }
}
