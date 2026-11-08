import { AUTO, Game, Scale, Types } from 'phaser';
import { H, W } from './params';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';
import { BG_COLOR } from './scenes/ui';

const StartGame = (parent: string) => {
    const config: Types.Core.GameConfig = {
        type: AUTO,
        width: W,
        height: H,
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
