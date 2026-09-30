// Writes the crawler and LLM files for suph.app into site/: robots.txt, sitemap.xml, llms.txt,
// llms-full.txt, humans.txt, .well-known/security.txt and the IndexNow key file.
//
//   node scripts/build-crawler-files.mjs            (dates use today's local date)
//   BUILD_DATE=2026-09-29 node scripts/build-crawler-files.mjs
//   DOCS_REF= node scripts/build-crawler-files.mjs   (Quran Art documents from the working tree)
//
// Idempotent: the same inputs and date give byte-identical files, and an existing IndexNow key
// is reused. The page list is derived from projects/quran-art/data/surahs.json, and every page must
// exist on disk and declare the same canonical URL the sitemap lists, so the files cannot drift
// from the generated site.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(repo, 'site');
const ORIGIN = 'https://suph.app';
const read = path => readFileSync(join(repo, path), 'utf8').replace(/\r\n/g, '\n');
const json = path => JSON.parse(read(path));

const buildDate = (() => {
  const value = process.env.BUILD_DATE;
  if (value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('BUILD_DATE must be YYYY-MM-DD');
    return value;
  }
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map(n => String(n).padStart(2, '0')).join('-');
})();

// The owner's public identity, worded as on https://suphian.com/llms.txt.
const owner = {
  name: 'Suphian Tweel',
  url: 'https://suphian.com/',
  email: 'hello@suphian.com',
  summary: 'Product leader. Led payments at YouTube, 2020 – 2026. Founder of Abacus Labs, a command center for MCA operators. Shares weekend experiments at suph.app.',
  title: 'Product leader. Led payments at YouTube; builds Abacus Labs and suph.app.',
  profiles: [['LinkedIn', 'https://www.linkedin.com/in/suphian/'], ['GitHub', 'https://github.com/Suphian']],
};
// suph.app and The Toga Is Dead as described on https://suphian.com/llms-full.txt.
const studio = 'Small things I build to explore. When a new model or tool comes out, I like to spend a weekend with it and use it to solve a real problem. I don’t plan to support them; they’re experiments I think are worth sharing.';
const toga = 'A 3D board game you play in the browser: 2–4 players, with solo practice, same-screen play and online invitations, set in a medieval coastal kingdom or the Roman empire.';

// ---- Pages: /, /Toga, /quran and one page per surah, in one canonical form. ----
const { chapters } = json('projects/quran-art/data/surahs.json');
const places = new Map(json('projects/quran-art/data/chapters-raw.json').chapters.map(c => [c.id, c.revelation_place]));
const placeName = id => ({ makkah: 'Makkah', madinah: 'Madinah' })[places.get(id)] ?? (() => { throw new Error(`No revelation place for surah ${id}`); })();
const pages = [
  { url: `${ORIGIN}/`, file: 'index.html' },
  { url: `${ORIGIN}/Toga`, file: 'Toga/index.html' },
  { url: `${ORIGIN}/quran`, file: 'quran/index.html' },
  ...chapters.map(c => ({ url: `${ORIGIN}/surah/${c.slug}/`, file: `surah/${c.slug}/index.html` })),
];
const html = new Map();
for (const page of pages) {
  const path = join(site, page.file);
  if (!existsSync(path)) throw new Error(`Missing page for ${page.url}: site/${page.file}`);
  const text = readFileSync(path, 'utf8');
  const canonical = text.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  if (canonical !== page.url) throw new Error(`site/${page.file} declares canonical ${canonical}, expected ${page.url}`);
  html.set(page.file, text);
}
const unescapeAttribute = text => text.replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e]);
const description = file => unescapeAttribute(html.get(file).match(/<meta name="description" content="([^"]*)">/)[1]);
const quranSummary = description('quran/index.html');

// ---- Markdown documents for llms-full.txt ----
// Headings move down two levels to sit under "## Project documents"; repository-relative links
// become plain text (the linked documents are included here) and site-root links become absolute.
// The documents that describe the Quran studies are read at DOCS_REF, so llms-full.txt matches the
// studies the site serves; the rest (and all of them when DOCS_REF is empty) come from the working tree.
const docsRef = process.env.DOCS_REF ?? '1fa0c9c'; // live studies; remove when one-rule ships
const studyDocuments = new Set(['README.md', 'projects/quran-art/README.md', 'projects/quran-art/data/method.md']);
const atRef = path => Boolean(docsRef) && studyDocuments.has(path);
const readDocument = path => atRef(path)
  ? execFileSync('git', ['show', `${docsRef}:${path}`], { cwd: repo, encoding: 'utf8' }).replace(/\r\n/g, '\n')
  : read(path);
