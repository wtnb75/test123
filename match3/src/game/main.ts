import { AUTO, Game, Scale, Types } from 'phaser';
import { computeScreenSize } from './logic/screen';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';
import { BG_COLOR } from './scenes/ui';

const StartGame = (parent: string) => {
    // A first guess from the window (the parent element can't be measured before the game exists); Title
    // re-decides the size from the parent element on entry.
    const size = computeScreenSize(window.innerWidth, window.innerHeight);
    const config: Types.Core.GameConfig = {
        type: AUTO,
        width: size.width,
        height: size.height,
        parent,
        backgroundColor: BG_COLOR,
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        scene: [Title, GameScene, Result],
    };
    return new Game(config);
};

export default StartGame;
