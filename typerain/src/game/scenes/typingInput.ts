import { readInputDelta } from '../logic/input';

type CharHandler = (ch: string) => void;
type FocusListener = (focused: boolean) => void;

/**
 * The hidden <input> that receives typing (docs/spec.md "操作仕様"): the phone's OS keyboard and a PC keyboard
 * both type into it. One lives for the whole page; the Game Scene sets a handler while it runs.
 */
export class TypingInput {
    private readonly el: HTMLInputElement;
    private seen = 0;
    private handler: CharHandler | null = null;
    private readonly focusListeners = new Set<FocusListener>();

    constructor(doc: Document = document) {
        const el = doc.createElement('input');
        el.type = 'text';
        el.autocapitalize = 'off';
        el.autocomplete = 'off';
        el.spellcheck = false;
        el.setAttribute('autocorrect', 'off');
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
        // 16px or more keeps iOS from zooming in; invisible and out of the way of taps on the canvas.
        el.style.cssText =
            'position:fixed;left:0;bottom:0;width:60px;height:24px;opacity:0;font-size:16px;pointer-events:none;';
        el.addEventListener('input', () => this.onInput());
        el.addEventListener('focus', () => this.notify(true));
        el.addEventListener('blur', () => this.notify(false));
        doc.body.appendChild(el);
        this.el = el;
    }

    /** Where typed letters go (null: they are dropped). */
    setHandler(handler: CharHandler | null): void {
        this.handler = handler;
    }

    /** Must run inside a user gesture on iOS (a button release), or the keyboard won't open. */
    focus(): void {
        this.el.focus({ preventScroll: true });
    }

    blur(): void {
        this.el.blur();
    }

    get focused(): boolean {
        return this.el.ownerDocument.activeElement === this.el;
    }

    /** Calls `listener` when the input gains or loses focus; returns the remover. */
    onFocusChange(listener: FocusListener): () => void {
        this.focusListeners.add(listener);
        return () => this.focusListeners.delete(listener);
    }

    private notify(focused: boolean): void {
        this.focusListeners.forEach((l) => l(focused));
    }

    private onInput(): void {
        const delta = readInputDelta(this.seen, this.el.value);
        this.seen = delta.seen;
        if (delta.clear) this.el.value = '';
        if (this.handler) delta.chars.forEach((c) => this.handler?.(c));
    }
}

let shared: TypingInput | null = null;

/** The one input for the page, created on first use. */
export function typingInput(): TypingInput {
    shared ??= new TypingInput();
    return shared;
}
