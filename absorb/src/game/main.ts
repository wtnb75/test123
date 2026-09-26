import { Game as MainGame } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { AUTO, Game, Scale, Types } from 'phaser';
import { computeScreenSize } from './logic/screen';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
// The Game scene recomputes the size on every run, so a rotated device gets a fitting world.
const initialSize = computeScreenSize(window.innerWidth, window.innerHeight);

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: initialSize.width,
    height: initialSize.height,
    parent: 'game-container',
    backgroundColor: '#0b1020',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        MainGame,
        GameOver
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
