import { describe, expect, it } from 'vitest';
import { TouchRoles, pointersToAdd, type TouchContext } from './touchRoles';

// Expected roles are worked out by hand from docs/spec.md ("タッチ": 指の振り分け / 指の役割の寿命):
// paused -> ignore; a drag finger already down -> release anywhere; else inside BUTTON_HIT_RADIUS
// (88 px) of the button centre -> release; else drag. The button is drawn with radius 56 px.
const BX = 600;
const BY = 700;
const touch: TouchContext = { paused: false, touchUi: true, buttonX: BX, buttonY: BY };

function withDrag(): TouchRoles {
    const roles = new TouchRoles();
    expect(roles.down(1, 100, 300, touch)).toBe('drag');
    return roles;
}

describe('a first finger with nothing dragging', () => {
    it('drags when it touches away from the button', () => {
        const roles = new TouchRoles();
        expect(roles.down(1, 100, 300, touch)).toBe('drag');
        expect(roles.dragging).toBe(true);
        expect(roles.roleOf(1)).toBe('drag');
    });

    it('releases at the button centre and at the drawn edge (56 px)', () => {
        const roles = new TouchRoles();
        expect(roles.down(1, BX, BY, touch)).toBe('release');
        expect(roles.down(2, BX - 56, BY, touch)).toBe('release');
        expect(roles.dragging).toBe(false);
    });

    it('releases just outside the drawn circle, up to exactly 88 px from the centre', () => {
        const roles = new TouchRoles();
        expect(roles.down(1, BX + 57, BY, touch)).toBe('release');
        expect(roles.down(2, BX + 88, BY, touch)).toBe('release');
        expect(roles.down(3, BX, BY - 88, touch)).toBe('release');
    });

    it('drags from just beyond 88 px', () => {
        const roles = new TouchRoles();
        expect(roles.down(1, BX + 88.01, BY, touch)).toBe('drag');
    });

    it('measures the hit range as a circle, not a square', () => {
        // (62, 62) is 87.7 px away (inside); (63, 63) is 89.1 px away (outside).
        expect(new TouchRoles().down(1, BX + 62, BY + 62, touch)).toBe('release');
        expect(new TouchRoles().down(1, BX + 63, BY + 63, touch)).toBe('drag');
    });
});

describe('a finger touching while another one drags', () => {
    it.each([
        ['the top-left corner', 0, 0],
        ['the middle of the screen', 384, 768],
        ['the button', BX, BY],
        ['the spot right beside the drag finger', 101, 301]
    ])('releases when it touches %s', (_name, x, y) => {
        const roles = withDrag();
        expect(roles.down(2, x, y, touch)).toBe('release');
        expect(roles.roleOf(2)).toBe('release');
        expect(roles.roleOf(1)).toBe('drag');
    });

    it('releases again for every further finger while the drag continues', () => {
        const roles = withDrag();
        expect(roles.down(2, 10, 10, touch)).toBe('release');
        roles.up(2);
        expect(roles.down(2, 20, 20, touch)).toBe('release');
        expect(roles.dragging).toBe(true);
    });
});

describe('finger roles keep for the life of the finger', () => {
    it('records the button finger as a release, not a drag', () => {
        const roles = new TouchRoles();
        roles.down(1, BX, BY, touch);
        expect(roles.roleOf(1)).toBe('release');
        expect(roles.dragging).toBe(false);
    });

    it('lets the next finger drag while a release finger is still down', () => {
        const roles = new TouchRoles();
        roles.down(1, BX, BY, touch);
        expect(roles.down(2, 100, 300, touch)).toBe('drag');
        expect(roles.roleOf(1)).toBe('release');
    });

    it('releases the third finger when finger 1 released and finger 2 is dragging', () => {
        const roles = new TouchRoles();
        roles.down(1, BX, BY, touch);
        roles.down(2, 100, 300, touch);
        expect(roles.down(3, 200, 200, touch)).toBe('release');
    });

    it('goes back to no dragging when the drag finger leaves, so the next finger can drag', () => {
        const roles = withDrag();
        roles.up(1);
        expect(roles.dragging).toBe(false);
        expect(roles.roleOf(1)).toBe('ignore');
        expect(roles.down(2, 200, 200, touch)).toBe('drag');
    });

    it('lets the next finger touching the button release after the drag finger left', () => {
        const roles = withDrag();
        roles.up(1);
        expect(roles.down(2, BX, BY, touch)).toBe('release');
    });

    it('does not end the drag when a release finger leaves', () => {
        const roles = withDrag();
        roles.down(2, 10, 10, touch);
        roles.up(2);
        expect(roles.dragging).toBe(true);
        expect(roles.down(3, 50, 50, touch)).toBe('release');
    });

    it('does not let a release finger take over the drag when the drag finger leaves', () => {
        const roles = withDrag();
        roles.down(2, 10, 10, touch);
        roles.up(1);
        expect(roles.dragging).toBe(false);
        expect(roles.roleOf(2)).toBe('release');
    });

    it('drags only once when the same finger id touches down again without leaving', () => {
        const roles = withDrag();
        expect(roles.down(1, 300, 300, touch)).toBe('drag');
        expect(roles.dragging).toBe(true);
        roles.up(1);
        expect(roles.dragging).toBe(false);
    });

    it('replaces a finger\'s role when the same id touches down again elsewhere', () => {
        const roles = new TouchRoles();
        roles.down(1, BX, BY, touch);
        expect(roles.down(1, 100, 300, touch)).toBe('drag');
        expect(roles.roleOf(1)).toBe('drag');
    });

    it('ignores a finger that has no record', () => {
        const roles = new TouchRoles();
        expect(roles.roleOf(7)).toBe('ignore');
        roles.up(7);
        expect(roles.dragging).toBe(false);
    });
});

