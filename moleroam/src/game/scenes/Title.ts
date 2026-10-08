import { Scene } from 'phaser';
import { PARAMS } from '../params';
import { addButton, addLabel, drawBackdrop, fadeInScene } from './ui';

export class Title extends Scene {
    constructor() {
        super('Title');
    }

    create() {
        const cx = PARAMS.viewW / 2;
        fadeInScene(this);
        drawBackdrop(this);
        addLabel(this, cx, 150, 'モグラ巡り', 96);
        addLabel(this, cx, 255, '広い盤面を動き回って、モグラを叩こう！', 34, '#e8f5e9');
        addLabel(
            this,
            cx,
            405,
            [
                `モグラ +${PARAMS.scoreMole}\u3000／\u3000ネコは叩いちゃダメ ${PARAMS.scoreFriend}`,
                '画面の外の矢印の先は、モグラとは限らない（ネコのおとりも！）',
                '',
                'スクロール: ドラッグ ／ 矢印キー ／ マウスを画面の端へ',
                '叩く: タップ ／ クリック ／ Space',
            ].join('\n'),
            28,
        ).setLineSpacing(10);
        addButton(this, cx, 620, 'スタート', () => this.begin());
        this.input.keyboard?.on('keydown-ENTER', this.onKey, this);
        this.input.keyboard?.on('keydown-SPACE', this.onKey, this);
        this.events.once('shutdown', () => {
            this.input.keyboard?.off('keydown-ENTER', this.onKey, this);
            this.input.keyboard?.off('keydown-SPACE', this.onKey, this);
        });
    }

    private onKey(event: KeyboardEvent) {
        if (!event.repeat) this.begin();
    }

    private begin() {
        this.scene.start('Game');
    }
}
