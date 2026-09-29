'use strict';
module.exports = ({c,head,esc,safeJSON,sourceFooter,theories,options}) => {
  const N = c.verses.reduce((sum,v)=>sum+v.word_count,0);
  const cards = [['shell','Verse Shell','A contour for each verse.'],['current','Word Current',`${N.toLocaleString()} words, one unbroken line.`],['lines','Verse Lines','One ayah, one line. Length follows letters.']].map(([kind,name,deck]) => `
    <article class="art-card">
      <div class="art-heading"><h2>${name}</h2><a class="save" href="/quran/artworks/${c.id}-${kind}.svg" download="${esc(c.slug)}-${kind}.svg" aria-label="Save ${name} as SVG">Save SVG ↓</a></div>
      <p class="art-deck">${deck}</p>
      <button class="artwork" id="${kind}-art" aria-label="Enlarge ${name}" title="Enlarge artwork"><img src="/quran/thumbs/${c.id}-${kind}.png" alt="${esc(c.name)}: ${name}" width="600" height="480"></button>
      <details class="theory" open><summary>The mathematics</summary>${theories[kind]}</details>
    </article>`).join('');
  return `${head(c.name,'../')}<body class="detail" data-page="detail">
    <header><nav class="nav"><a class="brand" href="/">suph.</a><label><span class="visually-hidden">Choose a surah</span><select id="surah-select" class="surah-select">${options}</select></label></nav></header>
    <main>
      <a class="back-link" href="/quran">← All surahs</a>
      <div class="hero"><div><h1>${esc(c.name)}. Three forms.</h1><p class="detail-subtitle">The same text, shaped by three mathematical rules.</p></div><p class="arabic-title" lang="ar" dir="rtl">${esc(c.name_arabic)}</p></div>
      <section class="verse-panel" aria-label="Explore a verse">
        <div class="verse-controls"><div class="verse-label"><label for="verse-range" id="verse-output">Verse ${c.id}:2</label><div class="verse-nav"><button class="arrow" id="previous-verse" aria-label="Previous verse">←</button><button class="arrow" id="next-verse" aria-label="Next verse">→</button></div></div><input type="range" id="verse-range" min="1" max="${c.verses.length}" value="${Math.min(2,c.verses.length)}" aria-label="Follow a verse"><p id="verse-stats" class="visually-hidden"></p></div>
      </section>
      <section class="art-grid" aria-label="Three mathematical artworks">${cards}</section>
      <section class="measurements" aria-label="Selected verse measurements"><p id="verse-arabic" class="verse-text" lang="ar" dir="rtl">${esc(c.verses[Math.min(1,c.verses.length-1)].arabic)}</p><div class="verse-numbers"><dl><div><dt>Words</dt><dd id="count-words"></dd></div><div><dt>Letters</dt><dd id="count-letters"></dd></div><div><dt>Mean length</dt><dd id="count-mean"></dd></div><div><dt>Length spread</dt><dd id="count-sd"></dd></div></dl><div class="length-study"><span>Word lengths</span><div id="length-bars" aria-label="Letters in each word"></div></div></div></section>
    </main>${sourceFooter}
    <dialog id="art-dialog"><div class="dialog-top"><h2 id="dialog-title"></h2><button id="close-art" aria-label="Close enlarged artwork">Close ×</button></div><div id="dialog-art"></div></dialog>
    <script id="chapter-data" type="application/json">${safeJSON(c)}</script><script src="/quran/geometry.js?v=verse-lines" defer></script><script src="/quran/app.js?v=verse-lines" defer></script>
  </body></html>`;
};
