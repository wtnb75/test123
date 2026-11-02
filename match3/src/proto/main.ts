import { AUTO, Game, Scale, Types } from 'phaser';
import { HEIGHT, WIDTH } from './params';
import { Play } from './Play';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: WIDTH,
    height: HEIGHT,
    parent: 'game-container',
    backgroundColor: '#1b2230',
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    scene: [Play],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
