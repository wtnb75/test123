import { GameObjects, Scene } from 'phaser';
import { PARAMS } from './params';
import { applyChar, scoreFor, spawnIntervalAt, spawnWord, speedAt, type Word } from './logic';

type Phase = 'ready' | 'play' | 'over';

interface WordView {
    base: GameObjects.Text;
    typed: GameObjects.Text;
}

const FONT = { fontFamily: 'monospace', fontSize: `${PARAMS.fontPx}px` };

// Throwaway prototype Scene: everything in one place (no responsibility split).
export class ProtoScene extends Scene {
    private phase: Phase = 'ready';
    private words: Word[] = [];
    private views = new Map<number, WordView>();
    private targetId: number | null = null;
    private nextId = 1;
    private elapsed = 0;
    private spawnTimer = 0;
    private lives = PARAMS.lives;
    private score = 0;
    private combo = 0;
    private best = 0;
    private overAt = 0;

    private floorY = 0;
    private floorLine!: GameObjects.Rectangle;
    private blocker!: GameObjects.Rectangle;
    private blockerText!: GameObjects.Text;
    private hud!: GameObjects.Text;
    private center!: GameObjects.Text;
    private input_!: HTMLInputElement;
    private seen = 0;

    constructor() {
        super('ProtoScene');
    }

