import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    startButton!: GameObjects.Text;
    hasStarted = false;

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

        this.startButton = this.add.text(width / 2, height * 0.74, 'START', {
            fontFamily: 'Arial Black',
            fontSize: 36,
            color: '#ffe66d',
            stroke: '#111111',
            strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.startButton.on('pointerover', () => {
            this.startButton.setScale(1.06);
        });
        this.startButton.on('pointerout', () => {
            this.startButton.setScale(1);
        });
        this.startButton.on('pointerup', () => {
            this.tryStartGame();
        });

        this.input.on('pointerup', () => {
            this.tryStartGame();
        });

        this.input.keyboard?.on('keydown-ENTER', this.tryStartGame, this);
        this.input.keyboard?.on('keydown-SPACE', this.tryStartGame, this);

        this.scale.on('resize', this.onResize, this);

        this.events.once('shutdown', () => {
            this.scale.off('resize', this.onResize, this);
            this.startButton.off('pointerover');
            this.startButton.off('pointerout');
            this.startButton.off('pointerup');
            this.input.off('pointerup');
            this.input.keyboard?.off('keydown-ENTER', this.tryStartGame, this);
            this.input.keyboard?.off('keydown-SPACE', this.tryStartGame, this);
        });
    }

    private tryStartGame (): void
    {
        if (this.hasStarted) {
            return;
        }
        this.hasStarted = true;
        this.scene.start('Game');
    }

    private onResize (gameSize: Phaser.Structs.Size): void
    {
        const { width, height } = gameSize;
        this.background.setPosition(width / 2, height / 2);
        this.logo.setPosition(width / 2, height * 0.4);
        this.title.setPosition(width / 2, height * 0.6);
        this.startButton.setPosition(width / 2, height * 0.74);
    }
}
