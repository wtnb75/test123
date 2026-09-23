import { AUTO, Game, Scale, type Types } from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { Game as MainGame } from './scenes/Game';
import { Result } from './scenes/Result';
import { GAME_WIDTH, GAME_HEIGHT } from './logic/constants';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#eaf6ff',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Boot, Title, MainGame, Result],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