const document = path => {
  let fenced = false;
  let sourced = false;
  const lines = [];
  for (const line of readDocument(path).trimEnd().split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
    if (!fenced && /^#{1,6}\s/.test(line)) {
      lines.push(line.replace(/^(#{1,6})/, hashes => '#'.repeat(Math.min(6, hashes.length + 2))));
      if (!sourced) lines.push('', `From \`${path}\` in the suph.app repository${atRef(path) ? ` at commit ${docsRef}` : ''}.`);
      sourced = true;
      continue;
    }
    lines.push(fenced ? line : line.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (link, text, target) => {
      if (/^(https?:|mailto:|#)/.test(target)) return link;
      if (target.startsWith('/')) return `[${text}](${ORIGIN}${target})`;
      return text;
    }));
  }
  return lines.join('\n');
};
const documents = ['README.md', 'RULES.md', 'projects/quran-art/README.md', 'projects/quran-art/data/method.md', 'site/assets/projects/SOURCES.md'];

// ---- Footage credits from SOURCES.md, for humans.txt ----
const credits = [];
for (const block of read('site/assets/projects/SOURCES.md').split(/^## /m).slice(1)) {
  const field = name => block.match(new RegExp(`^- ${name}: (.+)$`, 'm'))?.[1];
  if (field('Creator')) credits.push(`${field('Creator')}: “${field('Clip')}” (${field('Source')})`);
}

// ---- IndexNow key: reuse the one already published, create it once otherwise. ----
const keyFiles = readdirSync(site).filter(name => /^[0-9a-f]{32}\.txt$/.test(name));
if (keyFiles.length > 1) throw new Error(`More than one IndexNow key file in site/: ${keyFiles.join(', ')}`);
const indexNowKey = keyFiles.length ? keyFiles[0].slice(0, 32) : randomBytes(16).toString('hex');

const oneYearLater = (() => {
  const date = new Date(`${buildDate}T00:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
})();

const contact = ['## Contact and profiles', '', `- [Email ${owner.email}](mailto:${owner.email})`, ...owner.profiles.map(([name, url]) => `- [${name}](${url})`)];
const author = ['## Author', '', `- [${owner.name}](${owner.url}): ${owner.summary}`, '- [suphian.com/llms.txt](https://suphian.com/llms.txt): His portfolio in plain text.'];
const summary = `> Small projects by ${owner.name}: The Toga Is Dead, a 3D strategy game for the browser, and Quran Art, a gallery of artworks for all ${chapters.length} surahs of the Quran.`;

const files = {
  'robots.txt': [
    '# Public pages and assets are crawlable.',
    'User-agent: *',
    'Allow: /',
    '',
    '# Search, assistant and AI crawlers, named explicitly (same policy as suphian.com).',
    ...['OAI-SearchBot', 'GPTBot', 'ClaudeBot', 'Claude-Web', 'PerplexityBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Bytespider']
      .flatMap(bot => [`User-agent: ${bot}`, 'Allow: /', '']),
    `Sitemap: ${ORIGIN}/sitemap.xml`,
  ],
  'sitemap.xml': [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...pages.map(page => `  <url><loc>${page.url}</loc><lastmod>${buildDate}</lastmod></url>`),
    '</urlset>',
  ],
  'llms.txt': [
    '# Suph.app', '', summary, '', studio, '',
    '## Projects', '',
    `- [The Toga Is Dead](${ORIGIN}/Toga): ${toga}`,
    `- [Quran Art](${ORIGIN}/quran): ${quranSummary} Each surah has its own page, such as ${ORIGIN}/surah/${chapters[0].slug}/, with SVG downloads.`,
    '- Coming soon: a looping film of ink blooming in water.',
    '',
    '## Pages', '',
    `- [Gallery](${ORIGIN}/): The three project cards.`,
    `- [Full text](${ORIGIN}/llms-full.txt): Project documentation, game rules, Quran Art sources and method, and every surah page.`,
    `- [Sitemap](${ORIGIN}/sitemap.xml): All ${pages.length} pages.`,
    '', ...author, '', ...contact,
  ],
  'llms-full.txt': [
    '# Suph.app', '', summary, '', studio, '',
    '## Projects', '',
    '### The Toga Is Dead', '', toga, '', `- [Play The Toga Is Dead](${ORIGIN}/Toga)`, '',
    '### Quran Art', '', quranSummary, '', `- [See Quran Art](${ORIGIN}/quran)`, '',
    '### Coming soon', '', 'A looping film of ink blooming in water.', '',
    '## Quran Art surah pages', '',
    ...chapters.map(c => `- [${c.id}. ${c.name} (${c.name_arabic})](${ORIGIN}/surah/${c.slug}/): ${c.verses.length} verses, revealed in ${placeName(c.id)}`),
    '',
    '## Project documents', '',
    documents.map(document).join('\n\n'),
    '', ...author, '', ...contact,
  ],
  'humans.txt': [
    '/* TEAM */',
    `Name: ${owner.name}`,
    `Title: ${owner.title}`,
    `Contact: ${owner.email}`,
    `Site: ${owner.url}`,
    '',
    '/* THANKS */',
    'Quran.com: Uthmani text and chapter metadata (https://api.quran.com/api/v4/quran/verses/uthmani)',
    ...credits,
    '',
    '/* SITE */',
    'Language: English',
    'Built with: HTML, CSS, JavaScript, three.js, PeerJS, Web Audio, resvg-js, sharp',
    'Hosting: Vercel',
    `Last update: ${buildDate}`,
  ],
  '.well-known/security.txt': [
    `Contact: mailto:${owner.email}`,
    `Expires: ${oneYearLater}T23:59:59.000Z`,
    'Preferred-Languages: en',
    `Canonical: ${ORIGIN}/.well-known/security.txt`,
    '',
    '# Reporting Security Vulnerabilities',
    '',
    'If you discover a security vulnerability, please report it responsibly:',
    '',
    '1. Do NOT open a public issue',
    `2. Send details to ${owner.email}`,
    '3. Include steps to reproduce the vulnerability',
    '',
    'Acknowledgment within 48 hours.',
    '',
    `Last updated: ${buildDate}`,
  ],
  [`${indexNowKey}.txt`]: [indexNowKey],
};

for (const [name, lines] of Object.entries(files)) {
  const path = join(site, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, name === `${indexNowKey}.txt` ? indexNowKey : `${lines.join('\n')}\n`, 'utf8');
}
console.log(JSON.stringify({ date: buildDate, docs: docsRef || 'working tree', pages: pages.length, indexNowKey, files: Object.keys(files) }));
