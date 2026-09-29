import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import geometry from '../projects/quran-art/geometry.js';

// One rule, three arrangements: one letter is one unit of line, every word
// boundary is a carved break. Expected values below are derived by hand from
// the spec (frame 600, margin 40, radius 260), never from the module.
const { chapters } = JSON.parse(readFileSync(new URL('../projects/quran-art/data/surahs.json', import.meta.url), 'utf8'));
const chapter = id => chapters[id - 1];
const STUDIES = ['rays', 'rows', 'spiral'];
const PATH = /^(?:M-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?(?:L-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?)+)+$/;
const points = d => [...d.matchAll(/[ML](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map(m => ({ x: Number(m[1]), y: Number(m[2]) }));
const subpaths = d => d.split('M').filter(Boolean).map(s => points('M' + s));
const span = d => { const p = points(d); return Math.hypot(p.at(-1).x - p[0].x, p.at(-1).y - p[0].y); };
const ink = d => subpaths(d).reduce((sum, p) => sum + Math.hypot(p.at(-1).x - p[0].x, p.at(-1).y - p[0].y), 0);
const letters = id => chapter(id).verses.reduce((sum, v) => sum + v.letter_count, 0);
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);
// Unwrapped polar angle (counter-clockwise on screen) of every spiral point in reading order.
const spiralTrace = model => {
  const trace = []; let previous = null, unwrapped = 0;
  for (const { d } of model.spiral) for (const p of points(d)) {
    const angle = Math.atan2(300 - p.y, p.x - 300);
    if (previous !== null) { let delta = angle - previous; while (delta < -Math.PI) delta += 2 * Math.PI; while (delta > Math.PI) delta -= 2 * Math.PI; unwrapped += delta; trace.push({ ...p, delta, theta: unwrapped }); }
    else trace.push({ ...p, delta: 0, theta: 0 });
    previous = angle;
  }
  return trace;
};

// Al-Fatihah by hand: V = 7 → r0 = 24; longest verse 43 letters → rays u = 236/43 px per letter;
// rows u = min(520/43, 520/(2.4·6)) = 520/43; pitch = 2.4·520/43; verse 1 has 19 letters in 4 words.
const FATIHAH_RAY_UNIT = 236 / 43;
const FATIHAH_ROW_UNIT = 520 / 43;

test('every surah builds three finite studies inside the frame', () => {
  for (const c of chapters) {
    const model = geometry.build(c);
    for (const key of STUDIES) {
      const study = model.studies[key];
      for (const [name, value] of Object.entries(study)) assert.ok(Number.isFinite(value), `${c.id} ${key}.${name} is not finite`);
      const slack = study.stroke / 2 + .02;
      for (const { d } of model[key]) {
        assert.match(d, PATH, `${c.id} ${key} path syntax`);
        for (const p of points(d)) assert.ok(p.x >= 40 - slack && p.x <= 560 + slack && p.y >= 40 - slack && p.y <= 560 + slack, `${c.id} ${key}: (${p.x},${p.y}) leaves the 40px margin`);
      }
    }
  }
});

test('each study yields exactly one path per verse, numbered in reading order', () => {
  for (const c of chapters) {
    const model = geometry.build(c);
    for (const key of STUDIES) {
      assert.equal(model[key].length, c.verses.length, `${c.id} ${key}`);
      assert.deepEqual(model[key].map(p => p.verse), c.verses.map(v => v.verse_number), `${c.id} ${key} verse numbers`);
    }
  }
  const svg = geometry.markup(chapter(89), 'rows', { selected: 0 });
  assert.deepEqual([...svg.matchAll(/data-verse="(\d+)"/g)].map(m => Number(m[1])), Array.from({ length: 30 }, (_, i) => i + 1));
});

test('ray and row lengths are the letter count times one shared unit, with breaks carved from the ink', () => {
  const m = geometry.build(chapter(1));
  near(span(m.rays[6].d), 236, .03, 'Al-Fatihah verse 7 ray reaches the frame edge');
  near(span(m.rays[3].d), 11 * FATIHAH_RAY_UNIT, .03, 'Al-Fatihah verse 4 ray (11 letters)');
  near(span(m.rows[6].d), 520, .03, 'Al-Fatihah verse 7 row spans the content width');
  near(span(m.rows[0].d), 19 * FATIHAH_ROW_UNIT, .03, 'Al-Fatihah verse 1 row (19 letters)');
  near(ink(m.rays[0].d), 19 * FATIHAH_RAY_UNIT - 3 * .45 * FATIHAH_RAY_UNIT, .05, 'verse 1 ray ink = 19u − 3 breaks of 0.45u');
  near(ink(m.rows[0].d), 19 * FATIHAH_ROW_UNIT - 3 * 4, .05, 'verse 1 row ink = 19u − 3 breaks capped at 4px');
  const b = geometry.build(chapter(2));
  const expected = chapter(2).verses[281].letter_count / chapter(2).verses[254].letter_count;
  near(span(b.rays[281].d) / span(b.rays[254].d), expected, 2e-3, 'Al-Baqarah 282:255 ray ratio');
  near(span(b.rows[281].d) / span(b.rows[254].d), expected, 2e-3, 'Al-Baqarah 282:255 row ratio');
});

test('verse 1 points up, later verses follow counter-clockwise, rows start at the right edge', () => {
  const m = geometry.build(chapter(1));
  const tip1 = points(m.rays[0].d).at(-1);
  near(tip1.x, 300, .02, 'verse 1 tip x');
  near(tip1.y, 300 - (24 + 19 * FATIHAH_RAY_UNIT), .03, 'verse 1 tip y');
  const tip2 = points(m.rays[1].d).at(-1);
  assert.ok(tip2.x < 300 && tip2.y < 300, `verse 2 should land upper-left of centre, got (${tip2.x},${tip2.y})`);
  const row1 = points(m.rows[0].d);
  near(row1[0].x, 560, .02, 'row 1 begins at the right edge');
  near(row1.at(-1).x, 560 - 19 * FATIHAH_ROW_UNIT, .03, 'row 1 runs leftward');
  near(row1[0].y, 300 - 3 * 2.4 * FATIHAH_ROW_UNIT, .03, 'row 1 sits at the top of the centred block');
  const first = points(m.spiral[0].d)[0];
  near(first.x, 300, .02, 'spiral starts on the vertical axis');
  assert.ok(first.y < 300, 'spiral starts above the centre');
});

test('spiral turns grow with the square root of the letter count and clamp at 40', () => {
  for (const [id, turns] of [[108, Math.sqrt(letters(108) / 16)], [1, Math.sqrt(letters(1) / 16)], [2, 40]]) {
    const trace = spiralTrace(geometry.build(chapter(id)));
    near(trace.at(-1).theta / (2 * Math.PI), turns, .01, `surah ${id} turns`);
    const outer = Math.max(...trace.map(p => Math.hypot(p.x - 300, p.y - 300)));
    assert.ok(outer <= 260.02 && outer >= 208, `surah ${id} outer radius ${outer}`);
  }
});

test('spiral never turns back and stays within its swell band', () => {
  for (const id of [1, 2, 18, 108]) {
    const model = geometry.build(chapter(id)), s = model.studies.spiral;
    for (const p of spiralTrace(model)) {
      assert.ok(p.delta >= -5e-3, `surah ${id}: spiral turns back by ${p.delta} rad at (${p.x},${p.y})`);
      near(Math.hypot(p.x - 300, p.y - 300), s.r0 + s.b * p.theta, s.amplitude + .05, `surah ${id}: radius off the track at θ=${p.theta.toFixed(3)}`);
    }
    assert.ok(s.amplitude <= .35 * s.p + 1e-9 && s.amplitude <= (s.p - s.stroke - .8) / 2 + 1e-9, `surah ${id}: swell ${s.amplitude} too large for pitch ${s.p}`);
  }
});

test('markup lists one path per verse and appends the highlighted verse last', () => {
  const c = chapter(89), m = geometry.build(c);
  const svg = geometry.markup(c, 'rays', { selected: 3 });
  const paths = [...svg.matchAll(/<path [^>]*>/g)].map(x => x[0]);
  assert.equal(paths.length, 31, 'thirty verses plus one highlight');
  assert.match(paths.at(-1), /stroke="#a96736"/, 'highlight keeps the copper accent');
  assert.match(paths.at(-1), /data-verse="3"/);
  assert.match(paths.at(-1), /stroke-width="3.6"/, 'highlight is twice the 1.8 stroke');
  assert.ok(paths.at(-1).includes(`d="${m.rays[2].d}"`), 'highlight redraws verse 3 exactly');
  assert.equal([...geometry.markup(c, 'rays', { selected: 0 }).matchAll(/<path /g)].length, 30);
  assert.match(svg, /viewBox="0 0 600 600"/);
  assert.match(svg, /width="1200" height="1200"/);
  assert.match(svg, /stroke-linecap="butt"/);
  assert.match(svg, /<rect width="600" height="600" fill="#f8f5ec"\/>/, 'paper stays cream');
  assert.doesNotMatch(geometry.markup(c, 'rows', { background: false }), /<rect/);
  assert.match(svg, /aria-label="Al-Fajr — Rays"/);
  assert.throws(() => geometry.markup(c, 'shell'), /Unknown/);
});

test('word breaks appear only when a letter is at least two pixels wide', () => {
  for (const c of chapters) {
    const model = geometry.build(c);
    for (const key of STUDIES) {
      const { u, gap } = model.studies[key];
      if (u < 2) assert.equal(gap, 0, `${c.id} ${key}: u=${u} must hide breaks`);
      else assert.ok(gap > 0 && gap <= .45 * u + 1e-9 && gap <= 4 + 1e-9, `${c.id} ${key}: gap ${gap} for u ${u}`);
    }
  }
  const fatihah = geometry.build(chapter(1)), baqarah = geometry.build(chapter(2));
  assert.equal(subpaths(fatihah.rays[0].d).length, 4, 'Al-Fatihah 1:1 draws four words');
  assert.equal(subpaths(fatihah.spiral[0].d).length, 4, 'Al-Fatihah 1:1 spiral draws four words');
  assert.equal(subpaths(baqarah.rays[281].d).length, 1, 'Al-Baqarah 2:282 is one stroke when letters are under 2px');
  assert.equal(subpaths(baqarah.spiral[281].d).length, 1, 'Al-Baqarah 2:282 spiral is one continuous sub-path');
});
