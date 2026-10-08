// Build the top page (index.html) that lists the published games.
//
// Usage: node scripts/build-index.mjs <out-file> <game-dir>...
//
// Each card is made from the game's package.json: the `index` field ({ title, summary, tags }) when present,
// otherwise the directory name and `description`.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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

const cardHtml = (card) => `      <li>
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

    @media (max-width: 640px) {
      .page {
        margin: 1.25rem auto;
        padding: 1.2rem;
      }
    }
`;

/** The whole page for `cards`. */
export const pageHtml = (cards) => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>test 123</title>
  <style>${STYLE}  </style>
</head>
<body>
  <main class="page">
    <h1>test 123</h1>
    <p class="lead">公開中のゲーム一覧。カードを選ぶと、そのゲームのページを開けます。</p>
    <ul>
${cards.map(cardHtml).join('\n')}
    </ul>
  </main>
</body>
</html>
`;

const [out, ...dirs] = process.argv.slice(2);
if (out && dirs.length > 0) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, pageHtml(dirs.map((d) => cardOf(d))));
}
