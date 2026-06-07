/**
 * Wikisource から古語の用例候補を収集する
 *
 * Usage:
 *   pnpm run collect -- --word あはれ
 *   pnpm run collect -- --word あはれ をかし いみじ
 *   pnpm run collect -- --word あはれ --source 枕草子
 *   pnpm run collect -- --limit 30       # サブページ取得上限（デフォルト 50）
 *   pnpm run collect -- --sources        # 検索対象の作品一覧
 *   pnpm run collect -- --clear-cache    # キャッシュを削除
 *
 * Output: JSONL (stdout)
 *   {"wordId":"あはれ","word":"あはれ","sentence":"...","source":"枕草子","translation":"","highlights":[],"verified":false}
 *
 * リダイレクト例:
 *   pnpm run collect -- --word あはれ > candidates.jsonl
 *
 * キャッシュ: tools/.cache/ にページのテキストを保存（再実行時はネットワーク不要）
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const WIKISOURCE_BASE = 'https://ja.wikisource.org';
const WIKISOURCE_API  = `${WIKISOURCE_BASE}/w/api.php`;
const USER_AGENT = 'KogoDropCollector/1.0 (https://github.com/wtnb75/test123)';

const CACHE_DIR   = join(dirname(fileURLToPath(import.meta.url)), '.cache');
const KOGOLIST_TS = join(dirname(fileURLToPath(import.meta.url)), '../src/game/data/kogoList.ts');

/** kogoList.ts から { id → {word, pos} } のマップを抽出する */
async function loadKogoData() {
    const src = await readFile(KOGOLIST_TS, 'utf-8');
    const byId  = new Map(); // id → { word, pos }
    const byWord = new Map(); // word → pos
    const entryRe = /id:\s*'([^']+)'[^}]*?word:\s*'([^']+)'[^}]*?pos:\s*'([^']+)'/gs;
    for (const m of src.matchAll(entryRe)) {
        byId.set(m[1], { word: m[2], pos: m[3] });
        byWord.set(m[2], m[3]);
    }
    return { byId, byWord };
}

// u段 → e段の変換テーブル（下二段活用の連用形・未然形生成用）
const U_TO_E = { 'く':'け','ぐ':'げ','す':'せ','づ':'で','つ':'て','ぬ':'ね','ぶ':'べ','む':'め','ゆ':'え','る':'れ','ふ':'へ' };

// u段 → i段の変換テーブル（四段活用の連用形生成用）
const U_TO_I = { 'く':'き','ぐ':'ぎ','す':'し','づ':'ぢ','つ':'ち','ぬ':'に','ぶ':'び','む':'み','ゆ':'い','る':'り','ふ':'ひ' };

/**
 * Wikisource 古典テキストでよく漢字で書かれる語頭の対応テーブル。
 * 例: こころにくし → 心にくし のように書かれた文でも検索できるよう使う。
 * ※ 読みが一対一対応する確実なものだけ登録する（おも=面/思/重 のように多義の語は除外）
 */
const KANA_TO_KANJI_PREFIX = [
    ['こころ', '心'],  // こころ ≒ 心（他の訓読みがほぼない）
    ['ひと',   '人'],  // ひと ≒ 人
    ['みち',   '道'],  // みち ≒ 道
];

/** 検索語の先頭平仮名を漢字に置き換えたバリアントを追加生成する */
function addKanjiVariants(terms) {
    const extra = [];
    for (const term of terms) {
        for (const [kana, kanji] of KANA_TO_KANJI_PREFIX) {
            if (term.startsWith(kana)) {
                const variant = kanji + term.slice(kana.length);
                if (variant !== term && !terms.includes(variant) && !extra.includes(variant)) {
                    extra.push(variant);
                }
            }
        }
    }
    return [...terms, ...extra];
}

/**
 * 品詞に応じた検索語リストを生成する
 *
 * 動詞:
 *   カ行変格:    き/くる/くれ/こ の4形
 *   サ行変格:    し/する/すれ/せ の4形
 *   下二段:      終止形(u段) + 連用/未然形(e段) の2形
 *   上二段:      語幹 2文字以上なら語幹、それ以下は終止形のみ
 *   ラ行変格:    語幹 + ら/り/る/れ の4形
 *   四段・上一段: 語幹 3文字以上なら語幹。2文字以下は連用形(i段) + 終止形 の2形
 *
 * 形容詞（ク活用・シク活用）:
 *   語幹（終止形末尾の「し」を除く）が 3文字以上なら語幹のみ
 *   2文字以下は終止形 + 連用形(stem+く) + 連体形(stem+き) の3形
 *
 * 形容動詞・ナリ活用:
 *   語幹（末尾の「なり」を除く）が 3文字以上なら語幹のみ
 *   2文字以下は終止形 + に形 + なる形 の3形
 *
 * 副詞・名詞・感動詞: 終止形そのまま
 */
