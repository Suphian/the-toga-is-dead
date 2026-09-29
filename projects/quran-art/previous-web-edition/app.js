'use strict';

// These are visual encoding choices, not linguistic claims about the angles.
const TURNS = new Map([
  ['ha`*aA', -60], ['*a`lik', 60], ['>uwla`^}ik', 120], ['*aA', -30],
  ['hunaA', 0], ['tilokum', 90], ['ha`*a`n', -90], [">uwlaA^'", -120],
  ['ha`ka*aA', 30], ['ha`tayon', -90], ['*a`nik', 90],
]);
const $ = (id) => document.getElementById(id);
const escapeXML = (value) => String(value).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
let corpus, chapters, selected, visibleCount = 0, animation = 0;
const drawings = new Map();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function geometry(chapter) {
  let x = 0, y = 0, heading = -Math.PI / 2, previousVerse = 0;
  const points = [[x, y]];
  for (const token of chapter.tokens) {
    if (!TURNS.has(token.lemma)) throw new Error('Unmapped corpus lemma: ' + token.lemma);
    heading += TURNS.get(token.lemma) * Math.PI / 180;
    const gap = previousVerse ? token.verse - previousVerse : 0;
    const length = 1 + token.word / token.verseWords + Math.min(gap, 12) / 12;
    x += Math.cos(heading) * length;
    y += Math.sin(heading) * length;
    points.push([x, y]); previousVerse = token.verse;
  }
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = 380 / Math.max(maxX - minX, maxY - minY, 3);
  return points.map(([px, py]) => [250 + (px - (maxX + minX) / 2) * scale, 250 + (py - (maxY + minY) / 2) * scale]);
}

