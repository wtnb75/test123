import { AUTO, Game, Scale, Types } from 'phaser';
import { P } from './params';
import { ProtoScene } from './scenes/ProtoScene';

const config: Types.Core.GameConfig = {
    type: AUTO,
    width: P.canvasW,
    height: P.canvasH,
    parent: 'game-container',
    backgroundColor: '#10161f',
    scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
    scene: [ProtoScene],
};

const StartGame = (parent: string) => new Game({ ...config, parent });

export default StartGame;
