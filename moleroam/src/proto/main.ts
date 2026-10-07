import { AUTO, Game, Scale, Types } from 'phaser';
import { P } from './params';
import { ProtoScene } from './ProtoScene';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: P.viewW,
    height: P.viewH,
    parent: 'game-container',
    backgroundColor: '#2e7d32',
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    scene: [ProtoScene],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
