import type { Scene } from 'phaser';
import { Layout, LayoutKind, layoutFor, layoutKindFor } from '../logic/layout';

const kindNow = (): LayoutKind => layoutKindFor(window.innerWidth, window.innerHeight);

/**
 * Sizes the canvas for the current window shape and calls `onChange` with the new layout whenever the
 * layout kind (portrait / landscape / wide) changes. The resize listener is removed when the Scene shuts down. Returns the initial layout.
 */
export const bindOrientation = (scene: Scene, onChange: (layout: Layout) => void): Layout => {
    let kind = kindNow();
    const apply = (): Layout => {
        const layout = layoutFor(kind);
        scene.scale.setGameSize(layout.width, layout.height);
        // setGameSize fits to the parent size measured before this resize; measure again so the canvas grows when the window does
        scene.scale.updateBounds();
        scene.scale.refresh();
        return layout;
    };
    const onResize = () => {
        const now = kindNow();
        if (now === kind) return;
        kind = now;
        onChange(apply());
    };
    window.addEventListener('resize', onResize);
    scene.events.once('shutdown', () => window.removeEventListener('resize', onResize));
    return apply();
};

export const initialCanvasSize = (): { width: number; height: number } => {
    const { width, height } = layoutFor(kindNow());
    return { width, height };
};
