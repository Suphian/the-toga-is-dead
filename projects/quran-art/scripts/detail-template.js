'use strict';
const meta = require('./page-meta');
module.exports = ({c,head,esc,safeJSON,sourceFooter,theories,options,studies,version,surahPage}) => {
  const subtitle = 'One rule, three arrangements: a letter is a unit of line, a word boundary is a break.';
  const N = c.verses.reduce((sum,v)=>sum+v.word_count,0);
  const decks = {rays:'Every verse a ray. Length is letters; breaks are words.', rows:'Every verse a row, right-aligned like a page.', spiral:`${N.toLocaleString()} words on one spiral.`};
  const cards = studies.map(({key,name}) => `
    <article class="art-card">
      <div class="art-heading"><h2>${name}</h2><a class="save" href="/quran/artworks/${c.id}-${key}.svg" download="${esc(c.slug)}-${key}.svg" aria-label="Save ${name} as SVG">Save SVG ↓</a></div>
      <p class="art-deck">${decks[key]}</p>
      <button class="artwork" id="${key}-art" aria-label="Enlarge ${name}" title="Enlarge artwork">${meta.picture(`/quran/thumbs/${c.id}-${key}`, `alt="${esc(c.name)}: ${name}" width="600" height="600"`)}</button>
      <section class="theory" aria-labelledby="${key}-theory-title"><h3 class="theory-heading" id="${key}-theory-title">The mathematics</h3>${theories[key]}</section>
    </article>`).join('');
  return `${head(c.name, surahPage(c, subtitle))}<body class="detail" data-page="detail">
    <header><nav class="nav"><a class="brand" href="/">suph.</a><label><span class="visually-hidden">Choose a surah</span><select id="surah-select" class="surah-select">${options}</select></label></nav></header>
    <main>
      <a class="back-link" href="/quran">← All surahs</a>
      <div class="hero"><div><h1>${esc(c.name)}. Three forms.</h1><p class="detail-subtitle">${subtitle}</p></div><p class="arabic-title" lang="ar" dir="rtl">${esc(c.name_arabic)}</p></div>
      <section class="verse-panel" aria-label="Explore a verse">
        <div class="verse-controls"><div class="verse-label"><label for="verse-range" id="verse-output">Verse ${c.id}:2</label><div class="verse-nav"><button class="arrow" id="previous-verse" aria-label="Previous verse">←</button><button class="arrow" id="next-verse" aria-label="Next verse">→</button></div></div><input type="range" id="verse-range" min="1" max="${c.verses.length}" value="${Math.min(2,c.verses.length)}" aria-label="Follow a verse"><p id="verse-stats" class="visually-hidden"></p></div>
      </section>
      <section class="art-grid" aria-label="Three arrangements of one rule">${cards}</section>
      <section class="measurements" aria-label="Selected verse measurements"><p id="verse-arabic" class="verse-text" lang="ar" dir="rtl">${esc(c.verses[Math.min(1,c.verses.length-1)].arabic)}</p><div class="verse-numbers"><dl><div><dt>Words</dt><dd id="count-words"></dd></div><div><dt>Letters</dt><dd id="count-letters"></dd></div><div><dt>Mean length</dt><dd id="count-mean"></dd></div><div><dt>Length spread</dt><dd id="count-sd"></dd></div></dl><div class="length-study"><span>Word lengths</span><div id="length-bars" aria-label="Letters in each word"></div></div></div></section>
    </main>${sourceFooter}
    <dialog id="art-dialog"><div class="dialog-top"><h2 id="dialog-title"></h2><button id="close-art" aria-label="Close enlarged artwork">Close ×</button></div><div id="dialog-art"></div></dialog>
    <script id="chapter-data" type="application/json">${safeJSON(c)}</script><script src="/quran/geometry.js?v=${version}" defer></script><script src="/quran/app.js?v=${version}" defer></script>
  </body></html>`;
};
