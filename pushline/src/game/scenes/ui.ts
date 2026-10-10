import { Scale, type GameObjects, type Scene } from 'phaser';
import { BUTTON_H, BUTTON_W, pickLayout, type Layout, type Rect } from '../logic/layout';

export const UI_FONT = 'sans-serif';

/** Text sizes in canvas pixels. */
export const FONT_SIZE = { hud: 32, headline: 72, button: 30 } as const;

export const COLORS = {
    bg: 0x10161f,
    empty: 0x1e2a3a,
    movable: 0xf2b134,
    fixed: 0x5b6270,
    fixedMark: 0x2a2f3a,
    player: 0x4fd1c5,
    pruned: 0x8a93a3,
    buttonDefault: 0x2c3a52,
    buttonDanger: 0x5a2d3a,
    buttonDangerArmed: 0xb23a52,
    recoveredText: '#7ee787',
    text: '#ffffff',
    captionText: '#9aa7b8',
    alarm: 0xff3b30,
    /** CSS colour of the moves counter while the moves are running low. */
    alarmText: '#ff5a4f',
} as const;

/** Draw order, back to front (docs/spec.md "描画順"). */
export const DEPTH = { board: 0, ghost: 1, player: 2, fx: 3, mark: 5, hud: 10, alert: 20 } as const;

/**
 * Picks the layout for the window as it is now and switches the logical canvas to it.
 * Called when a Scene starts; `watchOrientation` handles later changes.
 */
export function applyLayout(scene: Scene): Layout {
    const layout = pickLayout(window.innerWidth, window.innerHeight);
    const size = scene.scale.gameSize;
    if (size.width !== layout.viewW || size.height !== layout.viewH) scene.scale.setGameSize(layout.viewW, layout.viewH);
    return layout;
}

/**
 * While the Scene is shown, calls `onChange` with the new layout whenever the window's orientation
 * differs from the current one. It listens to the ScaleManager's own resize event, which fires after
 * Phaser has measured the new parent size: switching the canvas size from a raw window `resize`
 * event would be fitted to the previous window size. The listener is removed when the Scene shuts down.
 */
export function watchOrientation(scene: Scene, current: () => Layout, onChange: (layout: Layout) => void): void {
    const handler = () => {
        const next = pickLayout(window.innerWidth, window.innerHeight);
        if (next.orientation === current().orientation) return;
        // `setGameSize` emits RESIZE again, so the new layout must be in place before it is called.
        onChange(next);
        scene.scale.setGameSize(next.viewW, next.viewH);
    };
    scene.scale.on(Scale.Events.RESIZE, handler);
    scene.events.once('shutdown', () => scene.scale.off(Scale.Events.RESIZE, handler));
}

export function addLabel(
    scene: Scene,
    x: number,
    y: number,
    text: string,
    size: number,
    color: string = COLORS.text,
): GameObjects.Text {
    return scene.add
        .text(x, y, text, { fontFamily: UI_FONT, fontSize: `${size}px`, color, align: 'center' })
        .setOrigin(0.5);
}

export interface ButtonView {
    box: GameObjects.Rectangle;
    label: GameObjects.Text;
    place: (rect: Rect) => void;
}

/** A button drawn as a rectangle with a label; `place` (re)positions it. Hit-testing is the caller's. */
export function createButton(scene: Scene, text: string, fill: number, depth: number): ButtonView {
    const box = scene.add.rectangle(0, 0, BUTTON_W, BUTTON_H, fill).setStrokeStyle(3, 0xffffff, 0.6).setDepth(depth);
    const label = addLabel(scene, 0, 0, text, FONT_SIZE.button).setDepth(depth + 0.1);
    return {
        box,
        label,
        place: (r) => {
            box.setPosition(r.x + r.w / 2, r.y + r.h / 2).setSize(r.w, r.h);
            label.setPosition(r.x + r.w / 2, r.y + r.h / 2);
        },
    };
}
