import { AUTO, Game, Scale, Types } from 'phaser';
import { ProtoScene } from './ProtoScene';
import { PARAMS } from './params';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: PARAMS.width,
    height: PARAMS.height,
    parent: 'game-container',
    backgroundColor: '#101828',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [ProtoScene],
};

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
};

export default StartGame;