describe('arrival order within one frame', () => {
    it('makes the first finger the drag and the second a release when the first is away from the button', () => {
        const roles = new TouchRoles();
        expect(roles.down(1, 100, 300, touch)).toBe('drag');
        expect(roles.down(2, 110, 310, touch)).toBe('release');
    });

    it('makes the first a release and the second the drag when the first is on the button', () => {
        const roles = new TouchRoles();
        expect(roles.down(1, BX, BY, touch)).toBe('release');
        expect(roles.down(2, 110, 310, touch)).toBe('drag');
    });
});

describe('pause', () => {
    it('ignores every finger touching while paused, even on the button or with nothing dragging', () => {
        const roles = new TouchRoles();
        const paused = { ...touch, paused: true };
        expect(roles.down(1, BX, BY, paused)).toBe('ignore');
        expect(roles.down(2, 100, 300, paused)).toBe('ignore');
        expect(roles.dragging).toBe(false);
    });

    it('ignores fingers while paused even with a drag finger down', () => {
        const roles = withDrag();
        expect(roles.down(2, 100, 300, { ...touch, paused: true })).toBe('ignore');
    });

    it('turns the drag finger into an ignored finger when the pause begins', () => {
        const roles = withDrag();
        roles.suspendDrag();
        expect(roles.dragging).toBe(false);
        expect(roles.roleOf(1)).toBe('ignore');
    });

    it('lets a new finger drag after the pause began, while the old drag finger stays ignored', () => {
        const roles = withDrag();
        roles.suspendDrag();
        expect(roles.down(2, 200, 200, touch)).toBe('drag');
        roles.up(1);
        expect(roles.dragging).toBe(true);
    });

    it('does nothing when the pause begins with no drag finger', () => {
        const roles = new TouchRoles();
        roles.down(1, BX, BY, touch);
        roles.suspendDrag();
        expect(roles.roleOf(1)).toBe('release');
    });
});

describe('clearing', () => {
    it('forgets every finger, so fingers already down become ignored', () => {
        const roles = withDrag();
        roles.down(2, 10, 10, touch);
        roles.clear();
        expect(roles.dragging).toBe(false);
        expect(roles.roleOf(1)).toBe('ignore');
        expect(roles.roleOf(2)).toBe('ignore');
        expect(roles.down(3, 200, 200, touch)).toBe('drag');
    });
});

describe('a device without touch (mouse only)', () => {
    const mouse: TouchContext = { ...touch, touchUi: false };

    it('drags even when pressing inside the button range', () => {
        const roles = new TouchRoles();
        expect(roles.down(0, BX, BY, mouse)).toBe('drag');
    });

    it('never turns another press into a release', () => {
        const roles = new TouchRoles();
        roles.down(0, 100, 100, mouse);
        expect(roles.down(1, 300, 300, mouse)).toBe('ignore');
    });

    it('still ignores presses while paused', () => {
        expect(new TouchRoles().down(0, 100, 100, { ...mouse, paused: true })).toBe('ignore');
    });
});

describe('pointers to add', () => {
    it('adds the one extra pointer when Phaser starts with a single touch pointer', () => {
        expect(pointersToAdd(1)).toBe(1);
    });

    it('adds nothing on a restart, when the earlier run already added it', () => {
        expect(pointersToAdd(2)).toBe(0);
    });

    it('never adds a negative number when the pool is already larger', () => {
        expect(pointersToAdd(5)).toBe(0);
    });
});
