import { AUTO, Game, Scale, type Types } from 'phaser';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';
import { BG_COLOR } from './scenes/ui';
import { SCREEN_HEIGHT_MIN, SCREEN_WIDTH } from './params';
import { computeScreenSize, fitScale } from './logic/screen';
import { renderScaleFor } from './logic/render';
import { RENDER_SCALE_KEY } from './scenes/render';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT_MIN,
    parent: 'game-container',
    backgroundColor: BG_COLOR,
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Title, GameScene, Result],
};

/**
 * Keeps the game inside the area the browser really shows. Phone browsers shrink `visualViewport` (not the layout
 * viewport) when the OS keyboard opens, and may scroll the page to show the focused input. The game's element is
 * pinned (`position: fixed`) to that area, and the logical height follows its aspect ratio, so the text keeps its
 * size and the whole field stays visible above the keyboard.
 *
 * The canvas itself has (logical size x k) real pixels, k following the on-screen scale and devicePixelRatio, so
 * text and shapes are drawn at the resolution they are shown at. The Scenes keep working in logical coordinates
 * (a camera zoom of k maps them onto the canvas); k is published in the game's registry.
 */
function followViewport(game: Game): void {
    const app = document.getElementById('app');
    const container = document.getElementById('game-container');
    if (!app || !container) return;
    container.style.width = '100%';
    container.style.height = '100%';
    const vv = window.visualViewport;
    const apply = () => {
        app.style.position = 'fixed';
        app.style.left = `${vv?.offsetLeft ?? 0}px`;
        app.style.top = `${vv?.offsetTop ?? 0}px`;
        app.style.width = `${vv?.width ?? window.innerWidth}px`;
        app.style.height = `${vv?.height ?? window.innerHeight}px`;
        // Read the parent's new size first: the canvas is fitted to the size Phaser knew last.
        game.scale.getParentBounds();
        const { width, height } = game.scale.parentSize;
        const size = computeScreenSize(width, height);
        const k = renderScaleFor(fitScale(width, height, size), window.devicePixelRatio, size.height);
        // Scenes read k when the resize event arrives, so it is set first.
        game.registry.set(RENDER_SCALE_KEY, k);
        // One resize event per change: setGameSize refreshes the scale itself, so refresh only when it isn't called.
        if (size.width * k !== game.scale.gameSize.width || size.height * k !== game.scale.gameSize.height) {
            game.scale.setGameSize(size.width * k, size.height * k);
        } else {
            game.scale.refresh();
        }
    };
    if (vv) {
        vv.addEventListener('resize', apply);
        vv.addEventListener('scroll', apply);
    } else {
        window.addEventListener('resize', apply);
    }
    apply();
    watchPixelRatio(apply);
}

/** Runs `onChange` whenever devicePixelRatio changes (browser zoom, or the window moved to another display). */
function watchPixelRatio(onChange: () => void): void {
    const listen = () => {
        const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
        // Very old browsers have no addEventListener on a MediaQueryList: the plain `resize` event is all they get.
        if (typeof query.addEventListener !== 'function') return;
        query.addEventListener(
            'change',
            () => {
                // Watch the new ratio first: a failing onChange must not stop the watching.
                listen();
                onChange();
            },
            { once: true },
        );
    };
    listen();
}

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    followViewport(game);
    return game;
};

export default StartGame;
