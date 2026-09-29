(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.QuranGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = 2 * Math.PI;
  const HALF_PI = Math.PI / 2;
  const cache = new Map();
  const fmt = n => String(Number(n.toFixed(3)));
  const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
  const bounds = () => ({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  function include(b, p) {
    b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x);
    b.minY = Math.min(b.minY, p.y); b.maxY = Math.max(b.maxY, p.y);
  }
  function fit(b, invertY = false) {
    const width = b.maxX - b.minX, height = b.maxY - b.minY;
    const scale = Math.min(width > 1e-12 ? 520 / width : Infinity, height > 1e-12 ? 420 / height : Infinity);
    const actualScale = Number.isFinite(scale) ? scale : 1;
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    return { scale: actualScale, point: p => ({ x: 300 + (p.x - cx) * actualScale, y: 240 + (invertY ? -1 : 1) * (p.y - cy) * actualScale }) };
  }
  function polyline(points, close = false) {
    return points.map((p, i) => `${i ? 'L' : 'M'}${fmt(p.x)},${fmt(p.y)}`).join(' ') + (close ? ' Z' : '');
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
    const mean = lengths.reduce((a, b) => a + b, 0) / N;
    const sd = Math.sqrt(lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / N);
    const records = chapter.verses.map((verse, index) => {
      const W = verse.word_lengths.length, L = verse.word_lengths.reduce((a, b) => a + b, 0);
      const mean = L / W;
      const sd = Math.sqrt(verse.word_lengths.reduce((a, n) => a + (n - mean) ** 2, 0) / W);
      return { ...verse, W, L, mean, sd, R: 40 + 2 * L, A: .25 * sd / (mean + sd), phi: TAU * index / V, z: 12 * index };
    });

    // Verse Shell: verse statistics create rippled rings in a tilted stack.
    const shellBounds = bounds();
    const contours = records.map(verse => {
      const steps = Math.max(720, 12 * verse.W);
      return Array.from({ length: steps + 1 }, (_, i) => {
        const theta = TAU * i / steps;
        const r = verse.R * (1 + verse.A * Math.cos(verse.W * theta));
        const p = { x: r * Math.cos(theta + verse.phi), y: .42 * r * Math.sin(theta + verse.phi) - .907 * (verse.z - 6 * (V - 1)) };
        include(shellBounds, p); return p;
      });
    });
    const shellFit = fit(shellBounds);
    const shellPaths = contours.map((points, i) => ({ d: polyline(points.map(shellFit.point), true), verse: records[i].verse_number }));

    // Word Current: exact circular arcs preserve reading order and tangency.
    let position = { x: 0, y: 0 }, heading = 0;
    const currentBounds = bounds(); include(currentBounds, position);
    const currentArcs = [], wordStarts = [0];
    const verseArcs = records.map(verse => {
      const arcs = verse.word_lengths.map((length, index) => {
        const s = 10 * length;
        const delta = sd > 1e-12 ? 3 * Math.PI / 4 * Math.tanh((length - mean) / sd) : 0;
        const start = { ...position }, h = heading;
        const pointAt = t => Math.abs(delta) < 1e-12
          ? { x: start.x + t * s * Math.cos(h), y: start.y + t * s * Math.sin(h) }
          : { x: start.x + s / delta * (Math.sin(h + t * delta) - Math.sin(h)), y: start.y + s / delta * (Math.cos(h) - Math.cos(h + t * delta)) };
        const end = pointAt(1);
        const arc = { verse: verse.verse_number, word: index + 1, length, s, delta, h, start, end, pointAt };
        include(currentBounds, start); include(currentBounds, end);
        if (Math.abs(delta) >= 1e-12) {
          const low = Math.min(h, h + delta), high = Math.max(h, h + delta);
          for (let n = Math.ceil(low / HALF_PI); n <= Math.floor(high / HALF_PI); n++) include(currentBounds, pointAt((n * HALF_PI - h) / delta));
        }
        position = end; heading += delta; currentArcs.push(arc); return arc;
      });
      wordStarts.push(currentArcs.length); return arcs;
    });
    const currentFit = fit(currentBounds, true);
    const currentPaths = verseArcs.map((arcs, i) => {
      const start = currentFit.point(arcs[0].start);
      const d = `M${fmt(start.x)},${fmt(start.y)} ` + arcs.map(arc => {
        const end = currentFit.point(arc.end);
        if (Math.abs(arc.delta) < 1e-12) return `L${fmt(end.x)},${fmt(end.y)}`;
        const r = Math.abs(arc.s / arc.delta) * currentFit.scale;
        return `A${fmt(r)},${fmt(r)} 0 0 ${arc.delta > 0 ? 0 : 1} ${fmt(end.x)},${fmt(end.y)}`;
      }).join(' ');
      return { d, verse: records[i].verse_number };
    });

    // Verse Lines: centered line lengths directly encode each verse's letters.
    const lineBounds = bounds();
    const lineEndpoints = records.map((verse, i) => {
      const start = { x: -3 * verse.L, y: 12 * i };
      const end = { x: 3 * verse.L, y: 12 * i };
      include(lineBounds, start); include(lineBounds, end);
      return { start, end };
    });
    const lineFit = fit(lineBounds);
    const lineSpacing = 12 * lineFit.scale;
    const lineWidth = Math.max(.45, Math.min(1.6, .65 * lineSpacing));
    const lineRows = lineEndpoints.map((row, i) => ({
      d: polyline([lineFit.point(row.start), lineFit.point(row.end)]), verse: records[i].verse_number
    }));
    // Word boundaries are decorative one-pixel breaks, shown only where the
    // words on both sides are at least three SVG pixels wide after fitting.
    const lineTicks = records.map((verse, i) => {
      let cumulative = 0;
      const segments = [];
      for (let word = 0; word < verse.word_lengths.length - 1; word++) {
        cumulative += verse.word_lengths[word];
        if (6 * Math.min(verse.word_lengths[word], verse.word_lengths[word + 1]) * lineFit.scale < 3) continue;
        const p = lineFit.point({ x: -3 * verse.L + 6 * cumulative, y: 12 * i });
        const halfHeight = (lineWidth + 1.4) / 2;
        segments.push(`M${fmt(p.x)},${fmt(p.y - halfHeight)} L${fmt(p.x)},${fmt(p.y + halfHeight)}`);
      }
      return { d: segments.join(' '), verse: verse.verse_number };
    });
    const result = { records, lengths, mean, sd, shellPaths, currentPaths, lineRows, lineTicks, lineEndpoints, lineBounds, lineFit, lineSpacing, lineWidth, wordStarts, N, currentEnd: position, currentHeading: heading, currentArcs, verseArcs, currentBounds, currentFit, shellBounds, shellFit };
    cache.set(chapter, result);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return result;
  }

  function markup(chapter, kind, options = {}) {
    if (!['shell', 'current', 'lines'].includes(kind)) throw new Error('Unknown artwork method.');
    const g = build(chapter);
    const selected = Number(options.selected || 0);
    const hasSelection = selected >= 1 && selected <= g.records.length;
    const label = { shell: 'Verse Shell', current: 'Word Current', lines: 'Verse Lines' }[kind];
    const metadata = { surah: chapter.id, name: chapter.name, method: label, words: g.N, letters: g.lengths.reduce((a, b) => a + b, 0), selectedVerse: hasSelection ? `${chapter.id}:${selected}` : null,
      mapping: kind === 'shell' ? 'R=40+2L; A=.25*sigma/(mu+sigma); r=R(1+A*cos(W*theta)); phi=2*pi*(i-1)/V; z=12*(i-1); projection=(x,.42*y-.907*(z-6*(V-1)))' : kind === 'current' ? 's=10*length; delta=(3*pi/4)*tanh((length-globalMean)/globalSD); exact circular arcs in word order from (0,0), heading 0; zero SD gives straight lines' : 'For verse index i starting at 0, L=sum(word lengths); centered endpoints=(-3L,12i),(+3L,12i), so length=6L; uniformly fit all endpoints into [40,560]x[30,450], retaining length ratios; row stroke width=max(.45,min(1.6,.65*12*fitScale)); word boundaries at x=-3L+6*cumulativeWordLength are decorative paper-color breaks of width1 and height(rowStrokeWidth+1.4), drawn only when both neighboring words are at least3 SVG pixels wide; highlight selected verse in copper with width2.5; one verse remains a centered horizontal line',
      source: 'https://api.quran.com/api/v4/quran/verses/uthmani', counting: 'Unicode whitespace words; Unicode L letters except U+0640/U+06E5/U+06E6; no normalization' };
    let content = options.background === false ? '' : '<rect width="600" height="480" fill="#f8f5ec"/>';
    content += '<g fill="none" stroke-linecap="round" stroke-linejoin="round">';
    const path = (d, stroke, width, opacity, verse) => `<path d="${d}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"${verse ? ` data-verse="${verse}"` : ''}/>`;
    if (kind === 'lines') {
      for (const row of g.lineRows) content += path(row.d, '#355c55', g.lineWidth, .78, row.verse);
      for (const tick of g.lineTicks) if (tick.d) content += path(tick.d, '#f8f5ec', 1, 1, tick.verse);
      if (hasSelection) content += path(g.lineRows[selected - 1].d, '#a96736', 2.5, 1, selected);
    } else {
      const paths = kind === 'shell' ? g.shellPaths : g.currentPaths;
      for (const p of paths) content += path(p.d, '#355c55', kind === 'shell' ? 1.05 : 1.6, kind === 'shell' ? .58 : .78, p.verse);
      if (hasSelection) { const active = paths[selected - 1]; content += path(active.d, '#a96736', kind === 'shell' ? 2.8 : 3.5, 1, selected); }
    }
    content += '</g>';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="960" viewBox="0 0 600 480" role="img" aria-label="${escape(`${chapter.name} — ${label}`)}"><title>${escape(`${chapter.name} — ${label}`)}</title><desc>${escape(`${label} generated from all ${g.N} written words in surah ${chapter.id}.${hasSelection ? ` Verse ${selected} highlighted.` : ''}`)}</desc><metadata>${escape(JSON.stringify(metadata))}</metadata>${content}</svg>`;
  }
  return { build, markup };
});
