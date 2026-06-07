/**
 * out/*.json の生候補から良い用例をフィルタリングして出力する
 *
 * Usage:
 *   pnpm run filter                         # 全語, 語ごと最大3件
 *   pnpm run filter -- --id okashi aware    # 指定語のみ
 *   pnpm run filter -- --max 5              # 語ごと最大N件
 *   pnpm run filter -- --min-len 20 --max-len 100
 *   pnpm run filter -- --source 枕草子       # 特定出典のみ
 *
 * Output: JSONL (stdout)
 *   各行が ExampleSentence 形式（translation は空欄、verified: false）
 *   wordId フィールド付加（TypeScript 変換時に除去）
 *   同じセンテンスは 1 回のみ出力。そのセンテンスに含まれる他の語も
 *   highlights に追加する（複数語ハイライト）。
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir       = dirname(fileURLToPath(import.meta.url));
const KOGOLIST_TS = join(__dir, '../src/game/data/kogoList.ts');
const OUT_DIR     = join(__dir, '../out');

// ─── kogoList 読み込み ────────────────────────────────────────────────────────

async function loadKogoData() {
    const src = await readFile(KOGOLIST_TS, 'utf-8');
    const byId = new Map();
    const re = /id:\s*'([^']+)'[^}]*?word:\s*'([^']+)'[^}]*?pos:\s*'([^']+)'/gs;
    for (const m of src.matchAll(re)) {
        byId.set(m[1], { word: m[2], pos: m[3] });
    }
    return byId;
}

// ─── 活用形検出 ───────────────────────────────────────────────────────────────

// 'う' = ウ音便（をかしう等）を含む
const ADJ_SUFFIXES  = ['しく', 'しき', 'しけれ', 'しう', 'く', 'き', 'し', 'けれ', 'う', 'かり', 'かる', 'かれ', 'さ', 'げ', 'み'];
const ADJV_SUFFIXES = ['なり', 'なる', 'なれ', 'なら', 'に', 'にて', 'なりし'];
const STOP_RE       = /[　 \s。、！？・「」『』〈〉【】（）…—―\/]/;
const KANJI_RE      = /[一-鿿㐀-䶿]/;
// 動詞連用形の後に来る接続助詞・格助詞。これ以降は別語なので停止
const FORM_STOP     = new Set(['て', 'で', 'に', 'を', 'は', 'が', 'も', 'や', 'か', 'ば', 'ど', 'と']);

function findFormInSentence(sentence, searchTerms, pos, word) {
    for (const term of searchTerms) {
        const idx = sentence.indexOf(term);
        if (idx < 0) continue;

        if (pos.startsWith('形容詞')) {
            const rest = sentence.slice(idx + term.length, idx + term.length + 8);
            for (const suf of ADJ_SUFFIXES) {
                if (rest.startsWith(suf)) return term + suf;
            }
            return term;
        }

        if (pos === '形容動詞・ナリ活用') {
            const rest = sentence.slice(idx + term.length, idx + term.length + 6);
            for (const suf of ADJV_SUFFIXES) {
                if (rest.startsWith(suf)) return term + suf;
            }
            return term;
        }

        // 動詞・名詞・副詞・その他: term 以降を最大2文字取る（漢字・記号・助詞で停止）
        let end = idx + term.length;
        while (end < sentence.length
               && end < idx + term.length + 2
               && !STOP_RE.test(sentence[end])
               && !KANJI_RE.test(sentence[end])
               && !FORM_STOP.has(sentence[end])) {
            end++;
        }
        return sentence.slice(idx, end);
    }
    return word;
}

// ─── スコアリング ─────────────────────────────────────────────────────────────

const PREF_SOURCES  = ['枕草子', '徒然草', '伊勢物語', '方丈記', '竹取物語', '土佐日記', '和泉式部日記', '更級日記'];
const ANNOTATION_RE = /[〔〕〈〉\[\]]/;

// 直前の引用・思考が切れた断片文を示す文頭パターン
// 例: 「とて、…」「と思すに、…」「と、あぢきなく…」
const FRAGMENT_RE   = /^(?:とて[、。]|と[思の言聞見申]|とのたまひ|と[、。])/;

/**
 * 「」の対応が取れていない文を修正する。
 * 「が多い → 最左の「を順に除去、」が多い → 最右の」を順に除去。
 * 修正後も括弧の順序がおかしい（」が「より先に来る）場合は null を返す（フィルタ除外）。
 */
