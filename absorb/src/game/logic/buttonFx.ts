import { lerpColor } from './absorbFx';
import {
    BUTTON_EMPTY_ALPHA, BUTTON_PRESS_ALPHA, BUTTON_PRESS_DURATION, BUTTON_PRESS_SCALE, BUTTON_RADIUS
} from './constants';
import { effectProgress } from './effects';
import type { Phase } from './world';

export const BUTTON_COLOR = 0x4dd0e1;
/** Same red as enemy bullets, so an empty press reads as "nothing to fire". */
export const BUTTON_EMPTY_COLOR = 0xff5252;

/** 'press': the button is pushed in; 'empty': nothing was released, so it flashes red. */
export type ButtonPress = 'press' | 'empty';

/**
 * Which feedback a release finger gets, judged from the phase and stock just before the frame's update:
 * a real release is a press, a release that does nothing (ready, stock 0) is empty, none while ending.
 */
export function buttonPressKind(phase: Phase, stock: number): ButtonPress | null {
    if (phase === 'ending' || phase === 'over') return null;
    return phase === 'playing' && stock >= 1 ? 'press' : 'empty';
}

/**
 * The button feedback in play; restarts on the next press. Drawing only: the rules never read this.
 */
export class ButtonEffects {
    /** Seconds since the latest press; Infinity when none is playing. */
    age = Infinity;
    kind: ButtonPress = 'press';

    /** Advances by `dt`; `press` starts (or restarts) the feedback at t = 0 this frame. */
    update(dt: number, press: ButtonPress | null): void {
        this.age += dt;
        if (press === null) return;
        this.age = 0;
        this.kind = press;
    }

    get playing(): boolean {
        return effectProgress(this.age, BUTTON_PRESS_DURATION) >= 0;
    }

    clear(): void {
        this.age = Infinity;
    }
}

/** Resting fill / outline opacity of the button: brighter once there is something to release. */
export function buttonRestFillAlpha(stock: number): number {
    return stock > 0 ? 0.35 : 0.12;
}

export function buttonRestStrokeAlpha(stock: number): number {
    return stock > 0 ? 0.9 : 0.4;
}

/** Drawn radius: a press starts smaller and grows back to BUTTON_RADIUS. */
export function buttonRadius(age: number, kind: ButtonPress): number {
    const p = effectProgress(age, BUTTON_PRESS_DURATION);
    if (p < 0 || kind !== 'press') return BUTTON_RADIUS;
    return BUTTON_RADIUS * (BUTTON_PRESS_SCALE + (1 - BUTTON_PRESS_SCALE) * p);
}

/** Colour of fill and outline: an empty press starts red and blends back to the button colour. */
export function buttonColor(age: number, kind: ButtonPress): number {
    const p = effectProgress(age, BUTTON_PRESS_DURATION);
    if (p < 0 || kind !== 'empty') return BUTTON_COLOR;
    return lerpColor(BUTTON_EMPTY_COLOR, BUTTON_COLOR, p);
}

export function buttonFillAlpha(age: number, kind: ButtonPress, stock: number): number {
    const rest = buttonRestFillAlpha(stock);
    const p = effectProgress(age, BUTTON_PRESS_DURATION);
    if (p < 0) return rest;
    const start = kind === 'press' ? BUTTON_PRESS_ALPHA : BUTTON_EMPTY_ALPHA;
    return start + (rest - start) * p;
}

export function buttonStrokeAlpha(age: number, kind: ButtonPress, stock: number): number {
    const rest = buttonRestStrokeAlpha(stock);
    const p = effectProgress(age, BUTTON_PRESS_DURATION);
    if (p < 0 || kind !== 'empty') return rest;
    return 1 + (rest - 1) * p;
}
