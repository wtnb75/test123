import { Scene } from 'phaser';
import type { KogoEntry } from '../logic/types';
import { findExampleSentence } from '../logic/kogodrop';
import { exampleSentences } from '../data/exampleSentences';

interface ReviewData {
    wrongEntries?: KogoEntry[];
}

export class Review extends Scene {
    private wrongEntries: KogoEntry[] = [];
    private overlayEl: HTMLElement | null = null;

    constructor() {
        super('Review');
    }

    init(data: ReviewData) {
        this.wrongEntries = data.wrongEntries ?? [];
    }

    create() {
        this.cameras.main.setBackgroundColor('#1a1a2e');
        this.buildDomOverlay();
    }

    private buildDomOverlay() {
        const canvas = this.game.canvas;
        const rect = canvas.getBoundingClientRect();

        const overlay = document.createElement('div');
        overlay.id = 'review-overlay';
        overlay.style.cssText = [
            `position:fixed`,
            `left:${rect.left}px`,
            `top:${rect.top}px`,
            `width:${rect.width}px`,
            `height:${rect.height}px`,
            `background:#1a1a2e`,
            `color:#f0f0f0`,
            `font-family:sans-serif`,
            `z-index:100`,
            `display:flex`,
            `flex-direction:column`,
            `box-sizing:border-box`,
        ].join(';');

        const title = document.createElement('div');
        title.textContent = '復習 — 間違えた単語';
        title.style.cssText = [
            'text-align:center',
            'font-size:20px',
            'font-weight:bold',
            'padding:16px',
            'color:#ffd166',
            'border-bottom:1px solid rgba(255,255,255,0.2)',
            'flex-shrink:0',
        ].join(';');
        overlay.appendChild(title);

        const list = document.createElement('div');
        list.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;';

        this.wrongEntries.forEach((entry, idx) => {
            list.appendChild(this.buildEntryEl(entry, idx));
        });

        overlay.appendChild(list);

        const btn = document.createElement('button');
        btn.textContent = 'タイトルへ';
        btn.style.cssText = [
            'margin:12px auto',
            'display:block',
            'padding:12px 32px',
            'background:#415a77',
            'color:#f1faee',
            'border:none',
            'border-radius:4px',
            'font-size:18px',
            'cursor:pointer',
            'flex-shrink:0',
        ].join(';');
        btn.addEventListener('click', () => {
            this.destroyOverlay();
            this.scene.start('Title');
        });
        overlay.appendChild(btn);

        document.body.appendChild(overlay);
        this.overlayEl = overlay;
    }

    private buildEntryEl(entry: KogoEntry, idx: number): HTMLElement {
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.15);';

        const header = document.createElement('div');
        header.textContent = `${idx + 1}. ${entry.word}［${entry.pos}］`;
        header.style.cssText = 'font-weight:bold;color:#ffd166;font-size:16px;';
        item.appendChild(header);

        const jpMeaning = document.createElement('div');
        jpMeaning.textContent = `→ ${entry.meaning}`;
        jpMeaning.style.cssText = 'margin-top:6px;color:#f0f0f0;';
        item.appendChild(jpMeaning);

        const enMeaning = document.createElement('div');
        enMeaning.textContent = `→ ${entry.englishMeaning}`;
        enMeaning.style.cssText = 'margin-top:2px;color:#90e0ef;';
        item.appendChild(enMeaning);

        const example = findExampleSentence(entry.word, exampleSentences);
        if (example) {
            const highlight = example.highlights.find((h) => h.word === entry.word);

            const sentenceEl = document.createElement('div');
            sentenceEl.textContent = `例）「${example.sentence}」`;
            sentenceEl.style.cssText = 'margin-top:8px;color:#ccc;font-size:14px;';
            item.appendChild(sentenceEl);

            const transEl = document.createElement('div');
            transEl.textContent = `（${example.translation}）`;
            transEl.style.cssText = 'margin-left:20px;color:#aaa;font-size:13px;';
            item.appendChild(transEl);

            if (highlight?.note) {
                const noteEl = document.createElement('div');
                noteEl.textContent = `※「${highlight.form}」= ${highlight.note}`;
                noteEl.style.cssText = 'margin-left:20px;margin-top:2px;color:#9999cc;font-size:12px;';
                item.appendChild(noteEl);
            }

            if (example.source) {
                const sourceEl = document.createElement('div');
                sourceEl.textContent = `※出典: ${example.source}`;
                sourceEl.style.cssText = 'margin-left:20px;margin-top:2px;color:#888;font-size:12px;';
                item.appendChild(sourceEl);
            }
        }

        return item;
    }

    private destroyOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
    }
}
