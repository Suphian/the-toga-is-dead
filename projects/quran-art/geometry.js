(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.QuranGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // One rule, three arrangements. One letter is one unit of line; every word
  // boundary is a small break carved out of the ink. Rays, Rows and Spiral
  // differ only in how that line is arranged inside a square frame.
  const TAU = 2 * Math.PI;
  const CENTER = 300, RADIUS = 260, AREA = 520; // 600 frame, 40 margin
  const palette = { paper: '#f8f5ec', ink: '#355c55', accent: '#a96736' };
  const studies = [
    { key: 'rays', name: 'Rays' },
    { key: 'rows', name: 'Rows' },
    { key: 'spiral', name: 'Spiral' }
  ];
  // Presentation constants. They set stroke, break and swell sizes; none of
  // them changes a length ratio.
  const style = {
    gapFraction: .45, gapMax: 4, gapMinUnit: 2,        // break = .45u capped at 4px, only when a letter is >= 2px
    strokeFactor: .55, strokeMin: .5, strokeMax: 1.8,  // stroke = clamp(.55 * local spacing, .5, 1.8)
    highlightFactor: 2, highlightMin: 2.4,
    rowPitch: 2.4,                                     // letter units between rows
    rayInner: .19, rayInnerMin: 24, rayInnerMax: 70,   // inner circle radius from verse count
    spiralTurnsDivisor: 16, spiralTurnsMin: 1.25, spiralTurnsMax: 40,
    spiralInner: .5, swell: .35, swellSlope: .2, swellWavelength: 24, minPaper: .8,
    chordTolerance: .08, sampleMin: 1, sampleMax: 4
  };
  const cache = new Map();
  const fmt = n => String(Number(n.toFixed(2)));
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const strokeFor = spacing => clamp(style.strokeFactor * spacing, style.strokeMin, style.strokeMax);
  const highlightFor = width => Math.max(style.highlightFactor * width, style.highlightMin);
  const gapFor = unit => unit >= style.gapMinUnit ? Math.min(style.gapMax, style.gapFraction * unit) : 0;
  const segment = (a, b) => `M${fmt(a.x)},${fmt(a.y)}L${fmt(b.x)},${fmt(b.y)}`;
  // Distances along a verse's line where each word's ink starts and ends.
  // Breaks are taken from the ink on both sides of a boundary, so the spans
  // still add up to exactly L * unit.
  function wordSpans(wordLengths, unit, gap) {
    if (!gap || wordLengths.length === 1) return [[0, wordLengths.reduce((a, b) => a + b, 0) * unit]];
    const spans = []; let position = 0; const last = wordLengths.length - 1;
    wordLengths.forEach((length, k) => {
      spans.push([position + (k > 0 ? gap / 2 : 0), position + length * unit - (k < last ? gap / 2 : 0)]);
      position += length * unit;
    });
    return spans;
  }

  function build(chapter) {
    if (cache.has(chapter)) {
      const value = cache.get(chapter); cache.delete(chapter); cache.set(chapter, value); return value;
    }
    if (!chapter || !chapter.verses || !chapter.verses.length) throw new Error('A chapter with numbered verses is required.');
    const V = chapter.verses.length;
    const lengths = chapter.verses.flatMap(v => v.word_lengths);
    const N = lengths.length;
    if (!N || lengths.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Word lengths must be positive finite numbers.');
    const S = lengths.reduce((a, b) => a + b, 0);
    const mean = S / N;
    const sd = Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / N);
    const records = chapter.verses.map(verse => {
      const W = verse.word_lengths.length, L = verse.word_lengths.reduce((a, b) => a + b, 0);
      const verseMean = L / W;
      const verseSd = Math.sqrt(verse.word_lengths.reduce((a, n) => a + (n - verseMean) ** 2, 0) / W);
      return { ...verse, W, L, mean: verseMean, sd: verseSd };
    });
    const Lmax = Math.max(...records.map(r => r.L));

    // Rays: one straight ray per verse from a small inner circle. Verse 1
    // points up; later verses follow counter-clockwise on screen.
    const r0 = clamp(style.rayInner * V, style.rayInnerMin, style.rayInnerMax);
    const rayUnit = (RADIUS - r0) / Lmax;
    const rayGap = gapFor(rayUnit);
    const raySpacing = TAU * r0 / V;
    const rayStroke = strokeFor(raySpacing);
    const rays = records.map((verse, i) => {
      const theta = Math.PI / 2 + TAU * i / V, dx = Math.cos(theta), dy = -Math.sin(theta);
      const at = distance => ({ x: CENTER + (r0 + distance) * dx, y: CENTER + (r0 + distance) * dy });
      return { d: wordSpans(verse.word_lengths, rayUnit, rayGap).map(([a, e]) => segment(at(a), at(e))).join(''), verse: verse.verse_number };
    });

    // Rows: one horizontal row per verse, stacked in order and aligned to the
    // right edge where reading begins. A uniform fit keeps every length ratio.
    const rowUnit = Math.min(AREA / Lmax, V > 1 ? AREA / (style.rowPitch * (V - 1)) : Infinity);
    const pitch = style.rowPitch * rowUnit;
    const rowGap = gapFor(rowUnit);
    const rowStroke = strokeFor(pitch);
    const right = CENTER + Lmax * rowUnit / 2, top = CENTER - (V - 1) * pitch / 2;
    const rows = records.map((verse, i) => {
      const y = top + i * pitch;
      return { d: wordSpans(verse.word_lengths, rowUnit, rowGap).map(([a, e]) => segment({ x: right - a, y }, { x: right - e, y })).join(''), verse: verse.verse_number };
    });

    // Spiral: the whole surah as one Archimedean spiral r = r0 + b*theta,
    // read from the centre outward, one letter per unit of arc. Turns grow
    // with the square root of the letter count so ink density stays even.
    const turns = clamp(Math.sqrt(S / style.spiralTurnsDivisor), style.spiralTurnsMin, style.spiralTurnsMax);
    const p = (RADIUS - style.strokeMax / 2) / (turns + style.spiralInner + style.swell);
    const inner = style.spiralInner * p, b = p / TAU, outer = inner + p * turns;
    const spiralStroke = strokeFor(p);
    const arcLength = r => (r * Math.hypot(r, b) + b * b * Math.asinh(r / b)) / (2 * b); // exact, for r = b*theta
    const arcStart = arcLength(inner);
    const length = arcLength(outer) - arcStart;
    const spiralUnit = length / S;
    const spiralGap = gapFor(spiralUnit);
    const amplitude = Math.max(0, Math.min(style.swell * p, (p - spiralStroke - style.minPaper) / 2));
    const radiusAt = s => {
      let r = Math.sqrt(inner * inner + 2 * b * s);
      for (let k = 0; k < 3; k++) r -= (arcLength(r) - arcStart - s) * b / Math.hypot(r, b);
      return r;
    };
    const point = (s, offset) => {
      const r = radiusAt(s), theta = Math.PI / 2 + (r - inner) / b, radius = r + offset;
      return { x: CENTER + radius * Math.cos(theta), y: CENTER - radius * Math.sin(theta) };
    };
    // Swell: a word longer than the surah's average pushes the line outward,
    // a shorter word pulls it inward. Each push is a sin^2 bump centred on
    // the word and at least `swellWavelength` px wide, weighted by the share
    // of that window the word occupies, so dense surahs undulate slowly
    // instead of vibrating. The summed offset is soft-clamped to `amplitude`,
    // which keeps adjacent turns apart.
    const offsets = new Float64Array(Math.ceil(length) + 2);
    if (sd > 1e-12 && amplitude > 0) {
      let at = 0;
      for (const wordLength of lengths) {
        const arc = wordLength * spiralUnit, wave = Math.max(arc, style.swellWavelength);
        const peak = Math.tanh((wordLength - mean) / sd) * Math.min(amplitude, style.swellSlope * wave) * (arc / wave);
        const from = at + (arc - wave) / 2;
        for (let i = Math.max(0, Math.ceil(from)), stop = Math.min(offsets.length - 1, Math.floor(from + wave)); i <= stop; i++) offsets[i] += peak * Math.sin(Math.PI * (i - from) / wave) ** 2;
        at += arc;
      }
      for (let i = 0; i < offsets.length; i++) offsets[i] = amplitude * Math.tanh(offsets[i] / amplitude);
    }
    const offsetAt = s => {
      const i = Math.min(offsets.length - 2, Math.max(0, Math.floor(s))), f = s - i;
      return offsets[i] * (1 - f) + offsets[i + 1] * f;
    };
    let position = 0;
    const spiral = records.map(verse => {
      let d = '';
      const last = verse.word_lengths.length - 1;
      verse.word_lengths.forEach((wordLength, k) => {
        const start = position, arc = wordLength * spiralUnit;
        const from = start + (spiralGap && k > 0 ? spiralGap / 2 : 0);
        const to = start + arc - (spiralGap && k < last ? spiralGap / 2 : 0);
        let s = from, first = spiralGap ? true : k === 0;
        for (;;) {
          const q = point(s, offsetAt(s));
          d += (first ? 'M' : 'L') + fmt(q.x) + ',' + fmt(q.y);
          first = false;
          if (s >= to - 1e-9) break;
          s = Math.min(to, s + clamp(Math.sqrt(8 * radiusAt(s) * style.chordTolerance), style.sampleMin, style.sampleMax));
        }
        position = start + arc;
      });
      return { d, verse: verse.verse_number };
    });

    const result = {
      records, lengths, mean, sd, N, S, rays, rows, spiral,
      studies: {
        rays: { u: rayUnit, r0, gap: rayGap, spacing: raySpacing, stroke: rayStroke, highlight: highlightFor(rayStroke), Lmax },
        rows: { u: rowUnit, pitch, gap: rowGap, stroke: rowStroke, highlight: highlightFor(rowStroke), right, top, Lmax },
        spiral: { u: spiralUnit, n: turns, p, r0: inner, b, R: outer, length, gap: spiralGap, stroke: spiralStroke, highlight: highlightFor(spiralStroke), amplitude }
      }
    };
    cache.set(chapter, result);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return result;
  }

  const mappings = {
    rays: 'theta_i = pi/2 + 2pi(i-1)/V counter-clockwise on screen; ray from r0 = clamp(.19V, 24, 70) with length L*u, u = (260 - r0)/Lmax',
    rows: 'row i at y = top + 2.4u(i-1), right-aligned, length L*u, u = min(520/Lmax, 520/(2.4(V-1)))',
    spiral: 'r = r0 + p*theta/2pi from the centre outward, one letter per unit of arc; n = clamp(sqrt(S/16), 1.25, 40); p = (260 - .9)/(n + .85); r0 = .5p; swell = A*tanh((l - mu)/sigma)*sin^2(pi t), A <= .35p'
  };
  const round = values => Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v.toFixed(4))]));

  function markup(chapter, kind, options = {}) {
    const study = studies.find(s => s.key === kind);
    if (!study) throw new Error('Unknown artwork method.');
    const g = build(chapter);
    const values = g.studies[kind];
    const selected = Number(options.selected || 0);
    const hasSelection = Number.isInteger(selected) && selected >= 1 && selected <= g.records.length;
    const colors = Object.assign({}, palette, options.palette || {});
    const metadata = {
      surah: chapter.id, name: chapter.name, method: study.name, words: g.N, letters: g.S, selectedVerse: hasSelection ? `${chapter.id}:${selected}` : null,
      rule: 'one letter is one unit of line; word boundaries are breaks of .45u (max 4px) carved from the ink, drawn only when u >= 2px; frame 600 with 40px margin',
      mapping: mappings[kind], values: round(values),
      source: 'https://api.quran.com/api/v4/quran/verses/uthmani', counting: 'Unicode whitespace words; Unicode L letters except U+0640/U+06E5/U+06E6; no normalization'
    };
    let content = options.background === false ? '' : `<rect width="600" height="600" fill="${colors.paper}"/>`;
    content += `<g fill="none" stroke="${colors.ink}" stroke-width="${fmt(values.stroke)}" stroke-linecap="butt" stroke-linejoin="round">`;
    for (const path of g[kind]) content += `<path d="${path.d}" data-verse="${path.verse}"/>`;
    if (hasSelection) {
      const path = g[kind][selected - 1];
      content += `<path d="${path.d}" stroke="${colors.accent}" stroke-width="${fmt(values.highlight)}" data-verse="${path.verse}"/>`;
    }
    content += '</g>';
    const label = `${chapter.name} — ${study.name}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 600 600" role="img" aria-label="${escape(label)}"><title>${escape(label)}</title><desc>${escape(`${study.name} generated from all ${g.N} written words in surah ${chapter.id}.${hasSelection ? ` Verse ${selected} highlighted.` : ''}`)}</desc><metadata>${escape(JSON.stringify(metadata))}</metadata>${content}</svg>`;
  }
  return { build, markup, studies, palette, style };
});
