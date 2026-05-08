import { generateColHints, generateRowHints } from './hints';
import type { AnalysisResult, BinaryCell, PuzzleData } from './types';

type PbmMeta = {
    difficulty?: string;
    score?: string;
    unique?: string;
};

const parseBinary = (token: string): BinaryCell => {
    if (token === '0') {
        return 0;
    }
    if (token === '1') {
        return 1;
    }
    throw new Error(`invalid binary token: ${token}`);
};

export const exportPBM = (board: BinaryCell[][], analysis: AnalysisResult): string => {
    const height = board.length;
    const width = board[0]?.length ?? 0;
    const lines: string[] = [
        'P1',
        '# NonoEdit export',
        `# difficulty: ${analysis.difficulty}`,
        `# score: ${analysis.score}`,
        `# unique: ${analysis.unique}`,
        `${width} ${height}`,
    ];

    for (const row of board) {
        lines.push(row.join(' '));
    }
    return lines.join('\n');
};

export const importPBM = (input: string): { puzzle: PuzzleData; meta: PbmMeta } => {
    const rawLines = input.replace(/\r/g, '').split('\n');
    const contentTokens: string[] = [];
    const meta: PbmMeta = {};

    for (const line of rawLines) {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
            continue;
        }
        if (trimmed.startsWith('#')) {
            // Parse known metadata keys but ignore comments for data parsing.
            const m = trimmed.match(/^#\s*([a-zA-Z][a-zA-Z-]*)\s*:\s*(.+)$/);
            if (m) {
                const key = m[1].toLowerCase();
                const value = m[2].trim();
                if (key === 'difficulty') {
                    meta.difficulty = value;
                } else if (key === 'score') {
                    meta.score = value;
                } else if (key === 'unique') {
                    meta.unique = value;
                }
            }
            continue;
        }
        contentTokens.push(...trimmed.split(/\s+/));
    }

    if (contentTokens[0] !== 'P1') {
        throw new Error('invalid PBM header: expected P1');
    }
    if (contentTokens.length < 4) {
        throw new Error('invalid PBM: too short');
    }

    const width = Number(contentTokens[1]);
    const height = Number(contentTokens[2]);
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
        throw new Error('invalid PBM size');
    }
    if (width < 5 || width > 25 || height < 5 || height > 25) {
        throw new Error('PBM size out of range (5-25)');
    }

    const expected = width * height;
    const payload = contentTokens.slice(3);
    if (payload.length !== expected) {
        throw new Error(`invalid PBM cell count: expected ${expected}, got ${payload.length}`);
    }

    const solution: BinaryCell[][] = [];
    let index = 0;
    for (let y = 0; y < height; y += 1) {
        const row: BinaryCell[] = [];
        for (let x = 0; x < width; x += 1) {
            row.push(parseBinary(payload[index]));
            index += 1;
        }
        solution.push(row);
    }

    const puzzle: PuzzleData = {
        width,
        height,
        solution,
        rows: generateRowHints(solution),
        cols: generateColHints(solution),
    };

    return { puzzle, meta };
};
