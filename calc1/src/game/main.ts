import { Game as MainGame } from './scenes/Game';
import { Title } from './scenes/Title';
import { AUTO, Game, Scale,Types } from 'phaser';
import { CANVAS_WIDTH, canvasHeight } from './layout';

// Logical height follows the window's aspect ratio at start (see layout.ts). A rotation takes effect on reload.
const initialHeight = Math.round(canvasHeight(window.innerWidth, window.innerHeight));

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: CANVAS_WIDTH,
    height: initialHeight,
    parent: 'game-container',
    backgroundColor: '#028af8',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        Title,
        MainGame
    ]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
