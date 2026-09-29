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

    // Fourier Bloom: low spatial frequencies of the standardized word sequence.
    const K = Math.min(12, Math.floor((N - 1) / 2));
    const coefficients = [];
    for (let k = 1; k <= K; k++) {
      let re = 0, im = 0;
      if (sd > 1e-12) for (let j = 0; j < N; j++) {
        const u = (lengths[j] - mean) / sd, phase = TAU * k * j / N;
        re += u * Math.cos(phase) / N; im -= u * Math.sin(phase) / N;
      }
      coefficients.push({ k, re, im, magnitude: Math.hypot(re, im) });
    }
    const B = 2 * coefficients.reduce((sum, c) => sum + c.magnitude, 0);
    function bloomRadius(theta, modes = K) {
      if (B < 1e-12) return 100;
      let value = 0;
      for (let i = 0; i < modes; i++) { const c = coefficients[i]; value += 2 * (c.re * Math.cos(c.k * theta) - c.im * Math.sin(c.k * theta)); }
      return 100 * (1 + .7 * value / B);
    }
    function rawBloomPoint(theta, modes = K) { const r = bloomRadius(theta, modes); return { x: r * Math.cos(theta), y: r * Math.sin(theta) }; }
    const bloomBounds = bounds();
    const bloomSamples = 1440;
    const partials = [];
    for (let modes = 1; modes < K; modes++) {
      partials.push(Array.from({ length: bloomSamples + 1 }, (_, i) => { const p = rawBloomPoint(TAU * i / bloomSamples, modes); include(bloomBounds, p); return p; }));
    }
    const bloomContour = Array.from({ length: bloomSamples + 1 }, (_, i) => { const p = rawBloomPoint(TAU * i / bloomSamples); include(bloomBounds, p); return p; });
    const bloomFit = fit(bloomBounds, true);
    const bloomPoint = theta => bloomFit.point(rawBloomPoint(theta));
    const bloomSegment = (startAngle, endAngle) => {
      const steps = Math.max(2, Math.ceil(Math.abs(endAngle - startAngle) / TAU * bloomSamples));
      return polyline(Array.from({ length: steps + 1 }, (_, i) => bloomPoint(startAngle + (endAngle - startAngle) * i / steps)));
    };
    const bloomPath = polyline(bloomContour.map(bloomFit.point), true);
    const bloomLayers = partials.map((points, i) => ({ d: polyline(points.map(bloomFit.point), true), modes: i + 1 }));
    const result = { records, lengths, mean, sd, shellPaths, currentPaths, bloomPath, bloomLayers, bloomPoint, bloomSegment, bloomRadius, wordStarts, N, K, B, coefficients, currentEnd: position, currentHeading: heading, currentArcs, verseArcs, currentBounds, currentFit, shellBounds, shellFit, bloomBounds, bloomFit };
    cache.set(chapter, result);
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    return result;
  }

  function markup(chapter, kind, options = {}) {
    if (!['shell', 'current', 'bloom'].includes(kind)) throw new Error('Unknown artwork method.');
    const g = build(chapter);
    const selected = Number(options.selected || 0);
    const hasSelection = selected >= 1 && selected <= g.records.length;
    const label = { shell: 'Verse Shell', current: 'Word Current', bloom: 'Fourier Bloom' }[kind];
    const metadata = { surah: chapter.id, name: chapter.name, method: label, words: g.N, letters: g.lengths.reduce((a, b) => a + b, 0), selectedVerse: hasSelection ? `${chapter.id}:${selected}` : null,
      mapping: kind === 'shell' ? 'R=40+2L; A=.25*sigma/(mu+sigma); r=R(1+A*cos(W*theta)); phi=2*pi*(i-1)/V; z=12*(i-1); projection=(x,.42*y-.907*(z-6*(V-1)))' : kind === 'current' ? 's=10*length; delta=(3*pi/4)*tanh((length-globalMean)/globalSD); exact circular arcs in word order from (0,0), heading 0; zero SD gives straight lines' : 'u=(length-globalMean)/globalSD; c_k=mean(u_j*exp(-2*pi*i*k*j/N)); K=min(12,floor((N-1)/2)); f=2*Re(sum(c_k*exp(i*k*theta))); B=2*sum(abs(c_k)); r=100*(1+.7*f/B); zero B gives circle; faint contours are partial sums with the full B',
      source: 'https://api.quran.com/api/v4/quran/verses/uthmani', counting: 'Unicode whitespace words; Unicode L letters except U+0640/U+06E5/U+06E6; no normalization' };
    let content = options.background === false ? '' : '<rect width="600" height="480" fill="#f8f5ec"/>';
    content += '<g fill="none" stroke-linecap="round" stroke-linejoin="round">';
    const path = (d, stroke, width, opacity, verse) => `<path d="${d}" stroke="${stroke}" stroke-width="${width}" stroke-opacity="${opacity}"${verse ? ` data-verse="${verse}"` : ''}/>`;
    if (kind === 'bloom') {
      for (const layer of g.bloomLayers) content += path(layer.d, '#355c55', .8, .18);
      content += path(g.bloomPath, '#355c55', 1.8, .88);
      if (hasSelection) content += path(g.bloomSegment(TAU * g.wordStarts[selected - 1] / g.N, TAU * g.wordStarts[selected] / g.N), '#a96736', 3.2, 1, selected);
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
