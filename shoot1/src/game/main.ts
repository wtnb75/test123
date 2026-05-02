import { Boot } from './scenes/Boot';
import { Game as GameScene } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { AUTO, Game, Scale, Types } from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './core/constants';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#0a0a1a',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [Boot, GameScene, GameOver]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