    create() {
        this.cameras.main.setBackgroundColor('#101830');
        this.floorLine = this.add.rectangle(PARAMS.width / 2, 0, PARAMS.width, 3, 0xff5555);
        this.hud = this.add.text(8, 6, '', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff' });
        this.center = this.add
            .text(PARAMS.width / 2, 200, '', { fontFamily: 'monospace', fontSize: '22px', color: '#ffffff', align: 'center' })
            .setOrigin(0.5);

        this.createInput();
        this.input.on('pointerdown', () => this.onTap());
        this.input.keyboard?.on('keydown-ENTER', () => this.onTap());
        this.blocker = this.add.rectangle(0, 0, PARAMS.width, PARAMS.heightMax, 0x101830, 0.96).setOrigin(0).setDepth(10);
        this.blockerText = this.add
            .text(PARAMS.width / 2, 0, 'ROTATE\n\n画面を縦にしてください', {
                fontFamily: 'monospace',
                fontSize: '18px',
                color: '#ffffff',
                align: 'center',
            })
            .setOrigin(0.5)
            .setDepth(11);
        this.scale.on('resize', this.layout, this);
        this.registry.events.on('changedata-tooSmall', this.layout, this);
        this.events.once('shutdown', () => {
            this.input_.remove();
            this.scale.off('resize', this.layout, this);
            this.registry.events.off('changedata-tooSmall', this.layout, this);
        });
        this.layout();
        this.showReady();
    }

    // Re-place the floor and keep each word's remaining fall time when the visible height changes.
    private layout() {
        const height = this.scale.gameSize.height;
        const newFloor = height - PARAMS.floorMargin;
        if (this.floorY > 0) {
            const k = newFloor / this.floorY;
            for (const w of this.words) w.y *= k;
        }
        this.floorY = newFloor;
        this.floorLine.setY(newFloor + 2);
        this.center.setY(height * 0.4);
        this.blocker.setSize(PARAMS.width, height).setVisible(this.tooSmall());
        this.blockerText.setY(height / 2).setVisible(this.tooSmall());
        this.refreshViews();
    }

    private tooSmall(): boolean {
        return this.registry.get('tooSmall') === true;
    }

    private createInput() {
        const el = document.createElement('input');
        el.type = 'text';
        el.autocapitalize = 'off';
        el.autocomplete = 'off';
        el.spellcheck = false;
        el.setAttribute('autocorrect', 'off');
        el.style.cssText = 'position:fixed;left:0;bottom:0;width:60px;height:24px;opacity:0;font-size:16px;';
        document.body.appendChild(el);
        el.addEventListener('input', () => this.onInput());
        this.input_ = el;
    }

    private onInput() {
        const v = this.input_.value.toLowerCase();
        if (v.length < this.seen) this.seen = v.length;
        for (let i = this.seen; i < v.length; i += 1) {
            if (/[a-z]/.test(v[i])) this.typeChar(v[i]);
        }
        this.seen = v.length;
        if (v.length > 24) {
            this.input_.value = '';
            this.seen = 0;
        }
    }

    private onTap() {
        this.input_.focus();
        if (this.tooSmall()) return;
        if (this.phase === 'ready') this.startRun();
        else if (this.phase === 'over' && this.time.now - this.overAt > PARAMS.retryDelayMs) this.startRun();
    }

    private showReady() {
        this.phase = 'ready';
        this.center.setText('TYPE RAIN\n\ntap to start');
    }

    private startRun() {
        this.words.forEach((w) => this.destroyView(w.id));
        this.words = [];
        this.targetId = null;
        this.elapsed = 0;
        this.spawnTimer = PARAMS.spawnStartSec - PARAMS.firstSpawnSec;
        this.lives = PARAMS.lives;
        this.score = 0;
        this.combo = 0;
        this.input_.value = '';
        this.seen = 0;
        this.center.setText('');
        this.phase = 'play';
    }

    private typeChar(ch: string) {
        if (this.phase === 'ready' || this.phase === 'over' || this.tooSmall()) return;
        const r = applyChar(this.words, this.targetId, ch);
        this.targetId = r.targetId;
        if (r.miss) {
            this.combo = 0;
            this.cameras.main.shake(80, 0.004);
        }
        if (r.cleared) {
            this.score += scoreFor(r.cleared.text.length, this.combo);
            this.combo += 1;
            this.words = this.words.filter((w) => w.id !== r.cleared!.id);
            this.destroyView(r.cleared.id);
        }
        this.refreshViews();
    }

    private destroyView(id: number) {
        const v = this.views.get(id);
        if (!v) return;
        v.base.destroy();
        v.typed.destroy();
        this.views.delete(id);
    }

    private refreshViews() {
        for (const w of this.words) {
            const v = this.views.get(w.id);
            if (!v) continue;
            v.base.setPosition(w.x, w.y);
            v.typed.setPosition(w.x, w.y).setText(w.text.slice(0, w.typed));
            v.base.setColor(w.id === this.targetId ? '#ffffff' : '#9fb4ff');
        }
    }

    update(_time: number, delta: number) {
        if (this.phase !== 'play' || this.tooSmall()) return;
        const dt = delta / 1000;
        this.elapsed += dt;
        this.spawnTimer += dt;
        if (this.spawnTimer >= spawnIntervalAt(this.elapsed) && this.words.length < PARAMS.maxOnScreen) {
            this.spawnTimer = 0;
            const w = spawnWord(Math.random, this.elapsed, this.words, this.nextId++);
            this.words.push(w);
            this.views.set(w.id, {
                base: this.add.text(w.x, w.y, w.text, { ...FONT, color: '#9fb4ff' }),
                typed: this.add.text(w.x, w.y, '', { ...FONT, color: '#ffd84d' }),
            });
        }
        // Speed scales with the floor height so the time to fall stays constant.
        const v = speedAt(this.elapsed) * (this.floorY / PARAMS.refFloorY) * dt;
        for (const w of [...this.words]) {
            w.y += v;
            if (w.y + PARAMS.fontPx >= this.floorY) this.dropWord(w);
        }
        this.refreshViews();
        this.hud.setText(`SCORE ${this.score}  LIFE ${'♥'.repeat(this.lives)}${this.combo >= 2 ? `  x${this.combo}` : ''}`);
    }

    private dropWord(w: Word) {
        this.words = this.words.filter((x) => x.id !== w.id);
        this.destroyView(w.id);
        if (this.targetId === w.id) this.targetId = null;
        this.combo = 0;
        this.lives -= 1;
        this.cameras.main.shake(150, 0.01);
        if (this.lives <= 0) this.gameOver();
    }

    private gameOver() {
        this.phase = 'over';
        this.overAt = this.time.now;
        this.best = Math.max(this.best, this.score);
        this.center.setText(`GAME OVER\n\nscore ${this.score}\nbest ${this.best}\n\ntap to retry`);
    }
}
