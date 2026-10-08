import { Scene } from 'phaser';
import { PARAMS } from '../params';
import type { Layout } from '../logic/layout';
import { addButton, addLabel, applyLayout, drawBackdrop, fadeInScene } from './ui';

/** Where things go on the title (see docs/spec.md and docs/spec/portrait.md "レイアウト方針"). */
const POSITIONS = {
    landscape: { name: 150, tagline: 255, info: 405, infoSize: 28, button: 620 },
    portrait: { name: 230, tagline: 360, info: 600, infoSize: 26, button: 900 },
} as const;

/** The explanation lines. In portrait the long ones are broken by hand so they fit the 768 px width. */
const infoLines = (portrait: boolean): string[] => {
    const score = `モグラ +${PARAMS.scoreMole}\u3000／\u3000ネコは叩いちゃダメ ${PARAMS.scoreFriend}`;
    if (!portrait) {
        return [
            score,
            '画面の外の矢印の先は、モグラとは限らない（ネコのおとりも！）',
            '',
            'スクロール: ドラッグ ／ 矢印キー ／ マウスを画面の端へ',
            '叩く: タップ ／ クリック ／ Space',
        ];
    }
    return [
        score,
        '画面の外の矢印の先は、',
        'モグラとは限らない（ネコのおとりも！）',
        '',
        'スクロール:',
        'ドラッグ ／ 矢印キー ／ マウスを画面の端へ',
        '叩く: タップ ／ クリック ／ Space',
    ];
};

export class Title extends Scene {
    constructor() {
        super('Title');
    }

    create() {
        const layout: Layout = applyLayout(this);
        const portrait = layout.viewH > layout.viewW;
        const pos = portrait ? POSITIONS.portrait : POSITIONS.landscape;
        const cx = layout.viewW / 2;
        fadeInScene(this);
        drawBackdrop(this, layout);
        addLabel(this, cx, pos.name, 'モグラ巡り', 96);
        addLabel(this, cx, pos.tagline, '広い盤面を動き回って、モグラを叩こう！', 34, '#e8f5e9');
        addLabel(this, cx, pos.info, infoLines(portrait).join('\n'), pos.infoSize).setLineSpacing(10);
        addButton(this, cx, pos.button, 'スタート', () => this.begin());
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
