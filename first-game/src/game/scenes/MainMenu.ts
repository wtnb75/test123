import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        const { width, height } = this.scale;

        this.background = this.add.image(width / 2, height / 2, 'background');
        this.logo = this.add.image(width / 2, height * 0.4, 'logo');

        this.title = this.add.text(width / 2, height * 0.6, 'Main Menu', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        this.scale.on('resize', this.onResize, this);

        this.events.once('shutdown', () => {
            this.scale.off('resize', this.onResize, this);
        });

        this.input.once('pointerdown', () => {
            this.scene.start('Game');
        });
    }

    private onResize (gameSize: Phaser.Structs.Size): void
    {
        const { width, height } = gameSize;
        this.background.setPosition(width / 2, height / 2);
        this.logo.setPosition(width / 2, height * 0.4);
        this.title.setPosition(width / 2, height * 0.6);
    }
}
