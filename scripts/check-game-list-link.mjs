// Fails when a game's Title Scene does not show the "back to the game list" link.
//
// Usage: node scripts/check-game-list-link.mjs [<game-dir>...]   (no argument: every game in pnpm-workspace.yaml)
//
// A game is checked when it has src/game/scenes/Title.ts. That file must import `showGameListLink` from
// 'game-list-link' and call it, and the game's package.json must depend on game-list-link
// (see shared/game-list-link/README.md). Games without a Title.ts are skipped.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TITLE_PATH = 'src/game/scenes/Title.ts';
const IMPORT_RE = /import\s*\{[^}]*\bshowGameListLink\b[^}]*\}\s*from\s*['"]game-list-link['"]/;
const CALL_RE = /\bshowGameListLink\s*\(/;

/** Removes block comments and `//` line comments (a `//` right after `:` is kept, e.g. a URL). */
function stripComments(source) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Problems of one game (an empty array is OK).
 * @param {{ titleSource: string | null, packageJson: { dependencies?: Record<string, string> } }} files
 */
export function findProblems({ titleSource, packageJson }) {
    if (titleSource === null) return [];
    const code = stripComments(titleSource);
    const problems = [];
    if (!CALL_RE.test(code)) problems.push(`${TITLE_PATH} does not call showGameListLink(this) in create()`);
    if (!IMPORT_RE.test(code)) problems.push(`${TITLE_PATH} does not import showGameListLink from 'game-list-link'`);
    if (!packageJson.dependencies?.['game-list-link']) {
        problems.push('package.json does not depend on game-list-link ("game-list-link": "workspace:*")');
    }
    return problems;
}

/** Game directories listed in pnpm-workspace.yaml (entries with a `/` are shared packages, not games). */
export function gamesFromWorkspace(yaml) {
    const games = [];
    for (const line of yaml.split('\n')) {
        const m = /^-\s*['"]?([^'"\s]+)['"]?\s*$/.exec(line);
        if (m && !m[1].includes('/')) games.push(m[1]);
        else if (games.length > 0 && !line.startsWith('-')) break;
    }
    return games;
}

function main(args) {
    const root = join(fileURLToPath(import.meta.url), '..', '..');
    const games = args.length > 0 ? args : gamesFromWorkspace(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8'));
    let failed = false;
    for (const game of games) {
        const titleFile = join(root, game, TITLE_PATH);
        const titleSource = existsSync(titleFile) ? readFileSync(titleFile, 'utf8') : null;
        const packageJson = JSON.parse(readFileSync(join(root, game, 'package.json'), 'utf8'));
        for (const problem of findProblems({ titleSource, packageJson })) {
            process.stderr.write(`${game}: ${problem}\n`);
            failed = true;
        }
    }
    process.exitCode = failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
