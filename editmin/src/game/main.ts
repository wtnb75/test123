import { Game as MainGame } from './scenes/Game';
import { AUTO, Game, Scale, Types } from 'phaser';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#f4f1e8',
    dom: {
        createContainer: true
    },
    scale: {
        mode: Scale.RESIZE,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        MainGame
    ]
};

const StartGame = (parent: string) => {
    const game = new Game({ ...config, parent });
    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth, window.innerHeight);
    });
    return game;
};

export default StartGame;
