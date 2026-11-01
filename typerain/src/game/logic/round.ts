// One play of the game, without Phaser (docs/spec.md "ルール"): falling words, typing, lives and score.
// A word's vertical position is kept as its progress p (0 when it appears, 1 when its bottom meets the floor),
// so a change of screen height needs no re-placing.
import {
    DT_MAX_SEC,
    FIRST_SPAWN_SEC,
    LIVES,
    MAX_ON_SCREEN,
    SPAWN_GAP,
    WORD_H,
} from '../params';
import { fallSpeedAt, spawnIntervalAt } from './difficulty';
import { scoreFor } from './scoring';
import { pickWord, pickWordX, type Rng } from './words';

export interface Word {
    id: number;
    text: string;
    /** Left edge. */
    x: number;
    /** Progress down the fall distance: 0 at the top of the field, 1 when the bottom reaches the floor. */
    p: number;
    /** Letters typed so far (only the locked-on word has any). */
    typed: number;
}

export type Phase = 'playing' | 'ending';

export type TypeOutcome =
    | { kind: 'ignored' }
    | { kind: 'miss' }
    | { kind: 'hit' }
    | { kind: 'clear'; word: Word; points: number };

const NO_WORDS: readonly Word[] = [];

export interface StepResult {
    spawned: Word | null;
    /** Words that reached the floor this step (each cost a life, unless the run had already ended). */
    floorHits: number;
    /** Those words themselves (already removed from `words`), lowest first. */
    landed: readonly Word[];
}

export class Round {
    readonly words: Word[] = [];
    phase: Phase = 'playing';
    lives = LIVES;
    score = 0;
    combo = 0;
    /** Words typed to the end. */
    cleared = 0;
    /** Playing time in seconds. */
    elapsed = 0;
    targetId: number | null = null;
    /** Seconds since the last spawn (counted from the start until the first word appears). */
    private spawnTimer = 0;
    private nextId = 1;
    private lastSpawnedId: number | null = null;

    constructor(private readonly rng: Rng) {}

    /** The lives ran out: nothing moves or counts any more. */
    get ended(): boolean {
        return this.phase === 'ending';
    }

    /** Applies one typed letter (a-z). */
    typeChar(ch: string): TypeOutcome {
        if (this.phase !== 'playing') return { kind: 'ignored' };
        let target = this.words.find((w) => w.id === this.targetId);
        if (!target) {
            // Lock on to the lowest word that starts with this letter (the older one on a tie).
            for (const w of this.words) {
                if (w.text[0] === ch && (!target || w.p > target.p)) target = w;
            }
            if (!target) return this.miss();
            this.targetId = target.id;
        }
        if (target.text[target.typed] !== ch) return this.miss();
        target.typed += 1;
        if (target.typed < target.text.length) return { kind: 'hit' };
        const points = scoreFor(target.text.length, this.combo);
        this.score += points;
        this.combo += 1;
        this.cleared += 1;
        this.remove(target);
        return { kind: 'clear', word: target, points };
    }

    /**
     * Advances the run by `dtSec` (capped at DT_MAX_SEC): time, spawning, falling, then words that reach the
     * floor. `fallDistance` is the current height's fall distance in px (see `fallDistanceFor`).
     */
    step(dtSec: number, fallDistance: number): StepResult {
        const result: StepResult = { spawned: null, floorHits: 0, landed: NO_WORDS };
        if (this.phase !== 'playing') return result;
        const dt = Math.min(dtSec, DT_MAX_SEC);
        this.elapsed += dt;
        this.spawnTimer += dt;
        if (this.canSpawn(fallDistance)) {
            this.spawnTimer = 0;
            result.spawned = this.spawn();
        }
        const speed = fallSpeedAt(this.elapsed);
        for (const w of this.words) w.p += speed * dt;
        if (!this.anyLanded()) return result;
        const landed = this.words.filter((w) => w.p >= 1).sort((a, b) => b.p - a.p);
        const counted: Word[] = [];
        result.landed = counted;
        for (const w of landed) {
            result.floorHits += 1;
            counted.push(w);
            this.remove(w);
            this.lives = Math.max(0, this.lives - 1);
            this.combo = 0;
            if (this.lives === 0) {
                this.phase = 'ending';
                break;
            }
        }
        return result;
    }

    /** Whether any word has reached the floor (a plain loop: this runs every frame). */
    private anyLanded(): boolean {
        for (const w of this.words) if (w.p >= 1) return true;
        return false;
    }

    private canSpawn(fallDistance: number): boolean {
        // The first word comes FIRST_SPAWN_SEC after the start; later ones every spawn interval.
        const wait = this.nextId === 1 ? FIRST_SPAWN_SEC : spawnIntervalAt(this.elapsed);
        if (this.spawnTimer < wait) return false;
        if (this.words.length >= MAX_ON_SCREEN) return false;
        const last = this.words.find((w) => w.id === this.lastSpawnedId);
        return !last || last.p * fallDistance >= WORD_H + SPAWN_GAP;
    }

    private spawn(): Word {
        const text = pickWord(
            this.rng,
            this.elapsed,
            this.words.map((w) => w.text),
        );
        const word: Word = { id: this.nextId++, text, x: pickWordX(this.rng, text.length), p: 0, typed: 0 };
        this.words.push(word);
        this.lastSpawnedId = word.id;
        return word;
    }

    private miss(): TypeOutcome {
        this.combo = 0;
        return { kind: 'miss' };
    }

    private remove(word: Word): void {
        this.words.splice(this.words.indexOf(word), 1);
        if (this.targetId === word.id) this.targetId = null;
    }
}
