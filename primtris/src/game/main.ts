import { AUTO, Game, Scale, Types } from 'phaser';

import { Game as MainGame } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 540,
    height: 960,
    parent: 'game-container',
    backgroundColor: '#101820',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        Title,
        MainGame
        ,
        Result
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
