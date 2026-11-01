import { Play } from './Play';
import { WORLD_H, WORLD_W } from './params';
import { AUTO, Game, Scale, Types } from 'phaser';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: WORLD_W,
    height: WORLD_H,
    parent: 'game-container',
    backgroundColor: '#101a2e',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Play],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
