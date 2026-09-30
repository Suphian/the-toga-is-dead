'use strict';
// Guard: this generator emits the one-rule studies (Rays, Rows, Spiral), which are not approved.
// The committed site/quran and site/surah output is the live 1fa0c9c studies; rebuild those with
// scripts/live-studies/build-live-studies.sh (it builds the archived 1fa0c9c generator, not this file).
if (process.env.ONE_RULE_APPROVED !== '1') {
  console.error([
    'build_site.js stopped: it emits the one-rule studies (Rays, Rows, Spiral), which are not approved.',
    'The committed site/quran and site/surah pages are the live 1fa0c9c studies (Verse Shell, Word Current, Verse Lines).',
    'Rebuild them from the repository root with: bash projects/quran-art/scripts/live-studies/build-live-studies.sh',
    'Once the one-rule studies are approved, run: ONE_RULE_APPROVED=1 node scripts/build_site.js',
  ].join('\n'));
  process.exit(1);
}
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {chapters} = JSON.parse(fs.readFileSync(path.join(root, 'data/surahs.json'), 'utf8'));
const geometry = require(path.join(root, 'geometry.js'));
const {studies, palette} = geometry;
const {Resvg} = require('@resvg/resvg-js');
const meta = require('./page-meta');
const output = path.resolve(root, '../../site/quran');
const detailRoot = path.resolve(root, '../../site/surah');
const version = 'one-rule';
const dateCreated = '2026-09-28'; // when the current studies' geometry was drawn
fs.mkdirSync(output, {recursive:true});
for (const dir of ['artworks','thumbs']) fs.mkdirSync(path.join(output,dir),{recursive:true});
for (const file of ['style.css','app.js','geometry.js']) fs.copyFileSync(path.join(root,file),path.join(output,file));
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON = data => JSON.stringify(data).replace(/</g, '\\u003c');
const sourceFooter = `<footer><div class="foot"><details><summary>Text &amp; method</summary><p>The Arabic text comes from <a href="https://api.quran.com/api/v4/quran/verses/uthmani">Quran.com’s Uthmani transcription</a>. Words are separated by spaces; lengths count written Unicode letters, excluding vowel marks, tatweel, and small annotation waw and yeh. Attached prefixes stay within the word. These counts describe this transcription, not pronunciation or traditional letter totals.</p><p>Only numbered verses are included: the basmala in 1:1 and within 27:30 is retained; no unnumbered openings are added. In every drawing one letter is one unit of line and word boundaries are breaks; the remaining constants are artistic choices. Each artwork is fitted to its own frame, so its displayed size is not a comparison of surah length.</p></details><a href="/">suph.app ↗</a></div></footer>`;
const galleryDescription = 'Three arrangements of one rule for every surah of the Quran: one letter is one unit of line. Rays, rows and a spiral drawn from the text’s own measurements.';
const head = (title, page) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="${palette.paper}"><title>${esc(title)} · Quran Art</title>${meta.tags({title:`${title} · Quran Art`, ...page})}<link rel="stylesheet" href="/quran/style.css?v=${version}"><script defer src="/projects/ph.js"></script></head>`;
const modes = studies.map((study, index) => `<button class="mode" data-kind="${study.key}" aria-pressed="${index === 0}">${study.name}</button>`).join('');
const cards = chapters.map(c => `<a class="surah-card" href="/surah/${c.slug}" data-id="${c.id}" data-name="${esc(c.name)}" data-search="${esc(`${c.id} ${c.name} ${c.name_arabic} ${c.slug}`.toLocaleLowerCase().replace(/[-'’]/g,''))}"><div class="preview">${meta.picture(`/quran/thumbs/${c.id}-${studies[0].key}`, `alt="${esc(c.name)}: ${studies[0].name}" width="600" height="600" loading="lazy" decoding="async"`)}</div><div class="card-name"><h2 class="latin-name"><span class="number">${String(c.id).padStart(2,'0')}</span>${esc(c.name)}</h2><span class="arabic-name" lang="ar" dir="rtl">${esc(c.name_arabic)}</span></div></a>`).join('\n');
const theories = {
 rays:`<p>Every verse is a ray. One letter is one unit of length and each word boundary is a small break. Verse 1 points up; later verses follow counter-clockwise, the direction Arabic is read. Nothing overlaps, however long the surah.</p><p class="formula">θᵢ = 90° + 360°(i − 1)/V<br>length = L · u<br>u = (260 − r₀)/L<sub>max</sub>, r₀ = clamp(0.19V, 24, 70)</p><p>V is the number of verses, L the verse’s letter count and i its number. The rays begin on a small inner circle of radius r₀, and the longest verse reaches the edge of the 600-unit frame. Breaks are 0.45u wide, at most 4 units, and are drawn only when a letter is at least 2 units wide.</p><p id="rays-values" class="math-values"></p>`,
 rows:`<p>Every verse is a row, aligned to the right where reading begins and stacked in order. One letter is one unit; breaks are word boundaries. A single scale fits the whole block, so a verse with twice the letters is twice as long.</p><p class="formula">length = L · u<br>pitch = 2.4u<br>u = min(520/L<sub>max</sub>, 520/2.4(V − 1))</p><p>Rows are 2.4 letter-units apart. The block is centred in the frame and is as wide as the longest verse or as tall as the verse count allows, whichever fits first.</p><p id="rows-values" class="math-values"></p>`,
 spiral:`<p>The whole surah is one spiral read from the centre outward, word after word. One letter is one unit of arc. Words longer than the surah’s average swell the line outward and shorter words pull it inward, each over at least a short stretch of arc, so the swell stays gentle. Turns grow with the square root of the letter count, so the ink stays evenly spread.</p><p class="formula">r = r₀ + pθ/2π, n = √(S/16) turns<br>u = arc length / S<br>δ = A · tanh[(ℓ − μ)/σ] · sin²(πt), A ≤ 0.35p</p><p>S is the surah’s letter count, μ and σ the mean and spread of its word lengths, p the distance between turns, and n is kept between 1.25 and 40. Each word’s push is spread over at least 24 units of arc and the total swell never exceeds A, so neighbouring turns never touch.</p><p id="spiral-values" class="math-values"></p>`
};
// Only the current studies' exports survive a build; earlier studies' files are removed.
const keep = new RegExp(`^\\d+-(${studies.map(study => study.key).join('|')})\\.(svg|png|webp)$`);
for (const folder of ['artworks','thumbs']) for (const file of fs.readdirSync(path.join(output,folder))) if (!keep.test(file)) fs.unlinkSync(path.join(output,folder,file));
let count = 0;
const encodes = [];
const thumbSize = new Map(); // surah id -> pixel size of its first study's thumbnail, the page's og:image
const thumbURL = (c, key) => meta.absolute(`/quran/thumbs/${c.id}-${key}.png`);
const surahPage = (c, tagline) => {
  const description = meta.surahDescription(c, tagline, chapters.length);
  const images = studies.map(({key}) => thumbURL(c, key));
  return {canonical:meta.surahUrl(c.slug), description, image:{url:images[0], alt:`${c.name}: ${studies[0].name}`, ...thumbSize.get(c.id)},
    graph:meta.artworkGraph({c, name:`${c.name} · Quran Art`, description, images, dateCreated})};
};
for (const c of chapters) {
  for (const {key} of studies) {
    const svg = geometry.markup(c,key,{selected:0,background:true});
    fs.writeFileSync(path.join(output,'artworks',`${c.id}-${key}.svg`),svg,'utf8');
    const rendered = new Resvg(geometry.markup(c,key,{selected:0,background:false}), {fitTo:{mode:'width',value:640},font:{loadSystemFonts:false}}).render();
    const image = rendered.asPng();
    if (!thumbSize.has(c.id)) thumbSize.set(c.id, {width:rendered.width, height:rendered.height});
    fs.writeFileSync(path.join(output,'thumbs',`${c.id}-${key}.png`),image);
    encodes.push(meta.writeWebp(image, path.join(output,'thumbs',`${c.id}-${key}.webp`)));
    count++;
  }
  const dir = path.join(detailRoot,c.slug); fs.mkdirSync(dir,{recursive:true});
  const options = chapters.map(item => `<option value="${item.slug}"${item.id===c.id?' selected':''}>${item.id}. ${esc(item.name)}</option>`).join('');
  fs.writeFileSync(path.join(dir,'index.html'),require('./detail-template')({c,head,esc,safeJSON,sourceFooter,theories,options,studies,version,surahPage}),'utf8');
}
const cover = {url:thumbURL(chapters[0], studies[0].key), alt:`${chapters[0].name}: ${studies[0].name}`, ...thumbSize.get(chapters[0].id)};
const galleryPage = {canonical:meta.COLLECTION_URL, description:galleryDescription, image:cover, graph:meta.collectionGraph({description:galleryDescription, image:cover.url, chapters})};
fs.writeFileSync(path.join(output,'index.html'),`${head('114 surahs', galleryPage)}<body data-page="gallery"><header><nav class="nav"><a class="brand" href="/">suph.</a><span>114 surahs</span></nav></header><main><div class="hero"><h1>Quran in form</h1><p class="arabic-title" lang="ar" dir="rtl">القرآن</p></div><div class="toolbar"><div class="modes" role="group" aria-label="Artwork approach">${modes}</div><label><span class="visually-hidden">Find a surah</span><input id="search" class="search" type="search" placeholder="Find a surah" autocomplete="off"></label></div><div class="gallery">${cards}</div><p id="empty" class="empty" hidden>No surahs found.</p><p id="search-status" class="visually-hidden" role="status"></p></main>${sourceFooter}<script src="/quran/app.js?v=${version}" defer></script></body></html>`,'utf8');
Promise.all(encodes).then(
  () => console.log(JSON.stringify({surahs:chapters.length,artworks:count,webp:encodes.length,output})),
  error => { console.error(error); process.exitCode = 1; });
