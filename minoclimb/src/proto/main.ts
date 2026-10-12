import { AUTO, Game, Scale, Types } from 'phaser';
import { P } from './params';
import { ProtoScene } from './ProtoScene';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: P.COLS * P.CELL,
    height: P.ROWS * P.CELL,
    parent: 'game-container',
    backgroundColor: '#10131c',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [ProtoScene],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
