// Run with: node --test scripts/check-game-list-link.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findProblems, gamesFromWorkspace } from './check-game-list-link.mjs';

const GOOD_TITLE = `import { Scene } from 'phaser';
import { showGameListLink } from 'game-list-link';
export class Title extends Scene {
    create() {
        showGameListLink(this);
    }
}
`;
const WITH_DEP = { dependencies: { 'game-list-link': 'workspace:*' } };

test('a game without Title.ts has no problems', () => {
    assert.deepEqual(findProblems({ titleSource: null, packageJson: {} }), []);
});

test('a Title that imports and calls showGameListLink, with the dependency, has no problems', () => {
    assert.deepEqual(findProblems({ titleSource: GOOD_TITLE, packageJson: WITH_DEP }), []);
});

test('reports a Title that never calls showGameListLink', () => {
    const src = GOOD_TITLE.replace('        showGameListLink(this);\n', '');
    const problems = findProblems({ titleSource: src, packageJson: WITH_DEP });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /showGameListLink\(this\)/);
});

test('a call inside a line comment does not count', () => {
    const src = GOOD_TITLE.replace('showGameListLink(this);', '// showGameListLink(this);');
    assert.equal(findProblems({ titleSource: src, packageJson: WITH_DEP }).length, 1);
});

test('a call inside a block comment does not count', () => {
    const src = GOOD_TITLE.replace('showGameListLink(this);', '/* showGameListLink(this); */');
    assert.equal(findProblems({ titleSource: src, packageJson: WITH_DEP }).length, 1);
});

test('reports a Title that calls it without importing it from game-list-link', () => {
    const src = GOOD_TITLE.replace("import { showGameListLink } from 'game-list-link';\n", '');
    const problems = findProblems({ titleSource: src, packageJson: WITH_DEP });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /import/);
});

test('reports a package.json that does not depend on game-list-link', () => {
    const problems = findProblems({ titleSource: GOOD_TITLE, packageJson: { dependencies: {} } });
    assert.equal(problems.length, 1);
    assert.match(problems[0], /package\.json/);
});

test('gamesFromWorkspace lists the game directories and skips shared packages', () => {
    const yaml = "packages:\n- 'stepup'\n- 'first-game'\n- 'shared/pause'\ncatalog:\n  phaser: '4.2.1'\n";
    assert.deepEqual(gamesFromWorkspace(yaml), ['stepup', 'first-game']);
});
