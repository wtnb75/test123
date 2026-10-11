import type { GameObjects, Scene } from 'phaser';

import { formatBoxDigits, type BoxKey } from '../logic/primtris';

/** Where things sit inside a box and how big the text is (px). `Game` and the Title demo use different styles. */
export interface BoxesViewStyle {
    top: number;
    height: number;
    labelOffset: number;
    labelFont: number;
    digitsOffset: number;
    digitsFont: number;
    digitsLineSpacing: number;
    /** Distance of the "n/capacity" text's top from the top of the box. */
    capacityOffset: number;
    capacityFont: number;
}

const BASE_FILLS = [0x415a77, 0x33415c] as const;
const HIGHLIGHT_FILL = 0x778da9;

interface BoxView {
    background: GameObjects.Rectangle;
    labelText: GameObjects.Text;
    digitsText: GameObjects.Text;
    capacityText: GameObjects.Text;
}

/**
 * The row of boxes (background, label, residual digits, n / capacity), shared by `Game` and the Title demo.
 * Boxes are laid side by side across `width` with no gaps; `keys` are the visible boxes in order.
 */
export class BoxesView
{
    private readonly views = new Map<BoxKey, BoxView>();
    private readonly keys: readonly BoxKey[];
    private readonly capacity: number;
    private highlighted: BoxKey | null = null;
    private alpha = 1;

    constructor (scene: Scene, keys: readonly BoxKey[], width: number, style: BoxesViewStyle, capacity: number)
    {
        this.keys = keys;
        this.capacity = capacity;
        const boxWidth = width / keys.length;

        keys.forEach((key, index) => {
            const left = index * boxWidth;
            const centerX = left + boxWidth / 2;
            const background = scene.add.rectangle(left, style.top, boxWidth, style.height, this.baseFill(index)).setOrigin(0);
            const labelText = scene.add.text(centerX, style.top + style.labelOffset, key.toUpperCase(), {
                color: '#f8f4e3',
                fontFamily: 'sans-serif',
                fontSize: `${style.labelFont}px`,
                fontStyle: 'bold'
            }).setOrigin(0.5, 0);
            const digitsText = scene.add.text(centerX, style.top + style.digitsOffset, '--', {
                align: 'center',
                color: '#f8f4e3',
                fontFamily: 'monospace',
                fontSize: `${style.digitsFont}px`,
                fontStyle: 'bold',
                lineSpacing: style.digitsLineSpacing
            }).setOrigin(0.5, 0);
            const capacityText = scene.add.text(centerX, style.top + style.capacityOffset, `0/${capacity}`, {
                color: '#ffd166',
                fontFamily: 'sans-serif',
                fontSize: `${style.capacityFont}px`
            }).setOrigin(0.5, 0);

            this.views.set(key, { background, labelText, digitsText, capacityText });
        });
    }

    private baseFill (index: number): number
    {
        return BASE_FILLS[index % 2];
    }

    /** Shows the residual digits and the n / capacity of every box. */
    update (boxes: Record<BoxKey, number[]>): void
    {
        for (const key of this.keys) {
            const view = this.views.get(key);
            const digits = boxes[key];
            view?.digitsText.setText(formatBoxDigits(digits));
            view?.capacityText.setText(`${digits.length}/${this.capacity}`);
        }
    }

    /** Lights one box (or none). */
    setHighlight (key: BoxKey | null): void
    {
        if (this.highlighted === key) {
            return;
        }
        this.highlighted = key;

        this.keys.forEach((boxKey, index) => {
            this.views.get(boxKey)?.background.setFillStyle(boxKey === key ? HIGHLIGHT_FILL : this.baseFill(index));
        });
    }

    setAlpha (alpha: number): void
    {
        if (alpha === this.alpha) {
            return;
        }
        this.alpha = alpha;

        for (const view of this.views.values()) {
            view.background.setAlpha(alpha);
            view.labelText.setAlpha(alpha);
            view.digitsText.setAlpha(alpha);
            view.capacityText.setAlpha(alpha);
        }
    }

    destroy (): void
    {
        for (const view of this.views.values()) {
            view.background.destroy();
            view.labelText.destroy();
            view.digitsText.destroy();
            view.capacityText.destroy();
        }
        this.views.clear();
    }
}
