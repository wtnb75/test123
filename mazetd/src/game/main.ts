import { Game as MainGame } from './scenes/Game';
import { Result } from './scenes/Result';
import { AUTO, Game, Scale, Types } from 'phaser';
import { BG_COLOR, CANVAS_H, CANVAS_W } from './logic/config';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: CANVAS_W,
    height: CANVAS_H,
    parent: 'game-container',
    backgroundColor: BG_COLOR,
    // Two touch pointers so a second finger's tap is handled while the first is still down.
    input: {
        activePointers: 2
    },
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        MainGame,
        Result
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