function normalizeBrackets(s) {
    let result = s;
    let open  = (result.match(/「/g) ?? []).length;
    let close = (result.match(/」/g) ?? []).length;
    while (close > open) {
        result = result.slice(0, result.lastIndexOf('」')) + result.slice(result.lastIndexOf('」') + 1);
        close--;
    }
    while (open > close) {
        result = result.slice(0, result.indexOf('「')) + result.slice(result.indexOf('「') + 1);
        open--;
    }
    let depth = 0;
    for (const c of result) {
        if (c === '「') depth++;
        else if (c === '」') { depth--; if (depth < 0) return null; }
    }
    return result.trim() || null;
}

/**
 * 日本語テキスト中の不自然な半角スペースを除去する。
 * HTML タグがスペースに変換されたことで生じる artifact を修正する。
 * 日本語文字（ひらがな・カタカナ・漢字・句読点）の間のスペースは除去。
 */
// 〳〵 等の踊り字（U+3033-U+3035）も含む
const JP_CHAR = /[ぁ-んァ-ヶ一-鿿、。！？・「」『』（）…—―ー〳-〵]/;
function removeJapaneseSpaces(s) {
    // 日本語文字に挟まれたスペースを除去
    return s.replace(/ +/g, (sp, offset, str) => {
        const before = str[offset - 1] ?? '';
        const after  = str[offset + sp.length] ?? '';
        return (JP_CHAR.test(before) || JP_CHAR.test(after)) ? '' : sp;
    });
}

function scoreEntry(entry, minLen, maxLen) {
    entry.sentence = removeJapaneseSpaces(entry.sentence); // スペース artifact 除去
    const normalized = normalizeBrackets(entry.sentence);
    if (!normalized) return -1;       // 修正不可の複雑ケースを除外
    entry.sentence = normalized;      // 正規化した文に上書き

    const len = entry.sentence.length;
    if (len < minLen || len > maxLen) return -1;
    if (ANNOTATION_RE.test(entry.sentence)) return -1;
    if (FRAGMENT_RE.test(entry.sentence))   return -1; // 前文依存の断片を除外

    let score = 0;
    score += Math.max(0, 100 - Math.abs(len - 65) * 1.5); // 65字前後が最高点
    if (PREF_SOURCES.includes(entry.source)) score += 40;
    if (entry.sentence.endsWith('。')) score += 10;
    return score;
}

// ─── 候補読み込み ─────────────────────────────────────────────────────────────

async function readCandidates(wordId) {
    const path = join(OUT_DIR, `${wordId}.json`);
    if (!existsSync(path)) return [];
    const text = await readFile(path, 'utf-8');
    return text.split('\n')
        .filter(l => l.trim().startsWith('{'))
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);
}

// ─── 検索語生成（collect-examples.mjs と同じロジック）─────────────────────────

const U_TO_E = { 'く':'け','ぐ':'げ','す':'せ','づ':'で','つ':'て','ぬ':'ね','ぶ':'べ','む':'め','ゆ':'え','る':'れ','ふ':'へ' };
const U_TO_I = { 'く':'き','ぐ':'ぎ','す':'し','づ':'ぢ','つ':'ち','ぬ':'に','ぶ':'び','む':'み','ゆ':'い','る':'り','ふ':'ひ' };
const KANA_TO_KANJI_PREFIX = [['こころ','心'],['ひと','人'],['みち','道']];

function addKanjiVariants(terms) {
    const extra = [];
    for (const t of terms)
        for (const [k, j] of KANA_TO_KANJI_PREFIX)
            if (t.startsWith(k)) { const v = j + t.slice(k.length); if (!terms.includes(v) && !extra.includes(v)) extra.push(v); }
    return [...terms, ...extra];
}