function getSearchTerms(word, pos) {
    if (!pos) return [word];

    // ─── 動詞 ────────────────────────────────────────────────────────────────────
    if (pos.startsWith('動詞')) {
        const last = word.slice(-1);
        const stem = word.slice(0, -1);

        if (pos === '動詞・カ行変格活用') return ['き', 'くる', 'くれ', 'こ'];
        if (pos === '動詞・サ行変格活用') return ['し', 'する', 'すれ', 'せ'];

        if (pos === '動詞・下二段活用') {
            const eForm = U_TO_E[last];
            return stem.length >= 2 && eForm ? [stem + eForm, word] : [word];
        }

        if (pos === '動詞・上二段活用') {
            return stem.length >= 2 ? [stem] : [word];
        }

        if (pos === '動詞・ラ行変格活用') {
            return stem.length >= 2 ? [stem + 'ら', stem + 'り', stem + 'る', stem + 'れ'] : [word];
        }

        // 四段・上一段・その他
        if (stem.length >= 3) return [stem];
        // 語幹が短い場合: 連用形(i段) + 終止形 で主要形をカバー
        const iForm = U_TO_I[last];
        return iForm ? [stem + iForm, word] : [word];
    }

    // ─── 形容詞（ク活用・シク活用）─────────────────────────────────────────────
    if (pos.startsWith('形容詞')) {
        // 終止形末尾の「し」を除くと語幹
        const adjStem = word.endsWith('し') ? word.slice(0, -1) : word;
        const base = adjStem.length >= 3 ? [adjStem] : [word, adjStem + 'く', adjStem + 'き'];
        return addKanjiVariants(base);
    }

    // ─── 形容動詞・ナリ活用 ───────────────────────────────────────────────────
    if (pos === '形容動詞・ナリ活用') {
        const adjvStem = word.endsWith('なり') ? word.slice(0, -2) : word;
        const base = adjvStem.length >= 3 ? [adjvStem] : [word, adjvStem + 'に', adjvStem + 'なる'];
        return addKanjiVariants(base);
    }

    // 副詞・名詞・感動詞・その他
    return addKanjiVariants([word]);
}

/**
 * 検索対象の作品定義
 *
 * prefix: allpages API に渡すページタイトルの前置詞
 *   - サブページがある場合: "枕草子 (Wikisource)/"
 *   - 単一ページの場合: null (page で直接指定)
 * page: prefix が null のときに取得する単一ページタイトル
 */
const SOURCES = [
    { label: '枕草子',   prefix: '枕草子 (Wikisource)/' },
    { label: '源氏物語', prefix: '源氏物語/' },
    { label: '竹取物語', page:   '竹取物語 (國民文庫)' },
    { label: '土佐日記', page:   '土佐日記 (国文大観)' },
    { label: '方丈記',   page:   '方丈記 (国文大観)' },
    { label: '徒然草',   page:   '徒然草 (校註日本文學大系)' },
    { label: '伊勢物語', page:   '伊勢物語' },
    { label: '和泉式部日記', page: '和泉式部日記' },
    { label: '更級日記', page:   '更級日記' },
];

// ─── API ─────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;

