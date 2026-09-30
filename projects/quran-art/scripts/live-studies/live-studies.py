"""Add the crawl layer (scripts/page-meta.js) to the live-studies generator at commit 1fa0c9c.

The live studies are Verse Shell, Word Current and Verse Lines. build-live-studies.sh runs this
from projects/quran-art of a pristine `git archive 1fa0c9c projects/quran-art` tree; it edits that
copy's build_site.js, detail-template.js and app.js (head metadata, the /projects/ph.js analytics
tag, <picture> + WebP thumbnails, the gallery's <source> srcset update, and the PostHog events
surah_viewed / surah_study_switched / gallery_study_switched / artwork_downloaded mirrored from
HEAD's app.js) and leaves every visible string unchanged.
Delete this directory when the one-rule studies are approved and built with build_site.js.
"""


def edit(path, pairs):
    with open(path, encoding='utf-8') as handle:
        text = handle.read()
    for old, new in pairs:
        assert text.count(old) == 1, (path, old[:80])
        text = text.replace(old, new)
    with open(path, 'w', encoding='utf-8', newline='\n') as handle:
        handle.write(text)


HEAD_OLD = """const head = (title,prefix='') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8f5ec"><meta name="description" content="Three mathematical artworks for every surah of the Quran. Explore language through shape, rhythm, and geometry."><title>${esc(title)} · Quran Art</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='24' fill='none' stroke='%23355c55' stroke-width='3'/%3E%3C/svg%3E"><link rel="stylesheet" href="/quran/style.css"></head>`;"""
HEAD_NEW = """const galleryDescription = 'Three mathematical artworks for every surah of the Quran. Explore language through shape, rhythm, and geometry.';
const studies = [{key:'shell',name:'Verse Shell'},{key:'current',name:'Word Current'},{key:'lines',name:'Verse Lines'}];
const head = (title,page) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8f5ec"><title>${esc(title)} · Quran Art</title>${meta.tags({title:`${title} · Quran Art`, ...page})}<link rel="stylesheet" href="/quran/style.css"><script defer src="/projects/ph.js"></script></head>`;"""
CARD_OLD = '<img src="/quran/thumbs/${c.id}-shell.png" alt="${esc(c.name)}: Verse Shell" width="600" height="480" loading="lazy" decoding="async">'
CARD_NEW = '${meta.picture(`/quran/thumbs/${c.id}-shell`, `alt="${esc(c.name)}: Verse Shell" width="600" height="480" loading="lazy" decoding="async"`)}'
COUNT_OLD = "let count = 0;\n"
COUNT_NEW = """let count = 0;
const encodes = [];
const thumbSize = new Map(); // surah id -> pixel size of its first study's thumbnail, the page's og:image
const thumbURL = (c, key) => meta.absolute(`/quran/thumbs/${c.id}-${key}.png`);
const surahPage = (c, tagline) => {
  const description = meta.surahDescription(c, tagline, chapters.length);
  const images = studies.map(({key}) => thumbURL(c, key));
  return {canonical:meta.surahUrl(c.slug), description, image:{url:images[0], alt:`${c.name}: ${studies[0].name}`, ...thumbSize.get(c.id)},
    graph:meta.artworkGraph({c, name:`${c.name} · Quran Art`, description, images, dateCreated})};
};
"""
LOOP_OLD = """  const dir = path.join(detailRoot,c.slug); fs.mkdirSync(dir,{recursive:true});
  const options = chapters.map(item => `<option value="${item.slug}"${item.id===c.id?' selected':''}>${item.id}. ${esc(item.name)}</option>`).join('');
  fs.writeFileSync(path.join(dir,'index.html'),require('./detail-template')({c,head,esc,safeJSON,sourceFooter,theories,options}),'utf8');
  for (const kind of ['shell','current','lines']) {
    const svg = geometry.markup(c,kind,{selected:0,background:true});
    fs.writeFileSync(path.join(output,'artworks',`${c.id}-${kind}.svg`),svg,'utf8');
    const image = new Resvg(geometry.markup(c,kind,{selected:0,background:false}), {fitTo:{mode:'width',value:640},font:{loadSystemFonts:false}}).render().asPng();
    fs.writeFileSync(path.join(output,'thumbs',`${c.id}-${kind}.png`),image);
    count++;
  }
}
console.log(JSON.stringify({surahs:chapters.length,artworks:count,output}));"""
LOOP_NEW = """  for (const kind of ['shell','current','lines']) {
    const svg = geometry.markup(c,kind,{selected:0,background:true});
    fs.writeFileSync(path.join(output,'artworks',`${c.id}-${kind}.svg`),svg,'utf8');
    const rendered = new Resvg(geometry.markup(c,kind,{selected:0,background:false}), {fitTo:{mode:'width',value:640},font:{loadSystemFonts:false}}).render();
    const image = rendered.asPng();
    if (!thumbSize.has(c.id)) thumbSize.set(c.id, {width:rendered.width, height:rendered.height});
    fs.writeFileSync(path.join(output,'thumbs',`${c.id}-${kind}.png`),image);
    encodes.push(meta.writeWebp(image, path.join(output,'thumbs',`${c.id}-${kind}.webp`)));
    count++;
  }
  const dir = path.join(detailRoot,c.slug); fs.mkdirSync(dir,{recursive:true});
  const options = chapters.map(item => `<option value="${item.slug}"${item.id===c.id?' selected':''}>${item.id}. ${esc(item.name)}</option>`).join('');
  fs.writeFileSync(path.join(dir,'index.html'),require('./detail-template')({c,head,esc,safeJSON,sourceFooter,theories,options,surahPage}),'utf8');
}
const cover = {url:thumbURL(chapters[0], studies[0].key), alt:`${chapters[0].name}: ${studies[0].name}`, ...thumbSize.get(chapters[0].id)};
const galleryPage = {canonical:meta.COLLECTION_URL, description:galleryDescription, image:cover, graph:meta.collectionGraph({description:galleryDescription, image:cover.url, chapters})};
__GALLERY__
Promise.all(encodes).then(
  () => console.log(JSON.stringify({surahs:chapters.length,artworks:count,webp:encodes.length,output})),
  error => { console.error(error); process.exitCode = 1; });"""