function getSearchTerms(word, pos) {
    if (!pos) return addKanjiVariants([word]);
    if (pos.startsWith('動詞')) {
        const last = word.slice(-1), stem = word.slice(0, -1);
        if (pos === '動詞・カ行変格活用') return ['き', 'くる', 'くれ', 'こ'];
        if (pos === '動詞・サ行変格活用') return ['し', 'する', 'すれ', 'せ'];
        if (pos === '動詞・下二段活用') { const e = U_TO_E[last]; return stem.length >= 2 && e ? [stem+e, word] : [word]; }
        if (pos === '動詞・上二段活用') return stem.length >= 2 ? [stem] : [word];
        if (pos === '動詞・ラ行変格活用') return stem.length >= 2 ? [stem+'ら',stem+'り',stem+'る',stem+'れ'] : [word];
        if (stem.length >= 3) return [stem];
        const i = U_TO_I[last]; return i ? [stem+i, word] : [word];
    }
    if (pos.startsWith('形容詞')) {
        const s = word.endsWith('し') ? word.slice(0,-1) : word;
        return addKanjiVariants(s.length >= 3 ? [s] : [word, s+'く', s+'き']);
    }
    if (pos === '形容動詞・ナリ活用') {
        const s = word.endsWith('なり') ? word.slice(0,-2) : word;
        return addKanjiVariants(s.length >= 3 ? [s] : [word, s+'に', s+'なる']);
    }
    return addKanjiVariants([word]);
}

// ─── 複数語ハイライト検出 ─────────────────────────────────────────────────────
//
// ほぼ全文に現れる機能語（く・す・たまふ等）は secondary highlight としては
// ノイズになるため除外する。primary としては通常どおり使用する。
const SECONDARY_SKIP = new Set([
    'ku', 'su', 'tamau', 'tamaharu', 'haberi',
    'kaku', 'kikoyu', 'naku', 'iu', 'sarani',
]);

/**
 * sentence 中に現れる全 kogoList 語の highlight を返す。
 * primaryId の語は必ず先頭に、他は文中の出現順で並べる。
 * searchTermLength < 3 の語は誤検出が多いため secondary 追加しない。
 */
function buildHighlights(sentence, primaryId, allTerms, byId) {
    const highlights = [];
    const usedWords = new Set();

    // primary を先頭に
    const { word: pw, pos: pp } = byId.get(primaryId);
    const pTerms = allTerms.get(primaryId);
    const pForm = findFormInSentence(sentence, pTerms, pp, pw);
    highlights.push({ word: pw, form: pForm, note: '' });
    usedWords.add(pw);

    // secondary: sentence 中の出現位置でソート
    const secondaries = [];
    for (const [id, terms] of allTerms) {
        if (id === primaryId) continue;
        if (SECONDARY_SKIP.has(id)) continue;
        const { word, pos } = byId.get(id);
        if (usedWords.has(word)) continue;

        // 3文字未満のsearch termのみの語は誤検出リスク大のためスキップ
        const longTerms = terms.filter(t => t.length >= 3);
        if (longTerms.length === 0) continue;

        const matchedTerm = longTerms.find(t => sentence.includes(t));
        if (!matchedTerm) continue;

        const form = findFormInSentence(sentence, terms, pos, word);
        const idx = sentence.indexOf(matchedTerm);
        secondaries.push({ word, form, note: '', _idx: idx });
        usedWords.add(word);
    }

    // 文中の出現位置順にソート
    secondaries.sort((a, b) => a._idx - b._idx);
    for (const { word, form, note } of secondaries) {
        highlights.push({ word, form, note });
    }

    return highlights;
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = argv.slice(2);
    const ids = [];
    let maxPerWord = 3, maxPerSource = 2, minLen = 20, maxLen = 120, sourceFilter = null;
    let format = 'jsonl'; // 'jsonl' | 'ts'

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--id') { i++; while (i < args.length && !args[i].startsWith('-')) ids.push(args[i++]); i--; }
        else if (args[i] === '--max')            maxPerWord   = parseInt(args[++i], 10);
        else if (args[i] === '--max-per-source') maxPerSource = parseInt(args[++i], 10);
        else if (args[i] === '--min-len')        minLen       = parseInt(args[++i], 10);
        else if (args[i] === '--max-len')        maxLen       = parseInt(args[++i], 10);
        else if (args[i] === '--source')         sourceFilter = args[++i];
        else if (args[i] === '--format')         format       = args[++i];
    }
    return { ids, maxPerWord, maxPerSource, minLen, maxLen, sourceFilter, format };
}