async function apiGet(params) {
    const url = `${WIKISOURCE_API}?${new URLSearchParams({ format: 'json', formatversion: '2', ...params })}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`API HTTP ${res.status}`);
    return res.json();
}

/** prefix に一致するサブページタイトル一覧を取得 */
async function listSubpages(prefix, limit) {
    const titles = [];
    let apcontinue = undefined;
    while (titles.length < limit) {
        const params = {
            action: 'query', list: 'allpages',
            apprefix: prefix, apnamespace: '0',
            aplimit: String(Math.min(50, limit - titles.length)),
        };
        if (apcontinue) params.apcontinue = apcontinue;
        const data = await apiGet(params);
        for (const p of (data.query?.allpages ?? [])) titles.push(p.title);
        apcontinue = data.continue?.apcontinue;
        if (!apcontinue) break;
        await sleep(1000);
    }
    return titles;
}

// ─── キャッシュ ───────────────────────────────────────────────────────────────

const CACHE_MISS = '\x00'; // 404 だったことを記録するセンチネル

function cacheKey(pageTitle) {
    return join(CACHE_DIR, encodeURIComponent(pageTitle) + '.txt');
}

async function readCache(pageTitle) {
    try {
        return await readFile(cacheKey(pageTitle), 'utf-8');
    } catch {
        return undefined; // キャッシュなし
    }
}

async function writeCache(pageTitle, text) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(cacheKey(pageTitle), text ?? CACHE_MISS, 'utf-8');
}

/** REST API でレンダリング済み HTML を取得してプレーンテキストに変換（キャッシュ付き） */
async function fetchRenderedText(pageTitle) {
    const cached = await readCache(pageTitle);
    if (cached !== undefined) {
        info(`  キャッシュ: ${pageTitle}`);
        return cached === CACHE_MISS ? null : cached;
    }

    const url = `${WIKISOURCE_BASE}/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (res.status === 404) {
        await writeCache(pageTitle, null);
        return null;
    }
    if (!res.ok) throw new Error(`REST HTTP ${res.status}: ${pageTitle}`);
    const text = htmlToPlainText(await res.text());
    await writeCache(pageTitle, text);
    return text;
}

// ─── テキスト処理 ──────────────────────────────────────────────────────────────

function htmlToPlainText(html) {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, '')
        // ruby要素: ルビの読み（<rt>かな</rt>）でベーステキスト（漢字）を置き換える。
        // 例: <ruby>心許<rt>こころもとな</rt></ruby>し → こころもとなし
        // これにより平仮名検索語と一致させられる。ルビのない漢字は後段のタグ除去で残る。
        .replace(/<ruby[^>]*>[\s\S]*?<\/ruby>/gi, (match) => {
            const rtContent = match.match(/<rt[^>]*>([\s\S]*?)<\/rt>/i);
            return rtContent ? rtContent[1] : match.replace(/<[^>]+>/g, '');
        })
        // ブロック要素は改行に変換（文区切りとして機能させる）
        .replace(/<\/?(p|div|section|article|h[1-6]|li|br|hr|tr|td|th|blockquote)\b[^>]*>/gi, '\n')
        // インライン要素は空文字に（スペースを残さない）
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g,    '<')
        .replace(/&gt;/g,    '>')
        .replace(/&nbsp;/g,  ' ')
        .replace(/&ensp;/g,  ' ')
        .replace(/&emsp;/g,  ' ')
        .replace(/&thinsp;/g,' ')
        .replace(/&quot;/g,  '"')
        .replace(/&apos;/g,  "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g,'…')
        .replace(/&amp;/g,   '&')
        .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&#([0-9]+);/g,        (_, n) => String.fromCodePoint(Number(n)))
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[<>]/g, '')
        .trim();
}

