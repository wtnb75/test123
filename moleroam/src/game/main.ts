import { AUTO, Game, Scale, Types } from 'phaser';
import { PARAMS } from './params';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';

const StartGame = (parent: string) => {
    const config: Types.Core.GameConfig = {
        type: AUTO,
        width: PARAMS.viewW,
        height: PARAMS.viewH,
        parent,
        backgroundColor: '#1f5a27',
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        scene: [Title, GameScene, Result],
    };
    return new Game(config);
};

export default StartGame;
