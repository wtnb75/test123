// Build the top page (index.html) that lists the published games.
//
// Usage: node scripts/build-index.mjs <out-dir> <game-dir>... [--labs <game-dir>...]
//
// Writes <out-dir>/index.html (the games before `--labs`) and, when `--labs` is given, <out-dir>/labs.html
// (the games after it; works in progress that are not on the top page). Games are given oldest first
// (the order they were added to Taskfile.yml) and listed newest first.
//
// Each card is made from the game's package.json: the `index` field ({ title, summary, tags }) when present,
// otherwise the directory name and `description`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const escapeHtml = (text) =>
    String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The card data for one game directory. */
export const cardOf = (dir, root = '.') => {
    const pkg = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'));
    const info = pkg.index ?? {};
    return {
        dir,
        title: info.title ?? dir,
        summary: info.summary ?? pkg.description ?? '',
        tags: Array.isArray(info.tags) ? info.tags : [],
    };
};

const cardHtml = (card) => `      <li data-tags="${escapeHtml(JSON.stringify(card.tags))}">
        <a href="${escapeHtml(card.dir)}/">
          <span class="head">
            <span class="name">${escapeHtml(card.title)}</span>
            <span class="path">/${escapeHtml(card.dir)}/</span>
          </span>
          <span class="summary">${escapeHtml(card.summary)}</span>
          <span class="tags">${card.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</span>
        </a>
      </li>`;

const STYLE = `
    :root {
      --bg-1: #e7f5ff;
      --bg-2: #fff4e6;
      --card: #ffffffcc;
      --text: #1f2937;
      --muted: #6b7280;
      --accent: #0f766e;
      --ring: #99f6e4;
      --radius: 16px;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      background:
        radial-gradient(circle at 20% 10%, #ffffff 0%, transparent 35%),
        radial-gradient(circle at 90% 90%, #fff 0%, transparent 30%),
        linear-gradient(135deg, var(--bg-1), var(--bg-2));
      font-family: "Avenir Next", "Hiragino Sans", "Yu Gothic", sans-serif;
    }

    .page {
      width: min(920px, calc(100% - 2rem));
      margin: 3rem auto;
      padding: 2rem;
      border-radius: calc(var(--radius) + 6px);
      background: var(--card);
      border: 1px solid #ffffff;
      box-shadow: 0 20px 50px #0f172a1f;
      backdrop-filter: blur(8px);
    }

    h1 {
      margin: 0 0 0.5rem;
      font-size: clamp(1.6rem, 3vw, 2.2rem);
      letter-spacing: 0.01em;
    }

    .lead {
      margin: 0 0 1.4rem;
      color: var(--muted);
      font-size: 0.98rem;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 0.85rem;
    }

    li {
      display: flex;
    }

    a {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      width: 100%;
      text-decoration: none;
      color: inherit;
      padding: 0.95rem 1rem;
      border-radius: var(--radius);
      border: 1px solid #e5e7eb;
      background: #fff;
      transition: transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease;
    }

    a:hover {
      transform: translateY(-1px);
      border-color: var(--ring);
      box-shadow: 0 10px 22px #0f766e22;
    }

    a:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }

    .name {
      font-weight: 700;
      font-size: 1.1rem;
    }

    .path {
      color: var(--muted);
      font-size: 0.8rem;
    }

    .summary {
      font-size: 0.92rem;
      line-height: 1.55;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
      margin-top: auto;
    }

    .tag {
      padding: 0.1rem 0.55rem;
      border-radius: 999px;
      background: #f0fdfa;
      border: 1px solid var(--ring);
      color: var(--accent);
      font-size: 0.78rem;
    }

    .filter {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0 0 1.2rem;
    }

    .chip {
      padding: 0.25rem 0.8rem;
      border-radius: 999px;
      border: 1px solid var(--ring);
      background: #fff;
      color: var(--accent);
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .chip[aria-pressed="true"] {
      background: var(--accent);
      border-color: var(--accent);
      color: #fff;
    }

    .chip:focus-visible {
      outline: 3px solid var(--ring);
      outline-offset: 2px;
    }

    [hidden] {
      display: none !important;
    }

    .empty {
      color: var(--muted);
    }

    .nav {
      margin: 1.4rem 0 0;
      font-size: 0.92rem;
    }

    .nav a {
      display: inline;
      width: auto;
      padding: 0;
      border: 0;
      background: none;
      color: var(--accent);
      text-decoration: underline;
    }

    .nav a:hover {
      transform: none;
      box-shadow: none;
    }

    @media (max-width: 640px) {
      .page {
        margin: 1.25rem auto;
        padding: 1.2rem;
      }
    }
`;

