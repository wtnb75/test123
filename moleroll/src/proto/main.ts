import { AUTO, Game as PhaserGame, Scale, Types } from 'phaser';
import { Game } from './Game';
import { PARAMS } from './params';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: PARAMS.width,
    height: PARAMS.height,
    parent: 'game-container',
    backgroundColor: '#1f2a44',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Game],
};

const StartGame = (parent: string) => new PhaserGame({ ...config, parent });

export default StartGame;
