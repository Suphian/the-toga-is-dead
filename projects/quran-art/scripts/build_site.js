'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const {chapters} = JSON.parse(fs.readFileSync(path.join(root, 'data/surahs.json'), 'utf8'));
const geometry = require(path.join(root, 'geometry.js'));
const {Resvg} = require('@resvg/resvg-js');
const output = path.resolve(root, '../../site/quran');
const detailRoot = path.resolve(root, '../../site/surah');
fs.mkdirSync(output, {recursive:true});
for (const dir of ['artworks','thumbs']) fs.mkdirSync(path.join(output,dir),{recursive:true});
for (const file of ['style.css','app.js','geometry.js']) fs.copyFileSync(path.join(root,file),path.join(output,file));
const esc = text => String(text).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON = data => JSON.stringify(data).replace(/</g, '\\u003c');
const sourceFooter = `<footer><div class="foot"><details><summary>Text &amp; method</summary><p>The Arabic text comes from <a href="https://api.quran.com/api/v4/quran/verses/uthmani">Quran.com’s Uthmani transcription</a>. Words are separated by spaces; lengths count written Unicode letters, excluding vowel marks, tatweel, and small annotation waw and yeh. Attached prefixes stay within the word. These counts describe this transcription, not pronunciation or traditional letter totals.</p><p>Only numbered verses are included: the basmala in 1:1 and within 27:30 is retained; no unnumbered openings are added. Geometric constants are artistic choices. Each artwork is fitted to its own frame, so its displayed size is not a comparison of surah length.</p></details><a href="/">suph.app ↗</a></div></footer>`;
const head = (title,prefix='') => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8f5ec"><meta name="description" content="Three mathematical artworks for every surah of the Quran. Explore language through shape, rhythm, and geometry."><title>${esc(title)} · Quran Art</title><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='24' fill='none' stroke='%23355c55' stroke-width='3'/%3E%3C/svg%3E"><link rel="stylesheet" href="/quran/style.css"></head>`;
const cards = chapters.map(c => `<a class="surah-card" href="/surah/${c.slug}" data-id="${c.id}" data-name="${esc(c.name)}" data-search="${esc(`${c.id} ${c.name} ${c.name_arabic} ${c.slug}`.toLocaleLowerCase().replace(/[-'’]/g,''))}"><div class="preview"><img src="/quran/thumbs/${c.id}-shell.png" alt="${esc(c.name)}: Verse Shell" width="600" height="480" loading="lazy" decoding="async"></div><div class="card-name"><h2 class="latin-name"><span class="number">${String(c.id).padStart(2,'0')}</span>${esc(c.name)}</h2><span class="arabic-name" lang="ar" dir="rtl">${esc(c.name_arabic)}</span></div></a>`).join('\n');
fs.writeFileSync(path.join(output,'index.html'),`${head('114 surahs')}<body data-page="gallery"><header><nav class="nav"><a class="brand" href="/">suph.</a><span>114 surahs</span></nav></header><main><div class="hero"><h1>Quran in form</h1><p class="arabic-title" lang="ar" dir="rtl">القرآن</p></div><div class="toolbar"><div class="modes" role="group" aria-label="Artwork approach"><button class="mode" data-kind="shell" aria-pressed="true">Verse Shell</button><button class="mode" data-kind="current" aria-pressed="false">Word Current</button><button class="mode" data-kind="lines" aria-pressed="false">Verse Lines</button></div><label><span class="visually-hidden">Find a surah</span><input id="search" class="search" type="search" placeholder="Find a surah" autocomplete="off"></label></div><div class="gallery">${cards}</div><p id="empty" class="empty" hidden>No surahs found.</p><p id="search-status" class="visually-hidden" role="status"></p></main>${sourceFooter}<script src="/quran/app.js?v=verse-lines" defer></script></body></html>`,'utf8');
const theories = {
 shell:`<p>Each verse becomes a rippled ring. Its letter count sets the radius, its word count sets the number of ripples, and variation in word length sets their depth. The rings rise and rotate in verse order.</p><p class="formula">R = 40 + 2L<br>A = 0.25σᵥ / (μᵥ + σᵥ)<br>r(θ) = R[1 + A cos(Wθ)]</p><p>W and L are the verse’s word and letter counts; μᵥ and σᵥ are its mean word length and population standard deviation. For verse i of V, rotation is 2π(i − 1)/V and height is 12(i − 1). The tilted view projects y to 0.42y − 0.907[z − 6(V − 1)].</p><p id="shell-values" class="math-values"></p>`,
 current:`<p>Read every word as a movement. A word of length ℓ draws an arc of length 10ℓ. Longer-than-average words turn left; shorter words turn right. Each arc continues from the previous one, so word order changes the drawing.</p><p class="formula">s = 10ℓ<br>Δ = (3π/4) tanh[(ℓ − μ)/σ]<br>Curvature = Δ/s</p><p>μ and σ describe all word lengths in the surah. The path begins at (0, 0), facing right; each circular arc changes its heading by Δ, capped smoothly at ±135°. Zero turn draws a straight line. If σ = 0, the whole path is straight.</p><p id="current-values" class="math-values"></p>`,
 lines:`<p>Each ayah becomes one horizontal line. Its letter count sets its length. The lines are centered and stacked in verse order, revealing the rhythm of short and long passages.</p><p class="formula">Length = 6L<br>xₗ = −3L; xᵣ = 3L<br>y = 12(i − 1)</p><p>L is the ayah’s retained letter count and i is its verse number. Subtle divisions mark word boundaries where space allows. A single scale fits the whole drawing, so a verse with twice as many letters produces a line twice as long.</p><p id="lines-values" class="math-values"></p>`
};
let count = 0;
for (const c of chapters) {
  for (const [folder,extension] of [['artworks','svg'],['thumbs','png']]) {
    const previous = path.join(output,folder,`${c.id}-bloom.${extension}`);
    if (fs.existsSync(previous)) fs.unlinkSync(previous);
  }
  const dir = path.join(detailRoot,c.slug); fs.mkdirSync(dir,{recursive:true});
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
console.log(JSON.stringify({surahs:chapters.length,artworks:count,output}));