build = 'scripts/build_site.js'
with open(build, encoding='utf-8') as handle:
    lines = handle.read().split('\n')
marker = "fs.writeFileSync(path.join(output,'index.html'),`${head('114 surahs')}"
index = [i for i, line in enumerate(lines) if line.startswith(marker)]
assert len(index) == 1
gallery = lines.pop(index[0]).replace("${head('114 surahs')}", "${head('114 surahs', galleryPage)}", 1)
with open(build, 'w', encoding='utf-8', newline='\n') as handle:
    handle.write('\n'.join(lines))
edit(build, [
    ("const {Resvg} = require('@resvg/resvg-js');\n",
     "const {Resvg} = require('@resvg/resvg-js');\nconst meta = require('./page-meta');\nconst dateCreated = '2026-09-28'; // when the live studies were generated\n"),
    (HEAD_OLD, HEAD_NEW), (CARD_OLD, CARD_NEW), (COUNT_OLD, COUNT_NEW),
    (LOOP_OLD, LOOP_NEW.replace('__GALLERY__', gallery)),
])
edit('scripts/detail-template.js', [
    ("'use strict';\n", "'use strict';\nconst meta = require('./page-meta');\n"),
    ("module.exports = ({c,head,esc,safeJSON,sourceFooter,theories,options}) => {\n",
     "module.exports = ({c,head,esc,safeJSON,sourceFooter,theories,options,surahPage}) => {\n  const subtitle = 'The same text, shaped by three mathematical rules.';\n"),
    ('<img src="/quran/thumbs/${c.id}-${kind}.png" alt="${esc(c.name)}: ${name}" width="600" height="480">',
     '${meta.picture(`/quran/thumbs/${c.id}-${kind}`, `alt="${esc(c.name)}: ${name}" width="600" height="480"`)}'),
    ("return `${head(c.name,'../')}<body", "return `${head(c.name, surahPage(c, subtitle))}<body"),
    ('<p class="detail-subtitle">The same text, shaped by three mathematical rules.</p>', '<p class="detail-subtitle">${subtitle}</p>'),
])
edit('app.js', [
    ("""        const img = card.querySelector('img');
        img.src = `/quran/thumbs/${card.dataset.id}-${kind}.png`;""",
     """        const img = card.querySelector('img');
        const source = card.querySelector('source');
        if (source) source.srcset = `/quran/thumbs/${card.dataset.id}-${kind}.webp`;
        img.src = `/quran/thumbs/${card.dataset.id}-${kind}.png`;"""),
    ("""  const byId = id => document.getElementById(id);
""",
     """  const byId = id => document.getElementById(id);
  // Analytics via /projects/ph.js: a no-op unless PostHog runs on suph.app. No personal data.
  const track = (event, props) => { if (typeof window.suphTrack === 'function') window.suphTrack(event, props); };
"""),
    ("""    document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => setMode(button.dataset.kind)));
""",
     """    document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => {
      // The gallery switches every card at once; surah pages report surah_study_switched.
      if (button.getAttribute('aria-pressed') !== 'true') track('gallery_study_switched', { study: button.dataset.kind });
      setMode(button.dataset.kind);
    }));
"""),
    ("""  const chapter = JSON.parse(byId('chapter-data').textContent);
""",
     """  const chapter = JSON.parse(byId('chapter-data').textContent);
  track('surah_viewed', { id: chapter.id, slug: chapter.slug });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[download][href^="/quran/artworks/"]');
    if (!link) return;
    const [id, study] = link.getAttribute('href').split('/').pop().replace(/[.]svg$/, '').split('-');
    track('artwork_downloaded', { id: Number(id), study });
  });
"""),
    ("""  kinds.forEach(kind => byId(`${kind}-art`).addEventListener('click', () => {
    byId('dialog-title')""",
     """  kinds.forEach(kind => byId(`${kind}-art`).addEventListener('click', () => {
    track('surah_study_switched', { id: chapter.id, study: kind });
    byId('dialog-title')"""),
])
print('patched live-studies generator')
