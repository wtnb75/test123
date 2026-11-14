import { describe, expect, it } from 'vitest';
import { showGameListLink } from './gameListLink';

function fakeLink() {
    const attrs = new Map<string, string>([['data-visible', 'false']]);
    return {
        attrs,
        el: { setAttribute: (k: string, v: string) => void attrs.set(k, v) },
    };
}

function fakeDoc(el: ReturnType<typeof fakeLink>['el'] | null) {
    const ids: string[] = [];
    return {
        ids,
        doc: {
            getElementById: (id: string) => {
                ids.push(id);
                return el as unknown as HTMLElement | null;
            },
        },
    };
}

function fakeScene() {
    const handlers: Array<() => void> = [];
    let registered = 0;
    return {
        scene: {
            events: {
                once: (_event: 'shutdown', fn: () => void) => {
                    registered += 1;
                    handlers.push(fn);
                },
            },
        },
        shutdown: () => handlers.splice(0).forEach((fn) => fn()),
        registered: () => registered,
    };
}

describe('showGameListLink', () => {
    it('makes the link visible when called', () => {
        const link = fakeLink();
        const { doc, ids } = fakeDoc(link.el);
        showGameListLink(fakeScene().scene, doc);
        expect(link.attrs.get('data-visible')).toBe('true');
        expect(ids).toEqual(['game-list-link']);
    });

    it('hides the link again when the scene shuts down', () => {
        const link = fakeLink();
        const scene = fakeScene();
        showGameListLink(scene.scene, fakeDoc(link.el).doc);
        scene.shutdown();
        expect(link.attrs.get('data-visible')).toBe('false');
    });

    it('shows the link again when the scene is rebuilt after a shutdown', () => {
        const link = fakeLink();
        const scene = fakeScene();
        const { doc } = fakeDoc(link.el);
        showGameListLink(scene.scene, doc);
        scene.shutdown();
        showGameListLink(scene.scene, doc);
        expect(link.attrs.get('data-visible')).toBe('true');
    });

    it('registers one shutdown handler per call', () => {
        const scene = fakeScene();
        showGameListLink(scene.scene, fakeDoc(fakeLink().el).doc);
        expect(scene.registered()).toBe(1);
    });

    it('does nothing and does not throw when the page has no link (dev server)', () => {
        const scene = fakeScene();
        expect(() => showGameListLink(scene.scene, fakeDoc(null).doc)).not.toThrow();
        expect(scene.registered()).toBe(0);
    });
});