function svg(chapter, count = chapter.tokens.length, highlight = false, downloadable = false) {
  const points = drawings.get(chapter.id), shown = points.slice(0, count + 1);
  const coords = shown.map(p => p.map(n => n.toFixed(3)).join(',')).join(' ');
  const title = escapeXML(`${chapter.name}: ${chapter.tokens.length} annotated demonstratives`);
  const metadata = downloadable ? `<metadata>${escapeXML(JSON.stringify({source: 'https://corpus.quran.com/', snapshot: corpus.source, sha256: corpus.sourceSha256, chapter: chapter.id, method: 'Morphology and verse-position adaptation. Rules: https://suph.app/Quran/README.md', copyrightNotice: corpus.copyrightNotice}))}</metadata>` : '';
  let marks = '';
  if (count > 0 && highlight) {
    const a = points[count-1], b = points[count];
    marks = `<path d="M${a.join(',')}L${b.join(',')}" stroke="#b14536" stroke-width="2.1" fill="none"/><circle cx="${b[0]}" cy="${b[1]}" r="3" fill="#b14536"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" role="img" aria-label="${title}"><title>${title}</title>${metadata}${downloadable ? '<rect width="500" height="500" fill="white"/>' : ''}${count ? `<polyline points="${coords}" fill="none" stroke="#262624" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/>` : ''}${marks}</svg>`;
}

function stopAnimation() { cancelAnimationFrame(animation); animation = 0; $('play').textContent = 'Trace ↗'; }
function renderLine(count) {
  visibleCount = Math.max(0, Math.min(selected.tokens.length, count));
  $('trace').value = String(visibleCount);
  $('artwork').innerHTML = svg(selected, visibleCount, true);
  $('trace-status').textContent = `${visibleCount} of ${selected.tokens.length} occurrences shown`;
  $('trace').setAttribute('aria-valuetext', `${visibleCount} of ${selected.tokens.length} demonstratives`);
  $('art-sequence').textContent = `${String(visibleCount).padStart(3, '0')} MARKS / VERSE ORDER`;
  const token = selected.tokens[visibleCount - 1];
  $('token-note').hidden = !token;
  if (token) {
    $('token-location').textContent = `Verse ${selected.id}:${token.verse} · word ${token.word}`;
    $('token-form').textContent = token.form;
    $('token-description').textContent = 'Original corpus form in Buckwalter transliteration. Tagged as a demonstrative pronoun.';
    $('token-source').href = `https://corpus.quran.com/wordmorphology.jsp?location=(${selected.id}:${token.verse}:${token.word})`;
  }
}

function selectChapter(id, updateURL = true) {
  selected = chapters.find(c => c.id === Number(id)) || chapters[1];
  stopAnimation();
  $('chapter').value = String(selected.id);
  $('chapter-name').textContent = $('art-name').textContent = selected.name;
  $('art-number').textContent = `${String(selected.id).padStart(3, '0')} / 114`;
  $('count').textContent = String(selected.tokens.length);
  $('verses').textContent = String(selected.verses);
  $('chapter-summary').textContent = selected.tokens.length ? 'A line through the demonstrative pronouns recorded in this surah.' : 'No DEM-tagged occurrences are recorded in this surah. Its drawing is intentionally empty.';
  $('empty-art').hidden = selected.tokens.length > 0;
  $('trace').max = String(selected.tokens.length);
  $('trace').disabled = $('play').disabled = !selected.tokens.length;
  renderLine(selected.tokens.length);
  document.querySelectorAll('.chapter-card').forEach(card => card.setAttribute('aria-current', String(Number(card.dataset.chapter) === selected.id)));
  if (updateURL) {
    const url = new URL(location.href); url.searchParams.set('surah', selected.id); history.replaceState(null, '', url);
  }
  $('app-status').textContent = `Surah ${selected.id}: ${selected.name} · ${selected.tokens.length} corpus occurrences`;
}

function buildGallery() {
  const fragment = document.createDocumentFragment();
  for (const chapter of chapters) {
    const card = document.createElement('button'); card.type = 'button'; card.className = 'chapter-card';
    card.dataset.chapter = chapter.id;
    card.dataset.search = `${chapter.id} ${chapter.name}`.normalize('NFD').replace(/[\u0300-\u036f’'\-]/g, '').toLowerCase();
    card.setAttribute('aria-label', `Surah ${chapter.id}, ${chapter.name}, ${chapter.tokens.length} demonstratives`);
    card.innerHTML = `<div class="thumbnail"><span class="thumbnail-number">${String(chapter.id).padStart(3, '0')}</span>${chapter.tokens.length ? svg(chapter) : '<span class="thumbnail-empty" aria-hidden="true">—</span>'}</div><span class="chapter-card-label">${escapeXML(chapter.name)}</span><span class="chapter-card-count">${chapter.tokens.length} ${chapter.tokens.length === 1 ? 'OCCURRENCE' : 'OCCURRENCES'}</span>`;
    card.addEventListener('click', () => { selectChapter(chapter.id); $('explorer').scrollIntoView({behavior: reducedMotion ? 'instant' : 'smooth', block:'start'}); $('chapter').focus({preventScroll:true}); });
    fragment.append(card);
  }
  $('gallery').append(fragment);
}

async function initialize() {
  try {
    const response = await fetch('/Quran/data.json');
    if (!response.ok) throw new Error(`Data unavailable (${response.status})`);
    corpus = await response.json(); chapters = corpus.chapters;
    if (chapters.length !== 114 || chapters.reduce((n,c) => n+c.tokens.length,0) !== 1059) throw new Error('Corpus index validation failed');
    for (const chapter of chapters) drawings.set(chapter.id, geometry(chapter));
    $('chapter').replaceChildren(...chapters.map(c => new Option(`${String(c.id).padStart(2,'0')}  ${c.name}`, c.id)));
    ['chapter','previous','next','download'].forEach(id => $(id).disabled = false);
    buildGallery(); selectChapter(new URLSearchParams(location.search).get('surah') || 2, false);
    $('explorer').setAttribute('aria-busy','false');
  } catch (error) {
    $('app-status').textContent = 'The corpus data could not load. Please refresh to try again.';
    $('chapter-summary').textContent = 'Data unavailable';
    $('explorer').setAttribute('aria-busy','false');
    console.error('Quran Art:', error);
  }
}

$('chapter').addEventListener('change', event => selectChapter(event.target.value));
$('previous').addEventListener('click', () => selectChapter(selected.id === 1 ? 114 : selected.id - 1));
$('next').addEventListener('click', () => selectChapter(selected.id === 114 ? 1 : selected.id + 1));
$('trace').addEventListener('input', event => { stopAnimation(); renderLine(Number(event.target.value)); });
$('play').addEventListener('click', () => {
  if (animation) { stopAnimation(); return; }
  if (reducedMotion) { renderLine(selected.tokens.length); return; }
  renderLine(0); $('play').textContent = 'Pause';
  const start = performance.now(), duration = Math.max(1500, Math.min(8500, selected.tokens.length * 90));
  const frame = now => {
    const count = Math.min(selected.tokens.length, Math.floor((now-start)/duration*selected.tokens.length));
    if (count !== visibleCount) renderLine(count);
    if (count < selected.tokens.length) animation = requestAnimationFrame(frame); else stopAnimation();
  };
  animation = requestAnimationFrame(frame);
});
$('artwork').addEventListener('click', event => {
  if (!selected?.tokens.length) return;
  const element = $('artwork').querySelector('svg');
  const matrix = element.getScreenCTM(); if (!matrix) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const points = drawings.get(selected.id); let nearest = 1, best = Infinity;
  for (let i=1;i<points.length;i++) { const distance = Math.hypot(points[i][0]-point.x, points[i][1]-point.y); if (distance<best) {best=distance;nearest=i;} }
  stopAnimation(); renderLine(nearest);
});
$('download').addEventListener('click', () => {
  const blob = new Blob([svg(selected, selected.tokens.length, false, true)], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = `quran-art-${String(selected.id).padStart(3,'0')}.svg`;
  document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('search').addEventListener('input', event => {
  const query = event.target.value.normalize('NFD').replace(/[\u0300-\u036f’'\-]/g, '').toLowerCase().trim();
  let count = 0;
  document.querySelectorAll('.chapter-card').forEach(card => { card.hidden = !card.dataset.search.includes(query); if (!card.hidden) count++; });
  $('no-results').hidden = count > 0;
});
window.addEventListener('pagehide', stopAnimation);
initialize();
