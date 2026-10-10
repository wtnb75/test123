import { AUTO, Game, Scale, type Types } from 'phaser';
import { pickLayout } from './logic/layout';
import { COLORS } from './scenes/ui';
import { Game as GameScene } from './scenes/Game';
import { Result } from './scenes/Result';
import { Title } from './scenes/Title';

const StartGame = (parent: string) => {
    // The first Scene starts with the layout for the window's current shape; each Scene re-checks on start.
    const layout = pickLayout(window.innerWidth, window.innerHeight);
    const config: Types.Core.GameConfig = {
        type: AUTO,
        width: layout.viewW,
        height: layout.viewH,
        parent,
        backgroundColor: `#${COLORS.bg.toString(16).padStart(6, '0')}`,
        scale: {
            mode: Scale.FIT,
            autoCenter: Scale.CENTER_BOTH,
        },
        scene: [Title, GameScene, Result],
    };
    return new Game(config);
};

export default StartGame;
