import { AUTO, Game, Scale, Types } from 'phaser';
import { PARAMS } from './params';
import { pickLayout } from './logic/layout';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';

const StartGame = (parent: string) => {
    // The first Scene starts with the layout for the window's current shape; every later Scene picks again.
    const layout = pickLayout(window.innerWidth, window.innerHeight);
    const config: Types.Core.GameConfig = {
        type: AUTO,
        width: layout.viewW,
        height: layout.viewH,
        parent,
        backgroundColor: '#1f5a27',
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        // One Pointer object per touch finger the Game follows (the mouse has its own). Phaser never reports a
        // finger beyond this; PointerTracker enforces the same PARAMS.maxTouchPointers on its own so its rule is testable.
        input: { activePointers: PARAMS.maxTouchPointers },
        scene: [Title, GameScene, Result],
    };
    return new Game(config);
};

export default StartGame;
