import { AUTO, Game, Scale, Types } from 'phaser';
import { GameScene } from './GameScene';
import { P } from './params';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: P.W,
    height: P.H,
    parent: 'game-container',
    backgroundColor: '#10162b',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [GameScene],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
