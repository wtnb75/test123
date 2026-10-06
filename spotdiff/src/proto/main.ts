import { ProtoScene } from './Scene';
import { AUTO, Game, Scale, Types } from 'phaser';
import { PARAMS } from './params';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: window.innerHeight > window.innerWidth ? PARAMS.portrait.width : PARAMS.landscape.width,
    height: window.innerHeight > window.innerWidth ? PARAMS.portrait.height : PARAMS.landscape.height,
    parent: 'game-container',
    backgroundColor: '#1d2330',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    scene: [ProtoScene],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
