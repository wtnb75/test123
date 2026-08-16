import { AUTO, Game, Scale, type Types } from 'phaser';
import { Boot } from './scenes/Boot';
import { StageSelect } from './scenes/StageSelect';
import { Game as GameScene } from './scenes/Game';
import { StageClear } from './scenes/StageClear';
import { GameOver } from './scenes/GameOver';
import { GAME_WIDTH, GAME_HEIGHT } from './logic/constants';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#16213e',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [Boot, StageSelect, GameScene, StageClear, GameOver]
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
