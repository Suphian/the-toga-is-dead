'use strict';
(() => {
  const byId = id => document.getElementById(id);
  // Analytics via /projects/ph.js: a no-op unless PostHog runs on suph.app. No personal data.
  const track = (event, props) => { if (typeof window.suphTrack === 'function') window.suphTrack(event, props); };
  if (document.body.dataset.page === 'gallery') {
    const cards = [...document.querySelectorAll('.surah-card')];
    const buttons = [...document.querySelectorAll('.mode')];
    const setMode = button => {
      buttons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      cards.forEach(card => {
        const img = card.querySelector('img');
        const source = card.querySelector('source');
        if (source) source.srcset = `/quran/thumbs/${card.dataset.id}-${button.dataset.kind}.webp`;
        img.src = `/quran/thumbs/${card.dataset.id}-${button.dataset.kind}.png`;
        img.alt = `${card.dataset.name}: ${button.textContent.trim()}`;
      });
    };
    buttons.forEach(button => button.addEventListener('click', () => {
      // The gallery switches every card at once; surah pages report surah_study_switched.
      if (button.getAttribute('aria-pressed') !== 'true') track('gallery_study_switched', { study: button.dataset.kind });
      setMode(button);
    }));
    byId('search').addEventListener('input', event => {
      const query = event.target.value.toLocaleLowerCase().trim().replace(/[-'’]/g, '');
      let count = 0;
      cards.forEach(card => {
        const match = card.dataset.search.includes(query);
        card.hidden = !match;
        if (match) count++;
      });
      byId('empty').hidden = count > 0;
      byId('search-status').textContent = `${count} ${count === 1 ? 'surah' : 'surahs'}`;
    });
    return;
  }
  const chapter = JSON.parse(byId('chapter-data').textContent);
  track('surah_viewed', { id: chapter.id, slug: chapter.slug });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[download][href^="/quran/artworks/"]');
    if (!link) return;
    const [id, study] = link.getAttribute('href').split('/').pop().replace(/[.]svg$/, '').split('-');
    track('artwork_downloaded', { id: Number(id), study });
  });
  const geometry = window.QuranGeometry;
  const model = geometry.build(chapter);
  const kinds = geometry.studies.map(study => study.key);
  const names = Object.fromEntries(geometry.studies.map(study => [study.key, study.name]));
  const units = n => `${Number(n.toFixed(n < 10 ? 2 : 1))} units`;
  const breaks = study => study.gap ? `word breaks are ${units(study.gap)} wide` : 'letters are under 2 units wide here, so word breaks are not drawn';
  const initial = Number(new URLSearchParams(location.search).get('verse'));
  let selected = Number.isInteger(initial) && initial >= 1 && initial <= chapter.verses.length ? initial : Math.min(2, chapter.verses.length);
  let initialized = false;
  const render = () => {
    kinds.forEach(kind => {
      const container = byId(`${kind}-art`);
      if (!initialized) container.innerHTML = geometry.markup(chapter, kind, { selected, background: false });
      else {
        const group = container.querySelector('svg > g');
        group.lastElementChild.remove();
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const attributes = { d: model[kind][selected - 1].d, stroke: geometry.palette.accent, 'stroke-width': model.studies[kind].highlight, 'data-verse': selected };
        for (const [key, value] of Object.entries(attributes)) path.setAttribute(key, value);
        group.append(path);
        container.querySelector('desc').textContent = `${chapter.name}: verse ${selected} highlighted.`;
      }
    });
    initialized = true;
    const verse = chapter.verses[selected - 1];
    byId('verse-range').value = String(selected);
    byId('verse-range').setAttribute('aria-valuetext', `${chapter.name}, verse ${selected} of ${chapter.verses.length}`);
    byId('verse-output').textContent = `Verse ${chapter.id}:${selected}`;
    byId('verse-arabic').textContent = verse.arabic;
    byId('verse-stats').textContent = `${verse.word_count} words · ${verse.letter_count} letters`;
    byId('previous-verse').disabled = selected === 1;
    byId('next-verse').disabled = selected === chapter.verses.length;
    const record = model.records[selected - 1];
    byId('count-words').textContent = record.W;
    byId('count-letters').textContent = record.L;
    byId('count-mean').textContent = record.mean.toFixed(2);
    byId('count-sd').textContent = record.sd.toFixed(2);
    byId('length-bars').replaceChildren(...verse.word_lengths.map((length, index) => {
      const bar = document.createElement('span');
      bar.className = 'length-bar'; bar.style.setProperty('--length', length);
      bar.textContent = length; bar.title = `${verse.words[index]}: ${length} letters`;
      return bar;
    }));
    const { rays, rows, spiral } = model.studies;
    byId('rays-values').textContent = `Verse ${selected}: ${record.L} letters → a ray ${units(record.L * rays.u)} long from an inner circle of radius ${units(rays.r0)}; ${units(rays.u)} per letter; ${breaks(rays)}.`;
    byId('rows-values').textContent = `Verse ${selected}: ${record.L} letters → a row ${units(record.L * rows.u)} long; rows are ${units(rows.pitch)} apart; ${units(rows.u)} per letter; ${breaks(rows)}.`;
    byId('spiral-values').textContent = `${model.S.toLocaleString()} letters along ${spiral.n.toFixed(2)} turns, ${units(spiral.p)} apart; ${units(spiral.u)} per letter; μ = ${model.mean.toFixed(3)}, σ = ${model.sd.toFixed(3)}; swell up to ${units(spiral.amplitude)}. Verse ${selected} covers ${record.W} ${record.W === 1 ? 'word' : 'words'}.`;
  };
  byId('verse-range').addEventListener('input', event => { selected = Number(event.target.value); render(); });
  byId('previous-verse').addEventListener('click', () => { selected = Math.max(1, selected - 1); render(); });
  byId('next-verse').addEventListener('click', () => { selected = Math.min(chapter.verses.length, selected + 1); render(); });
  byId('surah-select').addEventListener('change', event => { location.href = `/surah/${event.target.value}`; });
  kinds.forEach(kind => byId(`${kind}-art`).addEventListener('click', () => {
    track('surah_study_switched', { id: chapter.id, study: kind });
    byId('dialog-title').textContent = `${chapter.name} · ${names[kind]}`;
    byId('dialog-art').innerHTML = geometry.markup(chapter, kind, { selected, background: false });
    byId('art-dialog').showModal();
  }));
  byId('close-art').addEventListener('click', () => byId('art-dialog').close());
  byId('art-dialog').addEventListener('click', event => { if (event.target === byId('art-dialog')) byId('art-dialog').close(); });
  render();
})();
