import { Scene } from 'phaser';
import type { GameConfig, Highlight, KogoEntry } from '../logic/types';
import { findExampleSentence } from '../logic/kogodrop';
import { exampleSentences } from '../data/exampleSentences';

interface ReviewData {
    wrongEntries?: KogoEntry[];
    correctEntries?: KogoEntry[];
    config?: GameConfig;
}

export class Review extends Scene {
    private wrongEntries: KogoEntry[] = [];
    private correctEntries: KogoEntry[] = [];
    private config!: GameConfig;
    private overlayEl: HTMLElement | null = null;

    constructor() {
        super('Review');
    }

    init(data: ReviewData) {
        this.wrongEntries = data.wrongEntries ?? [];
        this.correctEntries = data.correctEntries ?? [];
        this.config = data.config ?? { langMode: 'kogo-to-jp', difficulty: 'normal', questionCount: 20 };
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
        title.textContent = '復習';
        title.style.cssText = [
            'text-align:center',
            'font-size:20px',
            'font-weight:bold',
            'padding:12px 16px 8px',
            'color:#ffd166',
            'flex-shrink:0',
        ].join(';');
        overlay.appendChild(title);

        // Toggle row — only shown when there are correct entries
        if (this.correctEntries.length > 0) {
            const toggleRow = document.createElement('div');
            toggleRow.style.cssText = [
                'text-align:center',
                'padding:0 16px 8px',
                'border-bottom:1px solid rgba(255,255,255,0.2)',
                'flex-shrink:0',
            ].join(';');

            const toggleLabel = document.createElement('label');
            toggleLabel.style.cssText = 'color:#a8dadc;cursor:pointer;font-size:14px;user-select:none;';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.style.cssText = 'margin-right:6px;cursor:pointer;accent-color:#80ed99;';
            checkbox.addEventListener('change', () => {
                this.renderList(list, checkbox.checked);
            });

            toggleLabel.appendChild(checkbox);
            toggleLabel.appendChild(document.createTextNode(`正解した単語も表示（${this.correctEntries.length}語）`));
            toggleRow.appendChild(toggleLabel);
            overlay.appendChild(toggleRow);
        } else {
            title.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
            title.style.paddingBottom = '16px';
        }

        const list = document.createElement('div');
        list.style.cssText = 'flex:1;overflow-y:auto;padding:12px 16px;';
        this.renderList(list, false);
        overlay.appendChild(list);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;padding:12px 16px;flex-shrink:0;';

        const retryBtn = document.createElement('button');
        retryBtn.textContent = 'もう一度';
        retryBtn.style.cssText = [
            'padding:12px 28px',
            'background:#8ac926',
            'color:#14213d',
            'border:none',
            'border-radius:4px',
            'font-size:18px',
            'font-weight:bold',
            'cursor:pointer',
        ].join(';');
        retryBtn.addEventListener('click', () => {
            this.destroyOverlay();
            this.scene.start('Game', this.config);
        });

        const titleBtn = document.createElement('button');
        titleBtn.textContent = 'タイトルへ';
        titleBtn.style.cssText = [
            'padding:12px 28px',
            'background:#415a77',
            'color:#f1faee',
            'border:none',
            'border-radius:4px',
            'font-size:18px',
            'cursor:pointer',
        ].join(';');
        titleBtn.addEventListener('click', () => {
            this.destroyOverlay();
            this.scene.start('Title');
        });

        btnRow.appendChild(retryBtn);
        btnRow.appendChild(titleBtn);
        overlay.appendChild(btnRow);

        document.body.appendChild(overlay);
        this.overlayEl = overlay;
    }

    private renderList(list: HTMLElement, showCorrect: boolean) {
        while (list.firstChild) list.removeChild(list.firstChild);

        if (this.wrongEntries.length === 0 && !showCorrect) {
            const empty = document.createElement('div');
            empty.textContent = '間違えた単語はありません';
            empty.style.cssText = 'text-align:center;color:#aaa;padding:32px 0;';
            list.appendChild(empty);
            return;
        }

        this.wrongEntries.forEach((entry, idx) => {
            list.appendChild(this.buildEntryEl(entry, idx + 1, false));
        });

        if (showCorrect && this.correctEntries.length > 0) {
            if (this.wrongEntries.length > 0) {
                const sep = document.createElement('div');
                sep.textContent = '── 正解した単語 ──';
                sep.style.cssText = 'text-align:center;color:#80ed99;font-size:13px;padding:12px 0 4px;';
                list.appendChild(sep);
            }
            this.correctEntries.forEach((entry, idx) => {
                list.appendChild(this.buildEntryEl(entry, this.wrongEntries.length + idx + 1, true));
            });
        }
    }

    private buildEntryEl(entry: KogoEntry, num: number, wasCorrect: boolean): HTMLElement {
        const item = document.createElement('div');
        item.style.cssText = 'margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid rgba(255,255,255,0.15);';

        const header = document.createElement('div');
        const badge = wasCorrect ? '✓ ' : '';
        header.textContent = `${badge}${num}. ${entry.word}［${entry.pos}］`;
        header.style.cssText = `font-weight:bold;color:${wasCorrect ? '#80ed99' : '#ffd166'};font-size:16px;`;
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
            sentenceEl.style.cssText = 'margin-top:8px;color:#ccc;font-size:14px;';
            sentenceEl.appendChild(document.createTextNode('例）「'));
            if (highlight) {
                sentenceEl.appendChild(this.buildHighlightedText(example.sentence, highlight));
            } else {
                sentenceEl.appendChild(document.createTextNode(example.sentence));
            }
            sentenceEl.appendChild(document.createTextNode('」'));
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

    private buildHighlightedText(sentence: string, highlight: Highlight): DocumentFragment {
        const fragment = document.createDocumentFragment();
        const idx = sentence.indexOf(highlight.form);
        if (idx < 0) {
            fragment.appendChild(document.createTextNode(sentence));
            return fragment;
        }
        if (idx > 0) fragment.appendChild(document.createTextNode(sentence.slice(0, idx)));
        const span = document.createElement('span');
        span.textContent = highlight.form;
        span.style.cssText = 'color:#ffd166;font-weight:bold;';
        fragment.appendChild(span);
        const after = sentence.slice(idx + highlight.form.length);
        if (after) fragment.appendChild(document.createTextNode(after));
        return fragment;
    }

    shutdown() {
        this.destroyOverlay();
    }

    private destroyOverlay() {
        if (this.overlayEl) {
            this.overlayEl.remove();
            this.overlayEl = null;
        }
    }
}
