import { AUTO, Game, Scale, type Types } from 'phaser';
import { Boot } from './scenes/Boot';
import { Title } from './scenes/Title';
import { Game as MainGame } from './scenes/Game';
import { Result } from './scenes/Result';
import { Review } from './scenes/Review';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: 540,
    height: 960,
    parent: 'game-container',
    backgroundColor: '#101820',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [Boot, Title, MainGame, Result, Review],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