/**
 * 「」の対応が取れていない文を修正する。
 * - 「が多い: 最左の「を順に除去してバランスを取る
 * - 」が多い: 最右の」を順に除去してバランスを取る
 * - 修正後も括弧の順序がおかしい場合（」が「より先に来る）は null を返す（除外）
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
    // 修正後に括弧の順序が正しいか検証（深さが負になったら不正）
    let depth = 0;
    for (const c of result) {
        if (c === '「') depth++;
        else if (c === '」') { depth--; if (depth < 0) return null; }
    }
    return result.trim() || null;
}

// 直前の引用・思考が切れた断片文を示す文頭パターン
const FRAGMENT_RE = /^(?:とて[、。]|と[思の言聞見申]|とのたまひ|と[、。])/;

function extractSentences(plainText, searchTerms) {
    const results = new Set();
    for (const line of plainText.split('\n')) {
        const t = line.trim();
        if (t.length < 5) continue;
        // 句点・感嘆符・疑問符で区切る
        for (const chunk of t.split(/(?<=[。！？])/)) {
            let s = chunk.trim();
            if (s.length < 6 || !searchTerms.some(term => s.includes(term))) continue;
            if (FRAGMENT_RE.test(s)) continue; // 前文依存の断片を除外
            if (!s.endsWith('。') && !s.endsWith('！') && !s.endsWith('？')) s += '。';
            const normalized = normalizeBrackets(s);
            if (normalized) results.add(normalized);
        }
    }
    return [...results];
}

// ─── ユーティリティ ────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function warn(msg)  { process.stderr.write(`[warn] ${msg}\n`); }
function info(msg)  { process.stderr.write(`${msg}\n`); }

// ─── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = argv.slice(2);
    const words = [];
    const ids = [];
    const sourceLabels = [];
    let limit = 50;
    let clearCache = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--word') {
            i++;
            while (i < args.length && !args[i].startsWith('-')) words.push(args[i++]);
            i--;
        } else if (args[i] === '--id') {
            i++;
            while (i < args.length && !args[i].startsWith('-')) ids.push(args[i++]);
            i--;
        } else if (args[i] === '--source') {
            i++;
            while (i < args.length && !args[i].startsWith('-')) sourceLabels.push(args[i++]);
            i--;
        } else if (args[i] === '--limit') {
            limit = parseInt(args[++i], 10);
        } else if (args[i] === '--sources') {
            info('検索対象の作品:');
            for (const s of SOURCES) info(`  ${s.label}`);
            process.exit(0);
        } else if (args[i] === '--clear-cache') {
            clearCache = true;
        } else if (!args[i].startsWith('-')) {
            words.push(args[i]);
        }
    }
    return { words, ids, sourceLabels, limit, clearCache };
}

// ─── メイン ───────────────────────────────────────────────────────────────────

const { words, ids, sourceLabels, limit, clearCache } = parseArgs(process.argv);

if (clearCache) {
    if (existsSync(CACHE_DIR)) {
        await rm(CACHE_DIR, { recursive: true });
        info('キャッシュを削除しました');
    } else {
        info('キャッシュはありません');
    }
    process.exit(0);
}

// wordEntries: { id, word, searchTerms }[] の形に正規化する
const wordEntries = [];

if (ids.length > 0 || words.length > 0) {
    const { byId, byWord } = await loadKogoData();

    for (const id of ids) {
        const entry = byId.get(id);
        if (!entry) {
            process.stderr.write(`ID が見つかりません: ${id}\n`);
            process.exit(1);
        }
        const searchTerms = getSearchTerms(entry.word, entry.pos);
        if (searchTerms.length > 1 || searchTerms[0] !== entry.word) {
            info(`  活用形展開: ${id} (${entry.pos}) → [${searchTerms.map(t => `「${t}」`).join(', ')}] で検索`);
        }
        wordEntries.push({ id, word: entry.word, searchTerms });
    }

    for (const word of words) {
        if (wordEntries.some(e => e.word === word)) continue; // --id と重複しない
        const pos = byWord.get(word);
        const searchTerms = getSearchTerms(word, pos);
        wordEntries.push({ id: word, word, searchTerms });
    }
}

if (wordEntries.length === 0) {
    process.stderr.write([
        '使い方:',
        '  pnpm run collect -- --word あはれ',
        '  pnpm run collect -- --word あはれ をかし いみじ',
        '  pnpm run collect -- --id aware',
        '  pnpm run collect -- --id aware okashi imiji',
        '  pnpm run collect -- --word あはれ --source 枕草子',
        '  pnpm run collect -- --limit 30',
        '  pnpm run collect -- --sources',
    ].join('\n') + '\n');
    process.exit(1);
}

const targetSources = sourceLabels.length > 0
    ? SOURCES.filter(s => sourceLabels.includes(s.label))
    : SOURCES;

if (sourceLabels.length > 0 && targetSources.length === 0) {
    process.stderr.write(`作品が見つかりません: ${sourceLabels.join(', ')}\n--sources で一覧を確認してください\n`);
    process.exit(1);
}

let totalFound = 0;

for (const source of targetSources) {
    // ページタイトル一覧を取得
    let pageTitles;
    if (source.prefix) {
        info(`サブページ列挙: ${source.label} ...`);
        pageTitles = await listSubpages(source.prefix, limit);
    } else {
        pageTitles = [source.page];
    }
    info(`  ${pageTitles.length} ページ対象`);

    for (const title of pageTitles) {
        let text;
        try {
            text = await fetchRenderedText(title);
        } catch (e) {
            warn(`取得失敗: ${title} — ${e.message}`);
            continue;
        }
        if (!text) {
            info(`  スキップ(404): ${title}`);
            continue;
        }

        for (const { id, word, searchTerms } of wordEntries) {
            const sentences = extractSentences(text, searchTerms);
            for (const sentence of sentences) {
                const record = {
                    wordId: id,
                    word,
                    sentence,
                    source: source.label,
                    translation: '',
                    highlights: [],
                    verified: false,
                };
                console.log(JSON.stringify(record));
                totalFound++;
            }
        }

        await sleep(1000);
    }
}

info(`\n完了: 計 ${totalFound} 件`);
