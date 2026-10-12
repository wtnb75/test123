import { AUTO, Game as PhaserGame, Scale, type Types } from 'phaser';
import { HEIGHT, WIDTH } from './params';
import { Demo } from './scenes/Demo';
import { Game } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';

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
    // Title is first and launches Demo (the real game played by a bot) behind itself.
    scene: [Title, Game, Result, Demo],
};

const StartGame = (parent: string) => new PhaserGame({ ...config, parent });

export default StartGame;