// ─── TypeScript 出力 ──────────────────────────────────────────────────────────
//
// 既存の src/game/data/exampleSentences.ts と同じ形式で 1 エントリを出力する。
// シングルクォート文字列内のエスケープに対応。

function escapeTsString(s) {
    return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function formatHighlightTs(h) {
    const parts = [`word: '${escapeTsString(h.word)}'`, `form: '${escapeTsString(h.form)}'`];
    if (h.note) parts.push(`note: '${escapeTsString(h.note)}'`);
    return `            { ${parts.join(', ')} },`;
}

function formatEntryTs(entry) {
    const lines = [
        '    {',
        `        // ${entry.wordId}`,
        `        sentence: '${escapeTsString(entry.sentence)}',`,
        `        translation: '${escapeTsString(entry.translation)}',`,
        `        translationEn: '${escapeTsString(entry.translationEn ?? '')}',`,
        '        highlights: [',
        ...entry.highlights.map(formatHighlightTs),
        '        ],',
    ];
    if (entry.source) lines.push(`        source: '${escapeTsString(entry.source)}',`);
    lines.push(`        verified: ${entry.verified},`);
    lines.push('    },');
    return lines.join('\n');
}

// ─── メイン ───────────────────────────────────────────────────────────────────

const { ids, maxPerWord, maxPerSource, minLen, maxLen, sourceFilter, format } = parseArgs(process.argv);
const byId = await loadKogoData();

// 全語の検索語マップを事前構築
const allTerms = new Map(); // id → string[]
for (const [id, { word, pos }] of byId) {
    allTerms.set(id, getSearchTerms(word, pos));
}

const targetIds = ids.length > 0 ? ids : [...byId.keys()];

// 全語の候補を読み込む（secondary highlight 検出のため全語必要）
process.stderr.write('候補を読み込み中...\n');
const allCandidates = new Map(); // id → entry[]
for (const [id] of byId) {
    allCandidates.set(id, await readCandidates(id));
}

// グローバル重複排除: 同じ sentence は 1 回のみ出力
const emittedSentences = new Set();
let totalOut = 0;

for (const wordId of targetIds) {
    if (!byId.has(wordId)) { process.stderr.write(`ID not found: ${wordId}\n`); continue; }

    const { word, pos } = byId.get(wordId);
    const searchTerms = allTerms.get(wordId);
    const candidates = allCandidates.get(wordId) ?? [];

    // フィルタ・スコアリング
    const pool = (sourceFilter ? candidates.filter(e => e.source === sourceFilter) : candidates)
        .map(e => ({ entry: e, score: scoreEntry(e, minLen, maxLen) }))
        .filter(s => s.score >= 0)
        .sort((a, b) => b.score - a.score);

    const sourceCounts = {};
    let wordCount = 0;

    for (const { entry } of pool) {
        if (wordCount >= maxPerWord) break;
        if (emittedSentences.has(entry.sentence)) continue;

        const srcCount = sourceCounts[entry.source] ?? 0;
        if (srcCount >= maxPerSource) continue;

        emittedSentences.add(entry.sentence);
        sourceCounts[entry.source] = srcCount + 1;
        wordCount++;

        const highlights = buildHighlights(entry.sentence, wordId, allTerms, byId);
        const record = {
            wordId,
            sentence: entry.sentence,
            translation: '',
            translationEn: '',
            highlights,
            source: entry.source,
            verified: false,
        };

        if (format === 'ts') {
            console.log(formatEntryTs(record));
        } else {
            console.log(JSON.stringify(record));
        }
        totalOut++;
    }
}

process.stderr.write(`\n完了: ${totalOut} 件出力\n`);
if (format === 'ts') {
    process.stderr.write('\n貼り付け先: src/game/data/exampleSentences.ts の配列内\n');
    process.stderr.write('翻訳を埋めて verified: true に変えてから取り込んでください\n');
}
