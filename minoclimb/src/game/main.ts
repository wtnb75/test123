import { AUTO, Game as PhaserGame, Scale, type Types } from 'phaser';
import { HEIGHT, WIDTH } from './params';
import { Game } from './scenes/Game';
import { Result } from './scenes/Result';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: 'game-container',
    backgroundColor: '#10131c',
    input: {
        // Mouse + up to three simultaneous fingers.
        activePointers: 3,
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Game, Result],
};

const StartGame = (parent: string) => new PhaserGame({ ...config, parent });

export default StartGame;
