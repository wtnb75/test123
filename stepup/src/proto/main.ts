import { AUTO, Game, Scale, Types } from 'phaser';
import { P } from './params';
import { Proto } from './Proto';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: P.width,
    height: P.height,
    parent: 'game-container',
    backgroundColor: '#1b2540',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Proto],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
