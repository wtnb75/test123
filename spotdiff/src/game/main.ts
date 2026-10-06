import { AUTO, Game, Scale, Types } from 'phaser';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';
import { initialCanvasSize } from './scenes/orientation';

const StartGame = (parent: string) => {
    const config: Types.Core.GameConfig = {
        type: AUTO,
        ...initialCanvasSize(),
        parent,
        backgroundColor: '#1d2330',
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        scene: [Title, GameScene, Result],
    };
    return new Game(config);
};

export default StartGame;