/** The distinct tags of `cards`, in order of first appearance. */
export const tagsOf = (cards) => [...new Set(cards.flatMap((card) => card.tags))];

// Narrows the cards to the ones that have every selected tag. The selection is kept in the URL hash
// (`#tag=a,b`). Without JavaScript the filter bar stays hidden and every card is shown.
const SCRIPT = `
    (() => {
      const bar = document.querySelector('.filter');
      const items = [...document.querySelectorAll('li[data-tags]')];
      const empty = document.querySelector('.empty');
      const chips = [...bar.querySelectorAll('.chip[data-tag]')];
      const known = new Set(chips.map((chip) => chip.dataset.tag));
      const selected = new Set();
      const fromHash = () => {
        const m = /^#tag=(.*)$/.exec(location.hash);
        selected.clear();
        if (m) decodeURIComponent(m[1]).split(',').filter((t) => known.has(t)).forEach((t) => selected.add(t));
      };
      const render = () => {
        let shown = 0;
        for (const li of items) {
          const tags = JSON.parse(li.dataset.tags);
          const ok = [...selected].every((t) => tags.includes(t));
          li.hidden = !ok;
          if (ok) shown += 1;
        }
        for (const chip of chips) chip.setAttribute('aria-pressed', String(selected.has(chip.dataset.tag)));
        bar.querySelector('.chip-all').setAttribute('aria-pressed', String(selected.size === 0));
        empty.hidden = shown > 0;
      };
      const save = () => {
        const hash = selected.size ? '#tag=' + encodeURIComponent([...selected].join(',')) : location.pathname + location.search;
        history.replaceState(null, '', hash);
      };
      bar.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        if (chip.dataset.tag === undefined) selected.clear();
        else if (selected.has(chip.dataset.tag)) selected.delete(chip.dataset.tag);
        else selected.add(chip.dataset.tag);
        save();
        render();
      });
      window.addEventListener('hashchange', () => { fromHash(); render(); });
      bar.hidden = false;
      fromHash();
      render();
    })();
`;

const filterHtml = (tags) =>
    tags.length === 0
        ? ''
        : `    <div class="filter" role="group" aria-label="タグで絞り込み" hidden>
      <button type="button" class="chip chip-all" aria-pressed="true">すべて</button>
${tags.map((t) => `      <button type="button" class="chip" data-tag="${escapeHtml(t)}" aria-pressed="false">${escapeHtml(t)}</button>`).join('\n')}
    </div>
`;

/**
 * One listing page for `cards`.
 * `page` is { title, lead, link }; `link` ({ href, text } or null) is shown below the list.
 */
export const pageHtml = (cards, page) => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(page.title)}</title>
  <style>${STYLE}  </style>
</head>
<body>
  <main class="page">
    <h1>${escapeHtml(page.title)}</h1>
    <p class="lead">${escapeHtml(page.lead)}</p>
${filterHtml(tagsOf(cards))}    <ul>
${cards.map(cardHtml).join('\n')}
    </ul>
    <p class="empty" hidden>条件に合うゲームはありません。</p>
${page.link ? `    <p class="nav"><a href="${escapeHtml(page.link.href)}">${escapeHtml(page.link.text)}</a></p>\n` : ''}  </main>
  <script>${SCRIPT}  </script>
</body>
</html>
`;

export const TOP_PAGE = {
    title: 'test 123',
    lead: '公開中のゲーム一覧。カードを選ぶと、そのゲームのページを開けます。',
    link: { href: 'labs.html', text: '試作・実験作はこちら' },
};

export const LABS_PAGE = {
    title: 'test 123 / 試作・実験作',
    lead: 'まだ作りこみの途中のゲーム。遊べますが、挙動やバランスは変わるかもしれません。',
    link: { href: './', text: '公開中のゲーム一覧へ戻る' },
};

/**
 * Splits CLI arguments (oldest first) into the top-page games and the labs games (those after `--labs`),
 * each newest first.
 */
export const splitArgs = (args) => {
    const i = args.indexOf('--labs');
    const games = i < 0 ? args : args.slice(0, i);
    const labs = i < 0 ? [] : args.slice(i + 1);
    return { games: [...games].reverse(), labs: [...labs].reverse() };
};

const [out, ...rest] = process.argv.slice(2);
if (out && rest.length > 0) {
    const { games, labs } = splitArgs(rest);
    mkdirSync(out, { recursive: true });
    const top = labs.length > 0 ? TOP_PAGE : { ...TOP_PAGE, link: null };
    writeFileSync(join(out, 'index.html'), pageHtml(games.map((d) => cardOf(d)), top));
    if (labs.length > 0) {
        writeFileSync(join(out, 'labs.html'), pageHtml(labs.map((d) => cardOf(d)), LABS_PAGE));
    }
}
