import { AUTO, Game, Scale, type Types } from 'phaser';
import { PARAMS } from './params';
import { ProtoScene } from './ProtoScene';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: PARAMS.width,
    height: PARAMS.heightInitial,
    parent: 'game-container',
    backgroundColor: '#101830',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [ProtoScene],
};

// Keep the game inside the visible area when the OS keyboard is open
// (mobile browsers shrink visualViewport but not the layout viewport).
function fitToVisualViewport(game: Game) {
    const vv = window.visualViewport;
    const app = document.getElementById('app');
    if (!vv || !app) return;
    const container = document.getElementById('game-container');
    if (container) {
        container.style.width = '100%';
        container.style.height = '100%';
    }
    const apply = () => {
        app.style.position = 'fixed';
        app.style.left = `${vv.offsetLeft}px`;
        app.style.top = `${vv.offsetTop}px`;
        app.style.width = `${vv.width}px`;
        app.style.height = `${vv.height}px`;
        const h = Math.round((PARAMS.width * vv.height) / vv.width);
        const clamped = Math.min(PARAMS.heightMax, Math.max(PARAMS.heightMin, h));
        // Too short to play (e.g. landscape with the keyboard open): the Scene pauses and asks to rotate.
        game.registry.set('tooSmall', h < PARAMS.heightMin);
        game.scale.setGameSize(PARAMS.width, clamped);
        game.scale.refresh();
    };
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    apply();
}

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    fitToVisualViewport(game);
    return game;
};

export default StartGame;
