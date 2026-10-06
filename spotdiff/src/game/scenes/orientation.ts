import type { Scene } from 'phaser';
import { Layout, isPortraitSize, layoutFor } from '../logic/layout';

const portraitNow = (): boolean => isPortraitSize(window.innerWidth, window.innerHeight);

/**
 * Sizes the canvas for the current window orientation and calls `onChange` with the new layout whenever the
 * orientation flips. The resize listener is removed when the Scene shuts down. Returns the initial layout.
 */
export const bindOrientation = (scene: Scene, onChange: (layout: Layout) => void): Layout => {
    let portrait = portraitNow();
    const apply = (): Layout => {
        const layout = layoutFor(portrait);
        scene.scale.setGameSize(layout.width, layout.height);
        return layout;
    };
    const onResize = () => {
        const now = portraitNow();
        if (now === portrait) return;
        portrait = now;
        onChange(apply());
    };
    window.addEventListener('resize', onResize);
    scene.events.once('shutdown', () => window.removeEventListener('resize', onResize));
    return apply();
};

export const initialCanvasSize = (): { width: number; height: number } => {
    const { width, height } = layoutFor(portraitNow());
    return { width, height };
};
